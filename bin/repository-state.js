import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
// Git resolves the per-worktree HEAD/index and shared refs for us. This also
// handles atomic ref replacement, packed refs and changes made by other tools.
export async function repositoryState(git, root) {
    const [refs, head, branch, status, config, mailmap, index] = await Promise.all([
        git.raw(['for-each-ref', '--format=%(refname) %(objectname)']),
        git.revparse(['--verify', 'HEAD']).catch(() => ''),
        git.raw(['symbolic-ref', '--quiet', 'HEAD']).catch(() => ''),
        git.status(),
        git.listConfig(),
        readFile(resolve(root, '.mailmap'), 'utf8').catch(() => ''),
        git.raw(['diff', '--cached', '--raw', '-z', '--no-abbrev']),
    ]);
    const files = await Promise.all(status.files.map(async (file) => {
        const info = await stat(resolve(root, file.path)).catch(() => null);
        return [file, info?.mtimeMs, info?.ctimeMs, info?.size];
    }));
    const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    return {
        history: digest([refs, head, branch, config.all, mailmap]),
        working: digest([files, index]),
    };
}
