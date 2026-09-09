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

async function setup(page, count = 700) {
  const commits = history(count);
  const state = {
    staged: ['partial.txt'],
    unstaged: ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'partial.txt'],
    revision: 'initial',
    workingRevision: 'initial',
    avatarRequests: 0,
    avatarAvailable: false,
    prRequests: [],
    failedStatus: false,
    failedSearch: false,
    failedHistory: false,
    failedCommit: false,
    delay: 0,
    searchDelay: 0,
    refreshDelay: 0,
    historyRequests: 0,
    stageRequests: [],
    commitRequests: [],
    contentRequests: [],
    conflicts: [],
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
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    const send = (json, status = 200) => route.fulfill({ status, json });
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
        return send({ azureDevOpsUrl: 'https://azure.example/collection', source: 'file' });
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
      case '/api/repo':
        return send({
          name: 'Fixture',
          root: '/fixture',
          identity: { name: 'Configured User', email: 'test@example.test' },
        });
      case '/api/branches/all':
        return send([
          { name: 'main', commit: commits[0].hash, current: true, remote: false },
          { name: 'origin/main', commit: commits[0].hash, current: false, remote: true },
        ]);
      case '/api/commits': {
        state.historyRequests++;
        const skip = Number(parsed.searchParams.get('skip') || 0);
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
        const fail = state.failedSearch;
        await delay(state.searchDelay);
        return fail
          ? send({ error: 'Search unavailable' }, 400)
          : send({ hashes: query === 'body-only' ? [commits[600].hash] : [] });
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
        return send({ hash: body.hash, files: [] });
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
  await expect(page.locator('.search-nav .count')).toHaveText('1 matches');
  await search.press('Enter');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 600');
  expect(await page.locator('.list-viewport .row').count()).toBeGreaterThan(1);
  await search.fill('no-match');
  await expect(page.locator('.search-nav .count')).toHaveText('No matches');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 600');
  await search.fill('Special Author');
  await expect(page.locator('.search-nav .count')).toHaveText('1 matches');
  await search.press('Enter');
  await expect(page.locator('.list-viewport .row.selected')).toContainText('Commit 7');
  expect(errors).toEqual([]);
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
  await expect(page.locator('.search-nav .count')).toHaveText('11 matches');
  await search.press('Enter');
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
  await expect(page.locator('.search-nav .count')).toHaveText('No matches');
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
  await expect(page.locator('.search-nav .count')).toHaveText('1 matches');
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
