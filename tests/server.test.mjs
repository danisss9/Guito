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
