import { test, expect } from '@playwright/test';

const url = '/?guitoToken=browser-test-token';
const file = (path) => ({
  path,
  oldPath: path,
  status: 'modified',
  lines: [],
  additions: 1,
  deletions: 1,
});
function history(count) {
  return Array.from({ length: count }, (_, i) => ({
    hash: (count - i).toString(16).padStart(40, '0'),
    message: `Commit ${i}`,
    date: '2026-09-07T12:00:00Z',
    author_name: i === 7 ? 'Spécial Author' : 'Test Author',
    author_email: 'test@example.test',
    parents: i < count - 1 ? [(count - i - 1).toString(16).padStart(40, '0')] : [],
    refs: i === 0 ? 'HEAD -> main' : '',
  }));
}

async function setup(page, count = 700, overrides = {}) {
  const commits = history(count);
  if (overrides.firstMessage) commits[0].message = overrides.firstMessage;
  if (overrides.firstRefs) commits[0].refs = overrides.firstRefs;
  const state = {
    staged: ['partial.txt'],
    unstaged: ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'partial.txt'],
    revision: 'initial',
    workingRevision: 'initial',
    repositoryStateRequests: 0,
    avatarRequests: 0,
    avatarAvailable: false,
    prRequests: [],
    prMutations: [],
    pullRequests: [
      {
        id: 101,
        title: 'Review the new login flow',
        isDraft: false,
        mergeStatus: 'succeeded',
        author: {
          id: 'author-1',
          name: 'Áda Author',
          email: 'ada@example.test',
        },
        createdAt: '2026-09-12T10:00:00Z',
        sourceBranch: 'feature/login',
        targetBranch: 'main',
        status: 'active',
        webUrl: 'https://azure.example/project/_git/repo/pullrequest/101',
        reviewers: [
          {
            id: 'me',
            name: 'Test Reviewer',
            email: 'test@example.test',
            vote: 0,
            isRequired: true,
          },
        ],
        myVote: 0,
        requiresMe: true,
      },
    ],
    failedStatus: false,
    failedSearch: false,
    failedHistory: false,
    failedCommit: false,
    delay: 0,
    searchDelay: 0,
    searchRequests: [],
    refreshDelay: 0,
    panelDelay: 0,
    historyRequests: 0,
    historyRanges: [],
    fetchRequests: [],
    worktreeRequests: 0,
    worktreeMutations: [],
    worktrees: [
      {
        path: '/fixture',
        head: commits[0].hash,
        branch: 'main',
        bare: false,
        detached: false,
        current: true,
      },
    ],
    bodyMatchIndex: 600,
    stageRequests: [],
    stashRequests: [],
    tagRequests: [],
    commitRequests: [],
    contentRequests: [],
    conflicts: [],
    conflictResolutions: [],
    conflictDetail: {
      path: 'a.txt',
      base: { content: 'base\n', binary: false },
      ours: { content: 'current\n', binary: false },
      theirs: { content: 'incoming\n', binary: false },
      result: {
        content: '<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch\n',
        binary: false,
      },
    },
    diffFiles: [],
    identity: { name: 'Configured User', email: 'test@example.test' },
    settings: {
      azureDevOpsUrl: 'https://azure.example/collection',
      prBranchNameTemplate: 'pr/${randomstring}',
      source: 'file',
    },
    remotes: [
      {
        name: 'origin',
        fetchUrl: 'https://example.test/repo.git',
        pushUrl: 'https://example.test/repo.git',
      },
    ],
    ...overrides,
  };
  const snapshot = () => ({
    files: [...new Set([...state.staged, ...state.unstaged])].map(file),
    staged: state.staged,
    unstaged: state.unstaged,
    untracked: [],
    conflicted: state.conflicts,
    stagedFiles: state.staged.map(file),
    unstagedFiles: state.unstaged.map(file),
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    expect(request.headers()['x-guito-token']).toBe('browser-test-token');
    const parsed = new URL(request.url());
    const body = request.method() === 'GET' || !request.postData() ? {} : request.postDataJSON();
    const send = (json, status = 200) => route.fulfill({ status, json });
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (request.method() === 'DELETE' && parsed.pathname.startsWith('/api/remotes/')) {
      const name = decodeURIComponent(parsed.pathname.split('/').pop());
      state.remotes = state.remotes.filter((remote) => remote.name !== name);
      return send(state.remotes);
    }
    const prPath = parsed.pathname.match(/^\/api\/azure-devops\/pullrequests\/(\d+)(?:\/(.*))?$/);
    if (prPath) {
      const id = Number(prPath[1]);
      const action = prPath[2] || '';
      if (!action && request.method() === 'GET') {
        const summary = state.pullRequests.find((pr) => pr.id === id);
        return send({
          ...summary,
          description: 'Please review **carefully**.',
          autoCompleteSetBy: null,
          completionOptions: null,
          lastMergeSourceCommit: 'a'.repeat(40),
          lastMergeTargetCommit: 'b'.repeat(40),
          labels: summary?.labels ?? ['ui'],
        });
      }
      if (action === 'threads' && request.method() === 'GET') return send({ threads: [] });
      if (action === 'workitems' && request.method() === 'GET') {
        return send({
          workItems: [
            {
              id: 64,
              title: 'Fix login',
              state: 'Active',
              url: 'https://azure.example/project/_workitems/edit/64',
            },
          ],
        });
      }
      if (action === 'checks' && request.method() === 'GET') {
        return state.prChecksError
          ? send({ error: 'Policy evaluations are unavailable' }, 400)
          : send({
              checks: [
                // Reported optional-first so the dialog has to regroup them.
                {
                  id: 'status:lint',
                  name: 'lint-check',
                  kind: 'status',
                  state: 'failed',
                  required: false,
                },
                {
                  id: 'policy:e1',
                  name: 'CI Build',
                  kind: 'build',
                  state: 'succeeded',
                  required: true,
                  detail: 'Build OK',
                },
              ],
              warnings: [],
            });
      }
      if (action === 'changes' && request.method() === 'GET') {
        // Fail only the first request so the Retry path can recover.
        const failed = state.prChangesError === true;
        state.prChangesError = false;
        return failed
          ? send({ error: 'Azure DevOps returned HTTP 500.' }, 400)
          : send({
              files: [
                {
                  path: '/src/login.ts',
                  oldPath: '/src/login.ts',
                  changeType: 'modified',
                },
              ],
            });
      }
      if (action === 'file-diff' && request.method() === 'GET') {
        return send({
          path: '/src/login.ts',
          oldPath: '/src/login.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          originalContent: 'old login\nunchanged',
          modifiedContent: 'new login\nunchanged',
          lines: [
            { type: 'hunk', text: '@@ -1,2 +1,2 @@' },
            { type: 'del', oldLine: 1, text: 'old login' },
            { type: 'add', newLine: 1, text: 'new login' },
            { type: 'context', oldLine: 2, newLine: 2, text: 'unchanged' },
          ],
        });
      }
      state.prMutations.push({ method: request.method(), action, body });
      if (!action && request.method() === 'PATCH') {
        state.pullRequests = state.pullRequests.map((pr) =>
          pr.id === id ? { ...pr, ...body } : pr,
        );
      }
      return send({ success: true });
    }
    switch (parsed.pathname) {
      case '/api/repository-state':
        state.repositoryStateRequests++;
        return send({
          history: state.revision,
          working: state.workingRevision,
        });
      case '/api/avatar':
        state.avatarRequests++;
        return state.avatarAvailable
          ? route.fulfill({
              contentType: 'image/png',
              body: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
                'base64',
              ),
            })
          : route.fulfill({ status: 204 });
      case '/api/settings':
        if (request.method() === 'POST') {
          state.settings = { ...state.settings, ...body };
        }
        return send(state.settings);
      case '/api/remotes':
        if (request.method() === 'POST') {
          const original = body.originalName || body.name;
          state.remotes = state.remotes.filter((remote) => remote.name !== original);
          state.remotes.push({
            name: body.name,
            fetchUrl: body.fetchUrl,
            pushUrl: body.pushUrl || body.fetchUrl,
          });
        } else if (request.method() === 'DELETE') {
          const name = decodeURIComponent(parsed.pathname.split('/').pop());
          state.remotes = state.remotes.filter((remote) => remote.name !== name);
        }
        return send(state.remotes);
      case '/api/identity':
        state.identity = request.method() === 'DELETE' ? { name: '', email: '' } : body;
        return send(state.identity);
      case '/api/azure-devops/tags':
        return send({ tags: ['release', 'ui'] });
      case '/api/azure-devops/reviewers': {
        const query = parsed.searchParams.get('query');
        await delay(query === 'older' ? 1500 : 30);
        return query === 'error'
          ? send({ error: 'Azure authentication failed' }, 400)
          : send({ reviewers: [{ id: query, label: `${query} Reviewer` }] });
      }
      case '/api/azure-devops/workitems':
        return send({
          workItems: [{ id: 64, title: 'Fix login', state: 'Active' }],
        });
      case '/api/azure-devops/pullrequest':
        state.prRequests.push(body);
        return send({
          id: 1,
          url: 'https://azure.example/pr/1',
          branch: 'main',
        });
      case '/api/azure-devops/pullrequests':
        return send({ pullRequests: state.pullRequests });
      case '/api/repo':
        return send({
          name: 'Fixture',
          root: '/fixture',
          identity: state.identity,
        });
      case '/api/branches/all':
        return send([
          {
            name: 'main',
            commit: commits[0].hash,
            current: true,
            remote: false,
          },
          {
            name: 'feature',
            commit: commits[10].hash,
            current: false,
            remote: false,
          },
          {
            name: 'origin/main',
            commit: commits[0].hash,
            current: false,
            remote: true,
          },
        ]);
      case '/api/stash/list':
        await delay(state.panelDelay);
        return send({
          total: 1,
          all: [
            {
              hash: 'f'.padEnd(40, '0'),
              message: 'WIP on main: fixture stash',
              date: '2026-09-08T09:30:00Z',
              author_name: 'Stash Author',
              author_email: 'test@example.test',
            },
          ],
        });
      case '/api/stash/apply':
      case '/api/stash/pop':
      case '/api/stash/drop':
        state.stashRequests.push({ path: parsed.pathname, ...body });
        return send({ success: true });
      case '/api/worktrees':
        state.worktreeRequests++;
        await delay(state.panelDelay);
        if (request.method() === 'POST') {
          state.worktreeMutations.push({ endpoint: parsed.pathname, ...body });
          state.worktrees.push({
            path: body.path,
            head: commits[10].hash,
            branch: body.branch,
            bare: false,
            detached: false,
            current: false,
          });
          return send({ success: true });
        }
        return send(state.worktrees);
      case '/api/worktrees/remove':
        state.worktreeMutations.push({ endpoint: parsed.pathname, ...body });
        state.worktrees = state.worktrees.filter((worktree) => worktree.path !== body.path);
        return send({ success: true });
      case '/api/fetch':
        state.fetchRequests.push({ prune: parsed.searchParams.get('prune') });
        return send({ success: true });
      case '/api/tags':
        await delay(state.panelDelay);
        return send([
          { name: 'v0.5.0', hash: commits[10].hash },
          { name: 'v1.0.0', hash: commits[2].hash },
        ]);
      case '/api/tag/delete':
      case '/api/tag/push':
        state.tagRequests.push({ path: parsed.pathname, ...body });
        return send({ success: true });
      case '/api/commits': {
        state.historyRequests++;
        const skip = Number(parsed.searchParams.get('skip') || 0);
        state.historyRanges.push({
          skip,
          limit: Number(parsed.searchParams.get('limit')),
        });
        await delay(state.refreshDelay);
        if (state.failedHistory && skip) return send({ error: 'History unavailable' }, 400);
        return send({
          commits: commits.slice(
            skip,
            skip + Number(parsed.searchParams.get('limit') || commits.length),
          ),
          total: commits.length,
        });
      }
      case '/api/commits/search': {
        const query = parsed.searchParams.get('query');
        state.searchRequests.push({
          query,
          caseSensitive: parsed.searchParams.get('caseSensitive') === '1',
        });
        const fail = state.failedSearch;
        await delay(state.searchDelay);
        return fail
          ? send({ error: 'Search unavailable' }, 400)
          : send({
              hashes: query === 'body-only' ? [commits[state.bodyMatchIndex].hash] : [],
              indices:
                query === 'body-only'
                  ? {
                      [commits[state.bodyMatchIndex].hash]: state.bodyMatchIndex,
                    }
                  : {},
            });
      }
      case '/api/working-changes':
        return state.failedStatus ? send({ error: 'Status unavailable' }, 400) : send(snapshot());
      case '/api/conflict':
        return send({ ...state.conflictDetail, path: parsed.searchParams.get('path') });
      case '/api/conflict/resolve':
        state.conflictResolutions.push(body);
        state.conflicts = state.conflicts.filter((path) => path !== body.path);
        return send({ success: true });
      case '/api/stage':
      case '/api/unstage': {
        state.stageRequests.push({ path: parsed.pathname, files: body.files });
        await delay(state.delay);
        if (parsed.pathname.endsWith('/unstage')) {
          state.staged = state.staged.filter((path) => !body.files.includes(path));
          state.unstaged = [...new Set([...state.unstaged, ...body.files])].sort();
        } else {
          state.staged = [...new Set([...state.staged, ...body.files])].sort();
          state.unstaged = state.unstaged.filter((path) => !body.files.includes(path));
        }
        return send({ success: true });
      }
      case '/api/commit': {
        state.commitRequests.push(body);
        await delay(state.delay);
        if (state.failedCommit) return send({ error: 'Commit hook rejected changes' }, 400);
        state.staged = [];
        return send({ success: true });
      }
      case '/api/file-content':
        state.contentRequests.push(body);
        return send({ content: `${body.ref}\n` });
      case '/api/commit/detail':
        return send({
          ...commits.find((c) => c.hash === body.hash),
          body: 'Details',
        });
      case '/api/commit/diff':
        return send({ hash: body.hash, files: state.diffFiles });
      default:
        return send({ error: `Unexpected API: ${parsed.pathname}` }, 400);
    }
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let app = page;
  if (overrides.embeddedInVsCode) {
    await page.goto(url);
    await page.setContent(`
      <script>
        window.guitoMessages = [];
        window.addEventListener('message', event => {
          if (event.data?.type === 'guito/openRepository') window.guitoMessages.push(event.data);
        });
      </script>
      <iframe src="${url}" style="width:1280px;height:800px;border:0"></iframe>
    `);
    app = page.frameLocator('iframe');
  } else {
    await page.goto(url);
  }
  await expect(app.locator('.list-viewport .row').first()).toBeVisible();
  await expect(app.locator('.table-loading')).toHaveCount(0);
  return { state, commits, errors, app };
}

