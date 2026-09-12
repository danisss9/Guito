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
    author_name: i === 7 ? 'Special Author' : 'Test Author',
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
    avatarRequests: 0,
    avatarAvailable: false,
    prRequests: [],
    prMutations: [],
    pullRequests: [{
      id: 101,
      title: 'Review the new login flow',
      isDraft: true,
      author: { id: 'author-1', name: 'Ada Author', email: 'ada@example.test' },
      createdAt: '2026-09-12T10:00:00Z',
      sourceBranch: 'feature/login',
      targetBranch: 'main',
      status: 'active',
      webUrl: 'https://azure.example/project/_git/repo/pullrequest/101',
      reviewers: [{ id: 'me', name: 'Test Reviewer', email: 'test@example.test', vote: 0, isRequired: true }],
      myVote: 0,
      requiresMe: true,
    }],
    failedStatus: false,
    failedSearch: false,
    failedHistory: false,
    failedCommit: false,
    delay: 0,
    searchDelay: 0,
    searchRequests: [],
    refreshDelay: 0,
    historyRequests: 0,
    historyRanges: [],
    fetchRequests: [],
    worktreeRequests: 0,
    bodyMatchIndex: 600,
    stageRequests: [],
    stashRequests: [],
    tagRequests: [],
    commitRequests: [],
    contentRequests: [],
    conflicts: [],
    diffFiles: [],
    identity: { name: 'Configured User', email: 'test@example.test' },
    settings: {
      azureDevOpsUrl: 'https://azure.example/collection',
      prBranchNameTemplate: 'pr/${randomstring}',
      source: 'file',
    },
    remotes: [{ name: 'origin', fetchUrl: 'https://example.test/repo.git', pushUrl: 'https://example.test/repo.git' }],
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
          labels: ['ui'],
        });
      }
      if (action === 'threads' && request.method() === 'GET') return send({ threads: [] });
      if (action === 'changes' && request.method() === 'GET') {
        return send({ files: [{ path: '/src/login.ts', oldPath: '/src/login.ts', changeType: 'modified' }] });
      }
      if (action === 'file-diff' && request.method() === 'GET') {
        return send({ path: '/src/login.ts', oldPath: '/src/login.ts', status: 'modified', additions: 1, deletions: 1, lines: [
          { type: 'hunk', text: '@@ -1,2 +1,2 @@' },
          { type: 'del', oldLine: 1, text: 'old login' },
          { type: 'add', newLine: 1, text: 'new login' },
          { type: 'context', oldLine: 2, newLine: 2, text: 'unchanged' },
        ] });
      }
      state.prMutations.push({ method: request.method(), action, body });
      if (!action && request.method() === 'PATCH') {
        state.pullRequests = state.pullRequests.map((pr) => pr.id === id ? { ...pr, ...body } : pr);
      }
      return send({ success: true });
    }
    switch (parsed.pathname) {
      case '/api/repository-state':
        return send({ history: state.revision, working: state.workingRevision });
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
          state.remotes.push({ name: body.name, fetchUrl: body.fetchUrl, pushUrl: body.pushUrl || body.fetchUrl });
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
        return send({ workItems: [{ id: 64, title: 'Fix login', state: 'Active' }] });
      case '/api/azure-devops/pullrequest':
        state.prRequests.push(body);
        return send({ id: 1, url: 'https://azure.example/pr/1', branch: 'main' });
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
          { name: 'main', commit: commits[0].hash, current: true, remote: false },
          { name: 'feature', commit: commits[10].hash, current: false, remote: false },
          { name: 'origin/main', commit: commits[0].hash, current: false, remote: true },
        ]);
      case '/api/stash/list':
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
        return send([
          {
            path: '/fixture',
            head: commits[0].hash,
            branch: 'main',
            bare: false,
            detached: false,
            current: true,
          },
        ]);
      case '/api/fetch':
        state.fetchRequests.push({ prune: parsed.searchParams.get('prune') });
        return send({ success: true });
      case '/api/tags':
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
        state.historyRanges.push({ skip, limit: Number(parsed.searchParams.get('limit')) });
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
              indices: query === 'body-only'
                ? { [commits[state.bodyMatchIndex].hash]: state.bodyMatchIndex }
                : {},
            });
      }
      case '/api/working-changes':
        return state.failedStatus ? send({ error: 'Status unavailable' }, 400) : send(snapshot());
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
        return send({ ...commits.find((c) => c.hash === body.hash), body: 'Details' });
      case '/api/commit/diff':
        return send({ hash: body.hash, files: state.diffFiles });
      default:
        return send({ error: `Unexpected API: ${parsed.pathname}` }, 400);
    }
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('.list-viewport .row').first()).toBeVisible();
  await expect(page.locator('.table-loading')).toHaveCount(0);
  return { state, commits, errors };
}

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
  await search.fill('Special Author');
  await expect(page.locator('.search .count-badge')).toHaveText('1');
  await search.press('Enter');
  await expect(page.locator('.search .count-badge')).toHaveText('1/1');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 7');
  await search.fill('Commit');
  await expect(page.locator('.search .count-badge')).toHaveText('99+');
  expect(errors).toEqual([]);
});

