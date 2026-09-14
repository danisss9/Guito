import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { startGuitoServer } from "../bin/guito-server.js";

// ==================== Azure DevOps pull request review ====================

const ME = {
  id: "me-guid",
  displayName: "Me Myself",
  uniqueName: "me@example.test",
};

async function createAzureRepository(context) {
  const repositoryPath = await mkdtemp(join(tmpdir(), "guito-test-"));
  context.after(() => rm(repositoryPath, { recursive: true, force: true }));
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
  return repositoryPath;
}

/** Starts a Guito server whose Azure DevOps calls hit a URL-dispatching fake. */
async function startAzureReviewServer(context, respond) {
  const repositoryPath = await createAzureRepository(context);
  const calls = [];
  const server = await startGuitoServer({
    repositoryPath,
    uiRoot: resolve("bin/ui"),
    host: "127.0.0.1",
    port: 0,
    azureDevOpsUrl: "https://azure.example/DefaultCollection",
    azureRequestImpl: async (method, url, body = "") => {
      const payload = body ? JSON.parse(body) : null;
      calls.push({ method, url, payload });
      const result = respond(method, url, payload) ?? { status: 404, body: {} };
      return { status: result.status, body: JSON.stringify(result.body ?? {}) };
    },
  });
  context.after(() => server.close());
  return { server, calls };
}

const connectionDataResponse = () => ({
  status: 200,
  body: {
    authenticatedUser: {
      id: ME.id,
      providerDisplayName: "Me Myself",
      properties: { Mail: { $value: ME.uniqueName } },
    },
  },
});

const prRecord = (id, extra = {}) => ({
  pullRequestId: id,
  title: `PR ${id}`,
  isDraft: false,
  status: "active",
  creationDate: "2026-09-10T10:00:00.000Z",
  createdBy: {
    id: ME.id,
    displayName: ME.displayName,
    uniqueName: ME.uniqueName,
  },
  sourceRefName: "refs/heads/feature",
  targetRefName: "refs/heads/main",
  reviewers: [],
  ...extra,
});

test("lists my pull requests with votes, drafts, and required reviewers", async (context) => {
  const mine = prRecord(101, {
    title: "Draft feature",
    isDraft: true,
    reviewers: [
      {
        id: "other-guid",
        displayName: "Other",
        uniqueName: "o@e.test",
        vote: 5,
      },
    ],
  });
  const assigned = prRecord(202, {
    title: "Needs my vote",
    creationDate: "2026-09-11T10:00:00.000Z",
    createdBy: {
      id: "other-guid",
      displayName: "Other",
      uniqueName: "o@e.test",
    },
    reviewers: [
      {
        id: ME.id,
        displayName: ME.displayName,
        uniqueName: ME.uniqueName,
        vote: 10,
        isRequired: true,
      },
      {
        id: "other-guid",
        displayName: "Other",
        uniqueName: "o@e.test",
        vote: -10,
      },
    ],
  });
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (url.includes("/pullrequests?")) {
        const records = url.includes("creatorId") ? [mine] : [assigned, mine];
        return { status: 200, body: { value: records } };
      }
      return { status: 404, body: { message: `unexpected ${url}` } };
    },
  );

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests`,
  );
  assert.equal(response.status, 200);
  const { pullRequests } = await response.json();
  assert.equal(pullRequests.length, 2);
  // Sorted newest first; creator + reviewer queries merged and de-duplicated.
  assert.equal(pullRequests[0].id, 202);
  assert.equal(pullRequests[0].title, "Needs my vote");
  assert.equal(pullRequests[0].myVote, 10);
  assert.equal(pullRequests[0].requiresMe, true);
  assert.equal(pullRequests[0].author.name, "Other");
  assert.equal(pullRequests[0].sourceBranch, "feature");
  assert.equal(pullRequests[0].targetBranch, "main");
  assert.equal(pullRequests[1].isDraft, true);
  assert.equal(pullRequests[1].myVote, 0);
  assert.equal(pullRequests[1].requiresMe, false);
  assert.equal(
    pullRequests[1].webUrl,
    "https://azure.example/DefaultCollection/Project/_git/Repo/pullrequest/101",
  );
  // Two list queries, one per search criteria, after one identity lookup.
  assert.equal(
    calls.filter((call) => call.url.includes("/pullrequests?")).length,
    2,
  );
});

test("serves PR details and edits title, description, and draft state", async (context) => {
  const detail = prRecord(101, {
    title: "Old title",
    description: "Old **description**",
    autoCompleteSetBy: { id: "someone", displayName: "Someone" },
    completionOptions: { mergeStrategy: "squash" },
    lastMergeSourceCommit: { commitId: "src-sha" },
    lastMergeTargetCommit: { commitId: "tgt-sha" },
    labels: [{ name: "bug" }, { name: "urgent" }],
  });
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/pullrequests\/\d+\?/.test(url))
        return { status: 200, body: detail };
      return { status: 404, body: { message: `unexpected ${method} ${url}` } };
    },
  );

  const detailResponse = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101`,
  );
  assert.equal(detailResponse.status, 200);
  const body = await detailResponse.json();
  assert.equal(body.description, "Old **description**");
  assert.equal(body.autoCompleteSetBy.name, "Someone");
  assert.deepEqual(body.completionOptions, { mergeStrategy: "squash" });
  assert.equal(body.lastMergeSourceCommit, "src-sha");
  assert.equal(body.lastMergeTargetCommit, "tgt-sha");
  assert.deepEqual(body.labels, ["bug", "urgent"]);

  const editResponse = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "New title",
        description: "New body",
        isDraft: true,
      }),
    },
  );
  assert.equal(editResponse.status, 200);
  const patch = calls.find((call) => call.method === "PATCH");
  assert.deepEqual(patch.payload, {
    title: "New title",
    description: "New body",
    isDraft: true,
  });
});

