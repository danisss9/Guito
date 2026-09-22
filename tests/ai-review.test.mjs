import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { startGuitoServer } from "../bin/guito-server.js";

// ==================== Automated pull request review ====================
// The reviewer is driven end to end through the HTTP API, with both Azure
// DevOps and the Claude Code CLI faked, so the tests cover the poller, the
// re-review on a new commit, and the manual posting step.

const ME = {
  id: "me-guid",
  displayName: "Me Myself",
  uniqueName: "me@example.test",
};

const OTHER = {
  id: "other-guid",
  displayName: "Other Person",
  uniqueName: "other@example.test",
};

const connectionData = () => ({
  status: 200,
  body: {
    authenticatedUser: {
      id: ME.id,
      providerDisplayName: ME.displayName,
      properties: { Mail: { $value: ME.uniqueName } },
    },
  },
});

/** A pull request created by someone else with me as a reviewer. */
const prRecord = (id, sourceCommit, extra = {}) => ({
  pullRequestId: id,
  title: `PR ${id}`,
  description: "Adds a thing.",
  isDraft: false,
  status: "active",
  creationDate: "2026-09-10T10:00:00.000Z",
  createdBy: OTHER,
  sourceRefName: "refs/heads/feature",
  targetRefName: "refs/heads/main",
  reviewers: [{ ...ME, vote: 0, isRequired: true }],
  lastMergeSourceCommit: { commitId: sourceCommit },
  lastMergeTargetCommit: { commitId: "target-commit" },
  labels: [],
  ...extra,
});

/**
 * Fakes the Azure DevOps endpoints one review touches: identity, the pull
 * request list and detail, iterations and their changes, file contents and
 * comment threads. Posted threads are recorded for assertions.
 */
function azureFake(state) {
  const posted = [];
  const respond = (method, url, payload) => {
    if (url.includes("/_apis/connectionData")) return connectionData();
    if (/\/pullrequests\?/.test(url)) {
      // Only the reviewerId search returns it; I did not create this one.
      const records = url.includes("creatorId") ? [] : state.pullRequests;
      return { status: 200, body: { value: records } };
    }
    const detail = url.match(/\/pullrequests\/(\d+)(\?|$)/);
    if (detail && method === "GET") {
      const pr = state.pullRequests.find(
        (entry) => entry.pullRequestId === Number(detail[1]),
      );
      return pr
        ? { status: 200, body: pr }
        : { status: 404, body: { message: "no such pull request" } };
    }
    if (/\/iterations\?/.test(url)) {
      return { status: 200, body: { value: state.iterations } };
    }
    const changes = url.match(/\/iterations\/(\d+)\/changes/);
    if (changes) {
      const compareTo = url.match(/\$compareTo=(\d+)/);
      const key = compareTo ? `${changes[1]}:${compareTo[1]}` : changes[1];
      return {
        status: 200,
        body: { changeEntries: state.changes[key] ?? state.changes[changes[1]] ?? [] },
      };
    }
    if (/\/items\?/.test(url)) {
      const path = decodeURIComponent(
        url.match(/[?&]path=([^&]*)/)?.[1] ?? "",
      ).replace(/^\//, "");
      const commit = decodeURIComponent(
        url.match(/versionDescriptor\.version=([^&]*)/)?.[1] ?? "",
      );
      const content = state.files[`${commit}:${path}`];
      return content === undefined
        ? { status: 404, body: {} }
        : { status: 200, body: { content, isBinary: false } };
    }
    if (/\/threads\?/.test(url) && method === "GET") {
      return { status: 200, body: { value: state.threads ?? [] } };
    }
    if (/\/threads\?/.test(url) && method === "POST") {
      const id = 900 + posted.length;
      posted.push({ ...payload, id });
      return { status: 200, body: { id } };
    }
    return { status: 404, body: { message: `unexpected ${method} ${url}` } };
  };
  return { respond, posted };
}

/** Starts a server wired to the Azure fake and a scripted review model. */
async function startReviewServer(context, state, replies, options = {}) {
  const repositoryPath = await mkdtemp(join(tmpdir(), "guito-ai-"));
  execFileSync("git", ["init"], { cwd: repositoryPath, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "remote",
      "add",
      "origin",
      "https://azure.example/DefaultCollection/Project/_git/Repo.git",
    ],
    { cwd: repositoryPath, stdio: "ignore" },
  );
  const azure = azureFake(state);
  const prompts = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve("bin/ui"),
    host: "127.0.0.1",
    port: 0,
    azureDevOpsUrl: "https://azure.example/DefaultCollection",
    aiReview: { enabled: false, scope: "reviewer", ...options.config },
    azureRequestImpl: async (method, url, body = "") => {
      const payload = body ? JSON.parse(body) : null;
      const result = azure.respond(method, url, payload) ?? {
        status: 404,
        body: {},
      };
      return { status: result.status, body: JSON.stringify(result.body ?? {}) };
    },
    aiReviewModelImpl: async (prompt) => {
      prompts.push(prompt);
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      return typeof reply === "string" ? reply : JSON.stringify(reply);
    },
  });
  context.after(async () => {
    await server.close();
    await rm(repositoryPath, { recursive: true, force: true });
  });
  return { server, prompts, posted: azure.posted };
}

