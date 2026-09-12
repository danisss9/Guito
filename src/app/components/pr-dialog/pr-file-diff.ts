import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { AuthorAvatar } from '../author-avatar/author-avatar';
import { MarkdownText } from '../markdown-text/markdown-text';
import { DiffLine, FileDiff, PrThread, PrThreadStatus } from '../../models/git.models';

/** A comment the user wrote on a specific diff line. */
export interface LineCommentRequest {
  filePath: string;
  line: number;
  side: 'left' | 'right';
  content: string;
}

/** A reply posted to an existing thread. */
export interface ThreadReplyRequest {
  threadId: number;
  content: string;
}

/** A status change (resolve, reactivate, close) on a thread. */
export interface ThreadStatusRequest {
  threadId: number;
  status: PrThreadStatus;
}

/** A line the dialog wants revealed: expand and scroll to its threads. */
export interface DiffFocus {
  line: number;
  side: 'left' | 'right';
}

const THREAD_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  fixed: 'Resolved',
  wontFix: "Won't fix",
  closed: 'Closed',
  byDesign: 'By design',
  pending: 'Pending',
};

/**
 * Unified diff of one pull request file with Azure-style inline comments:
 * hovering a line offers a comment button, and existing threads render
 * beneath their line.
 */
@Component({
  selector: 'app-pr-file-diff',
  imports: [AuthorAvatar, MarkdownText],
  templateUrl: './pr-file-diff.html',
  styleUrl: './pr-file-diff.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrFileDiff {
  readonly diff = input<FileDiff | null>(null);
  readonly threads = input<PrThread[]>([]);
  readonly loading = input(false);
  readonly error = input('');
  readonly posting = input(false);
  /** Set by the parent to expand and scroll to a line's threads. */
  readonly focus = input<DiffFocus | null>(null);

  readonly commentSubmit = output<LineCommentRequest>();
  readonly replySubmit = output<ThreadReplyRequest>();
  readonly statusSubmit = output<ThreadStatusRequest>();

  protected readonly threadStatuses = Object.keys(THREAD_STATUS_LABELS);

  /** The line the inline composer is currently attached to. */
  protected readonly composer = signal<DiffFocus | null>(null);
  protected readonly composerText = signal('');
  protected readonly expanded = signal<Record<number, boolean>>({});
  protected readonly replyDrafts = signal<Record<number, string>>({});

  protected readonly threadsByAnchor = computed(() => {
    const map = new Map<string, PrThread[]>();
    for (const thread of this.threads()) {
      if (!thread.filePath || thread.line === null || !thread.side) {
        continue;
      }
      const key = `${thread.side}:${thread.line}`;
      map.set(key, [...(map.get(key) ?? []), thread]);
    }
    return map;
  });

  constructor() {
    effect(() => {
      const target = this.focus();
      if (!target) {
        return;
      }
      const threads = this.threadsByAnchor().get(`${target.side}:${target.line}`) ?? [];
      const updates: Record<number, boolean> = {};
      for (const thread of threads) {
        updates[thread.id] = true;
      }
      if (Object.keys(updates).length) {
        this.expanded.update((current) => ({ ...current, ...updates }));
        const first = threads[0];
        setTimeout(() => document.getElementById(`pr-thread-${first.id}`)?.scrollIntoView({ block: 'center' }));
      }
    });
  }

  /** Threads anchored to one diff line (either side of it). */
  protected threadsAt(line: DiffLine): PrThread[] {
    const anchors: string[] = [];
    if (line.oldLine !== undefined) {
      anchors.push(`left:${line.oldLine}`);
    }
    if (line.newLine !== undefined) {
      anchors.push(`right:${line.newLine}`);
    }
    const found: PrThread[] = [];
    for (const anchor of anchors) {
      found.push(...(this.threadsByAnchor().get(anchor) ?? []));
    }
    return found;
  }

  /** Opens the inline composer on a line; deletion lines comment on the left side. */
  protected openComposer(line: DiffLine): void {
    if (line.type !== 'add' && line.type !== 'del' && line.type !== 'context') {
      return;
    }
    const side: 'left' | 'right' = line.type === 'del' ? 'left' : 'right';
    const lineNumber = side === 'left' ? line.oldLine : line.newLine;
    if (lineNumber === undefined) {
      return;
    }
    this.composer.set({ line: lineNumber, side });
    this.composerText.set('');
  }

  /** Whether the composer belongs under this line. */
  protected composerAt(line: DiffLine): boolean {
    const target = this.composer();
    if (!target) {
      return false;
    }
    return target.side === 'left'
      ? line.oldLine === target.line
      : line.newLine === target.line;
  }

  protected submitComposer(): void {
    const target = this.composer();
    const content = this.composerText().trim();
    if (!target || !content) {
      return;
    }
    this.commentSubmit.emit({ filePath: this.diff()?.path ?? '', ...target, content });
  }

  protected closeComposer(): void {
    this.composer.set(null);
    this.composerText.set('');
  }

  protected isExpanded(threadId: number): boolean {
    return this.expanded()[threadId] === true;
  }

  protected toggleThread(threadId: number): void {
    this.expanded.update((current) => ({ ...current, [threadId]: !current[threadId] }));
  }

  protected replyDraft(threadId: number): string {
    return this.replyDrafts()[threadId] ?? '';
  }

  protected setReplyDraft(threadId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.replyDrafts.update((current) => ({ ...current, [threadId]: value }));
  }

  protected sendReply(threadId: number): void {
    const content = this.replyDraft(threadId).trim();
    if (!content) {
      return;
    }
    this.replySubmit.emit({ threadId, content });
  }

  protected onStatusChange(thread: PrThread, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as PrThreadStatus;
    if (status && status !== thread.status) {
      this.statusSubmit.emit({ threadId: thread.id, status });
    }
  }

  protected statusLabel(status: string): string {
    return THREAD_STATUS_LABELS[status] ?? status;
  }

  protected formatDate(iso: string): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }
}