test('search is case insensitive by default and can require matching case', async ({ page }) => {
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

  await search.fill('Special Author');
  await expect(count).toHaveText('1');
  expect(errors).toEqual([]);
});

test('search mode settings filter unloaded body matches and restore navigation with the graph', async ({ page }) => {
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

test('search loads through a distant match in one request and reuses loaded pages', async ({ page }) => {
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
  const unstaged = page.getByRole('listbox', { name: 'unstaged files', exact: true });
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
  await page.getByRole('button', { name: 'View staged diff for partial.txt', exact: true }).click();
  await expect.poll(() => state.contentRequests.length).toBe(2);
  expect(state.contentRequests.map((r) => r.ref)).toEqual(['HEAD', 'INDEX']);
  await page.getByRole('button', { name: 'Close diff', exact: true }).click();
  await page
    .getByRole('button', { name: 'View unstaged diff for partial.txt', exact: true })
    .click();
  await expect.poll(() => state.contentRequests.length).toBe(4);
  expect(state.contentRequests.slice(2).map((r) => r.ref)).toEqual(['INDEX', 'WORKING']);
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

test('file lists render as a tree or flat list from the settings dialog', async ({ page }) => {
  const { state } = await setup(page, 700, {
    staged: ['src/app/app.ts', 'src/app/components/toolbar/toolbar.ts', 'README.md'],
    unstaged: ['docs/guide/intro.md', 'docs/guide/advanced.md', 'package.json'],
  });
  state.diffFiles = [file('src/main.ts'), file('src/app/app.ts'), file('README.md')];

  await page.locator('.working-row').click();
  const staged = page.getByRole('listbox', { name: 'staged files', exact: true });
  const unstaged = page.getByRole('listbox', { name: 'unstaged files', exact: true });

  // Flat by default: rows show full paths and no folder rows exist.
  await expect(
    unstaged.getByRole('option', { name: 'docs/guide/intro.md', exact: true }),
  ).toBeVisible();
  await expect(staged.getByRole('option', { name: 'src/app/app.ts', exact: true })).toBeVisible();
  await expect(staged.locator('.dir-row')).toHaveCount(0);

  // The full settings dialog switches both groups to the tree view and persists it.
  await page.getByTitle('Settings').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('Directory tree').check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.fileListView).toBe('tree');

  const stagedTree = page.getByRole('tree', { name: 'staged files', exact: true });
  const unstagedTree = page.getByRole('tree', { name: 'unstaged files', exact: true });
  await expect(stagedTree.locator('.dir-row')).toHaveCount(4);
  await expect(stagedTree.locator('.dir-row').first()).toContainText('src');
  await expect(
    stagedTree.getByRole('treeitem', { name: 'src/app/app.ts', exact: true }),
  ).toBeVisible();
  await expect(
    stagedTree.getByRole('treeitem', { name: 'src/app/components/toolbar/toolbar.ts', exact: true }),
  ).toBeVisible();

  // Collapsing a folder hides only its own files.
  await unstagedTree.getByRole('treeitem', { name: 'Directory docs', exact: true }).click();
  await expect(
    unstagedTree.getByRole('treeitem', { name: 'docs/guide/intro.md', exact: true }),
  ).toBeHidden();
  await expect(
    unstagedTree.getByRole('treeitem', { name: 'package.json', exact: true }),
  ).toBeVisible();
  await unstagedTree.getByRole('treeitem', { name: 'Directory docs', exact: true }).click();
  await expect(
    unstagedTree.getByRole('treeitem', { name: 'docs/guide/intro.md', exact: true }),
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
  await page.getByLabel('Flat list').check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => state.settings.fileListView).toBe('flat');
  await expect(detailFiles.locator('.dir-row')).toHaveCount(0);
  await expect(detailFiles.locator('.file-row')).toHaveCount(3);
});

test('full settings dialog saves repository and Azure DevOps preferences together', async ({ page }) => {
  const { state, errors } = await setup(page);

  await page.getByTitle('Settings').click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toContainText('Repository preferences and Git configuration.');
  await page.getByLabel('Automatically refresh').uncheck();
  await page.getByLabel('Show Git graph').uncheck();
  await page.getByLabel('Search mode').selectOption('filter');
  await page.getByLabel('Case-sensitive search').check();
  await page.getByLabel('Server URL').fill('https://devops.example/DefaultCollection');
  await page
    .getByLabel('Automatic PR branch name')
    .fill('users/${username}/${randomstring}');
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.settings.autoReload).toBe(false);
  expect(state.settings).toMatchObject({
    azureDevOpsUrl: 'https://devops.example/DefaultCollection',
    prBranchNameTemplate: 'users/${username}/${randomstring}',
    autoReload: false,
    showGraph: false,
    showStashes: true,
    fileListView: 'flat',
    searchMode: 'filter',
    searchCaseSensitive: true,
  });
  expect(errors).toEqual([]);
});

test('settings manage identity, remotes, tags, remote branches, and issue links', async ({ page }) => {
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

  expect(state.identity).toEqual({ name: 'New User', email: 'new@example.test' });
  expect(state.remotes.some((remote) => remote.name === 'upstream')).toBe(true);
  expect(state.settings).toMatchObject({ showTags: false, showRemoteBranches: false });
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
  expect(state.commitRequests[1]).toEqual({ message: 'Subject', description: 'Body' });
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
  const unstaged = page.getByRole('listbox', { name: 'unstaged files', exact: true });
  const staged = page.getByRole('listbox', { name: 'staged files', exact: true });
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


test('dismissing a status error preserves guards and a failed refresh shows it again', async ({ page }) => {
  const { state } = await setup(page);
  await page.locator('.working-row').click();
  await page.getByLabel('Commit message', { exact: true }).fill('Keep this draft');
  state.failedStatus = true;
  await page.getByTitle('Refresh').click();
  await expect(page.getByRole('alert')).toContainText('Status unavailable');
  const close = page.getByRole('button', { name: 'Dismiss error' });
  await close.focus();
  await page.keyboard.press('Enter');
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
  await expect(panel.locator('.row').filter({ hasText: 'stash@{0}' })).toContainText(
    'fixture stash',
  );
  await expect(panel.locator('.tree').filter({ hasText: 'Worktrees' })).toContainText('fixture');
  expect(state.worktreeRequests).toBeGreaterThan(0);

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
  await expect.poll(() => state.tagRequests.at(-1)).toEqual({
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
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(panel).toHaveCount(0);

  // The fetch button offers plain and pruning fetches.
  await page.locator('.toolbar .icon-btn[title="Fetch"]').click();
  await page.getByRole('menuitem', { name: 'Fetch (prune)' }).click();
  await expect
    .poll(() => state.fetchRequests.some((request) => request.prune === '1'))
    .toBe(true);
  await expect(page.locator('.table-loading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('pull request panel reviews, edits, comments, diffs, and completes a PR', async ({ page }) => {
  const { state, errors } = await setup(page);
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
  await expect(prSection).toContainText('Draft');
  await expect(prSection).toContainText('Required');
  await prSection.locator('.pr-row').click();

  const dialog = page.getByRole('dialog', { name: 'Pull request details' });
  await expect(dialog).toContainText('Please review carefully.');
  await dialog.getByRole('button', { name: 'Review ▾', exact: true }).click();
  await dialog.getByRole('menuitem', { name: 'Approve', exact: true }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'vote' && item.body.vote === 'approve')).toBe(true);

  await dialog.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Title').fill('Updated login review');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => state.prMutations.some((item) => item.method === 'PATCH' && item.body.title === 'Updated login review')).toBe(true);

  await dialog.getByRole('button', { name: /^Comments/ }).click();
  await dialog.getByPlaceholder('Leave a comment (markdown supported)').fill('General feedback');
  await dialog.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'threads' && item.body.content === 'General feedback')).toBe(true);

  await dialog.getByRole('button', { name: /^Files/ }).click();
  await dialog.getByRole('button', { name: /src\/login\.ts/ }).click();
  await expect(dialog).toContainText('new login');
  await dialog.locator('.diff-line.add').hover();
  await dialog.locator('.diff-line.add').getByRole('button', { name: 'Comment on this line' }).click();
  await dialog.locator('.composer textarea').fill('Inline feedback');
  await dialog.locator('.composer').getByRole('button', { name: 'Comment' }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'threads' && item.body.filePath === '/src/login.ts' && item.body.line === 1 && item.body.side === 'right')).toBe(true);

  await dialog.getByRole('button', { name: 'Set auto-complete' }).click();
  const autoComplete = page.getByRole('dialog', { name: 'Set auto-complete' });
  await autoComplete.getByLabel('Merge strategy').selectOption('squash');
  await autoComplete.getByLabel('Delete source branch').check();
  await autoComplete.getByRole('button', { name: 'Enable' }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'autocomplete' && item.body.enabled === true && item.body.mergeStrategy === 'squash')).toBe(true);

  await dialog.getByRole('button', { name: 'Complete', exact: true }).click();
  const complete = page.getByRole('dialog', { name: 'Complete pull request' });
  await complete.getByLabel('Complete associated work items').check();
  await complete.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect.poll(() => state.prMutations.some((item) => item.action === 'complete' && item.body.completeWorkItems === true)).toBe(true);
  expect(errors).toEqual([]);
});

test('pull request section stays hidden when Azure DevOps is not configured', async ({ page }) => {
  const { errors } = await setup(page, 700, { settings: { azureDevOpsUrl: '', source: '' } });
  await page.getByRole('button', { name: 'Toggle repository panel' }).click();
  await expect(page.getByText('Pull Requests', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stash rows show above the history with a pill, actions, and a settings dialog toggle', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
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
  await expect.poll(() => state.stashRequests.at(-1)).toEqual({
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