test("votes, adds required reviewers, and removes reviewers", async (context) => {
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      return { status: 200, body: {} };
    },
  );

  const vote = await fetch(
    `${server.address}/api/azure-devops/pullrequests/202/vote`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vote: "approve" }),
    },
  );
  assert.equal(vote.status, 200);
  assert.equal(
    calls[1].url,
    "https://azure.example/DefaultCollection/Project/_apis/git/repositories/Repo/pullrequests/202/reviewers/me-guid?api-version=5.0-preview",
  );
  assert.deepEqual(calls[1].payload, { vote: 10 });

  const add = await fetch(
    `${server.address}/api/azure-devops/pullrequests/202/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "other-guid", required: true, vote: 5 }),
    },
  );
  assert.equal(add.status, 200);
  assert.equal(calls[2].method, "PUT");
  assert.deepEqual(calls[2].payload, { isRequired: true, vote: 5 });

  const remove = await fetch(
    `${server.address}/api/azure-devops/pullrequests/202/reviewers`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "other-guid", remove: true }),
    },
  );
  assert.equal(remove.status, 200);
  assert.equal(calls[3].method, "DELETE");
  assert.match(calls[3].url, /\/reviewers\/other-guid\?/);
});

test("completes pull requests and manages auto-complete", async (context) => {
  const detail = prRecord(101, {
    lastMergeSourceCommit: { commitId: "src-sha" },
  });
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url, payload) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/pullrequests\/\d+\?/.test(url) && method === "GET") {
        return { status: 200, body: detail };
      }
      if (method === "PATCH") {
        // Simulate a Server release that rejects empty-identity auto-complete
        // cancellation until the null form is used.
        if (payload?.autoCompleteSetBy?.id === "") {
          return { status: 400, body: { message: "invalid identity" } };
        }
        return { status: 200, body: detail };
      }
      return { status: 404, body: { message: `unexpected ${method} ${url}` } };
    },
  );
  const base = `${server.address}/api/azure-devops/pullrequests/101`;

  const complete = await fetch(`${base}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mergeStrategy: "squash",
      deleteSourceBranch: true,
      completeWorkItems: true,
      transitionWorkItems: true,
    }),
  });
  assert.equal(complete.status, 200);
  const completeCall = calls.find(
    (call) => call.payload?.status === "completed",
  );
  assert.deepEqual(completeCall.payload, {
    status: "completed",
    lastMergeSourceCommit: { commitId: "src-sha" },
    completionOptions: {
      mergeStrategy: "squash",
      deleteSourceBranch: true,
      completeWorkItems: true,
      transitionWorkItems: true,
    },
  });

  const enable = await fetch(`${base}/autocomplete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: true, mergeStrategy: "squash" }),
  });
  assert.equal(enable.status, 200);
  const enableCall = calls.find(
    (call) => call.payload?.autoCompleteSetBy?.id === ME.id,
  );
  assert.deepEqual(enableCall.payload, {
    autoCompleteSetBy: { id: ME.id },
    completionOptions: { mergeStrategy: "squash" },
  });

  const cancel = await fetch(`${base}/autocomplete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(cancel.status, 200);
  const cancelCalls = calls.filter(
    (call) =>
      call.payload &&
      "autoCompleteSetBy" in call.payload &&
      call.payload.autoCompleteSetBy?.id !== ME.id,
  );
  assert.deepEqual(cancelCalls[0].payload, { autoCompleteSetBy: { id: "" } });
  assert.deepEqual(cancelCalls[1].payload, { autoCompleteSetBy: null });
});