test('opening performs only one commit-history refresh', async ({ page }) => {
  const { state, errors } = await setup(page);
  await expect.poll(() => state.repositoryStateRequests, { timeout: 5000 }).toBeGreaterThan(1);
  expect(state.historyRequests).toBe(1);
  expect(errors).toEqual([]);
});

test('header, working row and graph follow horizontal scrolling and column resize', async ({
  page,
}) => {
  const { errors } = await setup(page);
  await page.locator('.working-row').click();
  await page.setViewportSize({ width: 1000, height: 700 });
  const viewport = page.locator('.list-viewport');
  await viewport.evaluate((el) => {
    el.scrollLeft = 170;
    el.scrollTop = 2000;
  });
  await expect
    .poll(() => page.locator('.table-head').evaluate((el) => getComputedStyle(el).transform))
    .not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  const positions = await page.evaluate(() => {
    const x = (selector) => document.querySelector(selector).getBoundingClientRect().x;
    return [
      x('.table-head .cell-date'),
      x('.working-row .cell-date'),
      x('.list-viewport .row .cell-date'),
    ];
  });
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
  expect(
    await page.locator('.graph-overlay').evaluate((el) => getComputedStyle(el).transform),
  ).toBe(await page.locator('.table-head').evaluate((el) => getComputedStyle(el).transform));
  await viewport.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await page.getByRole('button', { name: 'Close changes' }).click();
  // The panel slides out before leaving the layout, so wait for it to be removed
  // before measuring the columns it was resizing next to.
  await expect(page.locator('app-working-panel')).toHaveCount(0);
  const resize = page.locator('.head-cell.cell-author .resizer');
  const box = await resize.boundingBox();
  await page.mouse.move(box.x + 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 82, box.y + 10);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.locator('.head-cell.cell-author').evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(210);
  expect(errors).toEqual([]);
});

test('search navigates body and author matches while retaining the surrounding history', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await page.locator('.list-viewport').evaluate((el) => {
    el.scrollTop = 14000;
  });
  state.searchDelay = 600;
  const search = page.getByPlaceholder('Search commits');
  await search.fill('body-only');
  await expect(page.getByRole('status').filter({ hasText: 'Searching' })).toBeVisible();
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await search.press('Enter');
  await expect(page.locator('.search .count-badge')).toHaveText('1/1');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 600');
  expect(await page.locator('.list-viewport .row').count()).toBeGreaterThan(1);
  await search.fill('no-match');
  await expect(page.locator('.search .count-badge')).toHaveText('0');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 600');
  await search.fill('Spécial Author');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await search.press('Enter');
  await expect(page.locator('.search .count-badge')).toHaveText('1/1');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 7');
  await search.fill('Commit');
  await expect(page.locator('.search .count-badge')).toHaveText('99+');
  expect(errors).toEqual([]);
});

test('search ignores case and accents by default and can require exact text', async ({ page }) => {
  const { state, errors } = await setup(page);
  const search = page.getByPlaceholder('Search commits');
  const count = page.locator('.search .count-badge');

  await search.fill('special author');
  await expect(count).toHaveText('1');
  expect(state.searchRequests.at(-1)).toEqual({
    query: 'special author',
    caseSensitive: false,
  });

  await page.getByTitle('Settings').click();
  await page.getByLabel('Case-sensitive search').check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.searchCaseSensitive).toBe(true);
  await expect(count).toHaveText('0');
  expect(state.searchRequests.at(-1)).toEqual({
    query: 'special author',
    caseSensitive: true,
  });

  await search.fill('Spécial Author');
  await expect(count).toHaveText('1');
  expect(errors).toEqual([]);
});

test('search mode settings filter unloaded body matches and restore navigation with the graph', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  const search = page.getByPlaceholder('Search commits');
  const rows = page.locator('.list-viewport .row');
  await search.fill('body-only');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Next match', exact: true })).toBeVisible();
  await page.getByTitle('Settings').click();
  await page.getByLabel('Search mode').selectOption('filter');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.searchMode).toBe('filter');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Commit 600');
  await expect(page.locator('.graph-overlay, .cell-graph')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next match', exact: true })).toHaveCount(0);
  await search.fill('Special Author');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Commit 7');
  await search.fill('no-match');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('No matching commits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.locator('.search .count-badge')).toHaveCount(0);
  await expect(rows.first()).toContainText('Commit 0');
  await expect(page.locator('.graph-overlay')).toHaveCount(0);
  await search.fill('Commit 42');
  await expect(page.locator('.search .count-badge')).toHaveText('11');
  await expect(rows).toHaveCount(11);
  await page.getByTitle('Settings').click();
  await page.getByLabel('Search mode').selectOption('navigate');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.searchMode).toBe('navigate');
  await expect(page.locator('.graph-overlay')).toBeVisible();
  await expect(rows.first()).toContainText('Commit 0');
  await expect(page.getByRole('button', { name: 'Next match', exact: true })).toBeVisible();
  await search.press('Enter');
  await expect(page.locator('.search .count-badge')).toHaveText('1/11');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 42');
  expect(errors).toEqual([]);
});

