import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  buildAzurePullRequestUrl,
  parseAzureRemoteUrl,
  startGuitoServer,
} from '../bin/guito-server.js';

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
    'https://server/DefaultCollection/Project/_git/Repo/pullrequests?api-version=4.1',
  );
  // A bare host base must not lose the collection path.
  assert.equal(
    buildAzurePullRequestUrl('https://server', remote),
    'https://server/DefaultCollection/Project/_git/Repo/pullrequests?api-version=4.1',
  );
  // Trailing slashes on the base are trimmed.
  assert.equal(
    buildAzurePullRequestUrl('https://server/DefaultCollection/', remote),
    'https://server/DefaultCollection/Project/_git/Repo/pullrequests?api-version=4.1',
  );
  // Encoded project segments are re-encoded in the REST URL.
  assert.equal(
    buildAzurePullRequestUrl(
      'https://server/tfs',
      'https://server/tfs/My%20Project/_git/My%20Repo',
    ),
    'https://server/tfs/My%20Project/_git/My%20Repo/pullrequests?api-version=4.1',
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
    'https://azure.example/DefaultCollection/Project/_git/Repo/pullrequests?api-version=4.1',
  );
  assert.deepEqual(calls[0].payload, {
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
        body: JSON.stringify({ pullRequestId: 7, _links: { web: { href: 'x' } } }),
      };
    },
  });
  context.after(() => server.close());

  const response = await fetch(`${server.address}/api/azure-devops/pullrequest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceBranch: '', targetBranch: 'main', newBranch: true }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.match(created.branch, /^pr\/[a-z0-9]{6}$/);

  // The random branch was pushed to the remote as the PR source.
  assert.ok(remoteBranches(remotePath).includes(`refs/heads/${created.branch}`));
  assert.deepEqual(calls[0].payload, {
    sourceRefName: `refs/heads/${created.branch}`,
    targetRefName: 'refs/heads/main',
  });
});

test('publishes a local-only source branch before creating the pull request', async (context) => {
  const { repositoryPath, remotePath } = await createAzureRepository(context);
  execFileSync('git', ['checkout', '-b', 'feature'], { cwd: repositoryPath, stdio: 'ignore' });
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
      body: JSON.stringify({ pullRequestId: 9, _links: { web: { href: 'x' } } }),
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
    body: JSON.stringify({ azureDevOpsUrl: 'https://server/DefaultCollection' }),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
  });

  const loaded = await fetch(`${server.address}/api/settings`);
  assert.equal(loaded.status, 200);
  assert.deepEqual(await loaded.json(), {
    azureDevOpsUrl: 'https://server/DefaultCollection',
    source: 'file',
  });

  // The settings file lives in the repository's git directory.
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: repositoryPath })
    .toString()
    .trim();
  const settings = JSON.parse(await readFile(join(gitDir, 'guito-settings.json'), 'utf8'));
  assert.equal(settings.azureDevOpsUrl, 'https://server/DefaultCollection');

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
  assert.deepEqual(await cleared.json(), { azureDevOpsUrl: '', source: '' });

  // A VS Code-provided URL wins over the file and is reported as such.
  const extension = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    azureDevOpsUrl: 'https://vscode/Collection',
  });
  context.after(() => extension.close());
  const fromExtension = await fetch(`${extension.address}/api/settings`);
  assert.deepEqual(await fromExtension.json(), {
    azureDevOpsUrl: 'https://vscode/Collection',
    source: 'vscode',
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
      if (url.includes('/_apis/identitypicker/identities')) {
        return {
          status: 200,
          body: JSON.stringify([
            { id: 'uuid-1', label: 'Jane Doe', description: 'jane@contoso.com' },
            { id: 'uuid-2', label: 'John Roe' },
          ]),
        };
      }
      if (url.includes('/_apis/wit/wiql')) {
        return { status: 200, body: JSON.stringify({ workItems: [{ id: 64 }, { id: 12 }] }) };
      }
      if (url.includes('/_apis/wit/workitems?ids=')) {
        return {
          status: 200,
          body: JSON.stringify({
            value: [
              { id: 64, fields: { 'System.Title': 'Fix login', 'System.State': 'Active' } },
              { id: 12, fields: { 'System.Title': 'Add tests', 'System.State': 'New' } },
            ],
          }),
        };
      }
      if (url.includes('/_apis/wit/tags')) {
        return { status: 200, body: JSON.stringify({ value: [{ name: 'perf' }, { name: 'ui' }] }) };
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
  assert.match(calls[0].url, /identitypicker\/identities/);
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
  assert.match(calls[1].payload.query, /\[System\.Title\] CONTAINS 'login'/);

  const byId = await fetch(
    `${server.address}/api/azure-devops/workitems?query=${encodeURIComponent('64')}`,
  );
  assert.equal(byId.status, 200);
  assert.match(calls[3].payload.query, /\[System\.Id\] = '64'/);

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
          : { status: 400, body: JSON.stringify({ message: 'TF401027: denied' }) };
      }
      return {
        status: 201,
        body: JSON.stringify({ pullRequestId: 55, _links: { web: { href: 'pr-link' } } }),
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
      reviewers: [
        { id: 'uuid-1', required: true },
        { id: 'uuid-2', required: false },
      ],
      workItems: [64, 'not-a-number', 0],
      labels: ['perf', 'ui'],
    }),
  });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.id, 55);
  assert.deepEqual(created.warnings, ['Could not add tag "ui" (HTTP 400).']);

  // The create payload carries reviewers and only valid work item ids.
  assert.deepEqual(calls[0].payload.reviewers, [
    { id: 'uuid-1', isRequired: true },
    { id: 'uuid-2', isRequired: false },
  ]);
  assert.deepEqual(calls[0].payload.workItems, [{ id: 64 }]);
  // Each tag is added through the labels endpoint after creation.
  assert.equal(calls[1].method, 'POST');
  assert.match(calls[1].url, /pullrequests\/55\/labels\?api-version=4\.1/);
  assert.deepEqual(calls[1].payload, { name: 'perf' });
  assert.deepEqual(calls[2].payload, { name: 'ui' });
});
