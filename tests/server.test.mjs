import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  buildAzurePullRequestUrl,
  formatPrBranchName,
  parseAzureRemoteUrl,
  startGuitoServer,
} from '../bin/guito-server.js';

test('formats automatic pull request branch names with safe template variables', () => {
  assert.equal(
    formatPrBranchName(
      'users/${username}/${repository}/${branch}/${targetbranch}/${title}/${date}/${time}/${timestamp}/${randomstring}',
      {
        username: 'Dani Smith',
        repository: 'Guito App',
        branch: 'feature/new UI',
        targetbranch: 'release/next',
        title: 'Add settings UI',
        date: '2026-09-12',
        time: '214530',
        timestamp: '1789250000000',
        randomstring: 'a1b2c3',
      },
    ),
    'users/Dani-Smith/Guito-App/feature/new-UI/release/next/Add-settings-UI/2026-09-12/214530/1789250000000/a1b2c3',
  );
  assert.throws(
    () =>
      formatPrBranchName('${unknown}', {
        username: 'dani',
        repository: 'Guito',
        branch: 'main',
        targetbranch: 'main',
        title: 'PR',
        date: '2026-09-12',
        time: '214530',
        timestamp: '1789250000000',
        randomstring: 'a1b2c3',
      }),
    /Unknown pull request branch variable \$\{unknown\}/,
  );
});

function assertSettings(actual, expected) {
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
}

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'guito-test-'));
  execFileSync('git', ['init'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Guito Test'], {
    cwd: directory,
  });
  execFileSync('git', ['config', 'user.email', 'guito@example.test'], {
    cwd: directory,
  });
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

