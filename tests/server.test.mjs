import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { startGuitoServer } from '../bin/guito-server.js';

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'guito-test-'));
  execFileSync('git', ['init'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Guito Test'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'guito@example.test'], { cwd: directory });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Initial commit'], {
    cwd: directory,
    stdio: 'ignore',
  });
  return directory;
}

test('starts on a random port and targets the configured repository', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/repo`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(resolve(body.root), resolve(repositoryPath));

  await server.close();
  await assert.rejects(fetch(`${server.address}/api/repo`));
});

test('protects extension API requests and archive downloads with a token', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const apiToken = 'test-session-token';

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    apiToken,
  });
  context.after(() => server.close());

  assert.equal((await fetch(`${server.address}/api/repo`)).status, 401);
  assert.equal(
    (
      await fetch(`${server.address}/api/repo`, {
        headers: { 'X-Guito-Token': apiToken },
      })
    ).status,
    200,
  );
  assert.equal((await fetch(`${server.address}/api/archive?ref=HEAD`)).status, 401);

  const archive = await fetch(
    `${server.address}/api/archive?ref=HEAD&guitoToken=${encodeURIComponent(apiToken)}`,
  );
  assert.equal(archive.status, 200);
  assert.equal(archive.headers.get('content-type'), 'application/zip');
});

test('returns commits in pages with a total count', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  for (const message of ['Second commit', 'Third commit']) {
    execFileSync('git', ['commit', '--allow-empty', '-m', message], {
      cwd: repositoryPath,
      stdio: 'ignore',
    });
  }

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const all = await (await fetch(`${server.address}/api/commits`)).json();
  assert.equal(all.total, 3);
  assert.equal(all.commits.length, 3);
  assert.equal(all.commits[0].message, 'Third commit');

  const firstPage = await (await fetch(`${server.address}/api/commits?limit=2`)).json();
  assert.equal(firstPage.total, 3);
  assert.equal(firstPage.commits.length, 2);
  assert.equal(firstPage.commits[0].message, 'Third commit');

  const lastPage = await (await fetch(`${server.address}/api/commits?limit=2&skip=2`)).json();
  assert.equal(lastPage.total, 3);
  assert.equal(lastPage.commits.length, 1);
  assert.equal(lastPage.commits[0].message, 'Initial commit');

  // Commits on unmerged branches are part of the history too.
  execFileSync('git', ['checkout', '-b', 'feature'], { cwd: repositoryPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Feature commit'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', '-'], { cwd: repositoryPath, stdio: 'ignore' });

  const withBranch = await (await fetch(`${server.address}/api/commits`)).json();
  assert.equal(withBranch.total, 4);
  assert.ok(withBranch.commits.some((commit) => commit.message === 'Feature commit'));
});

test('serves large compressed responses without truncation', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  // Long subjects keep the response large now that the list payload omits
  // commit bodies, pushing it past the synchronous compression threshold so
  // the streaming compression path is exercised.
  const filler = 'x'.repeat(4096);
  for (let index = 0; index < 20; index++) {
    execFileSync('git', ['commit', '--allow-empty', '-m', `Commit ${index} ${filler}`], {
      cwd: repositoryPath,
      stdio: 'ignore',
    });
  }

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/commits`, {
    headers: { 'accept-encoding': 'gzip' },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.total, 21);
  assert.equal(result.commits.length, 21);
});

test('omits commit bodies from the list and serves them on demand', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  execFileSync(
    'git',
    [
      'commit',
      '--allow-empty',
      '-m',
      'Fix session handling',
      '-m',
      'The session cookie expired too early for some users.',
    ],
    { cwd: repositoryPath, stdio: 'ignore' },
  );

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  // The list payload leaves the body out entirely.
  const list = await (await fetch(`${server.address}/api/commits`)).json();
  const listed = list.commits.find((commit) => commit.message === 'Fix session handling');
  assert.ok(listed, 'expected the commit to be listed');
  assert.equal('body' in listed, false);

  // The detail endpoint returns the full commit including the body.
  const detailResponse = await fetch(`${server.address}/api/commit/detail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hash: listed.hash }),
  });
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.hash, listed.hash);
  assert.equal(detail.message, 'Fix session handling');
  assert.ok(detail.body.includes('session cookie expired too early'));
  assert.equal(detail.parents.length, 1);

  // Body search runs on the server since bodies are not part of the list.
  const search = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('session cookie expired')}`,
    )
  ).json();
  assert.deepEqual(search.hashes, [listed.hash]);

  const noMatch = await (
    await fetch(`${server.address}/api/commits/search?query=nothing-matches-this`)
  ).json();
  assert.deepEqual(noMatch.hashes, []);

  const emptyQuery = await (await fetch(`${server.address}/api/commits/search`)).json();
  assert.deepEqual(emptyQuery.hashes, []);
});

