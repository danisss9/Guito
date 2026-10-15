import type { DiffLine, FileDiff, PrComment, PrThread } from '../models/git.models';

/** Friendly names for Azure DevOps thread statuses ("fixed" reads as Resolved). */
export const THREAD_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  fixed: 'Resolved',
  wontFix: "Won't fix",
  closed: 'Closed',
  byDesign: 'By design',
  pending: 'Pending',
};

/** Friendly names for Azure DevOps reviewer votes, by numeric REST value. */
export const VOTE_LABELS: Record<number, string> = {
  10: 'Approved',
  5: 'Approved with suggestions',
  0: 'No vote',
  [-5]: 'Waiting for author',
  [-10]: 'Rejected',
};

/** Past-tense verbs for vote system entries ("Drs approved"). */
const VOTE_VERBS: Record<number, string> = {
  10: 'approved',
  5: 'approved with suggestions',
  0: 'removed their vote',
  [-5]: 'is waiting for the author',
  [-10]: 'rejected',
};

export function statusLabel(status: string): string {
  return THREAD_STATUS_LABELS[status] ?? status;
}

export function voteLabel(vote: number): string {
  return VOTE_LABELS[vote] ?? String(vote);
}

/** Matches system entries Azure renders from raw values ("X changed status to 10"). */
const VOTE_STATUS_PATTERN = /^(.*?)\s+changed status to\s+(-?\d+)\s*$/i;
const NAMED_STATUS_PATTERN = /^(.*?)\s+changed status (?:from\s+(.+?)\s+)?to\s+(.+?)\s*$/i;

/**
 * Whether a comment is Azure-generated activity (votes, status changes, code
 * updates) rather than something a person wrote. Explicit "text" comments are
 * always user content; anything else falls back to content patterns so older
 * payloads without a comment type still classify.
 */
export function isSystemComment(comment: Pick<PrComment, 'commentType' | 'content'>): boolean {
  const kind = (comment.commentType ?? '').toLowerCase();
  if (kind === 'system' || kind === 'codechange' || kind === 'code_change') {
    return true;
  }
  if (kind === 'text') {
    return false;
  }
  const content = (comment.content ?? '').trim();
  return VOTE_STATUS_PATTERN.test(content) || NAMED_STATUS_PATTERN.test(content);
}

export interface FriendlyComment {
  /** Display text with raw vote/status values translated to friendly labels. */
  text: string;
  /** True for Azure-generated activity; rendered distinctly from user comments. */
  isSystem: boolean;
  /** Untouched Azure content, kept for tooltips and debugging. */
  raw: string;
}

/**
 * Translates system entries into readable text ("Drs changed status to 10"
 * becomes "Drs approved"). Unknown values fall back to the raw text so
 * nothing Azure reports is ever hidden.
 */
export function friendlyComment(comment: Pick<PrComment, 'commentType' | 'content'>): FriendlyComment {
  const raw = comment.content ?? '';
  const content = raw.trim();
  if (!isSystemComment(comment)) {
    return { text: raw, isSystem: false, raw };
  }
  const voteMatch = content.match(VOTE_STATUS_PATTERN);
  if (voteMatch) {
    const actor = voteMatch[1].trim();
    const verb = VOTE_VERBS[Number(voteMatch[2])];
    if (verb) {
      return { text: actor ? `${actor} ${verb}` : verb, isSystem: true, raw };
    }
    return { text: raw, isSystem: true, raw };
  }
  const statusMatch = content.match(NAMED_STATUS_PATTERN);
  if (statusMatch) {
    const actor = statusMatch[1].trim();
    const label = statusLabel(statusMatch[3].trim());
    const text = actor ? `${actor} changed status to ${label}` : `Changed status to ${label}`;
    return { text, isSystem: true, raw };
  }
  return { text: raw, isSystem: true, raw };
}

export type CommentLocationFilter = 'all' | 'general' | 'inline';
export type CommentKindFilter = 'all' | 'user' | 'system';

export interface ThreadFilter {
  /** Thread status value, or "all". */
  status: string;
  location: CommentLocationFilter;
  kind: CommentKindFilter;
}

export const EMPTY_THREAD_FILTER: ThreadFilter = { status: 'all', location: 'all', kind: 'all' };

export function isEmptyThreadFilter(filter: ThreadFilter): boolean {
  return filter.status === 'all' && filter.location === 'all' && filter.kind === 'all';
}

/** Whether a thread contains at least one user-written comment. */
export function threadHasUserComment(thread: Pick<PrThread, 'comments'>): boolean {
  return thread.comments.some((comment) => !isSystemComment(comment));
}

/** Whether a thread contains at least one system activity entry. */
export function threadHasSystemEntry(thread: Pick<PrThread, 'comments'>): boolean {
  return thread.comments.some((comment) => isSystemComment(comment));
}

export function threadMatchesFilter(
  thread: Pick<PrThread, 'status' | 'filePath' | 'comments'>,
  filter: ThreadFilter,
): boolean {
  if (filter.status !== 'all' && thread.status !== filter.status) {
    return false;
  }
  if (filter.location === 'general' && thread.filePath) {
    return false;
  }
  if (filter.location === 'inline' && !thread.filePath) {
    return false;
  }
  if (filter.kind === 'user' && !threadHasUserComment(thread)) {
    return false;
  }
  if (filter.kind === 'system' && !threadHasSystemEntry(thread)) {
    return false;
  }
  return true;
}

export function filterThreads<T extends Pick<PrThread, 'status' | 'filePath' | 'comments'>>(
  threads: T[],
  filter: ThreadFilter,
): T[] {
  if (isEmptyThreadFilter(filter)) {
    return threads;
  }
  return threads.filter((thread) => threadMatchesFilter(thread, filter));
}

export interface ThreadStatusCount {
  value: string;
  label: string;
  count: number;
}

/** Status options present in the threads, with counts for the filter bar. */
export function threadStatusCounts<T extends Pick<PrThread, 'status'>>(
  threads: T[],
): ThreadStatusCount[] {
  const counts = new Map<string, number>();
  for (const thread of threads) {
    counts.set(thread.status, (counts.get(thread.status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({
    value,
    label: statusLabel(value),
    count,
  }));
}

/**
 * Focused code context for an inline thread: the diff rows around the
 * thread's anchor line (matched on the thread's side), plus a few rows of
 * surrounding context. Returns [] when the anchor line is not in the diff
 * (outdated thread, truncated file), so callers can show a fallback.
 */
export function snippetForThread(
  diff: FileDiff | null | undefined,
  thread: Pick<PrThread, 'line' | 'side'>,
  radius = 8,
): DiffLine[] {
  if (!diff || thread.line === null || thread.line === undefined) {
    return [];
  }
  const lines = diff.lines ?? [];
  const anchor = lines.findIndex((line) =>
    thread.side === 'left' ? line.oldLine === thread.line : line.newLine === thread.line,
  );
  if (anchor === -1) {
    return [];
  }
  return lines.slice(Math.max(0, anchor - radius), anchor + radius + 1);
}