test('settles extension responses when error logging is enabled', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const logs = [];

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    apiToken: 'test-session-token',
    onLog: (line) => logs.push(line),
  });
  context.after(() => server.close());

  const page = await fetch(server.address, {
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(page.status, 200);

  const unauthorized = await fetch(`${server.address}/api/repo`, {
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(logs, ['GET /api/repo -> 401 {"error":"unauthorized"}']);
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
  execFileSync('git', ['checkout', '-b', 'feature'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Feature commit'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', '-'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });

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
      'The session cookie expired too early for some users. Résumé attached.',
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
  assert.equal(search.indices[listed.hash], list.commits.indexOf(listed));
  const insensitiveSearch = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('SESSION COOKIE EXPIRED')}`,
    )
  ).json();
  assert.deepEqual(insensitiveSearch.hashes, [listed.hash]);
  const accentInsensitiveSearch = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('resume attached')}`,
    )
  ).json();
  assert.deepEqual(accentInsensitiveSearch.hashes, [listed.hash]);
  const sensitiveMiss = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('SESSION COOKIE EXPIRED')}&caseSensitive=1`,
    )
  ).json();
  assert.deepEqual(sensitiveMiss.hashes, []);
  const sensitiveMatch = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('session cookie expired')}&caseSensitive=1`,
    )
  ).json();
  assert.deepEqual(sensitiveMatch.hashes, [listed.hash]);
  const accentSensitiveMiss = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('Resume attached')}&caseSensitive=1`,
    )
  ).json();
  assert.deepEqual(accentSensitiveMiss.hashes, []);
  const accentSensitiveMatch = await (
    await fetch(
      `${server.address}/api/commits/search?query=${encodeURIComponent('Résumé attached')}&caseSensitive=1`,
    )
  ).json();
  assert.deepEqual(accentSensitiveMatch.hashes, [listed.hash]);
  const older = list.commits[1];
  const olderSearch = await (
    await fetch(`${server.address}/api/commits/search?query=${encodeURIComponent(older.message)}`)
  ).json();
  assert.equal(olderSearch.indices[older.hash], 1);
  const targetPage = await (
    await fetch(`${server.address}/api/commits?skip=${olderSearch.indices[older.hash]}&limit=1`)
  ).json();
  assert.equal(targetPage.commits[0].hash, older.hash);

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

  execFileSync('git', ['branch', 'feature'], {
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

test('lists worktrees and stashes, and prunes deleted remote branches on fetch', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const originPath = await mkdtemp(join(tmpdir(), 'guito-origin-'));
  context.after(() => rm(originPath, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: repositoryPath, stdio: 'pipe' }).toString().trim();
  const branch = git('branch', '--show-current');

  // A bare remote with one pushed branch plus a later-deleted stale branch.
  execFileSync('git', ['init', '--bare', originPath], { stdio: 'ignore' });
  git('remote', 'add', 'origin', originPath);
  git('push', 'origin', branch);
  git('push', 'origin', `${branch}:stale-remote`);

  const linked = join(repositoryPath, 'linked');
  git('worktree', 'add', '-b', 'linked-branch', linked);
  await writeFile(join(repositoryPath, 'stashed.txt'), 'change\n');
  git('add', '.');
  git('stash', 'push', '-m', 'wip stash');

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  // The worktree list marks the served directory and describes the linked one.
  const worktrees = await (await fetch(`${server.address}/api/worktrees`)).json();
  assert.equal(worktrees.length, 2);
  const main = worktrees.find((entry) => entry.current);
  assert.ok(main, 'the served worktree is marked current');
  assert.equal(resolve(main.path), resolve(repositoryPath));
  assert.equal(main.branch, branch);
  const other = worktrees.find((entry) => !entry.current);
  assert.equal(other.branch, 'linked-branch');
  assert.equal(resolve(other.path), resolve(linked));

  // Worktrees can be created from an existing local branch and removed again.
  git('branch', 'api-worktree');
  const apiLinked = join(repositoryPath, 'api-linked');
  const created = await fetch(`${server.address}/api/worktrees`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: apiLinked, branch: 'api-worktree' }),
  });
  assert.equal(created.status, 200, await created.text());
  assert.equal(
    execFileSync('git', ['branch', '--show-current'], { cwd: apiLinked }).toString().trim(),
    'api-worktree',
  );

  // Removing the served worktree is always rejected.
  const removeCurrent = await fetch(`${server.address}/api/worktrees/remove`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: repositoryPath }),
  });
  assert.equal(removeCurrent.status, 400);
  assert.match((await removeCurrent.json()).error, /currently open/i);

  await writeFile(join(apiLinked, 'uncommitted.txt'), 'keep me\n');
  const dirtyRemoval = await fetch(`${server.address}/api/worktrees/remove`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: apiLinked }),
  });
  assert.equal(dirtyRemoval.status, 400);
  assert.ok((await dirtyRemoval.json()).error);
  await rm(join(apiLinked, 'uncommitted.txt'));

  const removed = await fetch(`${server.address}/api/worktrees/remove`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: apiLinked }),
  });
  assert.equal(removed.status, 200, await removed.text());
  assert.equal(
    (await fetch(`${server.address}/api/worktrees`).then((response) => response.json())).some(
      (entry) => resolve(entry.path) === resolve(apiLinked),
    ),
    false,
  );

  // The stash list feeds the panel and the commit table rows; the entries
  // carry the stash commit's metadata on top of hash + message.
  const stashList = await (await fetch(`${server.address}/api/stash/list`)).json();
  assert.equal(stashList.total, 1);
  assert.ok(stashList.all[0].message.includes('wip stash'));
  assert.match(stashList.all[0].hash, /^[0-9a-f]{40}$/);
  assert.match(stashList.all[0].date, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof stashList.all[0].author_name, 'string');
  assert.equal(typeof stashList.all[0].author_email, 'string');
  // The stash hash resolves through the commit endpoints used by the detail pane.
  const stashDetail = await fetch(`${server.address}/api/commit/detail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hash: stashList.all[0].hash }),
  });
  assert.equal(stashDetail.status, 200);
  const stashDiff = await fetch(`${server.address}/api/commit/diff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hash: stashList.all[0].hash }),
  });
  assert.equal(stashDiff.status, 200);
  assert.ok(
    (await stashDiff.json()).files.some((file) => file.path === 'stashed.txt'),
    'the stash diff shows the stashed file',
  );

  // A plain fetch keeps the stale remote-tracking branch; prune removes it.
  assert.ok(
    (await (await fetch(`${server.address}/api/branches/all`)).json()).some(
      (entry) => entry.name === 'origin/stale-remote',
    ),
  );
  // Deleting on the remote itself leaves the local remote-tracking ref stale.
  execFileSync('git', ['branch', '-d', 'stale-remote'], {
    cwd: originPath,
    stdio: 'ignore',
  });
  const pruned = await fetch(`${server.address}/api/fetch?prune=1`);
  assert.equal(pruned.status, 200);
  const branchesAfter = await (await fetch(`${server.address}/api/branches/all`)).json();
  assert.ok(
    !branchesAfter.some((entry) => entry.name === 'origin/stale-remote'),
    'fetch with prune drops the deleted remote branch',
  );
  assert.ok(branchesAfter.some((entry) => entry.name === `origin/${branch}`));
});

test('resets the current branch with the requested mode', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const file = join(repositoryPath, 'file.txt');
  await (await import('node:fs/promises')).writeFile(file, 'content\n');
  execFileSync('git', ['add', 'file.txt'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['commit', '-m', 'Add file'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });

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
  execFileSync('git', ['add', 'file.txt'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  assert.equal((await reset('hard')).status, 200);
  assert.equal(headCommit(), firstCommit);
  assert.equal(status(), '');

  // An unknown mode falls back to a hard reset.
  await (await import('node:fs/promises')).writeFile(file, 'more\n');
  execFileSync('git', ['add', 'file.txt'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['commit', '-m', 'Add file again'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
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
    execFileSync('git', ['--git-dir', remotePath, 'tag', '--list'], {
      cwd: remotePath,
    })
      .toString()
      .trim();

  execFileSync('git', ['tag', 'v1.0.0'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });

  // Deleting a tag removes it.
  const deleted = await fetch(`${server.address}/api/tag/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'v1.0.0' }),
  });
  assert.equal(deleted.status, 200);
  assert.equal(listTags(), '');

  // Pushing a tag uploads it to the remote.
  execFileSync('git', ['tag', 'v1.0.0'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
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

/** Creates a repository with a bare remote named origin and one pushed commit. */
async function createRepositoryWithRemote() {
  const repositoryPath = await createRepository();
  const remotePath = await mkdtemp(join(tmpdir(), 'guito-remote-'));
  execFileSync('git', ['init', '--bare'], { cwd: remotePath, stdio: 'ignore' });
  execFileSync('git', ['remote', 'add', 'origin', remotePath], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['push', '-u', 'origin', 'HEAD'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  return { repositoryPath, remotePath };
}

const post = (server, path, body) =>
  fetch(`${server.address}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('creates annotated tags and warns when pushing fails', async (context) => {
  const { repositoryPath, remotePath } = await createRepositoryWithRemote();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  context.after(() => rm(remotePath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  // An annotated tag carries a message and is peeled by the listing.
  const created = await post(server, '/api/tag/create', {
    name: 'v9.0.0',
    annotate: true,
    message: 'Release notes',
  });
  assert.equal(created.status, 200);
  const raw = execFileSync('git', ['tag', '--list', '--format=%(objecttype)'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  assert.equal(raw, 'tag');

  // An annotated tag without a message is rejected.
  const rejected = await post(server, '/api/tag/create', {
    name: 'v9.0.1',
    annotate: true,
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /requires a message/i);

  // A push to an unconfigured remote fails before anything is created.
  const failing = await post(server, '/api/tag/create', {
    name: 'v9.0.2',
    push: true,
    remote: 'no-such-remote',
  });
  assert.equal(failing.status, 400);
  assert.match((await failing.json()).error, /not configured/);
  assert.ok(
    !execFileSync('git', ['tag', '--list'], { cwd: repositoryPath }).toString().includes('v9.0.2'),
  );

  // Creating a tag with push uploads it to the remote.
  const pushed = await post(server, '/api/tag/create', {
    name: 'v9.0.3',
    push: true,
  });
  assert.equal(pushed.status, 200);
  const remoteTags = () =>
    execFileSync('git', ['--git-dir', remotePath, 'tag', '--list'], {
      cwd: remotePath,
    })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
  assert.deepEqual(remoteTags(), ['v9.0.3']);

  // Pushing the annotated tag uploads it too.
  const pushedAnnotated = await post(server, '/api/tag/push', { name: 'v9.0.0' });
  assert.equal(pushedAnnotated.status, 200);
  assert.deepEqual(remoteTags(), ['v9.0.0', 'v9.0.3']);

  // A push rejected by the remote keeps the local tag and returns a warning.
  // Origin's v9.9.9 already points at another object, so the push fails.
  const clonePath = await mkdtemp(join(tmpdir(), 'guito-tag-clone-'));
  context.after(() => rm(clonePath, { recursive: true, force: true }));
  execFileSync('git', ['clone', remotePath, clonePath], { stdio: 'ignore' });
  const cloneFile = join(clonePath, 'other.txt');
  await writeFile(cloneFile, 'other\n');
  execFileSync('git', ['add', 'other.txt'], { cwd: clonePath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Other work'], { cwd: clonePath, stdio: 'ignore' });
  execFileSync('git', ['tag', 'v9.9.9'], { cwd: clonePath, stdio: 'ignore' });
  execFileSync('git', ['push', 'origin', 'v9.9.9'], { cwd: clonePath, stdio: 'ignore' });

  // Creating a tag whose push is rejected keeps the local tag and warns.
  const warned = await post(server, '/api/tag/create', {
    name: 'v9.9.9',
    push: true,
  });
  assert.equal(warned.status, 200);
  const warningBody = await warned.json();
  assert.ok(warningBody.warnings?.length, 'expected a warning about the failed push');
  assert.match(warningBody.warnings[0], /could not be pushed/);
  assert.ok(
    execFileSync('git', ['tag', '--list'], { cwd: repositoryPath }).toString().includes('v9.9.9'),
    'the local tag should be kept',
  );

  // Tag deletion can also delete on the remote.
  const removed = await post(server, '/api/tag/delete', {
    name: 'v9.9.9',
    deleteRemote: true,
  });
  assert.equal(removed.status, 200);
  assert.deepEqual((await removed.json()).warnings ?? [], []);

  // Tag deletion can also delete on the remote.
  const deleted = await post(server, '/api/tag/delete', {
    name: 'v9.0.0',
    deleteRemote: true,
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(
    execFileSync('git', ['tag', '--list'], { cwd: repositoryPath })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean),
    ['v9.0.3'],
  );
  assert.deepEqual(remoteTags(), ['v9.0.3']);
});

test('creates, checks out, publishes and deletes branches with options', async (context) => {
  const { repositoryPath, remotePath } = await createRepositoryWithRemote();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  context.after(() => rm(remotePath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const branch = () =>
    execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repositoryPath })
      .toString()
      .trim();
  const initialBranch = branch();
  const remoteBranches = () =>
    execFileSync(
      'git',
      ['--git-dir', remotePath, 'branch', '--list', '--format=%(refname:short)'],
      {
        cwd: remotePath,
      },
    )
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);

  // Create without options leaves the current branch checked out.
  const created = await post(server, '/api/branch/create', { name: 'feature/one' });
  assert.equal(created.status, 200);
  assert.equal(branch(), initialBranch);

  // Create + checkout + publish sets upstream and switches.
  const published = await post(server, '/api/branch/create', {
    name: 'feature/published',
    checkout: true,
    publish: true,
  });
  assert.equal(published.status, 200);
  assert.equal(branch(), 'feature/published');
  assert.ok(remoteBranches().includes('feature/published'));
  const upstream = execFileSync('git', ['rev-parse', '--abbrev-ref', '@{upstream}'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  assert.equal(upstream, 'origin/feature/published');

  // Checkout with a detached HEAD and no branch.
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryPath })
    .toString()
    .trim();
  const detached = await post(server, '/api/checkout', { ref: head, detach: true });
  assert.equal(detached.status, 200);
  assert.equal(branch(), 'HEAD');

  // Back on the branch; renaming can publish and delete the old remote ref.
  await post(server, '/api/checkout', { ref: initialBranch });
  execFileSync('git', ['branch', '-f', 'old-name', initialBranch], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['push', 'origin', 'old-name'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  const renamed = await post(server, '/api/branch/rename', {
    oldName: 'old-name',
    newName: 'new-name',
    publish: true,
    deleteRemoteOld: true,
  });
  assert.equal(renamed.status, 200);
  assert.ok(remoteBranches().includes('new-name'));
  assert.ok(!remoteBranches().includes('old-name'));

  // Delete refuses unmerged branches in safe mode.
  execFileSync('git', ['branch', 'unmerged'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', 'unmerged'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Unmerged work'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', initialBranch], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  const safe = await post(server, '/api/branch/delete', { name: 'unmerged' });
  assert.equal(safe.status, 400);

  // Force delete removes it.
  const forced = await post(server, '/api/branch/delete', { name: 'unmerged', force: true });
  assert.equal(forced.status, 200);
  const branches = execFileSync('git', ['branch', '--list', '--format=%(refname:short)'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim()
    .split('\n');
  assert.ok(!branches.includes('unmerged'));

  // Delete with deleteRemote also removes the remote ref.
  const deleteRemote = await post(server, '/api/branch/delete', {
    name: 'new-name',
    deleteRemote: true,
  });
  assert.equal(deleteRemote.status, 200);
  assert.ok(!remoteBranches().includes('new-name'));

  // Remote branch deletion goes through the dedicated endpoint.
  await post(server, '/api/branch/create', { name: 'to-remove', publish: true });
  const removedRemote = await post(server, '/api/branch/delete-remote', {
    remote: 'origin',
    branch: 'to-remove',
  });
  assert.equal(removedRemote.status, 200);
  assert.ok(!remoteBranches().includes('to-remove'));
});

test('cherry-picks and reverts with option flags and mainline parents', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const git_ = (args) => execFileSync('git', args, { cwd: repositoryPath, stdio: 'ignore' });
  const head = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryPath }).toString().trim();
  const subjects = () =>
    execFileSync('git', ['log', '--format=%B'], { cwd: repositoryPath }).toString().trim();
  const initialBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();

  // A target commit with a real file lives on a topic branch.
  git_(['checkout', '-b', 'topic']);
  const fileA = join(repositoryPath, 'file-a.txt');
  await writeFile(fileA, 'target\n');
  git_(['add', 'file-a.txt']);
  git_(['commit', '-m', 'Target commit']);
  const target = head();

  // The main branch diverges so the target is not an ancestor.
  git_(['checkout', initialBranch]);
  const fileC = join(repositoryPath, 'file-c.txt');
  await writeFile(fileC, 'other\n');
  git_(['add', 'file-c.txt']);
  git_(['commit', '-m', 'Other work']);

  // cherry-pick -x appends the source hash to the new commit.
  const picked = await post(server, '/api/cherry-pick', {
    commit: target,
    recordSource: true,
  });
  assert.equal(picked.status, 200);
  assert.ok(subjects().includes(`cherry picked from commit ${target}`));
  assert.ok(existsSync(fileA));

  // Revert with --no-commit stages the inverse without committing.
  const reverted = await post(server, '/api/revert', { commit: target, noCommit: true });
  assert.equal(reverted.status, 200);
  const lastSubject = execFileSync('git', ['log', '-1', '--format=%s'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  // HEAD is the cherry-picked copy, which keeps the original subject.
  assert.equal(lastSubject, 'Target commit');
  const staged = execFileSync('git', ['diff', '--cached', '--name-status'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  assert.match(staged, /^D\s+file-a\.txt$/);
  git_(['reset', '--hard', 'HEAD']);

  // A merge commit requires a mainline parent for both operations.
  git_(['checkout', '-b', 'side', 'HEAD~1']);
  const fileB = join(repositoryPath, 'file-b.txt');
  await writeFile(fileB, 'side\n');
  git_(['add', 'file-b.txt']);
  git_(['commit', '-m', 'Side commit']);
  git_(['checkout', initialBranch]);
  git_(['merge', '-m', 'Merge side', 'side']);
  const merge = head();

  const pickMerge = await post(server, '/api/cherry-pick', { commit: merge });
  assert.equal(pickMerge.status, 400);
  assert.match((await pickMerge.json()).error, /mainline parent/i);

  const revertMerge = await post(server, '/api/revert', { commit: merge });
  assert.equal(revertMerge.status, 400);
  assert.match((await revertMerge.json()).error, /mainline parent/i);
});

test('drops only the selected commit and rejects ineligible ones', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const git_ = (args) => execFileSync('git', args, { cwd: repositoryPath, stdio: 'ignore' });
  const head = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryPath }).toString().trim();
  const initialBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  const subjects = () =>
    execFileSync('git', ['log', '--format=%s'], { cwd: repositoryPath })
      .toString()
      .trim()
      .split('\n');
  const root = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();

  git_(['commit', '--allow-empty', '-m', 'First']);
  const first = head();
  git_(['commit', '--allow-empty', '-m', 'Second']);
  const second = head();
  git_(['commit', '--allow-empty', '-m', 'Third']);
  const third = head();

  // Dropping the middle commit keeps its descendants.
  const dropped = await post(server, '/api/commit/drop', { commit: second });
  assert.equal(dropped.status, 200);
  assert.deepEqual(subjects(), ['Third', 'First', 'Initial commit']);
  // The surviving descendant was replayed (new hash).
  const newThird = head();
  assert.notEqual(newThird, third);

  // The root commit cannot be dropped.
  const rootDrop = await post(server, '/api/commit/drop', { commit: root });
  assert.equal(rootDrop.status, 400);
  assert.match((await rootDrop.json()).error, /root/i);

  // A merge commit cannot be dropped.
  git_(['checkout', '-b', 'merge-side', 'HEAD~1']);
  git_(['commit', '--allow-empty', '-m', 'Merge side']);
  git_(['checkout', initialBranch]);
  git_(['merge', '-m', 'Merge merge-side', 'merge-side']);
  const mergeCommit = head();
  const mergeDrop = await post(server, '/api/commit/drop', { commit: mergeCommit });
  assert.equal(mergeDrop.status, 400);
  assert.match((await mergeDrop.json()).error, /merge commits/i);
  git_(['reset', '--hard', 'HEAD~1']);

  // A detached HEAD blocks the drop.
  git_(['checkout', '--detach', 'HEAD']);
  const detached = await post(server, '/api/commit/drop', { commit: head() });
  assert.equal(detached.status, 400);
  assert.match((await detached.json()).error, /detached/i);
  git_(['checkout', initialBranch]);

  // An unreachable commit cannot be dropped.
  git_(['checkout', '--detach', 'HEAD']);
  git_(['branch', 'orphan', 'HEAD']);
  git_(['checkout', 'orphan']);
  git_(['commit', '--allow-empty', '-m', 'Orphan side']);
  const side = head();
  git_(['checkout', initialBranch]);
  git_(['branch', '-D', 'orphan']);
  const unreachable = await post(server, '/api/commit/drop', { commit: side });
  assert.equal(unreachable.status, 400);
  assert.match((await unreachable.json()).error, /reachable/i);

  // A dirty working tree blocks the drop (untracked files do not).
  const untracked = join(repositoryPath, 'untracked.txt');
  await writeFile(untracked, 'untracked\n');
  const untrackedOk = await post(server, '/api/commit/drop', { commit: first });
  assert.equal(untrackedOk.status, 200);
  const tracked = join(repositoryPath, 'tracked.txt');
  await writeFile(tracked, 'tracked\n');
  git_(['add', 'tracked.txt']);
  git_(['commit', '-m', 'Add tracked']);
  await writeFile(tracked, 'dirty\n');
  const dirty = await post(server, '/api/commit/drop', { commit: head() });
  assert.equal(dirty.status, 400);
  assert.match((await dirty.json()).error, /uncommitted changes/i);
});

test('merges, rebases and pulls with mode options', async (context) => {
  const { repositoryPath, remotePath } = await createRepositoryWithRemote();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  context.after(() => rm(remotePath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const git_ = (args, cwd = repositoryPath) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  const head = () =>
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryPath }).toString().trim();
  const subjects = () =>
    execFileSync('git', ['log', '--format=%s'], { cwd: repositoryPath })
      .toString()
      .trim()
      .split('\n');
  const status = () =>
    execFileSync('git', ['status', '--porcelain'], { cwd: repositoryPath }).toString().trim();
  const initialBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();

  // A side branch with a real file change.
  git_(['checkout', '-b', 'side']);
  const fileB = join(repositoryPath, 'file-b.txt');
  await writeFile(fileB, 'side\n');
  git_(['add', 'file-b.txt']);
  git_(['commit', '-m', 'Side change']);
  git_(['checkout', initialBranch]);

  // Squash merge stages the changes without a merge commit.
  const squashed = await post(server, '/api/merge', {
    branch: 'side',
    mode: 'squash',
  });
  assert.equal(squashed.status, 200);
  const stagedAfterSquash = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  assert.equal(stagedAfterSquash, 'file-b.txt');
  assert.ok(!subjects().includes('Side change'));
  git_(['commit', '-m', 'Squashed side']);

  // A no-ff merge creates a merge commit.
  git_(['checkout', '-b', 'side2']);
  const fileC = join(repositoryPath, 'file-c.txt');
  await writeFile(fileC, 'side2\n');
  git_(['add', 'file-c.txt']);
  git_(['commit', '-m', 'Side2 change']);
  git_(['checkout', initialBranch]);
  const merged = await post(server, '/api/merge', { branch: 'side2', mode: 'no-ff' });
  assert.equal(merged.status, 200);
  const parents = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim()
    .split(/\s+/);
  assert.equal(parents.length, 3);

  // Rebase with --autostash stashes and restores uncommitted changes.
  git_(['branch', 'rebase-target', 'HEAD~2']);
  git_(['checkout', '-b', 'rb']);
  const fileD = join(repositoryPath, 'file-d.txt');
  await writeFile(fileD, 'local\n');
  git_(['add', 'file-d.txt']);
  git_(['commit', '-m', 'Local change']);
  await writeFile(fileD, 'local\ndirty\n');
  const rebased = await post(server, '/api/rebase', {
    branch: 'rebase-target',
    autostash: true,
  });
  assert.equal(rebased.status, 200);
  assert.ok(status().includes('file-d.txt'), 'autostash should restore the modification');
  const rbSubjects = execFileSync('git', ['log', '--format=%s', 'rb'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim()
    .split('\n');
  assert.ok(rbSubjects.includes('Local change'));
  git_(['reset', '--hard', 'HEAD']);
  git_(['checkout', initialBranch]);

  // A commit lands on the remote; a selected-branch pull fast-forwards to it.
  const clonePath = await mkdtemp(join(tmpdir(), 'guito-clone-'));
  context.after(() => rm(clonePath, { recursive: true, force: true }));
  git_(['clone', remotePath, clonePath]);
  const remoteFile = join(clonePath, 'remote.txt');
  await writeFile(remoteFile, 'remote\n');
  git_(['add', 'remote.txt'], clonePath);
  git_(['commit', '-m', 'Remote change'], clonePath);
  git_(['push', 'origin', 'HEAD'], clonePath);

  git_(['fetch', 'origin']);
  // Return to the originally pushed commit so the branch is strictly behind
  // the remote and the fast-forward pull has something to update.
  git_(['reset', '--hard', `origin/${initialBranch}~1`]);
  const before = head();
  const pulled = await post(server, '/api/pull', {
    remote: 'origin',
    branch: initialBranch,
    mode: 'ff-only',
  });
  assert.equal(pulled.status, 200);
  assert.notEqual(head(), before);
  assert.equal(
    execFileSync('git', ['log', '-1', '--format=%s'], { cwd: repositoryPath }).toString().trim(),
    'Remote change',
  );

  // An up-to-date pull with the same options succeeds without changes.
  const upToDate = await post(server, '/api/pull', {
    remote: 'origin',
    branch: initialBranch,
    mode: 'merge',
  });
  assert.equal(upToDate.status, 200);
});

test('stashes save, apply and pop with index restoration', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const file = join(repositoryPath, 'file.txt');
  const status = () =>
    execFileSync('git', ['status', '--porcelain'], { cwd: repositoryPath }).toString().trim();

  // Staged + unstaged state.
  await writeFile(file, 'staged\n');
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath, stdio: 'ignore' });
  await writeFile(file, 'staged\nunstaged\n');

  // Stash without untracked files.
  const saved = await post(server, '/api/stash/save', {
    message: 'my stash',
    scope: 'all',
    includeUntracked: false,
  });
  assert.equal(saved.status, 200);
  assert.equal(status(), '');

  // Apply with --index restores the staged state; the stash entry remains.
  const applied = await post(server, '/api/stash/apply', { index: 0, restoreIndex: true });
  assert.equal(applied.status, 200);
  assert.equal(status(), 'AM file.txt');

  // Dropping the stash keeps the applied changes in the tree.
  await post(server, '/api/stash/drop', { index: 0 });
  assert.equal(status(), 'AM file.txt');

  // Reset the tree, re-stash and pop with --index.
  execFileSync('git', ['reset', '--hard', 'HEAD'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['clean', '-fd'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  assert.equal(status(), '');
  await writeFile(file, 'staged\n');
  execFileSync('git', ['add', 'file.txt'], { cwd: repositoryPath, stdio: 'ignore' });
  await writeFile(file, 'staged\nunstaged\n');
  await post(server, '/api/stash/save', { scope: 'all', includeUntracked: false });
  const popped = await post(server, '/api/stash/pop', { index: 0, restoreIndex: true });
  assert.equal(popped.status, 200);
  assert.equal(status(), 'AM file.txt');
  const stashList = execFileSync('git', ['stash', 'list'], { cwd: repositoryPath })
    .toString()
    .trim();
  assert.equal(stashList, '');

  // An out-of-range stash index is rejected.
  const missing = await post(server, '/api/stash/apply', { index: 5, restoreIndex: false });
  assert.equal(missing.status, 400);
});

test('parses Azure DevOps remote URLs', () => {
  assert.deepEqual(parseAzureRemoteUrl('https://server/DefaultCollection/Project/_git/Repo'), {
    projectPath: 'DefaultCollection/Project',
    repo: 'Repo',
  });
  assert.deepEqual(parseAzureRemoteUrl('https://server/DefaultCollection/Project/_git/Repo.git'), {
    projectPath: 'DefaultCollection/Project',
    repo: 'Repo',
  });
  assert.deepEqual(parseAzureRemoteUrl('https://server/tfs/My%20Project/_git/My%20Repo'), {
    projectPath: 'tfs/My Project',
    repo: 'My Repo',
  });
  assert.deepEqual(
    parseAzureRemoteUrl('https://user@server:8443/tfs/Collection/Project/_git/Repo'),
    {
      projectPath: 'tfs/Collection/Project',
      repo: 'Repo',
    },
  );
  assert.deepEqual(parseAzureRemoteUrl('git@server:DefaultCollection/Project/_git/Repo.git'), {
    projectPath: 'DefaultCollection/Project',
    repo: 'Repo',
  });
  assert.deepEqual(parseAzureRemoteUrl('ssh://git@server/DefaultCollection/Project/_git/Repo'), {
    projectPath: 'DefaultCollection/Project',
    repo: 'Repo',
  });
  assert.equal(parseAzureRemoteUrl('https://github.com/danisss9/Guito.git'), null);
  assert.equal(parseAzureRemoteUrl('/local/path/only'), null);
  assert.equal(parseAzureRemoteUrl(''), null);
});

test('builds the pull request REST URL', () => {
  const remote = 'https://server/DefaultCollection/Project/_git/Repo.git';
  assert.equal(
    buildAzurePullRequestUrl('https://server/DefaultCollection', remote),
    'https://server/DefaultCollection/Project/_apis/git/repositories/Repo/pullrequests?api-version=5.0-preview',
  );
  // A bare host base must not lose the collection path.
  assert.equal(
    buildAzurePullRequestUrl('https://server', remote),
    'https://server/DefaultCollection/Project/_apis/git/repositories/Repo/pullrequests?api-version=5.0-preview',
  );
  // Trailing slashes on the base are trimmed.
  assert.equal(
    buildAzurePullRequestUrl('https://server/DefaultCollection/', remote),
    'https://server/DefaultCollection/Project/_apis/git/repositories/Repo/pullrequests?api-version=5.0-preview',
  );
  // Encoded project segments are re-encoded in the REST URL.
  assert.equal(
    buildAzurePullRequestUrl(
      'https://server/tfs',
      'https://server/tfs/My%20Project/_git/My%20Repo',
    ),
    'https://server/tfs/My%20Project/_apis/git/repositories/My%20Repo/pullrequests?api-version=5.0-preview',
  );
  assert.equal(buildAzurePullRequestUrl('', remote), null);
  assert.equal(buildAzurePullRequestUrl('https://server', 'https://github.com/x/y.git'), null);
});

/** Creates a repository whose origin looks like Azure DevOps but pushes to a local bare repo. */
async function createAzureRepository(context) {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const remotePath = await mkdtemp(join(tmpdir(), 'guito-remote-'));
  context.after(() => rm(remotePath, { recursive: true, force: true }));
  execFileSync('git', ['init', '--bare'], { cwd: remotePath, stdio: 'ignore' });
  // The fetch URL points at a fake Azure DevOps server (parsed by the PR
  // route) while pushes go to the local bare repository.
  execFileSync(
    'git',
    ['remote', 'add', 'origin', 'https://azure.example/DefaultCollection/Project/_git/Repo.git'],
    { cwd: repositoryPath, stdio: 'ignore' },
  );
  execFileSync('git', ['remote', 'set-url', '--push', 'origin', remotePath], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['push', 'origin', 'HEAD:refs/heads/main'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  return { repositoryPath, remotePath };
}

const remoteBranches = (remotePath) =>
  execFileSync('git', [
    '--git-dir',
    remotePath,
    'for-each-ref',
    'refs/heads',
    '--format=%(refname)',
  ])
    .toString()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

test('creates a pull request through Azure DevOps', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async (method, url, body) => {
      calls.push({ url, payload: JSON.parse(body) });
      return {
        status: 201,
        body: JSON.stringify({
          pullRequestId: 42,
          _links: {
            web: {
              href: 'https://azure.example/DefaultCollection/Project/_git/Repo/pullrequest/42',
            },
          },
        }),
      };
    },
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceBranch: 'main',
      targetBranch: 'main',
      title: 'My PR',
      description: 'Body',
    }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.id, 42);
  assert.equal(
    created.url,
    'https://azure.example/DefaultCollection/Project/_git/Repo/pullrequest/42',
  );
  assert.equal(created.branch, 'main');

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://azure.example/DefaultCollection/Project/_apis/git/repositories/Repo/pullrequests?api-version=5.0-preview',
  );
  assert.deepEqual(calls[0].payload, {
    isDraft: false,
    sourceRefName: 'refs/heads/main',
    targetRefName: 'refs/heads/main',
    title: 'My PR',
    description: 'Body',
  });
});

test('creates a pull request from a new random branch', async (context) => {
  const { repositoryPath, remotePath } = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async (method, url, body) => {
      calls.push({ url, payload: JSON.parse(body) });
      return {
        status: 201,
        body: JSON.stringify({
          pullRequestId: 7,
          _links: { web: { href: 'x' } },
        }),
      };
    },
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceBranch: '',
      targetBranch: 'main',
      newBranch: true,
    }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.match(created.branch, /^pr\/[a-z0-9]{6}$/);

  // The random branch was pushed to the remote as the PR source.
  assert.ok(remoteBranches(remotePath).includes(`refs/heads/${created.branch}`));
  assert.deepEqual(calls[0].payload, {
    isDraft: false,
    sourceRefName: `refs/heads/${created.branch}`,
    targetRefName: 'refs/heads/main',
  });
});

test('publishes a local-only source branch before creating the pull request', async (context) => {
  const { repositoryPath, remotePath } = await createAzureRepository(context);
  execFileSync('git', ['checkout', '-b', 'feature'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Feature work'], {
    cwd: repositoryPath,
    stdio: 'ignore',
  });

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async () => ({
      status: 201,
      body: JSON.stringify({
        pullRequestId: 9,
        _links: { web: { href: 'x' } },
      }),
    }),
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceBranch: 'feature', targetBranch: 'main' }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.branch, 'feature');
  assert.ok(remoteBranches(remotePath).includes('refs/heads/feature'));
});

test('surfaces Azure DevOps errors and requires configuration', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);

  const failing = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async () => ({
      status: 400,
      body: JSON.stringify({ message: 'TF401027: You need permission.' }),
    }),
  });
  context.after(() => failing.close());

  const failed = await fetch(`${failing.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceBranch: 'main', targetBranch: 'main' }),
  });
  assert.equal(failed.status, 400);
  assert.equal((await failed.json()).error, 'TF401027: You need permission.');

  // Without any configured URL the request is rejected up front.
  const unconfigured = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => unconfigured.close());

  const missing = await fetch(`${unconfigured.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceBranch: 'main', targetBranch: 'main' }),
  });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /not configured/i);
});

test('edits repository identity and remote configuration', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const identity = await fetch(`${server.address}/api/identity`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Settings User',
      email: 'settings@example.test',
    }),
  });
  assert.equal(identity.status, 200);
  assert.deepEqual(await identity.json(), {
    name: 'Settings User',
    email: 'settings@example.test',
  });

  const added = await fetch(`${server.address}/api/remotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'upstream',
      fetchUrl: 'https://example.test/fetch.git',
      pushUrl: 'https://example.test/push.git',
    }),
  });
  assert.equal(added.status, 200);
  assert.deepEqual(await added.json(), [
    {
      name: 'upstream',
      fetchUrl: 'https://example.test/fetch.git',
      pushUrl: 'https://example.test/push.git',
    },
  ]);
  const renamed = await fetch(`${server.address}/api/remotes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      originalName: 'upstream',
      name: 'origin',
      fetchUrl: 'https://example.test/repo.git',
    }),
  });
  assert.equal(renamed.status, 200);
  assert.deepEqual(await renamed.json(), [
    {
      name: 'origin',
      fetchUrl: 'https://example.test/repo.git',
      pushUrl: 'https://example.test/repo.git',
    },
  ]);
  const removed = await fetch(`${server.address}/api/remotes/origin`, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), []);
});

test('creates a pull request branch from the configured name template', async (context) => {
  const { repositoryPath, remotePath } = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    prBranchNameTemplate: 'users/${username}/${randomstring}',
    azureRequestImpl: async (_method, _url, body) => {
      calls.push(JSON.parse(body));
      return {
        status: 201,
        body: JSON.stringify({
          pullRequestId: 8,
          _links: { web: { href: 'x' } },
        }),
      };
    },
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceBranch: '',
      targetBranch: 'main',
      newBranch: true,
    }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.match(created.branch, /^users\/[^/]+\/[a-z0-9]{6}$/);
  assert.ok(remoteBranches(remotePath).includes(`refs/heads/${created.branch}`));
  assert.equal(calls[0].sourceRefName, `refs/heads/${created.branch}`);
});

test('stores the Azure DevOps URL in server-side settings', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);

  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());

  const saved = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      azureDevOpsUrl: 'https://server/DefaultCollection',
    }),
  });
  assert.equal(saved.status, 200);
  assertSettings(await saved.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: false,
    fileListView: 'flat',
    refListView: 'flat',
    sidePanelSectionsExpanded: true,
    searchMode: 'navigate',
    searchCaseSensitive: false,
  });

  const loaded = await fetch(`${server.address}/api/settings`);
  assert.equal(loaded.status, 200);
  assertSettings(await loaded.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
  });

  // The settings file lives in the repository's git directory.
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: repositoryPath,
  })
    .toString()
    .trim();
  const settings = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(settings.azureDevOpsUrl, 'https://server/DefaultCollection');

  const namedBranch = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prBranchNameTemplate: 'users/${username}/${randomstring}',
    }),
  });
  assert.equal(namedBranch.status, 200);
  assert.equal(
    (await namedBranch.json()).prBranchNameTemplate,
    'users/${username}/${randomstring}',
  );
  const fileAfterBranchTemplate = JSON.parse(
    await readFile(join(gitDir, 'guito-settings.json'), 'utf8'),
  );
  assert.equal(fileAfterBranchTemplate.prBranchNameTemplate, 'users/${username}/${randomstring}');

  const unknownVariable = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prBranchNameTemplate: 'pr/${missing}' }),
  });
  assert.equal(unknownVariable.status, 400);
  assert.match((await unknownVariable.json()).error, /\$\{missing\}/);

  const resetBranchTemplate = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prBranchNameTemplate: '' }),
  });
  assert.equal(resetBranchTemplate.status, 200);
  assert.equal((await resetBranchTemplate.json()).prBranchNameTemplate, 'pr/${randomstring}');

  // Non-http URLs are rejected.
  const invalid = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ azureDevOpsUrl: 'ftp://server' }),
  });
  assert.equal(invalid.status, 400);

  // An empty value clears the setting.
  const cleared = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ azureDevOpsUrl: '' }),
  });
  assert.equal(cleared.status, 200);
  assertSettings(await cleared.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
  });

  // Hiding the graph persists it, and a post without the URL keeps the
  // cleared URL instead of resetting it.
  const hidden = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showGraph: false, autoReload: false }),
  });
  assert.equal(hidden.status, 200);
  assertSettings(await hidden.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: false,
    diffViewer: 'guito',
    showGraph: false,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
  });
  const fileAfterHide = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(fileAfterHide.showGraph, false);
  assert.equal(fileAfterHide.autoReload, false);

  // Hiding the commit-table stash rows persists the same way.
  const stashesHidden = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showStashes: false }),
  });
  assert.equal(stashesHidden.status, 200);
  assertSettings(await stashesHidden.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: false,
    diffViewer: 'guito',
    showGraph: false,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
  });

  // Switching the file lists to the tree view persists, an invalid value is
  // ignored, and unrelated keys survive.
  const treed = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileListView: 'tree' }),
  });
  assert.equal(treed.status, 200);
  assertSettings(await treed.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: false,
    diffViewer: 'guito',
    showGraph: false,
    showStashes: false,
    fileListView: 'tree',
    searchMode: 'navigate',
  });
  const fileAfterTree = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(fileAfterTree.fileListView, 'tree');
  assert.equal(fileAfterTree.showGraph, false);
  const invalidView = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileListView: 'folders' }),
  });
  assert.equal(invalidView.status, 200);
  assert.equal((await invalidView.json()).fileListView, 'tree');

  // The side-panel branch/tag view persists the same way and ignores invalid values.
  const refTree = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refListView: 'tree' }),
  });
  assert.equal(refTree.status, 200);
  assertSettings(await refTree.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: false,
    diffViewer: 'guito',
    showGraph: false,
    showStashes: false,
    fileListView: 'tree',
    refListView: 'tree',
    searchMode: 'navigate',
  });
  const fileAfterRefTree = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(fileAfterRefTree.refListView, 'tree');
  const invalidRefView = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refListView: 'nested' }),
  });
  assert.equal(invalidRefView.status, 200);
  assert.equal((await invalidRefView.json()).refListView, 'tree');

  // The repository panel's initial section state persists as a boolean.
  const sectionsCollapsed = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sidePanelSectionsExpanded: false }),
  });
  assert.equal(sectionsCollapsed.status, 200);
  assert.equal((await sectionsCollapsed.json()).sidePanelSectionsExpanded, false);
  const fileAfterSectionState = JSON.parse(
    await readFile(join(gitDir, 'guito-settings.json'), 'utf8'),
  );
  assert.equal(fileAfterSectionState.sidePanelSectionsExpanded, false);

  const filtered = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ searchMode: 'filter' }),
  });
  assert.equal(filtered.status, 200);
  assert.equal((await filtered.json()).searchMode, 'filter');
  const fileAfterSearchMode = JSON.parse(
    await readFile(join(gitDir, 'guito-settings.json'), 'utf8'),
  );
  assert.equal(fileAfterSearchMode.searchMode, 'filter');
  const invalidSearchMode = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ searchMode: 'find' }),
  });
  assert.equal(invalidSearchMode.status, 200);
  assert.equal((await invalidSearchMode.json()).searchMode, 'filter');

  const caseSensitive = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ searchCaseSensitive: true }),
  });
  assert.equal(caseSensitive.status, 200);
  assert.equal((await caseSensitive.json()).searchCaseSensitive, true);
  const fileAfterSearchCase = JSON.parse(
    await readFile(join(gitDir, 'guito-settings.json'), 'utf8'),
  );
  assert.equal(fileAfterSearchCase.searchCaseSensitive, true);

  // Disabling merge completion persists so the PR dialogs stop offering merge strategies.
  const mergeDisabled = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ allowMerge: false }),
  });
  assert.equal(mergeDisabled.status, 200);
  assert.equal((await mergeDisabled.json()).allowMerge, false);
  const fileAfterMerge = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(fileAfterMerge.allowMerge, false);
  const mergeEnabled = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ allowMerge: true }),
  });
  assert.equal(mergeEnabled.status, 200);
  assert.equal((await mergeEnabled.json()).allowMerge, true);

  const linked = await fetch(`${server.address}/api/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      showTags: false,
      showRemoteBranches: false,
      issueLinking: {
        regex: '#(\\d+)',
        url: 'https://example.test/issues/$1',
        useGlobally: false,
      },
    }),
  });
  assert.equal(linked.status, 200);
  assertSettings(await linked.json(), {
    showTags: false,
    showRemoteBranches: false,
    issueLinking: {
      regex: '#(\\d+)',
      url: 'https://example.test/issues/$1',
      useGlobally: false,
    },
  });

  // A VS Code-provided URL wins over the file and is reported as such.
  const extension = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://vscode/Collection',
    autoReload: false,
    diffViewer: 'vscode',
    sidePanelSectionsExpanded: true,
    searchMode: 'navigate',
    searchCaseSensitive: false,
  });
  context.after(() => extension.close());
  const fromExtension = await fetch(`${extension.address}/api/settings`);
  assertSettings(await fromExtension.json(), {
    azureDevOpsUrl: 'https://vscode/Collection',
    source: 'vscode',
    autoReload: false,
    diffViewer: 'vscode',
    showGraph: false,
    showStashes: false,
    fileListView: 'tree',
    sidePanelSectionsExpanded: true,
    searchMode: 'navigate',
    searchCaseSensitive: false,
  });

  // Changes from VS Code become effective in an already-running session.
  extension.updateSettings({
    azureDevOpsUrl: undefined,
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: true,
    fileListView: 'flat',
    sidePanelSectionsExpanded: undefined,
    searchMode: undefined,
    searchCaseSensitive: undefined,
  });
  const updatedFromExtension = await fetch(`${extension.address}/api/settings`);
  assertSettings(await updatedFromExtension.json(), {
    azureDevOpsUrl: '',
    source: '',
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: true,
    fileListView: 'flat',
    sidePanelSectionsExpanded: false,
    searchMode: 'filter',
    searchCaseSensitive: true,
  });

  // Auto-reload falls back to the settings file when the extension does not
  // pass it, and the extension value wins when it does.
  await writeFile(
    join(gitDir, 'guito-settings.json'),
    JSON.stringify({
      azureDevOpsUrl: 'https://server/DefaultCollection',
      autoReload: false,
    }),
    'utf8',
  );
  const fromFile = await fetch(`${server.address}/api/settings`);
  assertSettings(await fromFile.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
    autoReload: false,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
    searchCaseSensitive: false,
  });
  const reloaded = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    autoReload: true,
  });
  context.after(() => reloaded.close());
  const fromReloaded = await fetch(`${reloaded.address}/api/settings`);
  assertSettings(await fromReloaded.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
    autoReload: true,
    diffViewer: 'guito',
    showGraph: true,
    showStashes: false,
    fileListView: 'flat',
    searchMode: 'navigate',
    searchCaseSensitive: false,
  });
});