test('returns an empty history for repositories without commits', async (context) => {
  const repositoryPath = await mkdtemp(join(tmpdir(), 'guito-test-'));
  execFileSync('git', ['init'], { cwd: repositoryPath, stdio: 'ignore' });
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/commits`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { commits: [], total: 0 });
});

test('renames and deletes branches through the API', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  execFileSync('git', ['branch', 'feature'], { cwd: repositoryPath, stdio: 'ignore' });

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const listBranches = (pattern) =>
    execFileSync('git', ['branch', '--list', pattern], { cwd: repositoryPath }).toString().trim();

  // Renaming a local branch moves it.
  const renamed = await fetch(`${server.address}/api/branch/rename`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ oldName: 'feature', newName: 'renamed-feature' }),
  });
  assert.equal(renamed.status, 200);
  assert.ok(listBranches('renamed-feature').includes('renamed-feature'));
  assert.equal(listBranches('feature'), '');

  // Deleting the checked-out branch is rejected with a JSON error.
  const currentBranch = execFileSync('git', ['branch', '--show-current'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  const current = await fetch(`${server.address}/api/branch/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: currentBranch }),
  });
  assert.equal(current.status, 400);
  assert.ok((await current.json()).error);

  // Deleting an existing local branch removes it.
  const deleted = await fetch(`${server.address}/api/branch/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'renamed-feature' }),
  });
  assert.equal(deleted.status, 200);
  assert.equal(listBranches('renamed-feature'), '');

  // Deleting a missing branch fails with a JSON error.
  const missing = await fetch(`${server.address}/api/branch/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'no-such-branch' }),
  });
  assert.equal(missing.status, 400);
  assert.ok((await missing.json()).error);
});

test('resets the current branch with the requested mode', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const file = join(repositoryPath, 'file.txt');
  await (await import('node:fs/promises')).writeFile(file, 'content\n');
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Add file'], { cwd: repositoryPath, stdio: 'ignore' });

  const firstCommit = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const reset = (mode) =>
    fetch(`${server.address}/api/reset-commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commit: firstCommit, mode }),
    });

  const status = () =>
    execFileSync('git', ['status', '--porcelain'], { cwd: repositoryPath }).toString().trim();
  const headCommit = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryPath }).toString().trim();

  // Soft keeps the changes staged.
  assert.equal((await reset('soft')).status, 200);
  assert.equal(headCommit(), firstCommit);
  assert.equal(status(), 'A  file.txt');

  // Mixed keeps the changes but unstages them.
  assert.equal((await reset('mixed')).status, 200);
  assert.equal(headCommit(), firstCommit);
  assert.equal(status(), '?? file.txt');

  // Hard discards the changes; the file is staged again first because a hard
  // reset leaves untracked files alone.
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath, stdio: 'ignore' });
  assert.equal((await reset('hard')).status, 200);
  assert.equal(headCommit(), firstCommit);
  assert.equal(status(), '');

  // An unknown mode falls back to a hard reset.
  await (await import('node:fs/promises')).writeFile(file, 'more\n');
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Add file again'], { cwd: repositoryPath, stdio: 'ignore' });
  assert.equal((await reset('nonsense')).status, 200);
  assert.equal(headCommit(), firstCommit);
  assert.equal(status(), '');
});

test('deletes and pushes tags through the API', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const remotePath = await mkdtemp(join(tmpdir(), 'guito-remote-'));
  context.after(() => rm(remotePath, { recursive: true, force: true }));
  execFileSync('git', ['init', '--bare'], { cwd: remotePath, stdio: 'ignore' });
  execFileSync('git', ['remote', 'add', 'origin', remotePath], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const listTags = () =>
    execFileSync('git', ['tag', '--list'], { cwd: repositoryPath }).toString().trim();
  const remoteTags = () =>
    execFileSync('git', ['--git-dir', remotePath, 'tag', '--list'], { cwd: remotePath })
      .toString()
      .trim();

  execFileSync('git', ['tag', 'v1.0.0'], { cwd: repositoryPath, stdio: 'ignore' });

  // Deleting a tag removes it.
  const deleted = await fetch(`${server.address}/api/tag/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'v1.0.0' }),
  });
  assert.equal(deleted.status, 200);
  assert.equal(listTags(), '');

  // Pushing a tag uploads it to the remote.
  execFileSync('git', ['tag', 'v1.0.0'], { cwd: repositoryPath, stdio: 'ignore' });
  const pushed = await fetch(`${server.address}/api/tag/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'v1.0.0' }),
  });
  assert.equal(pushed.status, 200);
  assert.equal(remoteTags(), 'v1.0.0');

  // Pushing a missing tag fails with a JSON error.
  const missing = await fetch(`${server.address}/api/tag/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'no-such-tag' }),
  });
  assert.equal(missing.status, 400);
  assert.ok((await missing.json()).error);
});