/** The CLI envelope Claude Code prints with --output-format json. */
const cliReply = (review) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "```json\n" + JSON.stringify(review) + "\n```",
});

const baseState = () => ({
  pullRequests: [prRecord(42, "commit-one")],
  iterations: [
    { id: 1, createdDate: "2026-09-10T10:00:00Z", sourceRefCommit: { commitId: "commit-one" } },
  ],
  changes: {
    1: [{ item: { path: "/src/app.ts" }, changeType: "edit" }],
  },
  files: {
    "target-commit:src/app.ts": "const a = 1;\n",
    "commit-one:src/app.ts": "const a = 1;\nconst b = a / 0;\n",
  },
  threads: [],
});

const json = async (response) => {
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
};

test("reviews a pull request and queues findings without posting them", async (context) => {
  const state = baseState();
  const { server, prompts, posted } = await startReviewServer(context, state, [
    cliReply({
      summary: "One division by zero.",
      findings: [
        {
          file: "src/app.ts",
          line: 2,
          severity: "blocker",
          title: "Division by zero",
          comment: "`a / 0` is always Infinity here.",
        },
      ],
    }),
  ]);

  const { state: review } = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  assert.equal(review.status, "idle");
  assert.equal(review.reviewedCommit, "commit-one");
  assert.equal(review.passes, 1);
  assert.equal(review.findings.length, 1);
  assert.equal(review.findings[0].status, "pending");
  assert.equal(review.findings[0].line, 2);
  assert.equal(review.findings[0].severity, "blocker");
  // Nothing reaches Azure DevOps until the user posts it.
  assert.deepEqual(posted, []);
  // The prompt carries the diff with the line numbers the model must cite.
  assert.match(prompts[0], /--- FILE: src\/app\.ts/);
  assert.match(prompts[0], /2 \+ const b = a \/ 0;/);
  assert.match(prompts[0], /PULL REQUEST #42/);
});

test("drops a finding whose line is not in the diff onto the pull request", async (context) => {
  const state = baseState();
  const { server } = await startReviewServer(context, state, [
    cliReply({
      summary: "",
      findings: [
        {
          file: "src/app.ts",
          line: 900,
          severity: "concern",
          title: "Invented line",
          comment: "The model cited a line the diff never showed.",
        },
        {
          file: "docs/unknown.md",
          line: 3,
          severity: "nit",
          title: "Unknown file",
          comment: "Not part of this pull request.",
        },
      ],
    }),
  ]);

  const { state: review } = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  const [invented, unknown] = review.findings;
  assert.equal(invented.file, "src/app.ts");
  assert.equal(invented.line, null, "an unanchorable line becomes a file comment");
  assert.equal(unknown.file, "", "a file outside the diff becomes a PR comment");
  assert.equal(unknown.line, null);
});

test("re-reviews only the files touched by a new commit", async (context) => {
  const state = baseState();
  const { server, prompts } = await startReviewServer(context, state, [
    cliReply({
      summary: "First pass.",
      findings: [
        {
          file: "src/app.ts",
          line: 2,
          severity: "concern",
          title: "Division by zero",
          comment: "First pass comment.",
        },
      ],
    }),
    cliReply({
      summary: "Second pass.",
      findings: [
        {
          file: "src/new.ts",
          line: 1,
          severity: "suggestion",
          title: "Missing error handling",
          comment: "The new file swallows errors.",
        },
        {
          file: "src/app.ts",
          line: 2,
          severity: "concern",
          title: "Division by zero",
          comment: "Repeated from the first pass.",
        },
      ],
    }),
  ]);

  const first = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(first.state.findings.length, 1);

  // A new commit lands on the pull request: a second iteration, whose delta
  // against the reviewed one contains only the newly added file.
  state.pullRequests[0].lastMergeSourceCommit = { commitId: "commit-two" };
  state.iterations.push({
    id: 2,
    createdDate: "2026-09-11T10:00:00Z",
    sourceRefCommit: { commitId: "commit-two" },
  });
  state.changes["2:1"] = [{ item: { path: "/src/new.ts" }, changeType: "add" }];
  state.changes[2] = [
    { item: { path: "/src/app.ts" }, changeType: "edit" },
    { item: { path: "/src/new.ts" }, changeType: "add" },
  ];
  state.files["commit-two:src/new.ts"] = "try { go(); } catch {}\n";

  const second = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  assert.equal(second.state.reviewedCommit, "commit-two");
  assert.equal(second.state.passes, 2);
  // The repeated point is dropped; only the genuinely new one is added.
  assert.equal(second.state.findings.length, 2);
  assert.deepEqual(
    second.state.findings.map((finding) => finding.title).sort(),
    ["Division by zero", "Missing error handling"],
  );
  // The follow-up prompt saw only the file the new commit touched, and was
  // told what had already been raised.
  assert.match(prompts[1], /THIS IS A FOLLOW-UP REVIEW/);
  assert.match(prompts[1], /--- FILE: src\/new\.ts/);
  assert.doesNotMatch(prompts[1], /--- FILE: src\/app\.ts/);
  assert.match(prompts[1], /already raised[\s\S]*Division by zero/i);
});

test("posts selected findings as Azure DevOps threads and leaves the rest pending", async (context) => {
  const state = baseState();
  const { server, posted } = await startReviewServer(context, state, [
    cliReply({
      summary: "",
      findings: [
        {
          file: "src/app.ts",
          line: 2,
          severity: "blocker",
          title: "Division by zero",
          comment: "This is always Infinity.",
        },
        {
          file: "",
          line: null,
          severity: "nit",
          title: "Missing tests",
          comment: "No test covers the new branch.",
        },
      ],
    }),
  ]);

  const { state: review } = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  const inline = review.findings.find((finding) => finding.file === "src/app.ts");
  const general = review.findings.find((finding) => finding.file === "");

  const { state: afterPost } = await json(
    await fetch(
      `${server.address}/api/azure-devops/pullrequests/42/ai-review/post`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ findingIds: [inline.id] }),
      },
    ),
  );

  assert.equal(posted.length, 1);
  assert.equal(
    posted[0].threadContext.filePath,
    "/src/app.ts",
    "the comment is anchored to the file",
  );
  assert.equal(posted[0].threadContext.rightFileStart.line, 2);
  assert.match(posted[0].comments[0].content, /Division by zero/);
  assert.match(posted[0].comments[0].content, /always Infinity/);

  const stored = afterPost.findings.find((finding) => finding.id === inline.id);
  assert.equal(stored.status, "posted");
  assert.equal(stored.threadId, 900);
  assert.equal(
    afterPost.findings.find((finding) => finding.id === general.id).status,
    "pending",
  );
});