test('searches reviewers, work items, and tags through Azure DevOps', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async (method, url, body) => {
      calls.push({ method, url, payload: body ? JSON.parse(body) : undefined });
      if (url.includes('/_apis/identities')) {
        return {
          status: 200,
          body: JSON.stringify({
            value: [
              {
                id: 'uuid-1',
                providerDisplayName: 'Jane Doe',
                properties: { Mail: { $value: 'jane@contoso.com' } },
              },
              { id: 'uuid-2', providerDisplayName: 'John Roe' },
            ],
          }),
        };
      }
      if (url.includes('/_apis/wit/wiql')) {
        return {
          status: 200,
          body: JSON.stringify({ workItems: [{ id: 64 }, { id: 12 }] }),
        };
      }
      if (url.includes('/_apis/wit/workitems?ids=')) {
        return {
          status: 200,
          body: JSON.stringify({
            value: [
              {
                id: 64,
                fields: {
                  'System.Title': 'Fix login',
                  'System.State': 'Active',
                },
              },
              {
                id: 12,
                fields: { 'System.Title': 'Add tests', 'System.State': 'New' },
              },
            ],
          }),
        };
      }
      if (url.includes('/pullrequests?')) {
        return {
          status: 200,
          body: JSON.stringify({
            value: [{ labels: [{ name: 'perf' }, { name: 'ui' }] }],
          }),
        };
      }
      return { status: 404, body: '' };
    },
  });
  context.after(() => server.close());

  const reviewers = await fetch(
    `${server.address}/api/azure-devops/reviewers?query=${encodeURIComponent('jane')}`,
  );
  assert.equal(reviewers.status, 200);
  assert.deepEqual(await reviewers.json(), {
    reviewers: [
      { id: 'uuid-1', label: 'Jane Doe', description: 'jane@contoso.com' },
      { id: 'uuid-2', label: 'John Roe' },
    ],
  });
  assert.match(calls[0].url, /DefaultCollection\/_apis\/identities/);
  assert.match(calls[0].url, /filterValue=jane/);

  const workItems = await fetch(
    `${server.address}/api/azure-devops/workitems?query=${encodeURIComponent('login')}`,
  );
  assert.equal(workItems.status, 200);
  assert.deepEqual(await workItems.json(), {
    workItems: [
      { id: 64, title: 'Fix login', state: 'Active' },
      { id: 12, title: 'Add tests', state: 'New' },
    ],
  });
  // The WIQL query matches the title and, for numeric input, the id too.
  assert.equal(new URL(calls[1].url).searchParams.get('$top'), '20');
  assert.match(calls[1].payload.query, /\[System\.TeamProject\] = @project/);
  assert.match(calls[1].payload.query, /\[System\.Title\] CONTAINS 'login'/);

  const byId = await fetch(
    `${server.address}/api/azure-devops/workitems?query=${encodeURIComponent('64')}`,
  );
  assert.equal(byId.status, 200);
  assert.match(calls[3].payload.query, /\[System\.Id\] = 64/);

  const tags = await fetch(`${server.address}/api/azure-devops/tags`);
  assert.equal(tags.status, 200);
  assert.deepEqual(await tags.json(), { tags: ['perf', 'ui'] });

  // An empty query short-circuits without calling Azure.
  const empty = await fetch(`${server.address}/api/azure-devops/reviewers?query=%20`);
  assert.deepEqual(await empty.json(), { reviewers: [] });
  // 1 identity + 2 x (WIQL + batch) + 1 tags; the empty query adds none.
  assert.equal(calls.length, 6);
});