test("serves comment threads and posts replies, inline comments, and statuses", async (context) => {
  const threads = {
    status: 200,
    body: {
      value: [
        {
          id: 5,
          status: 4,
          threadContext: {
            filePath: "/src/app.ts",
            rightFileStart: { line: 12, offset: 1 },
          },
          comments: [
            {
              id: 1,
              author: { displayName: "Other", uniqueName: "o@e.test" },
              content: "Please change this",
              publishedDate: "2026-09-10T09:00:00.000Z",
            },
            {
              id: 2,
              author: { displayName: "Ghost", uniqueName: "g@e.test" },
              content: "deleted comment",
              isDeleted: true,
            },
          ],
        },
        {
          id: 6,
          status: 1,
          comments: [
            {
              id: 3,
              author: { displayName: "Other", uniqueName: "o@e.test" },
              content: "General note",
              publishedDate: "2026-09-10T08:00:00.000Z",
            },
          ],
        },
      ],
    },
  };
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/threads(\?|$)/.test(url) && method === "GET") return threads;
      return { status: 200, body: {} };
    },
  );
  const base = `${server.address}/api/azure-devops/pullrequests/101`;

  const listResponse = await fetch(`${base}/threads`);
  assert.equal(listResponse.status, 200);
  const { threads: mapped } = await listResponse.json();
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].status, "fixed");
  assert.equal(mapped[0].filePath, "src/app.ts");
  assert.equal(mapped[0].line, 12);
  assert.equal(mapped[0].side, "right");
  assert.equal(mapped[0].comments.length, 1);
  assert.equal(mapped[0].comments[0].author.name, "Other");
  assert.equal(mapped[1].filePath, null);
  assert.equal(mapped[1].line, null);

  const inline = await fetch(`${base}/threads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: "Line note",
      filePath: "src/app.ts",
      line: 12,
    }),
  });
  assert.equal(inline.status, 200);
  const inlineCall = calls.find((call) => call.payload?.threadContext);
  assert.deepEqual(inlineCall.payload, {
    status: 1,
    comments: [{ content: "Line note", parentCommentId: 0 }],
    threadContext: {
      filePath: "/src/app.ts",
      rightFileStart: { line: 12, offset: 1 },
      rightFileEnd: { line: 12, offset: 2147483647 },
    },
  });

  const reply = await fetch(`${base}/threads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: 5, content: "Reply" }),
  });
  assert.equal(reply.status, 200);
  const replyCall = calls.find((call) =>
    call.url.includes("/threads/5/comments"),
  );
  assert.deepEqual(replyCall.payload, { content: "Reply" });

  const status = await fetch(`${base}/threads/5/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "wontFix" }),
  });
  assert.equal(status.status, 200);
  const statusCall = calls.find((call) => /\/threads\/5\?/.test(call.url));
  assert.equal(statusCall.method, "PATCH");
  assert.deepEqual(statusCall.payload, { status: 3 });
});

test("serves PR iteration changes and per-file diffs", async (context) => {
  const detail = prRecord(101, {
    lastMergeSourceCommit: { commitId: "src-sha" },
    lastMergeTargetCommit: { commitId: "tgt-sha" },
  });
  const items = new Map([
    ["src/a.ts|tgt-sha", { content: "one\ntwo\nthree\n" }],
    ["src/a.ts|src-sha", { content: "one\nTWO\nthree\n" }],
    ["new.txt|src-sha", { content: "brand new\n" }],
    ["logo.png|tgt-sha", { isBinary: true }],
    ["logo.png|src-sha", { isBinary: true }],
  ]);
  const { server } = await startAzureReviewServer(context, (method, url) => {
    if (url.includes("/_apis/connectionData")) return connectionDataResponse();
    if (/\/pullrequests\/\d+\?/.test(url)) return { status: 200, body: detail };
    if (/\/iterations\?/.test(url)) {
      return {
        status: 200,
        body: {
          value: [
            { id: 1, createdDate: "2026-09-09T10:00:00.000Z" },
            { id: 2, createdDate: "2026-09-10T10:00:00.000Z" },
          ],
        },
      };
    }
    if (/\/iterations\/2\/changes/.test(url)) {
      return {
        status: 200,
        body: {
          value: [
            { changeType: "edit", item: { path: "/src/a.ts" } },
            { changeType: "add", item: { path: "/new.txt" } },
            {
              changeType: "rename",
              item: { path: "/renamed.ts" },
              sourceServerItem: "/old.ts",
            },
            { changeType: "delete", item: { path: "/gone.ts" } },
          ],
        },
      };
    }
    if (/\/items\?/.test(url)) {
      const parsed = new URL(url);
      const path = decodeURIComponent(parsed.searchParams.get("path"));
      const version = parsed.searchParams.get("versionDescriptor.version");
      const item = items.get(`${path.slice(1)}|${version}`);
      if (!item) return { status: 404, body: {} };
      return { status: 200, body: item };
    }
    return { status: 404, body: { message: `unexpected ${method} ${url}` } };
  });
  const base = `${server.address}/api/azure-devops/pullrequests/101`;

  const changes = await (await fetch(`${base}/changes`)).json();
  assert.deepEqual(changes.files, [
    { path: "src/a.ts", oldPath: "", changeType: "modified" },
    { path: "new.txt", oldPath: "", changeType: "added" },
    { path: "renamed.ts", oldPath: "old.ts", changeType: "renamed" },
    { path: "gone.ts", oldPath: "", changeType: "deleted" },
  ]);

  const diff = await (
    await fetch(`${base}/file-diff?path=${encodeURIComponent("src/a.ts")}`)
  ).json();
  assert.equal(diff.status, "modified");
  assert.equal(diff.additions, 1);
  assert.equal(diff.deletions, 1);
  const changed = diff.lines.filter(
    (line) => line.type !== "context" && line.type !== "hunk",
  );
  assert.deepEqual(changed, [
    { type: "del", oldLine: 2, text: "two" },
    { type: "add", newLine: 2, text: "TWO" },
  ]);

  const added = await (
    await fetch(`${base}/file-diff?path=${encodeURIComponent("new.txt")}`)
  ).json();
  assert.equal(added.status, "added");
  assert.deepEqual(
    added.lines.filter((line) => line.type !== "hunk"),
    [{ type: "add", newLine: 1, text: "brand new" }],
  );

  const binary = await (
    await fetch(`${base}/file-diff?path=${encodeURIComponent("logo.png")}`)
  ).json();
  assert.equal(binary.status, "binary");
  assert.equal(binary.binary, true);
  assert.deepEqual(binary.lines, []);
});

test("maps merge status and falls back to the labels resource for tags", async (context) => {
  // No "labels" array on the record: some Server releases omit it, so the
  // dedicated labels resource must be read instead of reporting no tags.
  const detail = prRecord(101, {
    mergeStatus: "conflicts",
    lastMergeSourceCommit: { commitId: "src-sha" },
  });
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/pullrequests\/\d+\?/.test(url))
        return { status: 200, body: detail };
      if (/\/pullrequests\/\d+\/labels\?/.test(url)) {
        return {
          status: 200,
          body: { value: [{ name: "bug" }, { name: "" }] },
        };
      }
      return { status: 404, body: { message: `unexpected ${method} ${url}` } };
    },
  );

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101`,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.labels, ["bug"]);
  assert.equal(body.mergeStatus, "conflicts");
  assert.equal(calls.filter((call) => call.url.includes("/labels")).length, 1);

  // A labels resource failure must surface as an error, not an empty list.
  const failing = await startAzureReviewServer(context, (method, url) => {
    if (url.includes("/_apis/connectionData")) return connectionDataResponse();
    if (/\/pullrequests\/\d+\?/.test(url)) return { status: 200, body: detail };
    if (/\/pullrequests\/\d+\/labels\?/.test(url)) {
      return { status: 400, body: { message: "labels unavailable" } };
    }
    return { status: 404, body: { message: `unexpected ${method} ${url}` } };
  });
  const failed = await fetch(
    `${failing.server.address}/api/azure-devops/pullrequests/101`,
  );
  assert.equal(failed.status, 400);
  const { error } = await failed.json();
  assert.match(error, /labels unavailable/);
});

