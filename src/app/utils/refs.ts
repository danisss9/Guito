import { BranchInfo, GitCommit, RefBadge } from '../models/git.models';

/**
 * Parses the `%D` refs decoration of a commit (e.g.
 * `HEAD -> main, origin/main, origin/HEAD, tag: v1.0`) into badges.
 *
 * `%D` only carries short names, so a `/` heuristic cannot tell local
 * branches like `feature/foo` apart from remote-tracking refs like
 * `origin/main`. When the loaded branch list is provided, exact names are
 * resolved against it; otherwise the slash heuristic is kept as a fallback.
 */
export function parseRefs(
  refs: string | undefined,
  knownBranches?: Pick<BranchInfo, 'name' | 'remote'>[],
): RefBadge[] {
  if (!refs) {
    return [];
  }

  return refs
    .split(',')
    .map((ref) => ref.trim())
    // Stashes are listed only in the side panel, never badged in the graph.
    .filter((ref) => ref && ref !== 'refs/stash')
    .map((ref): RefBadge => {
      if (ref.startsWith('HEAD -> ')) {
        return { type: 'head', name: ref.slice('HEAD -> '.length) };
      }
      if (ref === 'HEAD') {
        return { type: 'head', name: 'HEAD' };
      }
      if (ref.startsWith('tag: ')) {
        return { type: 'tag', name: ref.slice('tag: '.length) };
      }
      if (knownBranches) {
        const known = knownBranches.find((branch) => branch.name === ref);
        if (known) {
          return { type: known.remote ? 'remote' : 'local', name: ref };
        }
        // Unknown refs (e.g. filtered out of the loaded list) keep the
        // slash heuristic so remote-tracking names still resolve as remote.
      }
      if (ref.includes('/')) {
        return { type: 'remote', name: ref };
      }
      return { type: 'local', name: ref };
    });
}

export function isHeadCommit(commit: Pick<GitCommit, 'refs'>): boolean {
  const refs = commit.refs;
  if (!refs) {
    return false;
  }
  return refs === 'HEAD' || refs.startsWith('HEAD,') || refs.startsWith('HEAD ->');
}