test('creates a pull request with reviewers, work items, and tags', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);
  const calls = [];
  let labelCalls = 0;
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async (method, url, body) => {
      calls.push({ method, url, payload: body ? JSON.parse(body) : undefined });
      if (url.includes('/labels')) {
        labelCalls++;
        // The second tag fails; the route must report it as a warning.
        return labelCalls === 1
          ? { status: 200, body: '{}' }
          : {
              status: 400,
              body: JSON.stringify({ message: 'TF401027: denied' }),
            };
      }
      return {
        status: 201,
        body: JSON.stringify({
          pullRequestId: 55,
          _links: { web: { href: 'pr-link' } },
        }),
      };
    },
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sourceBranch: 'main',
      targetBranch: 'origin/main',
      reviewers: [
        { id: 'uuid-1', required: true },
        { id: 'uuid-2', required: false },
      ],
      workItems: [64, 'not-a-number', 0],
      labels: ['perf', 'ui'],
      isDraft: true,
    }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.id, 55);
  assert.deepEqual(created.warnings, ['Could not add tag "ui" (HTTP 400).']);

  assert.equal(calls[0].payload.isDraft, true);
  assert.equal(calls[0].payload.targetRefName, 'refs/heads/main');
  // The create payload carries reviewers and only valid work item ids.
  assert.deepEqual(calls[0].payload.reviewers, [
    { id: 'uuid-1', isRequired: true },
    { id: 'uuid-2', isRequired: false },
  ]);
  assert.deepEqual(calls[0].payload.workItemRefs, [{ id: '64' }]);
  // Each tag is added through the labels endpoint after creation.
  assert.equal(calls[1].method, 'POST');
  assert.match(calls[1].url, /pullrequests\/55\/labels\?api-version=5\.0-preview/);
  assert.deepEqual(calls[1].payload, { name: 'perf' });
  assert.deepEqual(calls[2].payload, { name: 'ui' });
});