test("follows paginated change entries and skips folders", async (context) => {
  const detail = prRecord(101);
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/pullrequests\/\d+\?/.test(url))
        return { status: 200, body: detail };
      if (/\/iterations\?/.test(url)) {
        return {
          status: 200,
          body: { value: [{ id: 2, createdDate: "2026-09-10T10:00:00.000Z" }] },
        };
      }
      if (/\/iterations\/2\/changes/.test(url)) {
        const skip = Number(new URL(url).searchParams.get("$skip") ?? 0);
        if (skip === 0) {
          return {
            status: 200,
            body: {
              changeEntries: [
                {
                  changeType: "edit",
                  item: { path: "/src/folder", isFolder: true },
                },
                { changeType: "add", item: { path: "/a.ts" } },
                { changeType: "edit", item: { path: "/b.ts" } },
              ],
              nextSkip: 2,
            },
          };
        }
        return {
          status: 200,
          body: {
            changeEntries: [{ changeType: "delete", item: { path: "/c.ts" } }],
          },
        };
      }
      return { status: 404, body: { message: `unexpected ${method} ${url}` } };
    },
  );

  const changes = await (
    await fetch(`${server.address}/api/azure-devops/pullrequests/101/changes`)
  ).json();
  assert.deepEqual(changes.files, [
    { path: "a.ts", oldPath: "", changeType: "added" },
    { path: "b.ts", oldPath: "", changeType: "modified" },
    { path: "c.ts", oldPath: "", changeType: "deleted" },
  ]);
  // Page 2 was requested via the continuation skip.
  assert.equal(
    calls.filter((call) => call.url.includes("/iterations/2/changes")).length,
    2,
  );
});

