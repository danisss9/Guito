import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { startGuitoServer } from '../bin/guito-server.js';

async function fixture(t, initial = true) {
  const root = await mkdtemp(join(tmpdir(), 'guito-working-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init'); git('config', 'user.name', 'Guito Test'); git('config', 'user.email', 'guito@example.test');
  git('config', 'core.autocrlf', 'false');
  if (initial) { await writeFile(join(root, 'file.txt'), 'original\n'); git('add', '.'); git('commit', '-m', 'Initial'); }
  const server = await startGuitoServer({ repositoryPath: root, uiRoot: resolve('bin/ui'), host: '127.0.0.1', port: 0 });
  t.after(async () => { await server.close(); await rm(root, { recursive: true, force: true }); });
  const post = async (path, body, status = 200) => {
    const response = await fetch(`${server.address}/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value)); return value;
  };
  const working = async () => {
    const response = await fetch(`${server.address}/api/working-changes`);
    const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
  };
  return { root, git, post, working, write: (path, text) => writeFile(join(root, path), text) };
}

test('partial staging exposes both diffs and commits only the index', async t => {
  const f = await fixture(t);
  await f.write('file.txt', 'staged\n'); await f.post('stage', { files: ['file.txt'] });
  await f.write('file.txt', 'working\n'); await f.write('loose.txt', 'untracked\n');
  const status = await f.working();
  assert.deepEqual(status.staged, ['file.txt']); assert.deepEqual(status.unstaged, ['file.txt']);
  assert.ok(status.stagedFiles[0].lines.some(line => line.type === 'add' && line.text === 'staged'));
  assert.ok(status.unstagedFiles[0].lines.some(line => line.type === 'add' && line.text === 'working'));
  assert.equal((await f.post('file-content', { path: 'file.txt', ref: 'INDEX' })).content, 'staged\n');
  await f.post('commit', { message: '  Commit index  ', description: 'First paragraph\n\nSecond paragraph' });
  assert.equal(f.git('show', 'HEAD:file.txt'), 'staged\n');
  assert.match(f.git('log', '-1', '--format=%B'), /Commit index\n\nFirst paragraph\n\nSecond paragraph/);
  assert.equal(await readFile(join(f.root, 'file.txt'), 'utf8'), 'working\n');
  assert.deepEqual((await f.working()).untracked, ['loose.txt']);
});

test('opposing index and working edits remain visible', async t => {
  const f = await fixture(t);
  await f.write('file.txt', 'staged\n'); await f.post('stage', { files: ['file.txt'] });
  await f.write('file.txt', 'original\n');
  assert.equal(f.git('diff', 'HEAD'), '');
  const status = await f.working();
  assert.equal(status.files.length, 1); assert.equal(status.stagedFiles.length, 1); assert.equal(status.unstagedFiles.length, 1);
  await f.post('unstage', { files: ['file.txt'] });
  assert.equal((await f.working()).files.length, 0);
});

test('initial repository supports stage, unstage, and first commit without losing files', async t => {
  const f = await fixture(t, false);
  assert.equal((await f.working()).files.length, 0);
  await f.write('new.txt', 'first\n');
  assert.deepEqual((await f.working()).untracked, ['new.txt']);
  await f.post('stage', { files: ['new.txt'] });
  assert.deepEqual((await f.working()).staged, ['new.txt']);
  await f.post('unstage', { files: ['new.txt'] });
  assert.equal(await readFile(join(f.root, 'new.txt'), 'utf8'), 'first\n');
  await f.post('stage', { files: ['new.txt'] }); await f.post('commit', { message: 'First commit' });
  assert.equal((await f.working()).files.length, 0);
});

test('bulk stage and unstage preserve literal unusual names and binary files', async t => {
  const f = await fixture(t);
  const paths = ['[ab].txt', 'a.txt', '-leading.txt', 'space name.txt', 'café.txt'];
  if (process.platform !== 'win32') paths.push('line\nbreak.txt', 'tab\tname.txt');
  for (const path of paths) await f.write(path, 'new\n');
  await f.write('binary.dat', Buffer.from([0, 1, 2]));
  await f.post('stage', { files: ['[ab].txt'] });
  assert.deepEqual((await f.working()).staged, ['[ab].txt']);
  await f.post('stage', { files: [...paths, 'binary.dat'] });
  const status = await f.working();
  assert.deepEqual(new Set(status.staged), new Set([...paths, 'binary.dat']));
  assert.equal(status.stagedFiles.find(f => f.path === 'binary.dat').status, 'binary');
  await f.post('unstage', { files: [...paths, 'binary.dat'] });
  assert.equal((await f.working()).staged.length, 0);
  for (const path of paths) assert.equal(await readFile(join(f.root, path), 'utf8'), 'new\n');
});

test('renames unstage both paths and deletions can be staged and committed', async t => {
  const f = await fixture(t);
  await rename(join(f.root, 'file.txt'), join(f.root, 'renamed.txt'));
  await f.post('stage', { files: ['file.txt', 'renamed.txt'] });
  const status = await f.working();
  assert.equal(status.stagedFiles[0].status, 'renamed');
  assert.equal(status.stagedFiles[0].oldPath, 'file.txt');
  await f.post('unstage', { files: ['renamed.txt'] });
  assert.equal((await f.working()).staged.length, 0);
  assert.equal(await readFile(join(f.root, 'renamed.txt'), 'utf8'), 'original\n');
  await f.post('stage', { files: ['file.txt'] });
  assert.equal((await f.working()).stagedFiles[0].status, 'deleted');
  await f.post('commit', { message: 'Delete original' });
  assert.equal(f.git('ls-tree', '--name-only', 'HEAD'), '');
});

test('invalid paths, empty commits, subjects, and unresolved conflicts are rejected', async t => {
  const f = await fixture(t);
  for (const files of [[], ['../outside'], ['.'], ['.git/config'], [f.root], [12], ['missing.txt']]) {
    await f.post('stage', { files }, 400);
  }
  await f.post('commit', { message: '' }, 400);
  await f.post('commit', { message: '   ' }, 400);
  await f.post('commit', { message: 'Empty index' }, 400);
  const branch = f.git('branch', '--show-current').trim();
  f.git('checkout', '-b', 'other'); await f.write('file.txt', 'other\n'); f.git('commit', '-am', 'Other');
  f.git('checkout', branch); await f.write('file.txt', 'main\n'); f.git('commit', '-am', 'Main');
  assert.throws(() => f.git('merge', 'other'));
  assert.deepEqual((await f.working()).conflicted, ['file.txt']);
  await f.post('commit', { message: 'Unresolved' }, 400);
});

test('a staged rename can be edited and staged again', async t => {
  const f = await fixture(t);
  await rename(join(f.root, 'file.txt'), join(f.root, 'renamed.txt'));
  await f.post('stage', { files: ['file.txt', 'renamed.txt'] });
  await f.write('renamed.txt', 'original\nmore content\n');
  await f.post('stage', { files: ['renamed.txt'] });
  assert.equal((await f.working()).unstaged.length, 0);
  assert.equal(f.git('show', ':renamed.txt'), 'original\nmore content\n');
});

test('simultaneous commit requests cannot create an extra empty commit', async t => {
  const f = await fixture(t);
  await f.write('file.txt', 'indexed\n'); await f.post('stage', { files: ['file.txt'] });
  const outcomes = await Promise.allSettled([
    f.post('commit', { message: 'First' }), f.post('commit', { message: 'Second' }),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.git('rev-list', '--count', 'HEAD').trim(), '2');
});