// Exercise real Git changes made outside the API, including linked worktrees.
test('repository state detects external refs, checkout, index, edits, and configuration', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: repositoryPath, stdio: 'pipe' }).toString().trim();
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());
  const state = async () => {
    const response = await fetch(`${server.address}/api/repository-state`);
    assert.equal(response.status, 200);
    return response.json();
  };
  const initial = await state();
  assert.deepEqual(await state(), initial);
  git('checkout', '-b', 'external');
  const checkout = await state();
  assert.notEqual(checkout.history, initial.history);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(repositoryPath, 'external.txt'), 'one\n');
  const added = await state();
  assert.equal(added.history, checkout.history);
  assert.notEqual(added.working, checkout.working);
  await writeFile(join(repositoryPath, 'external.txt'), 'two lines\nchanged\n');
  assert.notEqual((await state()).working, added.working);
  git('add', '.');
  const staged = await state();
  git('commit', '-m', 'Outside Guito');
  const committed = await state();
  assert.notEqual(committed.history, staged.history);
  assert.notEqual(committed.working, staged.working);
  git('config', 'user.name', 'Correct Name');
  assert.notEqual((await state()).history, committed.history);
  const beforeDetached = await state();
  git('checkout', '--detach');
  assert.notEqual((await state()).history, beforeDetached.history);
  git('tag', 'outside-tag');
  const tagged = await state();
  git('pack-refs', '--all');
  assert.deepEqual(await state(), tagged);

  const linked = join(repositoryPath, 'linked');
  git('worktree', 'add', '-b', 'linked-branch', linked);
  const linkedServer = await startGuitoServer({
    repositoryPath: linked,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => linkedServer.close());
  const linkedState = async () =>
    (await fetch(`${linkedServer.address}/api/repository-state`)).json();
  const previous = await linkedState();
  execFileSync('git', ['checkout', '--detach'], {
    cwd: linked,
    stdio: 'ignore',
  });
  assert.notEqual((await linkedState()).history, previous.history);
});

