// Optional Windows smoke test using an isolated VS Code profile and repository.
// Run after npm run build: node tests/browser/vscode-smoke.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = await mkdtemp(join(tmpdir(), 'guito-vscode-smoke-'));
const repository = join(root, 'repository');
const profile = join(root, 'profile');
await mkdir(repository); await mkdir(join(profile, 'User'), { recursive: true });
await writeFile(join(profile, 'User', 'settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none',
  'update.mode': 'none', 'extensions.autoUpdate': false, 'telemetry.telemetryLevel': 'off',
  'window.dialogStyle': 'custom',
}));
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
git('init'); git('config', 'user.name', 'Extension Test'); git('config', 'user.email', 'extension@example.test');
await writeFile(join(repository, 'example.txt'), 'original\n'); git('add', '.'); git('commit', '-m', 'Extension fixture');
await writeFile(join(repository, 'example.txt'), 'updated\n');
const executable = process.env.GUITO_CODE_EXE || join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe');
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.VSCODE_IPC_HOOK_CLI;
const child = spawn(executable, [
  `--user-data-dir=${profile}`, `--extensions-dir=${join(root, 'extensions')}`,
  `--extensionDevelopmentPath=${resolve('vscode-extension')}`, '--remote-debugging-port=9347',
  '--skip-welcome', '--skip-release-notes', '--disable-gpu', '--new-window', repository,
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: environment });
let launchError = '';
child.stderr.on('data', chunk => { launchError += chunk.toString(); });
let browser;
let workbench;
try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9347'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  assert.ok(browser, `VS Code remote debugging did not start (exit ${child.exitCode}): ${launchError}`);
  const context = browser.contexts()[0];
  let page;
  while (Date.now() < deadline) {
    page = context.pages().find(page => page.url().includes('workbench.html'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(page, `VS Code workbench did not open: ${context.pages().map(page => page.url()).join(', ')}`);
  workbench = page;
  await page.locator('.monaco-workbench').waitFor();
  await page.locator('.statusbar-item').filter({ hasText: 'Guito' }).click();
  let app;
  const appDeadline = Date.now() + 30000;
  while (Date.now() < appDeadline) {
    app = page.frames().find(frame => /^http:\/\/127\.0\.0\.1:\d+\//.test(frame.url()));
    if (app) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(app, 'Guito iframe did not open');
  await app.locator('.list-viewport .row').first().waitFor();
  assert.match(await app.locator('.list-viewport .row').first().textContent(), /Extension fixture/);
  await app.locator('.working-row').click();
  await app.getByRole('option', { name: 'example.txt' }).waitFor();
  await app.getByRole('button', { name: 'Stage all', exact: true }).click();
  await app.getByRole('listbox', { name: 'staged files', exact: true }).getByRole('option', { name: 'example.txt' }).waitFor();
  await app.getByLabel('Commit message', { exact: true }).fill('Commit from extension smoke test');
  await app.getByRole('button', { name: 'Commit staged changes' }).click();
  await app.getByText('No staged changes.', { exact: true }).waitFor();
  assert.equal(git('log', '-1', '--format=%s').trim(), 'Commit from extension smoke test');
  assert.equal(git('status', '--porcelain'), '');
  git('checkout', '-b', 'external-checkout');
  git('commit', '--allow-empty', '-m', 'External extension commit');
  await app.locator('.list-viewport .row').filter({ hasText: 'External extension commit' }).waitFor({ timeout: 15000 });
  assert.match(await app.locator('.list-viewport .row').first().textContent(), /external-checkout/);
  await app.getByTitle('Settings').click();
  await page.locator('.settings-editor').waitFor({ timeout: 15000 });
  await page.getByText('Guito: Show Graph', { exact: false }).waitFor({ timeout: 15000 });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/vscode-smoke.png' });
  console.log('VS Code smoke passed: authenticated nested iframe, Git workflow, external refresh, and native extension settings.');
} catch (error) {
  await mkdir('test-results', { recursive: true });
  await workbench?.screenshot({ path: 'test-results/vscode-smoke-failure.png' }).catch(() => {});
  if (workbench) console.log(await workbench.locator('.quick-input-widget').innerText().catch(() => 'No command palette'));
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (child.pid) {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
  // root is the explicit mkdtemp directory created by this test.
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '\\'));
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