test("a dismissed finding is never raised again", async (context) => {
  const state = baseState();
  const { server, prompts } = await startReviewServer(context, state, [
    cliReply({
      summary: "",
      findings: [
        {
          file: "src/app.ts",
          line: 2,
          severity: "nit",
          title: "Prefer a constant",
          comment: "Name the magic number.",
        },
      ],
    }),
    cliReply({
      summary: "",
      findings: [
        {
          file: "src/app.ts",
          line: 2,
          severity: "nit",
          title: "Prefer a constant",
          comment: "Raising the same point again.",
        },
      ],
    }),
  ]);

  const { state: review } = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  await json(
    await fetch(
      `${server.address}/api/azure-devops/pullrequests/42/ai-review/dismiss`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ findingIds: [review.findings[0].id] }),
      },
    ),
  );

  const { state: again } = await json(
    await fetch(`${server.address}/api/azure-devops/pullrequests/42/ai-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: true }),
    }),
  );

  assert.equal(again.findings.length, 1);
  assert.equal(again.findings[0].status, "dismissed");
  assert.match(prompts[1], /never raise these again[\s\S]*Prefer a constant/i);
});

test("the poller reviews pull requests waiting on me and skips reviewed commits", async (context) => {
  const state = baseState();
  state.pullRequests.push(
    // Created by me with nobody else involved: out of scope for "reviewer".
    prRecord(43, "other-commit", {
      createdBy: ME,
      reviewers: [],
      title: "My own work",
    }),
  );
  const { server, prompts } = await startReviewServer(
    context,
    state,
    [cliReply({ summary: "Clean.", findings: [] })],
    { config: { enabled: true, scope: "reviewer" } },
  );

  const first = await json(
    await fetch(`${server.address}/api/azure-devops/ai-review/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.deepEqual(first.reviewed, [42], "only the pull request assigned to me");
  assert.equal(prompts.length, 1);

  // Nothing changed, so a second poll must not spend another review.
  const second = await json(
    await fetch(`${server.address}/api/azure-devops/ai-review/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.deepEqual(second.reviewed, []);
  assert.equal(prompts.length, 1);

  const overview = await json(
    await fetch(`${server.address}/api/azure-devops/ai-review`),
  );
  assert.equal(overview.enabled, true);
  assert.equal(overview.pullRequests.length, 1);
  assert.equal(overview.pullRequests[0].pending, 0);
});

test("a failing Claude Code run is reported and not retried on the same commit", async (context) => {
  const state = baseState();
  const { server, prompts } = await startReviewServer(
    context,
    state,
    [new Error('Claude Code was not found at "claude".'), cliReply({ summary: "", findings: [] })],
    { config: { enabled: true } },
  );

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests/42/ai-review`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Claude Code was not found/);
  assert.equal(body.state.status, "error");

  // The poller leaves a pull request that already failed on this commit alone.
  const poll = await json(
    await fetch(`${server.address}/api/azure-devops/ai-review/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.deepEqual(poll.reviewed, []);
  assert.equal(prompts.length, 1);
});

test("the timer reviews on its own, without anyone asking it to", async (context) => {
  // The reviewer is driven directly here so the interval can be shorter than
  // the one-minute floor the settings clamp enforces.
  const { createAiReviewer, DEFAULT_AI_REVIEW_CONFIG } = await import(
    "../bin/ai-review.js"
  );
  const store = { version: 1, pullRequests: {} };
  const prompts = [];
  const pullRequest = {
    id: 7,
    title: "Waiting on me",
    description: "",
    author: "Other Person",
    sourceBranch: "feature",
    targetBranch: "main",
    isDraft: false,
    isReviewer: true,
    isMine: false,
    sourceCommit: "commit-one",
    targetCommit: "target-commit",
  };
  const reviewer = createAiReviewer(
    {
      listPullRequests: async () => [pullRequest],
      loadPullRequest: async () => pullRequest,
      loadChanges: async () => [
        { path: "src/app.ts", oldPath: "", changeType: "modified" },
      ],
      loadFileDiff: async () => ({
        path: "src/app.ts",
        oldPath: "",
        status: "modified",
        binary: false,
        lines: [{ type: "add", newLine: 1, text: "const b = a / 0;" }],
      }),
      loadThreads: async () => [],
      postComment: async () => ({ threadId: 1 }),
      readStore: async () => JSON.parse(JSON.stringify(store)),
      writeStore: async (next) => {
        store.pullRequests = next.pullRequests;
      },
      runModel: async (prompt) => {
        prompts.push(prompt);
        return JSON.stringify({
          summary: "Found one.",
          findings: [
            {
              file: "src/app.ts",
              line: 1,
              severity: "concern",
              title: "Division by zero",
              comment: "Always Infinity.",
            },
          ],
        });
      },
    },
    { ...DEFAULT_AI_REVIEW_CONFIG, enabled: true, pollMinutes: 0.01 },
  );
  context.after(() => reviewer.stop());

  reviewer.start();
  // Nothing below calls poll(): only the interval can produce a review.
  const deadline = Date.now() + 10000;
  while (prompts.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  reviewer.stop();

  assert.equal(prompts.length, 1, "the interval reviewed the pull request on its own");
  const state = await reviewer.state(7);
  assert.equal(state.reviewedCommit, "commit-one");
  assert.equal(state.findings.length, 1);
  assert.equal(state.findings[0].status, "pending");
});
