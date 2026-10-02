import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { startGuitoServer } from '../bin/guito-server.js';

// ==================== AI commit message ====================
// The drafter runs the Claude Code CLI over the pending changes; the CLI is
// faked so the tests cover the prompt, the argument wiring and the reply
// parsing without installing anything.

/** Clones do not inherit user.* config, so every committing repo needs one. */
function configureIdentity(directory) {
  execFileSync('git', ['config', 'user.name', 'Guito Test'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'guito@example.test'], { cwd: directory });
}

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), 'guito-message-'));
  execFileSync('git', ['init'], { cwd: directory, stdio: 'ignore' });
  configureIdentity(directory);
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Initial commit'], {
    cwd: directory,
    stdio: 'ignore',
  });
  return directory;
}

const post = (server, path, body = {}) =>
  fetch(`${server.address}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Starts a server whose Claude CLI is a recorded fake. */
async function startMessageServer(context, replies, options = {}) {
  const repositoryPath = await createRepository();
  const prompts = [];
  const cliCalls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve('bin/ui'),
    host: '127.0.0.1',
    port: 0,
    aiReview: { enabled: false, ...options.aiReview },
    aiReviewModelImpl: async (prompt, cliOptions) => {
      prompts.push(prompt);
      cliCalls.push(cliOptions);
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      return typeof reply === 'string' ? reply : JSON.stringify(reply);
    },
  });
  context.after(async () => {
    await server.close();
    await rm(repositoryPath, { recursive: true, force: true });
  });
  return { server, repositoryPath, prompts, cliCalls };
}

/** The model the CLI was told to use, or "" when it was left to its default. */
const modelArg = (cliCall) => {
  const index = cliCall.args.indexOf('--model');
  return index === -1 ? '' : cliCall.args[index + 1];
};

/** The effort the CLI was told to use, or "" when it was left to its default. */
const effortArg = (cliCall) => {
  const index = cliCall.args.indexOf('--effort');
  return index === -1 ? '' : cliCall.args[index + 1];
};

const jsonReply = (message) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '```json\n' + JSON.stringify(message) + '\n```',
});

test('drafts a message from the staged changes with the haiku default', async (context) => {
  const { server, repositoryPath, prompts, cliCalls } = await startMessageServer(context, [
    jsonReply({ subject: 'Guard the login route', description: 'Reject empty names.' }),
  ]);
  await writeFile(join(repositoryPath, 'a.txt'), 'export const ok = true;\n');
  execFileSync('git', ['add', 'a.txt'], { cwd: repositoryPath, stdio: 'ignore' });

  const response = await post(server, '/api/commit-message');
  const message = await response.json();
  assert.equal(response.status, 200, JSON.stringify(message));
  assert.equal(message.subject, 'Guard the login route');
  // The oneliner default keeps only the subject, even when a body comes back.
  assert.equal(message.description, '');
  assert.equal(message.scope, 'staged');
  assert.equal(message.model, 'haiku');

  // Print mode with the JSON envelope and no extra arguments.
  assert.deepEqual(cliCalls[0].args, [
    '-p',
    '--output-format',
    'json',
    '--model',
    'haiku',
    '--effort',
    'low',
  ]);
  // A subject is a small question; it must not inherit the review timeout.
  assert.equal(cliCalls[0].timeoutMs, 120000);
  assert.equal(cliCalls[0].cwd, repositoryPath);

  // The prompt carries the staged diff and the repository's style.
  assert.match(prompts[0], /staged for the next commit/);
  assert.match(prompts[0], /--- a\.txt \[added\] ---/);
  assert.match(prompts[0], /\+export const ok = true;/);
  assert.match(prompts[0], /- Initial commit/);
  assert.match(prompts[0], /the subject line is the whole message/);
});

test('falls back to every uncommitted change when nothing is staged', async (context) => {
  const { server, repositoryPath, prompts } = await startMessageServer(context, [
    jsonReply({ subject: 'Log failures', description: '' }),
  ]);
  await writeFile(join(repositoryPath, 'b.txt'), 'new file\n');

  const response = await post(server, '/api/commit-message');
  const message = await response.json();
  assert.equal(response.status, 200, JSON.stringify(message));
  assert.equal(message.scope, 'working');
  assert.match(prompts[0], /Nothing is staged yet/);
  assert.match(prompts[0], /\+new file/);
});

test('the host drafts through the same path as the endpoint', async (context) => {
  // The VS Code Source Control button calls this instead of the HTTP route.
  const { server, repositoryPath, cliCalls } = await startMessageServer(
    context,
    [jsonReply({ subject: 'Add a greeting', description: 'Say hello.' })],
    { aiReview: { commitMessageStyle: 'brief' } },
  );
  await writeFile(join(repositoryPath, 'c.txt'), 'hello\n');
  execFileSync('git', ['add', 'c.txt'], { cwd: repositoryPath, stdio: 'ignore' });

  const message = await server.generateCommitMessage();
  assert.deepEqual(message, {
    subject: 'Add a greeting',
    description: 'Say hello.',
    scope: 'staged',
    model: 'haiku',
  });
  assert.equal(cliCalls.length, 1);
});

test('refuses to draft when the working tree is clean', async (context) => {
  const { server, prompts } = await startMessageServer(context, []);
  const response = await post(server, '/api/commit-message');
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /no changes to write a commit message about/i);
  assert.equal(prompts.length, 0);
});

test('uses the configured commit message model, overridable per request', async (context) => {
  const { server, repositoryPath, cliCalls } = await startMessageServer(
    context,
    [
      jsonReply({ subject: 'Opus pick', description: '' }),
      jsonReply({ subject: 'Sonnet pick', description: '' }),
    ],
    { aiReview: { commitMessageModel: 'opus' } },
  );
  await writeFile(join(repositoryPath, 'd.txt'), 'change\n');

  const configured = await post(server, '/api/commit-message');
  assert.equal((await configured.json()).model, 'opus');
  assert.equal(modelArg(cliCalls[0]), 'opus');

  await writeFile(join(repositoryPath, 'e.txt'), 'more change\n');
  const overridden = await post(server, '/api/commit-message', { model: 'sonnet' });
  assert.equal((await overridden.json()).model, 'sonnet');
  assert.equal(modelArg(cliCalls[1]), 'sonnet');
});

test('passes the configured commit message effort, low by default', async (context) => {
  const configured = await startMessageServer(
    context,
    [jsonReply({ subject: 'Medium effort pick', description: '' })],
    { aiReview: { commitMessageEffort: 'medium', effort: 'max' } },
  );
  await writeFile(join(configured.repositoryPath, 'f.txt'), 'change\n');
  assert.equal((await post(configured.server, '/api/commit-message')).status, 200);
  assert.equal(effortArg(configured.cliCalls[0]), 'medium');

  const unset = await startMessageServer(context, [
    jsonReply({ subject: 'Default effort pick', description: '' }),
  ]);
  await writeFile(join(unset.repositoryPath, 'g.txt'), 'change\n');
  assert.equal((await post(unset.server, '/api/commit-message')).status, 200);
  assert.equal(effortArg(unset.cliCalls[0]), 'low');

  const claudeDefault = await startMessageServer(
    context,
    [jsonReply({ subject: 'Claude Code effort pick', description: '' })],
    { aiReview: { commitMessageEffort: '' } },
  );
  await writeFile(join(claudeDefault.repositoryPath, 'h.txt'), 'change\n');
  assert.equal((await post(claudeDefault.server, '/api/commit-message')).status, 200);
  assert.equal(effortArg(claudeDefault.cliCalls[0]), '');
});

test('the commit message style shapes the prompt and the description', async (context) => {
  const reply = { subject: 'Add the style setting', description: 'Pick how long drafts are.' };
  const expected = {
    oneliner: { prompt: /the subject line is the whole message/, description: '' },
    brief: { prompt: /one to three short sentences/, description: reply.description },
    descriptive: { prompt: /a full body explaining what changed/, description: reply.description },
  };
  for (const [style, { prompt, description }] of Object.entries(expected)) {
    const { server, repositoryPath, prompts } = await startMessageServer(
      context,
      [jsonReply(reply)],
      { aiReview: { commitMessageStyle: style } },
    );
    await writeFile(join(repositoryPath, 'h.txt'), 'change\n');
    const message = await (await post(server, '/api/commit-message')).json();
    assert.match(prompts[0], prompt, style);
    assert.equal(message.description, description, style);
  }

  // An unknown style keeps the oneliner default.
  const unknown = await startMessageServer(context, [jsonReply(reply)], {
    aiReview: { commitMessageStyle: 'essay' },
  });
  await writeFile(join(unknown.repositoryPath, 'i.txt'), 'change\n');
  const message = await (await post(unknown.server, '/api/commit-message')).json();
  assert.equal(message.description, '');
});

test('reads a plain-text reply when the model skips the JSON contract', async (context) => {
  const { server, repositoryPath } = await startMessageServer(
    context,
    ['Fix the login guard\n\nThe empty name check ran after the redirect.\n'],
    { aiReview: { commitMessageStyle: 'descriptive' } },
  );
  await writeFile(join(repositoryPath, 'e.txt'), 'change\n');
  const response = await post(server, '/api/commit-message');
  const message = await response.json();
  assert.equal(response.status, 200, JSON.stringify(message));
  assert.equal(message.subject, 'Fix the login guard');
  assert.equal(message.description, 'The empty name check ran after the redirect.');
});

test('reports a missing or failing CLI as an error', async (context) => {
  const { server, repositoryPath } = await startMessageServer(context, [
    new Error(
      'Claude Code was not found at "claude". Install it, or set guito.aiReview.claudePath.',
    ),
  ]);
  await writeFile(join(repositoryPath, 'c.txt'), 'change\n');
  const response = await post(server, '/api/commit-message');
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /Claude Code was not found/);
});