test("serves related work items resolved through the batch API", async (context) => {
  const { server, calls } = await startAzureReviewServer(
    context,
    (method, url) => {
      if (url.includes("/_apis/connectionData"))
        return connectionDataResponse();
      if (/\/pullrequests\/\d+\/workitems\?/.test(url)) {
        return { status: 200, body: { value: [{ id: 5 }, { id: 7 }] } };
      }
      if (/wit\/workitems\?ids=/.test(url)) {
        return {
          status: 200,
          body: {
            value: [
              {
                id: 5,
                fields: { "System.Title": "Fix bug", "System.State": "Active" },
              },
            ],
          },
        };
      }
      return { status: 404, body: { message: `unexpected ${method} ${url}` } };
    },
  );

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101/workitems`,
  );
  assert.equal(response.status, 200);
  const { workItems } = await response.json();
  assert.deepEqual(workItems, [
    {
      id: 5,
      title: "Fix bug",
      state: "Active",
      url: "https://azure.example/DefaultCollection/Project/_workitems/edit/5",
    },
    {
      id: 7,
      title: "Work item 7",
      state: "",
      url: "https://azure.example/DefaultCollection/Project/_workitems/edit/7",
    },
  ]);
  assert.equal(
    calls.find((call) => call.url.includes("wit/workitems"))?.method,
    "GET",
  );
});

test("serves policy evaluations and statuses as merge checks", async (context) => {
  const detail = prRecord(101, {
    repository: { project: { id: "proj-guid" } },
  });
  const { server } = await startAzureReviewServer(context, (method, url) => {
    if (url.includes("/_apis/connectionData")) return connectionDataResponse();
    if (/\/pullrequests\/\d+\?/.test(url)) return { status: 200, body: detail };
    if (/policy\/evaluations/.test(url)) {
      return {
        status: 200,
        body: {
          evaluations: [
            {
              status: {
                evaluationId: "e1",
                state: "approved",
                message: "Build OK",
              },
              configuration: {
                isRequired: true,
                type: { displayName: "Build" },
                settings: { displayName: "CI Build", buildId: 42 },
              },
            },
            {
              status: { evaluationId: "e2", state: "pending" },
              configuration: {
                isRequired: false,
                type: { displayName: "Required reviewers" },
                settings: { displayName: "Minimum reviewers" },
              },
            },
          ],
        },
      };
    }
    if (/\/pullrequests\/\d+\/statuses\?/.test(url)) {
      return {
        status: 200,
        body: {
          value: [
            {
              id: 1,
              state: "failed",
              description: "Lint failed",
              creationDate: "2026-09-10T08:00:00.000Z",
              context: { genre: "lint", name: "lint-check" },
              targetUrl: "https://ci.example/lint/1",
            },
            {
              id: 2,
              state: "succeeded",
              description: "Lint fixed",
              creationDate: "2026-09-10T09:00:00.000Z",
              context: { genre: "lint", name: "lint-check" },
            },
          ],
        },
      };
    }
    return { status: 404, body: { message: `unexpected ${method} ${url}` } };
  });

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101/checks`,
  );
  assert.equal(response.status, 200);
  const { checks, warnings } = await response.json();
  assert.deepEqual(warnings, []);
  assert.deepEqual(checks, [
    {
      id: "policy:e1",
      name: "CI Build",
      kind: "build",
      state: "succeeded",
      required: true,
      detail: "Build OK",
      url: "https://azure.example/DefaultCollection/Project/_build/results?buildId=42",
    },
    {
      id: "policy:e2",
      name: "Minimum reviewers",
      kind: "reviewer",
      state: "pending",
      required: false,
    },
    {
      id: "status:lint/lint-check",
      name: "lint-check",
      kind: "status",
      state: "succeeded",
      required: false,
      detail: "Lint fixed",
    },
  ]);
});