test('search loads through a distant match in one request and reuses loaded pages', async ({
  page,
}) => {
  const { state, errors } = await setup(page, 3600);
  state.bodyMatchIndex = 2700;
  await page.getByPlaceholder('Search commits').fill('body-only');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  const before = state.historyRequests;
  await page.getByPlaceholder('Search commits').press('Enter');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 2700');
  expect(state.historyRequests - before).toBe(1);
  expect(state.historyRanges.at(-1)).toEqual({ skip: 500, limit: 2500 });
  await page.getByPlaceholder('Search commits').press('Enter');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 2700');
  expect(state.historyRequests - before).toBe(1);
  expect(errors).toEqual([]);
});

test('failed search navigation waits for explicit history retry', async ({ page }) => {
  const { state } = await setup(page, 3600);
  state.bodyMatchIndex = 2700;
  state.failedHistory = true;
  await page.getByPlaceholder('Search commits').fill('body-only');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await page.getByPlaceholder('Search commits').press('Enter');
  await expect(page.locator('.error-banner')).toContainText('History unavailable');
  const requests = state.historyRequests;
  await page.waitForTimeout(700);
  expect(state.historyRequests).toBe(requests);
  state.failedHistory = false;
  await page.getByRole('button', { name: 'Load more commits', exact: true }).click();
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 2700');
});

test('rapid queries and refresh retain history and the latest match count', async ({ page }) => {
  const { state } = await setup(page);
  state.searchDelay = 1000;
  const search = page.getByPlaceholder('Search commits');
  await search.fill('body-only');
  await expect(page.locator('.table-loading')).toBeVisible();
  await search.fill('Commit 42');
  await page.getByTitle('Refresh').click();
  await expect(page.locator('.list-viewport .row').first()).toBeVisible();
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await expect(page.locator('.search .count-badge')).toHaveText('11');
  await search.press('Enter');
  await expect(page.locator('.search .count-badge')).toHaveText('1/11');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 42');
});

test('failed history does not retry itself and explicit retry recovers', async ({ page }) => {
  const { state } = await setup(page);
  state.failedHistory = true;
  await page.getByRole('button', { name: 'Load more commits', exact: true }).click();
  await expect(page.locator('.error-banner')).toContainText('History unavailable');
  await expect(page.locator('.table-loading')).toHaveCount(0);
  const count = state.historyRequests;
  await page.waitForTimeout(700);
  expect(state.historyRequests).toBe(count);
  await expect(page.locator('.list-viewport .row').first()).toContainText('Commit 0');
  state.failedHistory = false;
  await page.getByRole('button', { name: 'Load more commits', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load more commits', exact: true })).toHaveCount(0);
  await page.locator('.list-viewport').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator('.list-viewport .row').last()).toContainText('Commit 699');
});

test('worker failure completes graph computation above 2000 rows', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class {
      postMessage() {
        setTimeout(() => this.onerror?.(new Event('error')), 50);
      }
      terminate() {}
    };
  });
  const { errors } = await setup(page, 2500);
  await page.getByRole('button', { name: /Load all/ }).click();
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await page.locator('.list-viewport').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator('.list-viewport .row').last()).toContainText('Commit 2499');
  await page.getByPlaceholder('Search commits').fill('no-match');
  await expect(page.locator('.search .count-badge')).toHaveText('0');
  await page.getByPlaceholder('Search commits').fill('');
  await page.locator('.list-viewport').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.locator('.list-viewport .row').first()).toContainText('Commit 0');
  expect(errors).toEqual([]);
});

test('modifier selection, separate diffs, bulk actions and drafts', async ({ page }) => {
  const { state } = await setup(page);
  await page.locator('.working-row').click();
  const unstaged = page.getByRole('listbox', {
    name: 'unstaged files',
    exact: true,
  });
  await unstaged.getByRole('option', { name: 'a.txt', exact: true }).click();
  await unstaged
    .getByRole('option', { name: 'c.txt', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(3);
  await unstaged
    .getByRole('option', { name: 'b.txt', exact: true })
    .click({ modifiers: ['Control'] });
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stage selected', exact: true }).click();
  await expect.poll(() => state.stageRequests.length).toBe(1);
  expect(state.stageRequests[0].files).toEqual(['a.txt', 'c.txt']);
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(0);
  const staged = page.getByRole('listbox', {
    name: 'staged files',
    exact: true,
  });
  await expect(staged.getByRole('button', { name: /diff/i })).toHaveCount(0);
  await staged.getByRole('option', { name: 'partial.txt', exact: true }).dblclick();
  await expect.poll(() => state.contentRequests.length).toBe(2);
  expect(state.contentRequests.map((r) => r.ref)).toEqual(['HEAD', 'INDEX']);
  await page.getByRole('button', { name: 'Close diff', exact: true }).click();
  await unstaged.getByRole('option', { name: 'partial.txt', exact: true }).dblclick();
  await expect.poll(() => state.contentRequests.length).toBe(4);
  expect(state.contentRequests.slice(2).map((r) => r.ref)).toEqual(['INDEX', 'WORKING']);
  await page.getByRole('button', { name: 'Close diff', exact: true }).click();
  await unstaged
    .getByRole('option', { name: 'partial.txt', exact: true })
    .click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Open Diff', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Open File', exact: true })).toBeDisabled();
  await page.getByRole('menuitem', { name: 'Open Diff', exact: true }).click();
  await expect.poll(() => state.contentRequests.length).toBe(6);
  expect(state.contentRequests.slice(4).map((r) => r.ref)).toEqual(['INDEX', 'WORKING']);
  await page.getByRole('button', { name: 'Close diff', exact: true }).click();
  await page.getByLabel('Commit message', { exact: true }).fill('Keep this draft');
  await page.getByRole('button', { name: 'Close changes' }).click();
  await page.locator('.working-row').click();
  await expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Unstage all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit staged changes' })).toBeDisabled();
  await page.getByRole('button', { name: 'Stage all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit staged changes' })).toBeEnabled();
});

