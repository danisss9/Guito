import { GitCommit, RefBadge } from '../models/git.models';

/**
 * Parses the `%D` refs decoration of a commit (e.g.
 * `HEAD -> main, origin/main, origin/HEAD, tag: v1.0`) into badges.
 */
export function parseRefs(refs: string | undefined): RefBadge[] {
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