test("degrades one failed checks source to a warning and errors when both fail", async (context) => {
  const detail = prRecord(101, {
    repository: { project: { id: "proj-guid" } },
  });
  // Policies fail; statuses still answer, so the PR keeps its status checks.
  const partial = await startAzureReviewServer(context, (method, url) => {
    if (url.includes("/_apis/connectionData")) return connectionDataResponse();
    if (/\/pullrequests\/\d+\?/.test(url)) return { status: 200, body: detail };
    if (/policy\/evaluations/.test(url)) return { status: 404, body: {} };
    if (/\/pullrequests\/\d+\/statuses\?/.test(url)) {
      return {
        status: 200,
        body: {
          value: [
            {
              id: 1,
              state: "pending",
              context: { genre: "gate", name: "sign-off" },
            },
          ],
        },
      };
    }
    return { status: 404, body: { message: `unexpected ${method} ${url}` } };
  });
  const partialResponse = await fetch(
    `${partial.server.address}/api/azure-devops/pullrequests/101/checks`,
  );
  assert.equal(partialResponse.status, 200);
  const { checks, warnings } = await partialResponse.json();
  assert.equal(checks.length, 1);
  assert.equal(checks[0].name, "sign-off");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Policy evaluations are unavailable/);

  // With both sources failing the endpoint must report an error.
  const both = await startAzureReviewServer(context, (method, url) => {
    if (url.includes("/_apis/connectionData")) return connectionDataResponse();
    if (/\/pullrequests\/\d+\?/.test(url)) return { status: 200, body: detail };
    return { status: 500, body: { message: "down" } };
  });
  const bothResponse = await fetch(
    `${both.server.address}/api/azure-devops/pullrequests/101/checks`,
  );
  assert.equal(bothResponse.status, 400);
  const { error } = await bothResponse.json();
  assert.match(error, /down/);
});

test("abandons pull requests with the Azure status change", async (context) => {
  const { server, calls } = await startAzureReviewServer(context, () => ({
    status: 200,
    body: {},
  }));

  const response = await fetch(
    `${server.address}/api/azure-devops/pullrequests/101/abandon`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
  assert.equal(response.status, 200);
  const patch = calls.find((call) => call.method === "PATCH");
  assert.match(patch.url, /\/pullrequests\/101\?/);
  assert.deepEqual(patch.payload, { status: "abandoned" });
});
