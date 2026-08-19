#! /usr/bin/env node
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import open from 'open';
import simpleGit from 'simple-git';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
void (async function main() {
    // Calculate dirname
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Get port number
    const portArgIndex = process.argv.findIndex((a) => a.toLowerCase() === '--port');
    const port = portArgIndex !== -1 ? +process.argv[portArgIndex + 1] : 8080;
    // Get if should not open browser
    const shouldOpenBrowser = process.argv.findIndex((a) => a.toLowerCase() === '--no-open') === -1;
    // Initialize server
    const app = fastify({
        logger: false,
    });
    // Register cors
    await app.register(fastifyCors);
    // Register static file provider (supports both `ui/` and `ui/browser/` layouts)
    const uiRoot = join(__dirname, 'ui');
    const staticRoot = existsSync(join(uiRoot, 'browser', 'index.html'))
        ? join(uiRoot, 'browser')
        : uiRoot;
    if (existsSync(staticRoot)) {
        await app.register(fastifyStatic, { root: staticRoot });
        // Serve UI
        app.get('/', (_req, resp) => resp.sendFile('index.html'));
    }
    else {
        app.get('/', (_req, resp) => resp.send('Guito API is running. Build the UI with `npm run build:ui`.'));
    }
    // Initialize git lib
    const git = simpleGit(process.cwd());
    // ==================== Diff parsing ====================
    function parseUnifiedDiff(rawDiff) {
        const files = [];
        const lines = rawDiff.split('\n');
        let current = null;
        let inHunk = false;
        let oldLine = 0;
        let newLine = 0;
        const startFile = (line) => {
            current = {
                path: '',
                oldPath: '',
                status: 'modified',
                lines: [],
                additions: 0,
                deletions: 0,
            };
            const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
            if (match) {
                current.oldPath = match[1];
                current.path = match[2];
            }
            inHunk = false;
        };
        for (const line of lines) {
            if (line.startsWith('diff --git ')) {
                if (current)
                    files.push(current);
                startFile(line);
                continue;
            }
            if (!current)
                continue;
            if (line.startsWith('@@')) {
                inHunk = true;
                const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                if (match) {
                    oldLine = parseInt(match[1], 10);
                    newLine = parseInt(match[2], 10);
                }
                current.lines.push({ type: 'hunk', text: line });
                continue;
            }
            if (!inHunk) {
                // File meta headers (mode, index, rename, binary...)
                if (line.startsWith('new file mode'))
                    current.status = 'added';
                else if (line.startsWith('deleted file mode'))
                    current.status = 'deleted';
                else if (line.startsWith('rename from '))
                    current.status = 'renamed';
                else if (line.startsWith('rename to '))
                    current.path = line.slice('rename to '.length);
                else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch'))
                    current.status = 'binary';
                continue;
            }
            if (line.startsWith('\\')) {
                // "\ No newline at end of file"
                continue;
            }
            if (line.startsWith('+')) {
                current.lines.push({ type: 'add', newLine: newLine++, text: line.slice(1) });
                current.additions++;
            }
            else if (line.startsWith('-')) {
                current.lines.push({ type: 'del', oldLine: oldLine++, text: line.slice(1) });
                current.deletions++;
            }
            else {
                current.lines.push({
                    type: 'context',
                    oldLine: oldLine++,
                    newLine: newLine++,
                    text: line.slice(1),
                });
            }
        }
        if (current)
            files.push(current);
        return files;
    }
    const repoRoot = async () => (await git.revparse(['--show-toplevel'])).trim();
    // ==================== Repository ====================
    app.get('/api/repo', async (_req, resp) => {
        try {
            const root = (await git.revparse(['--show-toplevel'])).trim();
            resp.type('application/json').send({ root, name: basename(root) });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Commits ====================
    app.get('/api/commits', async (_req, resp) => {
        try {
            const log = await git.log({
                format: {
                    hash: '%H',
                    date: '%aI',
                    message: '%s',
                    refs: '%D',
                    body: '%b',
                    author_name: '%aN',
                    author_email: '%aE',
                    parents: '%P',
                },
            });
            const commits = log.all.map((commit) => ({
                ...commit,
                parents: String(commit.parents ?? '')
                    .split(' ')
                    .filter(Boolean),
            }));
            resp.type('application/json').send(commits);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/commit', async (req, resp) => {
        try {
            const { message, description } = req.body;
            await git.commit([message, ...(description ? [description] : [])], { '--allow-empty': null });
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/amend', async (req, resp) => {
        try {
            const { message, description } = req.body;
            await git.commit([message, ...(description ? [description] : [])], {
                '--amend': null,
                '--no-edit': null,
            });
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/revert', async (req, resp) => {
        try {
            const { commit } = req.body;
            await git.revert(commit);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/cherry-pick', async (req, resp) => {
        try {
            await git.raw(['cherry-pick', req.body.commit]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/commit/drop', async (req, resp) => {
        try {
            await git.raw(['reset', '--hard', `${req.body.commit}^`]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/reset-commit', async (req, resp) => {
        try {
            await git.raw(['reset', '--hard', req.body.commit]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Staging ====================
    app.get('/api/status', async (_req, resp) => {
        try {
            const status = await git.status();
            resp.type('application/json').send(status);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stage', async (req, resp) => {
        try {
            const { files } = req.body;
            if (Array.isArray(files) && files.length > 0) {
                await git.add(files);
            }
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/unstage', async (req, resp) => {
        try {
            const { files } = req.body;
            if (Array.isArray(files) && files.length > 0) {
                await git.reset(['HEAD', ...files]);
            }
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stage-lines', async (req, resp) => {
        try {
            const { file, patch } = req.body;
            // Stage specific lines using git add -p equivalent (patch mode)
            await git.raw('add --patch', { input: patch });
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Branches ====================
    app.get('/api/branches/all', async (_req, resp) => {
        try {
            const raw = await git.raw([
                'for-each-ref',
                '--format=%(refname)%09%(objectname)%09%(HEAD)',
                'refs/heads',
                'refs/remotes',
            ]);
            const branches = raw
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                const [refname, commit, headMarker] = line.split('\t');
                const remote = refname.startsWith('refs/remotes/');
                const name = refname.replace(/^refs\/(heads|remotes)\//, '');
                return { name, commit, current: headMarker === '*', remote };
            });
            resp.type('application/json').send(branches);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.get('/api/branches', async (_req, resp) => {
        try {
            const branchSummary = await git.branchLocal();
            resp.type('application/json').send(branchSummary);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/branch/create', async (req, resp) => {
        try {
            const { name, startPoint } = req.body;
            await git.branch([...(startPoint ? [name, startPoint] : [name])]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/branch/delete', async (req, resp) => {
        try {
            const { name, force } = req.body;
            await git.deleteLocalBranch(name, force);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/branch/delete-remote', async (req, resp) => {
        try {
            const { remote, branch } = req.body;
            await git.push([remote, '--delete', branch]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/branch/rename', async (req, resp) => {
        try {
            const { oldName, newName } = req.body;
            await git.branch(['-m', oldName, newName]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/checkout', async (req, resp) => {
        try {
            const { ref } = req.body;
            await git.checkout(ref);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Merge & Rebase ====================
    app.post('/api/merge', async (req, resp) => {
        try {
            const { branch } = req.body;
            await git.merge([branch]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.get('/api/archive', async (req, resp) => {
        try {
            const ref = String(req.query?.ref ?? 'HEAD');
            if (!/^[0-9a-fA-F]{7,40}$/.test(ref) && !/^[A-Za-z0-9._/-]+$/.test(ref)) {
                return resp.status(400).type('application/json').send({ error: 'invalid ref' });
            }
            const result = await execFileAsync('git', ['archive', '--format=zip', ref], {
                cwd: process.cwd(),
                encoding: 'buffer',
                maxBuffer: 100 * 1024 * 1024,
            });
            return resp
                .header('Content-Disposition', `attachment; filename="guito-${ref.slice(0, 8)}.zip"`)
                .type('application/zip')
                .send(result.stdout);
        }
        catch (err) {
            return resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/rebase', async (req, resp) => {
        try {
            const { branch } = req.body;
            await git.rebase([branch]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/squash', async (req, resp) => {
        try {
            const { commits } = req.body;
            // Squash: rebase -i with squash operation
            await git.rebase(['-i', 'HEAD~' + commits]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Stash ====================
    app.get('/api/stash/list', async (_req, resp) => {
        try {
            const stashList = await git.stashList();
            resp.type('application/json').send(stashList);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stash/save', async (req, resp) => {
        try {
            const { message } = req.body;
            await git.stash(['save', message || '']);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stash/apply', async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(['apply', `stash@{${index}}`]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stash/pop', async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(['pop', `stash@{${index}}`]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stash/drop', async (req, resp) => {
        try {
            const { index } = req.body;
            await git.stash(['drop', `stash@{${index}}`]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/stash/show', async (req, resp) => {
        try {
            const { index } = req.body;
            const show = await git.stash(['show', '-p', `stash@{${index}}`]);
            resp.type('application/json').send({ preview: show });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Tags ====================
    app.get('/api/tags', async (_req, resp) => {
        try {
            const tags = await git.tags();
            resp.type('application/json').send(tags);
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/tag/create', async (req, resp) => {
        try {
            const { name, message, commit } = req.body;
            if (message) {
                await git.tag(['-a', name, '-m', message, ...(commit ? [commit] : [])]);
            }
            else {
                await git.tag([name, ...(commit ? [commit] : [])]);
            }
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/tag/delete', async (req, resp) => {
        try {
            const { name } = req.body;
            await git.tag(['-d', name]);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Remote Operations ====================
    app.get('/api/fetch', async (_req, resp) => {
        try {
            await git.fetch();
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/pull', async (req, resp) => {
        try {
            const { remote, branch, rebase } = req.body;
            await git.pull(remote || 'origin', branch || undefined, rebase ? { '--rebase': null } : {});
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/push', async (req, resp) => {
        try {
            const { remote, branch, force } = req.body;
            await git.push(remote || 'origin', branch || undefined, force ? { '-f': null } : {});
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/sync', async (_req, resp) => {
        try {
            await git.pull('origin', undefined, {});
            await git.push('origin', undefined, {});
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/prune', async (req, resp) => {
        try {
            const { remote } = req.body;
            await git.remote(['prune', remote || 'origin']);
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Diff Viewer ====================
    app.post('/api/commit/diff', async (req, resp) => {
        try {
            const { hash } = req.body;
            if (!hash) {
                return resp.status(400).type('application/json').send({ error: 'hash required' });
            }
            // Get the raw unified diff (diff against the first parent for merges)
            const rawDiff = await git.raw([
                'show',
                '--no-color',
                '--pretty=format:',
                '--find-renames',
                '--first-parent',
                '-m',
                hash,
            ]);
            resp.type('application/json').send({ hash, files: parseUnifiedDiff(rawDiff) });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Working Changes ====================
    app.get('/api/working-changes', async (_req, resp) => {
        try {
            const root = await repoRoot();
            // Combined diff of the working tree + index against HEAD.
            const rawDiff = await git.raw(['diff', 'HEAD', '--no-color', '--find-renames']);
            const files = parseUnifiedDiff(rawDiff);
            // Untracked files are not part of `git diff` — add them as new files.
            const status = await git.status();
            for (const file of status.not_added ?? []) {
                let isBinary = false;
                let content = '';
                try {
                    const buffer = await readFile(join(root, file));
                    if (buffer.includes(0)) {
                        isBinary = true;
                    }
                    else {
                        content = buffer.toString('utf8');
                    }
                }
                catch {
                    content = '';
                }
                if (isBinary) {
                    files.push({
                        path: file,
                        oldPath: '',
                        status: 'binary',
                        lines: [],
                        additions: 0,
                        deletions: 0,
                    });
                }
                else {
                    const lines = content.length > 0 ? content.split('\n') : [];
                    files.push({
                        path: file,
                        oldPath: '',
                        status: 'added',
                        lines: lines.map((text, index) => ({ type: 'add', newLine: index + 1, text })),
                        additions: lines.length,
                        deletions: 0,
                    });
                }
            }
            const stagedRaw = await git.raw(['diff', '--name-only', '--cached']);
            const unstagedRaw = await git.raw(['diff', '--name-only']);
            resp.type('application/json').send({
                files,
                staged: stagedRaw.split('\n').filter(Boolean),
                unstaged: unstagedRaw.split('\n').filter(Boolean),
                untracked: status.not_added ?? [],
            });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== File Content ====================
    app.post('/api/file-content', async (req, resp) => {
        try {
            const { path, ref } = req.body;
            if (!path || !ref) {
                return resp.status(400).type('application/json').send({ error: 'path and ref required' });
            }
            if (ref === 'WORKING') {
                const root = await repoRoot();
                const abs = resolve(root, path);
                const rel = relative(root, abs);
                if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
                    return resp.status(400).type('application/json').send({ error: 'invalid path' });
                }
                try {
                    const buffer = await readFile(abs);
                    if (buffer.includes(0)) {
                        return resp.type('application/json').send({ binary: true, content: '' });
                    }
                    return resp.type('application/json').send({ content: buffer.toString('utf8') });
                }
                catch {
                    // File no longer exists on disk (deleted).
                    return resp.type('application/json').send({ content: '' });
                }
            }
            if (ref === 'EMPTY') {
                return resp.type('application/json').send({ content: '' });
            }
            try {
                const content = await git.raw(['show', `${ref}:${path}`]);
                if (content.includes('\u0000')) {
                    return resp.type('application/json').send({ binary: true, content: '' });
                }
                resp.type('application/json').send({ content });
            }
            catch {
                // Path did not exist at that revision (added file).
                resp.type('application/json').send({ content: '' });
            }
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Discard ====================
    app.post('/api/discard', async (req, resp) => {
        try {
            const { files } = req.body;
            if (!Array.isArray(files) || files.length === 0) {
                return resp.status(400).type('application/json').send({ error: 'files required' });
            }
            const root = await repoRoot();
            const status = await git.status();
            const untracked = new Set(status.not_added ?? []);
            const tracked = files.filter((file) => !untracked.has(file));
            const removed = files.filter((file) => untracked.has(file));
            if (tracked.length > 0) {
                await git.raw(['checkout', 'HEAD', '--', ...tracked]);
            }
            for (const file of removed) {
                await rm(join(root, file), { force: true, recursive: true });
            }
            resp.type('application/json').send({ success: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // ==================== Working Tree Actions ====================
    app.post('/api/reset', async (_req, resp) => {
        try {
            await git.raw(['reset', '--hard', 'HEAD']);
            resp.type('application/json').send({ ok: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    app.post('/api/clean', async (_req, resp) => {
        try {
            await git.raw(['clean', '-fd']);
            resp.type('application/json').send({ ok: true });
        }
        catch (err) {
            resp.status(400).type('application/json').send({ error: err.message });
        }
    });
    // Run the server
    app.listen({ port }, (err, address) => {
        if (err)
            throw err;
        console.log(`Visit "${address}" to see git explorer.`);
        if (shouldOpenBrowser)
            open(address);
    });
})();
