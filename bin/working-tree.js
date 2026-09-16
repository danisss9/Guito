import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
/** NUL-delimited metadata is authoritative: patch headers quote unusual filenames. */
function names(raw) {
    const fields = raw.split('\0');
    const result = [];
    for (let i = 0; fields[i];) {
        const code = fields[i++];
        const first = fields[i++];
        const renamed = /^[RC]/.test(code);
        result.push({ code, path: renamed ? fields[i++] : first, oldPath: first });
    }
    return result;
}
export function workingTree(git, parse) {
    const hasHead = async () => {
        try {
            await git.raw(['rev-parse', '--verify', 'HEAD']);
            return true;
        }
        catch {
            return false;
        }
    };
    async function changes(args) {
        const common = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--find-renames', '--diff-filter=ACDMRT', ...args];
        const metadata = names(await git.raw([...common, '--name-status', '-z']));
        const patches = parse(await git.raw([...common, '--patch']));
        return metadata.map((entry, index) => ({
            lines: [], additions: 0, deletions: 0, ...patches[index],
            path: entry.path,
            oldPath: entry.code[0] === 'A' ? '' : entry.oldPath,
            status: patches[index]?.status === 'binary' ? 'binary' :
                ({ A: 'added', D: 'deleted', R: 'renamed' }[entry.code[0]] ?? 'modified'),
        }));
    }
    async function status() {
        const fields = (await git.raw(['status', '--porcelain=v1', '-z', '--untracked-files=all'])).split('\0');
        const entries = [];
        for (let i = 0; fields[i];) {
            const field = fields[i++];
            const index = field[0], working = field[1], path = field.slice(3);
            const oldPath = /[RC]/.test(index + working) ? fields[i++] : '';
            entries.push({ path, oldPath, index, working });
        }
        return entries;
    }
    async function untrackedDiff(root, path) {
        const buffer = await readFile(join(root, path));
        const binary = buffer.includes(0);
        const text = buffer.toString('utf8');
        const lines = text ? text.replace(/\n$/, '').split('\n') : [];
        return {
            path, oldPath: '', status: binary ? 'binary' : 'added',
            lines: binary ? [] : lines.map((text, i) => ({ type: 'add', newLine: i + 1, text })),
            additions: binary ? 0 : lines.length, deletions: 0,
        };
    }
    async function snapshot() {
        const root = (await git.revparse(['--show-toplevel'])).trim();
        const entries = await status();
        const stagedFiles = await changes(['--cached']);
        const unstagedFiles = await changes([]);
        const untracked = entries.filter(e => e.index === '?').map(e => e.path);
        const conflicted = entries.filter(e => e.index === 'U' || e.working === 'U' || ['AA', 'DD'].includes(e.index + e.working)).map(e => e.path);
        for (const path of untracked)
            unstagedFiles.push(await untrackedDiff(root, path));
        for (const path of conflicted) {
            if (!unstagedFiles.some(file => file.path === path)) {
                unstagedFiles.push({ path, oldPath: path, status: 'modified', lines: [], additions: 0, deletions: 0 });
            }
        }
        const combined = await hasHead() ? await changes(['HEAD']) : [...stagedFiles];
        const files = new Map(combined.map(file => [file.path, file]));
        // The combined diff can be empty even when index and working changes cancel.
        for (const file of [...stagedFiles, ...unstagedFiles])
            if (!files.has(file.path))
                files.set(file.path, file);
        return {
            files: [...files.values()], stagedFiles, unstagedFiles, conflicted,
            staged: stagedFiles.map(file => file.path),
            unstaged: unstagedFiles.filter(file => !untracked.includes(file.path)).map(file => file.path),
            untracked,
        };
    }
    async function validate(files) {
        if (!Array.isArray(files) || !files.length || files.some(file => typeof file !== 'string' || !file)) {
            throw new Error('Select at least one file.');
        }
        const root = (await git.revparse(['--show-toplevel'])).trim();
        for (const file of files) {
            const rel = relative(root, resolve(root, file));
            if (file.includes('\0') || isAbsolute(file) || !rel || rel === '..' || rel.startsWith(`..${sep}`) ||
                isAbsolute(rel) || file.split(/[\\/]/).some((part) => part === '..' || part.toLowerCase() === '.git')) {
                throw new Error('Select repository-relative file paths.');
            }
        }
        return [...new Set(files)];
    }
    async function stage(files) {
        const selected = await validate(files);
        const entries = await status();
        const paths = new Set();
        for (const path of selected) {
            const entry = entries.find(e => e.path === path);
            if (!entry)
                throw new Error(`File is no longer changed: ${path}`);
            paths.add(path);
            if (entry.oldPath && /[RC]/.test(entry.working))
                paths.add(entry.oldPath);
        }
        await git.raw(['--literal-pathspecs', 'add', '-A', '--', ...paths]);
    }
    async function unstage(files) {
        const selected = await validate(files);
        const entries = names(await git.raw(['diff', '--cached', '--name-status', '--find-renames', '-z']));
        const paths = new Set();
        for (const path of selected) {
            const entry = entries.find(e => e.path === path);
            if (!entry)
                throw new Error(`File is no longer staged: ${path}`);
            paths.add(path);
            paths.add(entry.oldPath);
        }
        await git.raw(await hasHead()
            ? ['--literal-pathspecs', 'reset', '-q', 'HEAD', '--', ...paths]
            : ['--literal-pathspecs', 'rm', '--cached', '-f', '--ignore-unmatch', '--', ...paths]);
    }
    async function commit(message, description) {
        if (typeof message !== 'string' || !message.trim() || /[\r\n\0]/.test(message))
            throw new Error('Enter a commit subject on one line.');
        if (description !== undefined && (typeof description !== 'string' || description.includes('\0')))
            throw new Error('Invalid commit description.');
        if ((await git.raw(['ls-files', '--unmerged', '-z'])).length)
            throw new Error('Resolve conflicts before committing.');
        if (!(await git.raw(['diff', '--cached', '--name-only', '-z'])).length)
            throw new Error('Stage changes before committing.');
        await git.commit([message.trim(), ...(description ? [description] : [])]);
    }
    async function conflictPath(path) {
        const [selected] = await validate([path]);
        const unmerged = await git.raw([
            '--literal-pathspecs', 'ls-files', '--unmerged', '-z', '--', selected,
        ]);
        if (!unmerged)
            throw new Error(`File is no longer conflicted: ${selected}`);
        return selected;
    }
    async function conflictStage(path, stage) {
        try {
            const content = await git.raw(['show', `:${stage}:${path}`]);
            return { content: content.includes('\0') ? '' : content, binary: content.includes('\0') };
        }
        catch {
            // A missing stage represents a deletion on that side of the merge.
            return { content: null, binary: false };
        }
    }
    /** Returns the three index stages and the current marker-filled worktree result. */
    async function conflict(path) {
        const selected = await conflictPath(path);
        const root = (await git.revparse(['--show-toplevel'])).trim();
        let result = null;
        let resultBinary = false;
        try {
            const buffer = await readFile(join(root, selected));
            resultBinary = buffer.includes(0);
            if (!resultBinary)
                result = buffer.toString('utf8');
        }
        catch {
            // Delete/modify conflicts can currently have no worktree file.
        }
        const [base, ours, theirs] = await Promise.all([
            conflictStage(selected, 1), conflictStage(selected, 2), conflictStage(selected, 3),
        ]);
        return { path: selected, base, ours, theirs, result: { content: result, binary: resultBinary } };
    }
    /** Writes or selects a result and stages it, which marks the path resolved. */
    async function resolveConflict(path, resolution, content) {
        const selected = await conflictPath(path);
        if (!['content', 'ours', 'theirs', 'delete'].includes(String(resolution))) {
            throw new Error('Choose a valid conflict resolution.');
        }
        const root = (await git.revparse(['--show-toplevel'])).trim();
        const absolute = join(root, selected);
        if (resolution === 'content') {
            if (typeof content !== 'string' || content.includes('\0')) {
                throw new Error('Conflict result must be text.');
            }
            await mkdir(dirname(absolute), { recursive: true });
            await writeFile(absolute, content);
        }
        else if (resolution === 'delete') {
            await rm(absolute, { force: true, recursive: true });
        }
        else {
            const stage = resolution === 'ours' ? 2 : 3;
            const selectedStage = await conflictStage(selected, stage);
            if (selectedStage.content === null) {
                await rm(absolute, { force: true, recursive: true });
            }
            else {
                await git.raw(['--literal-pathspecs', 'checkout', `--${resolution}`, '--', selected]);
            }
        }
        await git.raw(['--literal-pathspecs', 'add', '-A', '--', selected]);
    }
    return { snapshot, stage, unstage, commit, conflict, resolveConflict };
}
