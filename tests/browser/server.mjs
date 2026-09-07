import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startGuitoServer } from '../../bin/guito-server.js';

const root = await mkdtemp(join(tmpdir(), 'guito-browser-test-'));
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
git('init'); git('config', 'user.name', 'Browser Test'); git('config', 'user.email', 'browser@example.test');
await writeFile(join(root, 'example.txt'), 'original\n'); git('add', '.'); git('commit', '-m', 'Browser fixture');
await writeFile(join(root, 'example.txt'), 'changed\n');
const server = await startGuitoServer({ repositoryPath: root, uiRoot: resolve('bin/ui'), host: '127.0.0.1', port: 4173, apiToken: 'browser-test-token' });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close(); await rm(root, { recursive: true, force: true }); process.exit();
}
process.on('SIGTERM', close); process.on('SIGINT', close);