test('author names use matching Git config and respect other authors and mailmaps', async (context) => {
  const repositoryPath = await createRepository();
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: repositoryPath, stdio: 'pipe' }).toString().trim();
  git('config', 'user.name', 'Correct Name');
  git('commit', '--allow-empty', '--author=Other Author <other@example.test>', '-m', 'Other');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(repositoryPath, '.mailmap'), 'Canonical Other <other@example.test>\n');
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
  });
  context.after(() => server.close());
  const repo = await (await fetch(`${server.address}/api/repo`)).json();
  assert.deepEqual(repo.identity, {
    name: 'Correct Name',
    email: 'guito@example.test',
  });
  const { commits } = await (await fetch(`${server.address}/api/commits`)).json();
  assert.equal(commits[0].author_name, 'Canonical Other');
  assert.equal(commits[1].author_name, 'Correct Name');
  for (const commit of commits) {
    const detail = await (
      await fetch(`${server.address}/api/commit/detail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hash: commit.hash }),
      })
    ).json();
    assert.equal(detail.author_name, commit.author_name);
  }
});

test('avatar cache normalizes email, deduplicates requests, and caches missing images', async () => {
  const { avatarCache } = await import('../bin/avatars.js');
  const { createHash } = await import('node:crypto');
  const calls = [];
  const cache = avatarCache(async (url) => {
    calls.push(url);
    return new Response('image', { headers: { 'content-type': 'image/png' } });
  });
  const images = await Promise.all([cache(' User@Example.com '), cache('user@example.com')]);
  assert.equal(calls.length, 1);
  assert.equal(images[0].data.toString(), 'image');
  assert.equal(images[0], images[1]);
  assert.match(calls[0], new RegExp(createHash('sha256').update('user@example.com').digest('hex')));
  let missing = 0;
  const negativeCache = avatarCache(async () => {
    missing++;
    return new Response('', { status: 404 });
  });
  assert.equal(await negativeCache('missing@example.test'), null);
  assert.equal(await negativeCache('missing@example.test'), null);
  assert.equal(missing, 1);
});

test('PR tags page through history and fetch omitted labels', async (context) => {
  const { repositoryPath } = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://azure.example/DefaultCollection',
    azureRequestImpl: async (method, url) => {
      calls.push(url);
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/1/labels')) {
        return {
          status: 200,
          body: JSON.stringify({ value: [{ name: 'fetched' }] }),
        };
      }
      const skip = parsed.searchParams.get('$skip');
      const value =
        skip === '0'
          ? Array.from({ length: 100 }, (_, i) =>
              i === 0
                ? { pullRequestId: 1 }
                : { pullRequestId: i + 1, labels: [{ name: 'shared' }] },
            )
          : [
              {
                pullRequestId: 101,
                labels: [{ name: 'last-page' }, { name: 'shared' }],
              },
            ];
      return { status: 200, body: JSON.stringify({ value }) };
    },
  });
  context.after(() => server.close());
  const response = await fetch(`${server.address}/api/azure-devops/tags`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tags: ['fetched', 'last-page', 'shared'],
  });
  assert.equal(calls.length, 3);
  assert.match(calls[2], /\$skip=100/);
});
