import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { startGuitoServer } from '../bin/guito-server.js';

// ==================== Code review of uncommitted changes ====================
// The reviewer runs the Claude Code CLI over the working tree, and the fixer
// runs it again with edit tools for one finding; the CLI is faked so the tests
// cover the routes, the argument wiring and the stored state.

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'guito-working-review-'));
  execFileSync('git', ['init'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Guito Test'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'guito@example.test'], { cwd: directory });
  await writeFile(join(directory, 'app.js'), 'const a = 1;\nconst b = 2;\n');
  execFileSync('git', ['add', 'app.js'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: directory, stdio: 'ignore' });
  return directory;
}

const post = (server, path, body = {}) =>
  fetch(`${server.address}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const getState = async (server) =>
  (await (await fetch(`${server.address}/api/working-review`)).json()).state;

/** Starts a server whose Claude CLI is a fake answering with `respond`. */
async function startReviewServer(context, respond) {
  const repositoryPath = await createRepository();
  const prompts = [];
  const cliCalls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    aiReview: { enabled: false, model: 'opus', effort: 'high' },
    aiReviewModelImpl: async (prompt, cliOptions) => {
      prompts.push(prompt);
      cliCalls.push(cliOptions);
      const reply = await respond(prompt, cliOptions);
      return typeof reply === 'string' ? reply : JSON.stringify(reply);
    },
  });
  context.after(async () => {
    await server.close();
    await rm(repositoryPath, { recursive: true, force: true });
  });
  return { server, repositoryPath, prompts, cliCalls };
}

const envelope = (result) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: typeof result === 'string' ? result : JSON.stringify(result),
});

const review = {
  summary: 'Adds a third constant.',
  findings: [
    {
      file: 'app.js',
      line: 3,
      endLine: null,
      severity: 'nit',
      title: 'Unused constant',
      comment: '`c` is never read.',
    },
    {
      file: 'app.js',
      line: 99,
      severity: 'blocker',
      title: 'Bad anchor',
      comment: 'Line 99 is not in the diff.',
    },
  ],
};

test('reviews staged, unstaged and untracked changes and keeps the result', async (context) => {
  const { server, repositoryPath, prompts, cliCalls } = await startReviewServer(context, () =>
    envelope(review),
  );
  await writeFile(join(repositoryPath, 'app.js'), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  await writeFile(join(repositoryPath, 'new.js'), 'export {};\n');

  const state = await server.workingReview.run();
  assert.equal(state.status, 'done');
  assert.equal(state.summary, 'Adds a third constant.');
  assert.deepEqual(state.files.sort(), ['app.js', 'new.js']);
  assert.match(prompts[0], /--- FILE: app\.js/);
  assert.match(prompts[0], /--- FILE: new\.js/);
  assert.deepEqual(cliCalls[0].args.slice(0, 4), ['-p', '--no-session-persistence', '--output-format', 'json']);
  assert.ok(!cliCalls[0].args.includes('--permission-mode'));

  // The blocker anchored outside the diff loses its line but is kept.
  assert.equal(state.findings[0].severity, 'blocker');
  assert.equal(state.findings[0].line, null);
  assert.equal(state.findings[1].line, 3);

  const stored = JSON.parse(
    await readFile(join(repositoryPath, '.git', 'guito-working-review.json'), 'utf8'),
  );
  assert.equal(stored.status, 'done');
  assert.equal(stored.findings.length, 2);
  assert.deepEqual(await getState(server), state);
});

test('reports an error when there is nothing to review', async (context) => {
  const { server, cliCalls } = await startReviewServer(context, () => envelope(review));
  const state = await server.workingReview.run();
  assert.equal(state.status, 'error');
  assert.match(state.error, /no uncommitted changes/);
  assert.equal(cliCalls.length, 0);
});

test('starts from the route, refuses a second run, and can be cancelled', async (context) => {
  let release;
  const { server, repositoryPath, cliCalls } = await startReviewServer(
    context,
    (_prompt, { signal }) =>
      new Promise((resolve, reject) => {
        release = () => resolve(envelope(review));
        signal.addEventListener('abort', () => reject(new Error('The review was cancelled.')));
      }),
  );
  await writeFile(join(repositoryPath, 'app.js'), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  const changes = [];
  server.workingReview.onChange((state) => changes.push(state.status));

  const started = await post(server, '/api/working-review');
  assert.equal(started.status, 200);
  assert.equal((await started.json()).state.status, 'running');

  const second = await post(server, '/api/working-review');
  assert.equal(second.status, 409);

  while (!cliCalls.length) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(cliCalls[0].signal.aborted, false);
  await post(server, '/api/working-review/cancel');
  while ((await getState(server)).status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(cliCalls[0].signal.aborted, true);
  assert.equal((await getState(server)).status, 'cancelled');
  assert.deepEqual(changes, ['running', 'cancelled']);
  release?.();
});

test('fixes one finding with edit tools and records what changed', async (context) => {
  const { server, repositoryPath, prompts, cliCalls } = await startReviewServer(
    context,
    (_prompt, { args }) =>
      args.includes('--permission-mode') ? envelope('Removed the unused constant.') : envelope(review),
  );
  await writeFile(join(repositoryPath, 'app.js'), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  const reviewed = await server.workingReview.run();
  const nit = reviewed.findings.find((finding) => finding.title === 'Unused constant');

  const started = await post(server, `/api/working-review/findings/${nit.id}/fix`);
  assert.equal(started.status, 200);
  const running = (await started.json()).state;
  assert.equal(running.fixingId, nit.id);
  assert.equal(running.findings.find((finding) => finding.id === nit.id).fix.status, 'running');

  let state = await getState(server);
  while (state.fixingId) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    state = await getState(server);
  }
  const fixed = state.findings.find((finding) => finding.id === nit.id);
  assert.equal(fixed.fix.status, 'fixed');
  assert.equal(fixed.fix.summary, 'Removed the unused constant.');

  const fixCall = cliCalls[1];
  const mode = fixCall.args.indexOf('--permission-mode');
  assert.equal(fixCall.args[mode + 1], 'acceptEdits');
  const tools = fixCall.args.indexOf('--allowedTools');
  assert.equal(fixCall.args[tools + 1], 'Read,Edit,Write,Glob,Grep');
  assert.equal(fixCall.cwd, repositoryPath);
  assert.match(prompts[1], /WHERE: app\.js, line 3/);
  assert.match(prompts[1], /PROBLEM: Unused constant/);

  const missing = await post(server, '/api/working-review/findings/nope/fix');
  assert.equal(missing.status, 400);
});