test('staged and unstaged file menus copy the repository-relative path', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup(page);
  await page.locator('.working-row').click();

  const staged = page.getByRole('listbox', {
    name: 'staged files',
    exact: true,
  });
  await staged.getByRole('option', { name: 'partial.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy File Path', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('partial.txt');

  const unstaged = page.getByRole('listbox', {
    name: 'unstaged files',
    exact: true,
  });
  await unstaged.getByRole('option', { name: 'a.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy File Path', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('a.txt');
});

test('staged and unstaged files can be compared with another branch', async ({ page }) => {
  const { state } = await setup(page);
  await page.locator('.working-row').click();

  const staged = page.getByRole('listbox', {
    name: 'staged files',
    exact: true,
  });
  await staged.getByRole('option', { name: 'partial.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Compare with Branch...', exact: true }).click();
  const branchDialog = page.getByRole('dialog');
  await expect(branchDialog).toContainText('Compare with Branch');
  await expect(branchDialog.locator('.option-label').filter({ hasText: /^main$/ })).toHaveCount(0);
  await expect(
    branchDialog.locator('.option-label').filter({ hasText: /^origin\/main$/ }),
  ).toHaveCount(1);
  await expect(branchDialog.getByRole('radio', { name: /feature/ })).toHaveCount(1);
  await branchDialog.getByRole('radio', { name: /feature/ }).dblclick();
  await expect.poll(() => state.contentRequests.length).toBe(2);
  expect(state.contentRequests.map((request) => request.ref)).toEqual(['feature', 'INDEX']);
  await page.getByRole('button', { name: 'Close diff', exact: true }).click();

  const unstaged = page.getByRole('listbox', {
    name: 'unstaged files',
    exact: true,
  });
  await unstaged.getByRole('option', { name: 'a.txt', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Compare with Branch...', exact: true }).click();
  await page.getByRole('radio', { name: /origin\/main/ }).dblclick();
  await expect.poll(() => state.contentRequests.length).toBe(4);
  expect(state.contentRequests.slice(2).map((request) => request.ref)).toEqual([
    'origin/main',
    'WORKING',
  ]);
});

test('file lists render as a tree or flat list from the settings dialog', async ({ page }) => {
  const { state } = await setup(page, 700, {
    staged: ['src/app/app.ts', 'src/app/components/toolbar/toolbar.ts', 'README.md'],
    unstaged: ['docs/guide/intro.md', 'docs/guide/advanced.md', 'package.json'],
  });
  state.diffFiles = [file('src/main.ts'), file('src/app/app.ts'), file('README.md')];

  await page.locator('.working-row').click();
  const staged = page.getByRole('listbox', {
    name: 'staged files',
    exact: true,
  });
  const unstaged = page.getByRole('listbox', {
    name: 'unstaged files',
    exact: true,
  });

  // Flat by default: rows show full paths and no folder rows exist.
  await expect(
    unstaged.getByRole('option', { name: 'docs/guide/intro.md', exact: true }),
  ).toBeVisible();
  await expect(staged.getByRole('option', { name: 'src/app/app.ts', exact: true })).toBeVisible();
  await expect(staged.locator('.dir-row')).toHaveCount(0);

  // The full settings dialog switches both groups to the tree view and persists it.
  await page.getByTitle('Settings').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.getByRole('radio', { name: 'Directory tree Group files' }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.fileListView).toBe('tree');

  const stagedTree = page.getByRole('tree', {
    name: 'staged files',
    exact: true,
  });
  const unstagedTree = page.getByRole('tree', {
    name: 'unstaged files',
    exact: true,
  });
  await expect(stagedTree.locator('.dir-row')).toHaveCount(4);
  await expect(stagedTree.locator('.dir-row').first()).toContainText('src');
  await expect(
    stagedTree.getByRole('treeitem', { name: 'src/app/app.ts', exact: true }),
  ).toBeVisible();
  await expect(
    stagedTree.getByRole('treeitem', {
      name: 'src/app/components/toolbar/toolbar.ts',
      exact: true,
    }),
  ).toBeVisible();

  // Collapsing a folder hides only its own files.
  await unstagedTree.getByRole('treeitem', { name: 'Directory docs', exact: true }).click();
  await expect(
    unstagedTree.getByRole('treeitem', {
      name: 'docs/guide/intro.md',
      exact: true,
    }),
  ).toBeHidden();
  await expect(
    unstagedTree.getByRole('treeitem', { name: 'package.json', exact: true }),
  ).toBeVisible();
  await unstagedTree.getByRole('treeitem', { name: 'Directory docs', exact: true }).click();
  await expect(
    unstagedTree.getByRole('treeitem', {
      name: 'docs/guide/intro.md',
      exact: true,
    }),
  ).toBeVisible();

  // Shift-range selection follows the visible tree order.
  await unstagedTree.getByRole('treeitem', { name: 'docs/guide/intro.md', exact: true }).click();
  await unstagedTree
    .getByRole('treeitem', { name: 'docs/guide/advanced.md', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(unstagedTree.locator('.file-row.selected')).toHaveCount(2);
  await page.getByRole('button', { name: 'Stage selected', exact: true }).click();
  await expect.poll(() => state.stageRequests.length).toBe(1);
  expect(state.stageRequests[0].files).toEqual(['docs/guide/advanced.md', 'docs/guide/intro.md']);

  // Commit details use the same tree view.
  await page.locator('.list-viewport .row').first().click();
  const detailFiles = page.locator('app-commit-detail .file-list');
  await expect(detailFiles.locator('.dir-row')).toHaveCount(2);
  await expect(detailFiles.locator('.file-row:not(.dir-row)')).toHaveCount(3);
  await expect(detailFiles.getByText('main.ts', { exact: true })).toBeVisible();

  // The dialog offers the way back to flat lists.
  await page.getByTitle('Settings').click();
  await page.getByRole('radio', { name: 'Flat list Show each file' }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.fileListView).toBe('flat');
  await expect(detailFiles.locator('.dir-row')).toHaveCount(0);
  await expect(detailFiles.locator('.file-row')).toHaveCount(3);
});

test('full settings dialog saves repository and Azure DevOps preferences together', async ({
  page,
}) => {
  const { state, errors } = await setup(page);

  await page.getByTitle('Settings').click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toContainText('Repository preferences and Git configuration.');
  await page.getByLabel('Automatically refresh').uncheck();
  await page.getByLabel('Show Git graph').uncheck();
  await page.getByLabel('Expand repository panel sections').uncheck();
  await page.getByLabel('Search mode').selectOption('filter');
  await page.getByLabel('Case-sensitive search').check();
  await page.getByLabel('Server URL').fill('https://devops.example/DefaultCollection');
  await page.getByLabel('Automatic PR branch name').fill('users/${username}/${randomstring}');
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.settings.autoReload).toBe(false);
  expect(state.settings).toMatchObject({
    azureDevOpsUrl: 'https://devops.example/DefaultCollection',
    prBranchNameTemplate: 'users/${username}/${randomstring}',
    autoReload: false,
    showGraph: false,
    showStashes: false,
    fileListView: 'flat',
    sidePanelSectionsExpanded: false,
    searchMode: 'filter',
    searchCaseSensitive: true,
  });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const sectionHeaders = page.locator('.side-panel .tree-head');
  await expect(sectionHeaders).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(sectionHeaders.nth(index)).toHaveAttribute('aria-expanded', 'false');
  }
  expect(errors).toEqual([]);
});

test('settings manage identity, remotes, tags, remote branches, and issue links', async ({
  page,
}) => {
  const { state, errors } = await setup(page, 30, {
    firstMessage: 'Fix #123 login',
    firstRefs: 'HEAD -> main, origin/main, tag: v1.0.0',
  });
  await expect(page.locator('.badge-tag')).toContainText('v1.0.0');
  await expect(page.locator('.badge-remote')).toContainText('origin/main');
  await page.getByTitle('Settings').click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });

  await expect(dialog.getByText('Configured User')).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('User name').fill('New User');
  await page.getByLabel('User email').fill('new@example.test');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('New User')).toBeVisible();

  await dialog.getByRole('button', { name: '+ Add Remote' }).click();
  await page.getByLabel('Remote name').fill('upstream');
  await page.getByLabel('Fetch URL').fill('https://example.test/upstream.git');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('upstream', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: '+ Add Issue Linking' }).click();
  await page.getByLabel('Issue URL').fill('https://example.test/issues/$1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('https://example.test/issues/$1')).toBeVisible();
  await page.getByLabel('Show tags').uncheck();
  await page.getByLabel('Show remote branches').uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();

  expect(state.identity).toEqual({
    name: 'New User',
    email: 'new@example.test',
  });
  expect(state.remotes.some((remote) => remote.name === 'upstream')).toBe(true);
  expect(state.settings).toMatchObject({
    showTags: false,
    showRemoteBranches: false,
  });
  await expect(page.locator('.badge-tag')).toHaveCount(0);
  await expect(page.locator('.badge-remote')).toHaveCount(0);
  const issueLink = page.getByRole('link', { name: '#123' });
  await expect(issueLink).toHaveAttribute('href', 'https://example.test/issues/123');
  expect(errors).toEqual([]);
});

test('failed status and commits preserve data; duplicate commits are prevented', async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.locator('.working-row').click();
  const commit = page.getByRole('button', { name: 'Commit staged changes' });
  await expect(commit).toBeDisabled();
  await page.getByLabel('Commit message', { exact: true }).fill('Subject');
  await page.getByLabel('Description (optional)', { exact: true }).fill('Body');
  state.failedStatus = true;
  await page.getByTitle('Refresh').click();
  await expect(page.getByRole('alert')).toContainText('Status unavailable');
  await expect(page.getByRole('option', { name: 'a.txt', exact: true })).toBeVisible();
  await expect(commit).toBeDisabled();
  state.failedStatus = false;
  await page.getByRole('button', { name: 'Retry status' }).click();
  await expect(commit).toBeEnabled();
  state.failedCommit = true;
  state.delay = 500;
  await commit.evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(commit).toBeDisabled();
  await expect(page.locator('.error-banner')).toContainText('Commit hook rejected');
  expect(state.commitRequests.length).toBe(1);
  await expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('Subject');
  state.failedCommit = false;
  await expect(commit).toBeEnabled();
  await commit.click();
  await expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Description (optional)', { exact: true })).toHaveValue('');
  expect(state.commitRequests[1]).toEqual({
    message: 'Subject',
    description: 'Body',
  });
});

test('authenticated iframe loads real history and working changes', async ({ page, request }) => {
  expect((await request.get('/api/commits')).status()).toBe(401);
  await page.goto(url);
  await page.setContent(
    '<iframe title="Guito" style="width:100%;height:700px" src="/?guitoToken=browser-test-token"></iframe>',
  );
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.list-viewport .row').first()).toContainText('Browser fixture');
  await frame.locator('.working-row').click();
  await expect(frame.getByRole('option', { name: 'example.txt' })).toBeVisible();
});

test('search errors keep rows and retry; refresh loading respects reduced motion', async ({
  page,
}) => {
  const { state } = await setup(page);
  state.failedSearch = true;
  await page.getByPlaceholder('Search commits').fill('body-only');
  await expect(page.locator('.error-banner')).toContainText('Search unavailable');
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await expect(page.locator('.list-viewport .row').first()).toContainText('Commit 0');
  state.failedSearch = false;
  state.refreshDelay = 700;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Refreshing' })).toBeVisible();
  await expect(page.locator('.table-loading .spinner')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await page.getByPlaceholder('Search commits').press('Enter');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 600');
});

test('real graph worker renders large history and keyboard/modifier anchors are scoped', async ({
  page,
}) => {
  const workers = [];
  page.on('worker', (worker) => workers.push(worker));
  await setup(page, 2500);
  await page.getByRole('button', { name: /Load all/ }).click();
  await expect.poll(() => workers.length).toBe(1);
  await expect(page.getByRole('button', { name: /Load all/ })).toHaveCount(0);
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await page.locator('.working-row').click();
  const unstaged = page.getByRole('listbox', {
    name: 'unstaged files',
    exact: true,
  });
  const staged = page.getByRole('listbox', {
    name: 'staged files',
    exact: true,
  });
  await unstaged.getByRole('option', { name: 'a.txt', exact: true }).click();
  await unstaged.getByRole('option', { name: 'c.txt', exact: true }).click({ modifiers: ['Meta'] });
  await unstaged
    .getByRole('option', { name: 'partial.txt', exact: true })
    .click({ modifiers: ['Control', 'Shift'] });
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(4);
  await staged
    .getByRole('option', { name: 'partial.txt', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(staged.getByRole('option', { selected: true })).toHaveCount(1);
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(4);
  await unstaged.getByRole('option', { name: 'a.txt', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(unstaged.getByRole('option', { selected: true })).toHaveCount(2);
});

test('unresolved conflicts disable commit even with staged files and a message', async ({
  page,
}) => {
  const { state } = await setup(page);
  state.conflicts = ['a.txt'];
  await page.getByTitle('Refresh').click();
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await page.locator('.working-row').click();
  await page.getByLabel('Commit message', { exact: true }).fill('Cannot commit yet');
  await expect(page.getByText('Resolve conflicts before committing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit staged changes' })).toBeDisabled();
});

test('standalone conflict list opens the resolver and stages the edited result', async ({
  page,
}) => {
  const { state } = await setup(page, 700, { conflicts: ['a.txt'] });
  await page.locator('.working-row').click();
  const conflicts = page.getByRole('region', { name: 'Merge conflicts' });
  await expect(conflicts.getByText('Merge conflicts (1)')).toBeVisible();
  await conflicts.getByRole('button', { name: /a\.txt.*Resolve/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Resolve merge conflict' });
  await expect(dialog.getByText('current', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use incoming' }).click();
  await dialog.getByLabel('Resolved file content').fill('resolved together\n');
  await dialog.getByRole('button', { name: 'Mark as resolved' }).click();

  await expect(dialog).toHaveCount(0);
  expect(state.conflictResolutions).toEqual([
    { path: 'a.txt', resolution: 'content', content: 'resolved together\n' },
  ]);
  await expect(page.getByRole('region', { name: 'Merge conflicts' })).toHaveCount(0);
});

test('embedded conflict list delegates resolution to the VS Code host', async ({ page }) => {
  const { state } = await setup(page, 700, { conflicts: ['a.txt'] });
  await page.evaluate(() => {
    window.__guitoMessages = [];
    window.addEventListener('message', (event) => window.__guitoMessages.push(event.data));
    document.body.innerHTML =
      '<iframe title="Embedded Guito" style="width:100%;height:700px" src="/?guitoToken=browser-test-token"></iframe>';
  });
  const frame = page.frameLocator('iframe[title="Embedded Guito"]');
  await frame.locator('.working-row').click();
  await frame
    .getByRole('region', { name: 'Merge conflicts' })
    .getByRole('button', { name: /a\.txt.*Resolve/ })
    .click();

  await expect
    .poll(() => page.evaluate(() => window.__guitoMessages))
    .toContainEqual({
      type: 'guito/openMergeConflict',
      path: 'a.txt',
    });
  await expect(frame.getByRole('dialog', { name: 'Resolve merge conflict' })).toHaveCount(0);
  expect(state.conflictResolutions).toEqual([]);
});

test('resizing changes only the dragged column until the window is resized', async ({ page }) => {
  await setup(page);
  const widths = () =>
    page
      .locator('.table-head .head-cell')
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
  const drag = async (column, delta) => {
    const box = await page.locator(`.head-cell.cell-${column} .resizer`).boundingBox();
    await page.mouse.move(box.x + 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 2 + delta, box.y + 10);
    await page.mouse.up();
  };
  // The table fills the window on load.
  const filled = () =>
    page.evaluate(() => {
      const head = document.querySelector('.table-head');
      const viewport = document.querySelector('.list-viewport');
      return Math.abs(head.clientWidth - viewport.clientWidth) <= 1;
    });
  await expect.poll(filled).toBe(true);
  const before = await widths();
  await drag('author', -70);
  // Only the dragged column changes; the freed space is left alone, so the
  // table may end up narrower than the window.
  expect(await widths()).toEqual(before.map((width, index) => (index === 3 ? width - 70 : width)));
  expect(await page.locator('.table-head').evaluate((el) => el.clientWidth)).toBeLessThan(
    await page.locator('.list-viewport').evaluate((el) => el.clientWidth),
  );
  // Resizing the window stretches the Description column back to 100%.
  await page.setViewportSize({ width: 1100, height: 600 });
  await expect.poll(filled).toBe(true);
  const shrunk = await widths();
  await drag('desc', 800);
  expect(await widths()).toEqual(shrunk.map((width, index) => (index === 1 ? width + 800 : width)));
  expect(
    await page.locator('.list-viewport').evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('.list-viewport .row').first()).toBeVisible();
  expect(await widths()).toEqual(shrunk.map((width, index) => (index === 1 ? width + 800 : width)));
});

test('avatar requests are shared between rows and commit details', async ({ page }) => {
  const { state } = await setup(page);
  await expect.poll(() => state.avatarRequests).toBe(1);
  await page.locator('.list-viewport .row').first().click();
  await expect(page.locator('app-commit-detail app-author-avatar')).toBeVisible();
  expect(state.avatarRequests).toBe(1);
  await expect(page.locator('app-commit-detail app-author-avatar')).toContainText('TA');
  state.avatarAvailable = true;
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator('app-author-avatar img')
        .first()
        .evaluate((img) => img.naturalWidth),
    )
    .toBe(1);
  expect(state.avatarRequests).toBe(2);
});

test('PR draft defaults off, metadata is selectable, and stale reviewer replies are discarded', async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.getByTitle('Push').click();
  await page.getByRole('menuitem', { name: 'Create Pull Request...' }).click();
  const dialog = page.locator('app-create-pr-dialog');
  await expect(dialog.getByLabel('Create as draft')).not.toBeChecked();
  const required = dialog.locator('app-chip-input').nth(0);
  await required.locator('input').fill('older');
  await expect(required.getByText('Searching...')).toBeVisible();
  await page.waitForTimeout(400);
  await required.locator('input').fill('newer');
  await required.getByRole('option', { name: 'newer Reviewer' }).click();
  await expect(required.locator('.chip')).toContainText('newer Reviewer');
  await page.waitForTimeout(1600);
  await expect(required.getByText('older Reviewer')).toHaveCount(0);
  const optional = dialog.locator('app-chip-input').nth(1);
  await optional.locator('input').fill('error');
  await expect(optional.getByRole('alert')).toHaveText('Azure authentication failed');
  const items = dialog.locator('app-chip-input').nth(2);
  await items.locator('input').fill('#64');
  await items.getByRole('option', { name: '#64 Fix login Active' }).click();
  const tags = dialog.locator('app-chip-input').nth(3);
  await tags.locator('input').fill('rel');
  await tags.getByRole('option', { name: 'release', exact: true }).click();
  await dialog.getByLabel('Create as draft').check();
  await dialog.getByRole('button', { name: 'Create Pull Request', exact: true }).click();
  await expect.poll(() => state.prRequests.length).toBe(1);
  expect(state.prRequests[0]).toMatchObject({
    isDraft: true,
    reviewers: [{ id: 'newer', required: true }],
    workItems: [64],
    labels: ['release'],
  });
});

test('external checkout and commit refresh the browser without a manual refresh', async ({
  page,
  request,
}) => {
  const { execFileSync } = await import('node:child_process');
  const response = await request.get('/api/repo', {
    headers: { 'x-guito-token': 'browser-test-token' },
  });
  const { root } = await response.json();
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  await page.goto(url);
  await expect(page.locator('.list-viewport .row').first()).toBeVisible();
  git('checkout', '-b', 'outside-browser');
  git('commit', '--allow-empty', '-m', 'External browser commit');
  await expect(page.locator('.list-viewport .row').first()).toContainText(
    'External browser commit',
    { timeout: 15000 },
  );
  await expect(page.locator('.list-viewport .row').first()).toContainText('outside-browser');
});

test('dismissing a status error preserves guards and a failed refresh shows it again', async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.locator('.working-row').click();
  await page.getByLabel('Commit message', { exact: true }).fill('Keep this draft');
  state.failedStatus = true;
  await page.getByTitle('Refresh').click();
  await expect(page.getByRole('alert')).toContainText('Status unavailable');
  await expect(page.getByRole('alert')).toHaveCSS('animation-name', /error-banner-enter$/);
  const close = page.getByRole('button', { name: 'Dismiss error' });
  await close.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveClass(/closing/);
  await expect(page.getByRole('alert')).toHaveCSS('animation-name', /error-banner-leave$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Commit staged changes' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Stage all', exact: true })).toBeDisabled();
  await page.getByTitle('Refresh').click();
  await expect(page.getByRole('alert')).toContainText('Status unavailable');
  state.failedStatus = false;
  await page.getByRole('button', { name: 'Retry status' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Commit staged changes' })).toBeEnabled();
  await expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('Keep this draft');
});

test('changing the branch and tag layout reloads the repository panel', async ({ page }) => {
  const { state, errors } = await setup(page);
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const panel = page.locator('.side-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTitle('origin/main', { exact: true })).toBeVisible();
  await panel.getByRole('searchbox', { name: 'Search' }).fill('origin');

  const initialPanelLoads = state.worktreeRequests;
  await page.getByTitle('Settings').click();
  await page.getByRole('radio', { name: 'Directory tree Group branches and tags' }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.refListView).toBe('tree');
  await expect.poll(() => state.worktreeRequests).toBeGreaterThan(initialPanelLoads);
  await expect(panel.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  await expect(panel.locator('.dir-row[title="origin"]')).toBeVisible();

  const treePanelLoads = state.worktreeRequests;
  await page.getByTitle('Settings').click();
  await page.getByRole('radio', { name: 'Flat list Show each branch and tag' }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.refListView).toBe('flat');
  await expect.poll(() => state.worktreeRequests).toBeGreaterThan(treePanelLoads);
  await expect(panel.locator('.dir-row[title="origin"]')).toHaveCount(0);
  await expect(panel.getByTitle('origin/main', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Resolves true when the panel host next starts a width transition. */
const watchPanelSlide = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const onRun = (event) => {
          if (!(event.target instanceof Element)) return;
          if (event.target.tagName !== 'APP-SIDE-PANEL' || event.propertyName !== 'width') return;
          cleanup();
          resolve(true);
        };
        const cleanup = () => {
          clearTimeout(timer);
          document.removeEventListener('transitionrun', onRun);
        };
        const timer = setTimeout(() => {
          document.removeEventListener('transitionrun', onRun);
          resolve(false);
        }, 4000);
        document.addEventListener('transitionrun', onRun);
      }),
  );

test('repository panel slides in when opened', async ({ page }) => {
  const { errors } = await setup(page);
  const toggle = page.getByRole('button', { name: 'Toggle repository panel' });
  const host = page.locator('app-side-panel');

  // The first open must animate the host width from zero instead of showing
  // the panel at full width instantly; transitionrun only fires when a
  // transition actually starts.
  const firstSlide = watchPanelSlide(page);
  await toggle.click();
  await expect(host).toBeVisible();
  expect(await firstSlide).toBe(true);
  await expect(host).toHaveCSS('width', '260px');

  // Reopening after a fully completed close must slide in as well.
  await toggle.click();
  await expect(host).toBeHidden();
  const reopenSlide = watchPanelSlide(page);
  await toggle.click();
  await expect(host).toBeVisible();
  expect(await reopenSlide).toBe(true);
  expect(errors).toEqual([]);
});

test('repository panel animation follows live reduced-motion changes', async ({ page }) => {
  const { errors } = await setup(page);
  const toggle = page.getByRole('button', { name: 'Toggle repository panel' });
  const host = page.locator('app-side-panel');

  await toggle.click();
  await expect(host).toBeVisible();
  await expect(host).toHaveCSS('width', '260px');

  // The preference can change after the app starts. Closing must not wait for
  // a transitionend event that reduced-motion CSS deliberately suppresses.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.click();
  await expect(host).toBeHidden();

  await toggle.click();
  await expect(host).toBeVisible();
  await expect(host).toHaveCSS('width', '260px');

  // Reversing a close should continue from the current width instead of
  // jumping to an animation endpoint. Both flights are sampled inside the
  // page per animation frame; driving the clicks and samples from the test
  // can miss the whole 150ms window under load.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Commit the restored transition property before closing: the media flip
  // alone triggers no style recalc, so without this the width change and the
  // return of transition: width would land in one pass and the browser would
  // skip the close transition entirely.
  await host.evaluate((element) => void element.offsetWidth);
  const reversal = await host.evaluate(async (element) => {
    const toggle = document.querySelector('button[aria-label="Toggle repository panel"]');
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const width = () => Math.round(element.getBoundingClientRect().width * 10) / 10;
    toggle.click();
    let closingWidth = 0;
    let closeDeadline = performance.now() + 1000;
    while (performance.now() < closeDeadline) {
      const current = width();
      if (current > 0 && current < 260) {
        closingWidth = current;
        break;
      }
      if (current === 0) break; // The close finished (or never animated).
      await nextFrame();
    }
    toggle.click();
    let firstReopenWidth = null;
    let minWidth = 260;
    let settled = false;
    const reopenDeadline = performance.now() + 1500;
    while (performance.now() < reopenDeadline) {
      const current = width();
      if (firstReopenWidth === null) firstReopenWidth = current;
      minWidth = Math.min(minWidth, current);
      if (current >= 260) {
        settled = true;
        break;
      }
      await nextFrame();
    }
    return { closingWidth, firstReopenWidth, minWidth, settled };
  });
  expect(reversal.closingWidth).toBeGreaterThan(0);
  expect(reversal.closingWidth).toBeLessThan(260);
  expect(reversal.firstReopenWidth).toBeLessThan(260);
  expect(reversal.minWidth).toBeGreaterThan(0);
  expect(reversal.settled).toBe(true);
  await expect(host).toHaveCSS('width', '260px');
  expect(errors).toEqual([]);
});

test('repository panel shows loading feedback inside each expanded section', async ({ page }) => {
  const { errors } = await setup(page, 700, { panelDelay: 500 });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const panel = page.locator('.side-panel');

  await expect(panel.locator('.panel-loading')).toHaveCount(0);
  for (const title of ['Branches', 'Tags', 'Stashes', 'Worktrees']) {
    const section = panel.locator('.tree').filter({ hasText: title });
    await expect(section.getByRole('status').filter({ hasText: 'Loading...' })).toBeVisible();
  }

  await expect(panel.locator('.section-loading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('VS Code layout changes reload the repository panel UI', async ({ page }) => {
  const { state, errors, app } = await setup(page, 700, { embeddedInVsCode: true });
  await app.getByRole('button', { name: 'Toggle repository panel' }).click();
  const panel = app.locator('.side-panel');
  const filter = panel.getByRole('searchbox', { name: 'Search' });
  await expect(panel.getByTitle('origin/main', { exact: true })).toBeVisible();
  await filter.fill('origin');

  const initialPanelLoads = state.worktreeRequests;
  state.settings = { ...state.settings, refListView: 'tree' };
  await page.evaluate(() => {
    document
      .querySelector('iframe')
      .contentWindow.postMessage({ type: 'guito/config', diffViewer: 'guito' }, '*');
  });

  await expect.poll(() => state.worktreeRequests).toBeGreaterThan(initialPanelLoads);
  await expect(filter).toHaveValue('');
  await expect(panel.locator('.dir-row[title="origin"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('repository panel shows branches, stashes and worktrees and filters on selection', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await expect(page.locator('.side-panel')).toHaveCount(0);

  // The hamburger button opens the panel; stashes and worktrees load lazily.
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const panel = page.locator('.side-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTitle('main', { exact: true })).toBeVisible();
  const feature = panel.getByTitle('feature', { exact: true });
  await expect(feature).toBeVisible();
  const stash = panel.locator('.row').filter({ hasText: 'stash@{0}' });
  await expect(stash).toContainText('fixture stash');
  await expect(panel.locator('.tree').filter({ hasText: 'Worktrees' })).toContainText('fixture');
  expect(state.worktreeRequests).toBeGreaterThan(0);

  // The filter-bar action collapses and expands every repository section.
  const sectionHeaders = panel.locator('.tree-head');
  const collapseAll = panel.getByRole('button', { name: 'Collapse all sections' });
  await expect(collapseAll).toBeVisible();
  await expect(collapseAll).toHaveAttribute('aria-expanded', 'true');
  await collapseAll.click();
  await expect(sectionHeaders).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(sectionHeaders.nth(index)).toHaveAttribute('aria-expanded', 'false');
  }
  const expandAll = panel.getByRole('button', { name: 'Expand all sections' });
  await expect(expandAll).toHaveAttribute('aria-expanded', 'false');
  await expandAll.click();
  for (let index = 0; index < 5; index += 1) {
    await expect(sectionHeaders.nth(index)).toHaveAttribute('aria-expanded', 'true');
  }

  // Clicking a stash in the repository panel opens its changed-file list.
  state.diffFiles = [file('stashed.txt')];
  await stash.click();
  const stashDetail = page.locator('app-commit-detail');
  await expect(stash).toHaveClass(/selected/);
  await expect(stashDetail.locator('.subject')).toContainText('fixture stash');
  await expect(stashDetail.locator('.file-path', { hasText: 'stashed.txt' })).toBeVisible();

  // The section action creates a worktree from an available local branch.
  await panel.getByRole('button', { name: 'Create worktree' }).click();
  const worktreeDialog = page.getByRole('dialog', { name: 'Create Worktree' });
  await expect(worktreeDialog).toBeVisible();
  await expect(worktreeDialog.getByRole('button', { name: 'Browse...' })).toBeDisabled();
  await worktreeDialog.getByLabel('Folder').fill('/tmp/feature-worktree');
  await worktreeDialog.getByLabel('Branch').selectOption('feature');
  await worktreeDialog.getByRole('button', { name: 'Create Worktree' }).click();
  await expect(worktreeDialog).toHaveCount(0);
  await expect(panel.getByTitle('/tmp/feature-worktree')).toContainText('feature');
  await expect
    .poll(() => state.worktreeMutations.at(-1))
    .toEqual({
      endpoint: '/api/worktrees',
      path: '/tmp/feature-worktree',
      branch: 'feature',
    });

  // Right-click deletion confirms before removing the folder; the current
  // worktree's equivalent action remains disabled.
  await panel.getByTitle('/fixture', { exact: true }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Delete Worktree...' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await panel.getByTitle('/tmp/feature-worktree').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Switch Current Tab' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Open as New Tab' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Open in New VS Code Window' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await panel.getByTitle('/tmp/feature-worktree').dblclick();
  await expect(panel.getByTitle('/tmp/feature-worktree')).toBeVisible();
  await panel.getByTitle('/tmp/feature-worktree').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Worktree...' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(panel.getByTitle('/tmp/feature-worktree')).toHaveCount(0);
  await expect
    .poll(() => state.worktreeMutations.at(-1))
    .toEqual({
      endpoint: '/api/worktrees/remove',
      path: '/tmp/feature-worktree',
    });

  // Tags are listed below the branches with a count.
  const tagsSection = panel.locator('.tree').filter({ hasText: 'Tags' });
  await expect(tagsSection.locator('.row')).toHaveCount(2);

  // Clicking a tag opens the commit it points to.
  await tagsSection.locator('.row').filter({ hasText: 'v1.0.0' }).click();
  const tagDetail = page.locator('app-commit-detail');
  await expect(tagDetail).toBeVisible();
  await expect(tagDetail.locator('.subject')).toContainText('Commit 2');

  // Right-clicking a tag offers the tag actions; deleting posts the name.
  await tagsSection.locator('.row').filter({ hasText: 'v0.5.0' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Tag...' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect
    .poll(() => state.tagRequests.at(-1))
    .toEqual({
      path: '/api/tag/delete',
      name: 'v0.5.0',
    });
  await expect(page.locator('.table-loading')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Selecting a branch filters the commit table to that branch's history;
  // the feature branch head (Commit 10) becomes the newest visible commit.
  const rows = page.locator('.list-viewport .row');
  await expect(rows.first()).toContainText('Commit 0');
  await feature.click();
  await expect(feature).toHaveClass(/selected/);
  await expect(rows.first()).toContainText('Commit 10');
  // Shift-click selects the range up to the clicked branch; the merged
  // histories of both branches are shown again.
  const mainRow = panel.getByTitle('main', { exact: true });
  await mainRow.click({ modifiers: ['Shift'] });
  await expect(mainRow).toHaveClass(/selected/);
  await expect(rows.first()).toContainText('Commit 0');
  // Ctrl-click adds another branch without clearing the previous ones.
  const originMain = panel.getByTitle('origin/main', { exact: true });
  await originMain.click({ modifiers: ['Control'] });
  await expect(originMain).toHaveClass(/selected/);
  await expect(feature).toHaveClass(/selected/);
  await expect(mainRow).toHaveClass(/selected/);
  // Ctrl-click again drops the branch from the selection.
  await originMain.click({ modifiers: ['Control'] });
  await expect(originMain).not.toHaveClass(/selected/);
  // A plain click focuses a single branch of the multi-selection.
  await feature.click();
  await expect(rows.first()).toContainText('Commit 10');
  // Clicking the selected branch again clears the filter.
  await feature.click();
  await expect(rows.first()).toContainText('Commit 0');

  // The settings dialog toggle hides remote branches from the panel.
  await page.getByTitle('Settings').click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('Show remote branches').uncheck();
  await settings.getByRole('button', { name: 'Save settings' }).click();
  await expect(settings).toHaveCount(0);
  await expect(panel.getByTitle('origin/main', { exact: true })).toHaveCount(0);

  // Closing the panel keeps its component alive, including its section state.
  const stashesToggle = panel.locator('.tree-head').filter({ hasText: 'Stashes' });
  await stashesToggle.click();
  await expect(stashesToggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('app-side-panel')).toHaveCount(1);
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(panel).toBeVisible();
  await expect(stashesToggle).toHaveAttribute('aria-expanded', 'false');

  // The fetch button offers plain and pruning fetches.
  await page.locator('.toolbar .icon-btn[title="Fetch"]').click();
  await page.getByRole('menuitem', { name: 'Fetch (prune)' }).click();
  await expect.poll(() => state.fetchRequests.some((request) => request.prune === '1')).toBe(true);
  await expect(page.locator('.table-loading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('worktree double click and menu send distinct VS Code context actions', async ({ page }) => {
  const worktreePath = '/fixture-feature';
  const { app, errors } = await setup(page, 700, {
    embeddedInVsCode: true,
    worktrees: [
      {
        path: '/fixture',
        head: history(1)[0].hash,
        branch: 'main',
        bare: false,
        detached: false,
        current: true,
      },
      {
        path: worktreePath,
        head: history(1)[0].hash,
        branch: 'feature',
        bare: false,
        detached: false,
        current: false,
      },
    ],
  });
  await app.getByRole('button', { name: 'Toggle repository panel' }).click();
  const row = app.getByTitle(worktreePath);

  await row.dblclick();
  await expect
    .poll(() => page.evaluate(() => window.guitoMessages.at(-1)))
    .toEqual({ type: 'guito/openRepository', path: worktreePath, disposition: 'switch' });

  for (const [name, disposition] of [
    ['Switch Current Tab', 'switch'],
    ['Open as New Tab', 'tab'],
    ['Open in New VS Code Window', 'window'],
  ]) {
    await row.click({ button: 'right' });
    await app.getByRole('menuitem', { name }).click();
    await expect
      .poll(() => page.evaluate(() => window.guitoMessages.at(-1)))
      .toEqual({ type: 'guito/openRepository', path: worktreePath, disposition });
  }
  expect(errors).toEqual([]);
});

test('repository panel search bar filters every section', async ({ page }) => {
  const { state, errors } = await setup(page);
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const panel = page.locator('.side-panel');
  await expect(panel.getByTitle('main', { exact: true })).toBeVisible();

  const filterInput = panel.getByRole('searchbox', { name: 'Search' });
  const searchIcon = panel.locator('.filter-field .filter-icon');
  await expect(filterInput).toHaveAttribute('placeholder', 'Search');
  await expect(searchIcon).toBeVisible();
  const branchesSection = panel.locator('.tree').filter({ hasText: 'Branches' });
  const tagsSection = panel.locator('.tree').filter({ hasText: 'Tags' });
  const stashesSection = panel.locator('.tree').filter({ hasText: 'Stashes' });
  const worktreesSection = panel.locator('.tree').filter({
    hasText: 'Worktrees',
  });
  const prSection = page.locator('.tree').filter({ hasText: 'Pull Requests' });

  // Filtering matches across all sections: the feature branch, the pull
  // request sourced from feature/login; everything else is hidden and the
  // section headers count the matches.
  await filterInput.fill('feature');
  await expect(panel.getByTitle('feature', { exact: true })).toBeVisible();
  await expect(panel.getByTitle('main', { exact: true })).toHaveCount(0);
  await expect(panel.getByTitle('origin/main', { exact: true })).toHaveCount(0);
  await expect(branchesSection.locator('.tree-count')).toHaveText('1');
  await expect(tagsSection.locator('.empty')).toHaveText('No matching tags');
  await expect(tagsSection.locator('.tree-count')).toHaveText('0');
  await expect(stashesSection.locator('.empty')).toHaveText('No matching stashes');
  await expect(worktreesSection.locator('.empty')).toHaveText('No matching worktrees');
  await expect(prSection.locator('.pr-row')).toHaveCount(1);

  // Clearing restores the unfiltered lists.
  const clearSearch = panel.getByRole('button', { name: 'Clear search' });
  await expect(clearSearch).toBeVisible();
  const fieldBox = await panel.locator('.filter-field').boundingBox();
  const iconBox = await searchIcon.boundingBox();
  const clearBox = await clearSearch.boundingBox();
  expect(fieldBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(clearBox).not.toBeNull();
  expect(iconBox.x).toBeGreaterThanOrEqual(fieldBox.x);
  expect(clearBox.x).toBeGreaterThan(fieldBox.x);
  expect(clearBox.x + clearBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width);
  await clearSearch.click();
  await expect(panel.getByTitle('main', { exact: true })).toBeVisible();
  await expect(tagsSection.locator('.row')).toHaveCount(2);
  await expect(branchesSection.locator('.tree-count')).toHaveText('3');

  // Escape also clears the filter.
  await filterInput.fill('v1');
  await expect(tagsSection.locator('.row').filter({ hasText: 'v1.0.0' })).toBeVisible();
  await expect(tagsSection.locator('.row').filter({ hasText: 'v0.5.0' })).toHaveCount(0);
  await filterInput.press('Escape');
  await expect(tagsSection.locator('.row').filter({ hasText: 'v0.5.0' })).toBeVisible();
  await expect(filterInput).toHaveValue('');

  // Sections report when nothing matches.
  await filterInput.fill('zzz');
  await expect(branchesSection.locator('.empty')).toHaveText('No matching branches');
  await expect(branchesSection.locator('.tree-count')).toHaveText('0');

  // The shared sensitivity setting controls sidebar casing and accents too.
  await filterInput.fill('ada author');
  await expect(prSection.locator('.pr-row')).toHaveCount(1);
  await page.getByTitle('Settings').click();
  await page.getByLabel('Case-sensitive search').check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(prSection.locator('.pr-row')).toHaveCount(0);
  await filterInput.fill('Áda Author');
  await expect(prSection.locator('.pr-row')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('pull request panel reviews, edits, comments, diffs, and completes a PR', async ({ page }) => {
  const { state, errors } = await setup(page, 700, {
    settings: {
      azureDevOpsUrl: 'https://azure.example/collection',
      prBranchNameTemplate: 'pr/${randomstring}',
      fileListView: 'tree',
      source: 'file',
    },
  });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(page.locator('.side-panel .tree-title')).toHaveText([
    'Branches',
    'Tags',
    'Stashes',
    'Worktrees',
    'Pull Requests',
  ]);
  const prSection = page.locator('.tree').filter({ hasText: 'Pull Requests' });
  await expect(prSection).toContainText('Review the new login flow');
  await expect(prSection).toContainText('Required');
  await prSection.locator('.pr-row').click();

  const dialog = page.getByRole('dialog', { name: 'Pull request details' });
  await expect(dialog).toContainText('Please review carefully.');
  // Overview shows the merge gates before the details card.
  await expect(dialog).toContainText('Checks');
  await expect(dialog).toContainText('CI Build');
  await expect(dialog).toContainText('lint-check');
  // Required checks are grouped above the divider, optional ones below.
  const checkLists = dialog.locator('.checks-card .check-list');
  await expect(checkLists).toHaveCount(2);
  await expect(checkLists.nth(0)).toContainText('CI Build');
  await expect(checkLists.nth(0)).not.toContainText('lint-check');
  await expect(checkLists.nth(1)).toContainText('lint-check');
  await expect(dialog.locator('.checks-card .check-divider')).toHaveCount(1);
  await expect(dialog).toContainText('Fix login');
  await expect(dialog).toContainText('ui');
  await dialog.getByRole('button', { name: 'Review ▾', exact: true }).click();
  await dialog.getByRole('menuitem', { name: 'Approve', exact: true }).click();
  await expect
    .poll(() =>
      state.prMutations.some((item) => item.action === 'vote' && item.body.vote === 'approve'),
    )
    .toBe(true);

  await dialog.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Title').fill('Updated login review');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) => item.method === 'PATCH' && item.body.title === 'Updated login review',
      ),
    )
    .toBe(true);

  await dialog.getByRole('button', { name: /^Comments/ }).click();
  await dialog.getByPlaceholder('Leave a comment (markdown supported)').fill('General feedback');
  await dialog.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) => item.action === 'threads' && item.body.content === 'General feedback',
      ),
    )
    .toBe(true);

  await dialog.getByRole('button', { name: /^Files/ }).click();
  await expect(dialog.locator('.file-list .dir-row')).toContainText('src');
  await dialog.getByRole('button', { name: /login\.ts/ }).click();
  await expect(dialog).toContainText('new login');
  await dialog.locator('.editor.modified .view-line').filter({ hasText: 'new login' }).click();
  await dialog.getByRole('button', { name: 'Add comment' }).click();
  await expect(dialog.locator('.composer textarea')).toBeFocused();
  await dialog.locator('.composer textarea').press('Escape');
  await expect(dialog.locator('.composer')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Add comment' }).click();
  await dialog.locator('.composer textarea').fill('Inline feedback');
  await dialog.locator('.composer textarea').press('Control+Enter');
  await expect(dialog.locator('.composer')).toHaveCount(0);
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) =>
          item.action === 'threads' &&
          item.body.filePath === '/src/login.ts' &&
          item.body.line === 1 &&
          item.body.side === 'right',
      ),
    )
    .toBe(true);

  await dialog.getByRole('button', { name: 'Set auto-complete' }).click();
  const autoComplete = page.getByRole('dialog', { name: 'Set auto-complete' });
  await autoComplete.getByLabel('Merge strategy').selectOption('squash');
  await autoComplete.getByLabel('Delete source branch').check();
  await autoComplete.getByRole('button', { name: 'Enable' }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) =>
          item.action === 'autocomplete' &&
          item.body.enabled === true &&
          item.body.mergeStrategy === 'squash',
      ),
    )
    .toBe(true);

  await dialog.getByRole('button', { name: 'Complete', exact: true }).click();
  const complete = page.getByRole('dialog', { name: 'Complete pull request' });
  await complete.getByLabel('Complete associated work items').check();
  await complete.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) => item.action === 'complete' && item.body.completeWorkItems === true,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test('draft pull requests show publish and abandon with conflicts and related data', async ({
  page,
}) => {
  const { state } = await setup(page, 700, {
    pullRequests: [
      {
        id: 102,
        title: 'Draft login flow',
        isDraft: true,
        mergeStatus: 'conflicts',
        author: {
          id: 'author-1',
          name: 'Ada Author',
          email: 'ada@example.test',
        },
        createdAt: '2026-09-12T10:00:00Z',
        sourceBranch: 'feature/login',
        targetBranch: 'main',
        status: 'active',
        webUrl: 'https://azure.example/project/_git/repo/pullrequest/102',
        reviewers: [],
        myVote: 0,
        requiresMe: false,
        labels: [],
      },
    ],
  });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const prSection = page.locator('.tree').filter({ hasText: 'Pull Requests' });
  await prSection.locator('.pr-row').click();

  const dialog = page.getByRole('dialog', { name: 'Pull request details' });
  // Draft PRs keep "Open in Azure DevOps" and the close icon, and only get
  // Publish/Abandon instead of the review and completion actions.
  await expect(dialog.getByRole('button', { name: 'Open in Azure DevOps' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Abandon', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Review ▾' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Complete', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Set auto-complete' })).toHaveCount(0);

  // Conflicts are surfaced prominently in the overview.
  await expect(dialog).toContainText('Merge conflicts');
  // Empty tags and the related work item render below the reviewers.
  await expect(dialog).toContainText('No tags.');
  await expect(dialog).toContainText('Fix login');

  // The trailing star decides whether picked reviewers are required.
  await dialog
    .getByRole('button', {
      name: 'Toggle between adding reviewers as required and optional',
    })
    .click();
  await dialog.locator('.chip-query').fill('priya');
  await dialog.getByRole('option', { name: 'priya Reviewer' }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) =>
          item.action === 'reviewers' && item.body.id === 'priya' && item.body.required === true,
      ),
    )
    .toBe(true);

  // Abandon asks for confirmation, then closes the dialog.
  await dialog.getByRole('button', { name: 'Abandon', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Abandon pull request' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Abandon', exact: true }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'abandon')).toBe(true);
  await expect(dialog).toHaveCount(0);

  // Publishing reopens cleanly and PATCHes the draft flag away.
  await prSection.locator('.pr-row').click();
  await page
    .getByRole('dialog', { name: 'Pull request details' })
    .getByRole('button', { name: 'Publish', exact: true })
    .click();
  await expect
    .poll(() =>
      state.prMutations.some((item) => item.method === 'PATCH' && item.body.isDraft === false),
    )
    .toBe(true);
});

test('pull request file changes report load failures with retry', async ({ page }) => {
  const { state } = await setup(page, 700, { prChangesError: true });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const prSection = page.locator('.tree').filter({ hasText: 'Pull Requests' });
  await prSection.locator('.pr-row').click();
  const dialog = page.getByRole('dialog', { name: 'Pull request details' });

  await dialog.getByRole('button', { name: /^Files/ }).click();
  // The failure is reported instead of a misleading "No changed files".
  await expect(dialog).toContainText('Azure DevOps returned HTTP 500.');
  await expect(dialog).not.toContainText('No changed files.');

  // Retry recovers and shows the files (and the first diff, auto-selected).
  await dialog.getByRole('button', { name: 'Retry' }).click();
  await expect(dialog.getByRole('button', { name: /src\/login\.ts/ })).toBeVisible();
  await expect(dialog).toContainText('new login');
});

test('pull request tags and related work items support add and remove', async ({ page }) => {
  const { state } = await setup(page, 700, {});
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  const prSection = page.locator('.tree').filter({ hasText: 'Pull Requests' });
  await prSection.locator('.pr-row').click();
  const dialog = page.getByRole('dialog', { name: 'Pull request details' });

  // The "+" beside Tags opens an inline picker fed by the project's tags.
  await dialog.getByRole('button', { name: 'Add tag' }).click();
  const tagInput = dialog.getByRole('textbox', { name: 'Add tag' });
  await expect(tagInput).toBeVisible();
  await tagInput.fill('rel');
  await dialog.getByRole('option', { name: 'release' }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) =>
          item.method === 'POST' && item.action === 'labels' && item.body.name === 'release',
      ),
    )
    .toBe(true);

  // Every tag chip offers an "x" to remove it.
  await dialog.getByRole('button', { name: 'Remove tag ui' }).click();
  await expect
    .poll(() =>
      state.prMutations.some((item) => item.method === 'DELETE' && item.action === 'labels/ui'),
    )
    .toBe(true);

  // Clicking "+" again closes the picker.
  await dialog.getByRole('button', { name: 'Add tag' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Add tag' })).toHaveCount(0);

  // The "+" beside Related work items opens a search picker.
  await dialog.getByRole('button', { name: 'Relate work item' }).click();
  const workItemInput = dialog.getByRole('textbox', {
    name: 'Search work item by title or ID',
  });
  await expect(workItemInput).toBeVisible();
  await workItemInput.fill('Fix');
  await dialog.getByRole('option', { name: '#64 Fix login' }).click();
  await expect
    .poll(() =>
      state.prMutations.some(
        (item) => item.method === 'POST' && item.action === 'workitems' && item.body.id === 64,
      ),
    )
    .toBe(true);

  // Each work item row offers an "x" to unlink it.
  await dialog.getByRole('button', { name: 'Unlink work item #64' }).click();
  await expect
    .poll(() =>
      state.prMutations.some((item) => item.method === 'DELETE' && item.action === 'workitems/64'),
    )
    .toBe(true);
});

test('pull request section stays hidden when Azure DevOps is not configured', async ({ page }) => {
  const { errors } = await setup(page, 700, {
    settings: { azureDevOpsUrl: '', source: '' },
  });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(page.getByText('Pull Requests', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stash rows show above the history with a pill, actions, and a settings dialog toggle', async ({
  page,
}) => {
  // Stash rows are hidden by default; the fixture settings turn them on.
  const { state, errors } = await setup(page, 700, {
    settings: {
      azureDevOpsUrl: 'https://azure.example/collection',
      prBranchNameTemplate: 'pr/${randomstring}',
      source: 'file',
      showStashes: true,
    },
  });
  const stashRow = page.locator('.stash-row');

  // The stash appears as a pinned row with a stash@{n} pill and its message,
  // author, and date, above the working row and the history.
  await expect(stashRow).toHaveCount(1);
  await expect(stashRow.locator('.badge-stash')).toContainText('stash@{0}');
  await expect(stashRow).toContainText('fixture stash');
  await expect(stashRow).toContainText('Stash Author');
  await expect(stashRow).toContainText('Sep 2026');

  // Clicking opens the stash commit in the details pane.
  await stashRow.click();
  const detail = page.locator('app-commit-detail');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.subject')).toContainText('fixture stash');

  // Right-clicking offers the stash actions; applying posts the stash index.
  await stashRow.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pop Stash' }).click();
  await expect
    .poll(() => state.stashRequests.at(-1))
    .toEqual({
      path: '/api/stash/pop',
      index: 0,
    });

  // The settings dialog hides the rows and persists the choice.
  await page.getByTitle('Settings').click();
  await page.getByLabel('Show stashes').uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.showStashes).toBe(false);
  await expect(stashRow).toHaveCount(0);

  // The settings dialog offers the way back.
  await page.getByTitle('Settings').click();
  await page.getByLabel('Show stashes').check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.showStashes).toBe(true);
  await expect(stashRow).toHaveCount(1);
  expect(errors).toEqual([]);
});
