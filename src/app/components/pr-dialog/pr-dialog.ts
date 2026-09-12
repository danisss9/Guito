import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  WritableSignal,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { GitService } from '../../services/git.service';
import { AuthorAvatar } from '../author-avatar/author-avatar';
import { ChipInput, ChipSuggestion } from '../create-pr-dialog/chip-input';
import { MarkdownText } from '../markdown-text/markdown-text';
import { DiffFocus, PrFileDiff } from './pr-file-diff';
import {
  FileDiff,
  PrDetail,
  PrFileChange,
  PrMergeStrategy,
  PrReviewer,
  PrThread,
  PrThreadStatus,
  PrVote,
} from '../../models/git.models';

type PrTab = 'overview' | 'files' | 'comments';

const THREAD_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  fixed: 'Resolved',
  wontFix: "Won't fix",
  closed: 'Closed',
  byDesign: 'By design',
  pending: 'Pending',
};

/**
 * Full pull request dialog mirroring the Azure DevOps PR page: Overview
 * (title/description/reviewers/votes/auto-complete/complete), Files (diffs
 * with inline line comments), and Comments (thread list with replies).
 */
@Component({
  selector: 'app-pr-dialog',
  imports: [AuthorAvatar, ChipInput, MarkdownText, PrFileDiff],
  templateUrl: './pr-dialog.html',
  styleUrl: './pr-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrDialog implements OnInit {
  private readonly git = inject(GitService);
  private readonly destroyRef = inject(DestroyRef);

  /** Azure DevOps pull request id. */
  readonly prId = input.required<number>();
  readonly closed = output<void>();

  protected readonly pr = signal<PrDetail | null>(null);
  protected readonly threads = signal<PrThread[]>([]);
  protected readonly files = signal<PrFileChange[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly tab = signal<PrTab>('overview');

  // Title/description editing.
  protected readonly editing = signal(false);
  protected readonly editTitle = signal('');
  protected readonly editDescription = signal('');

  // Reviewer picker (chip input with Azure identity search).
  protected readonly reviewerQuery = signal('');
  protected readonly reviewerSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly reviewersLoading = signal(false);
  protected readonly reviewersError = signal('');

  // Vote dropdown.
  protected readonly reviewMenuOpen = signal(false);

  // Completion / auto-complete sub-dialog options.
  protected readonly completeOpen = signal(false);
  protected readonly autoCompleteOpen = signal(false);
  protected readonly mergeStrategy = signal<PrMergeStrategy>('noFastForward');
  protected readonly deleteSourceBranch = signal(false);
  protected readonly completeWorkItems = signal(false);
  protected readonly transitionWorkItems = signal(false);

  // Comment composer on the Comments tab.
  protected readonly newComment = signal('');

  // Files tab state; per-file diffs are fetched lazily and cached.
  protected readonly selectedFile = signal<PrFileChange | null>(null);
  protected readonly fileDiffs = signal<Record<string, FileDiff>>({});
  protected readonly fileDiffLoading = signal(false);
  protected readonly fileDiffError = signal('');
  protected readonly fileFocus = signal<DiffFocus | null>(null);

  protected readonly mergeStrategies: { value: PrMergeStrategy; label: string }[] = [
    { value: 'noFastForward', label: 'No fast-forward (merge commit)' },
    { value: 'squash', label: 'Squash changes' },
    { value: 'rebase', label: 'Rebase and fast-forward' },
    { value: 'rebaseMerge', label: 'Semi-linear merge' },
  ];

  protected readonly voteOptions: { value: PrVote; label: string; icon: string }[] = [
    { value: 'approve', label: 'Approve', icon: 'approve' },
    { value: 'approveWithSuggestions', label: 'Approve with suggestions', icon: 'suggestions' },
    { value: 'waitForAuthor', label: 'Waiting for author', icon: 'waiting' },
    { value: 'reject', label: 'Reject', icon: 'reject' },
    { value: 'reset', label: 'Remove my vote', icon: 'none' },
  ];

  protected readonly threadStatuses = Object.keys(THREAD_STATUS_LABELS);

  protected readonly requiredReviewers = computed(() =>
    (this.pr()?.reviewers ?? []).filter((reviewer) => reviewer.isRequired),
  );
  protected readonly otherReviewers = computed(() =>
    (this.pr()?.reviewers ?? []).filter((reviewer) => !reviewer.isRequired),
  );
  protected readonly generalThreads = computed(() =>
    this.threads().filter((thread) => !thread.filePath),
  );
  protected readonly inlineThreads = computed(() =>
    this.threads().filter((thread) => thread.filePath),
  );

  constructor() {
    // Debounced reviewer typeahead, mirroring the create-PR dialog.
    toObservable(this.reviewerQuery)
      .pipe(
        switchMap((value) => {
          this.reviewerSuggestions.set([]);
          this.reviewersError.set('');
          this.reviewersLoading.set(value.trim().length >= 2);
          if (value.trim().length < 2) {
            return of([] as ChipSuggestion[]);
          }
          return this.git.searchReviewers(value.trim()).pipe(
            catchError(() => {
              this.reviewersError.set('Unable to load suggestions.');
              return of([] as ChipSuggestion[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((reviewers) => {
        this.reviewerSuggestions.set(reviewers);
        this.reviewersLoading.set(false);
      });
  }

  ngOnInit(): void {
    this.load();
  }

  /** Loads the pull request with its threads and changed files. */
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.git
      .getPrDetail(this.prId())
      .pipe(
        switchMap((detail) =>
          forkJoinTyped({
            detail: of(detail),
            threads: this.git.getPrThreads(this.prId()).pipe(catchError(() => of([] as PrThread[]))),
            files: this.git.getPrChanges(this.prId()).pipe(catchError(() => of([] as PrFileChange[]))),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ detail, threads, files }) => {
          this.pr.set(detail);
          this.threads.set(threads);
          this.files.set(files);
          if (this.selectedFile() && !files.some((file) => file.path === this.selectedFile()!.path)) {
            this.selectedFile.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.errorMessage(err));
        },
      });
  }

  /** Re-fetches detail and threads after a mutation. */
  private reload(): void {
    forkJoinTyped({
      detail: this.git.getPrDetail(this.prId()),
      threads: this.git.getPrThreads(this.prId()).pipe(catchError(() => of([] as PrThread[]))),
    }).subscribe({
      next: ({ detail, threads }) => {
        this.pr.set(detail);
        this.threads.set(threads);
      },
      error: (err) => this.error.set(this.errorMessage(err)),
    });
  }

  /** Runs one Azure mutation with busy/error handling. */
  private run(action: () => Observable<unknown>, done?: () => void): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    action()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          done?.();
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(this.errorMessage(err));
        },
      });
  }

  // ---- Overview actions ----

  protected vote(voteValue: PrVote): void {
    this.reviewMenuOpen.set(false);
    this.run(() => this.git.votePr(this.prId(), voteValue), () => this.reload());
  }

  protected startEditing(): void {
    this.editing.set(true);
    this.editTitle.set(this.pr()?.title ?? '');
    this.editDescription.set(this.pr()?.description ?? '');
  }

  protected saveEdit(): void {
    const title = this.editTitle().trim();
    if (!title) {
      return;
    }
    this.run(
      () =>
        this.git.updatePr(this.prId(), {
          title,
          description: this.editDescription(),
        }),
      () => {
        this.editing.set(false);
        this.reload();
      },
    );
  }

  protected toggleDraft(): void {
    const detail = this.pr();
    if (!detail) {
      return;
    }
    this.run(
      () => this.git.updatePr(this.prId(), { isDraft: !detail.isDraft }),
      () => this.reload(),
    );
  }

  protected addReviewer(choice: ChipSuggestion): void {
    this.reviewerQuery.set('');
    this.reviewerSuggestions.set([]);
    this.run(
      () => this.git.updatePrReviewer(this.prId(), { id: choice.id, required: false }),
      () => this.reload(),
    );
  }

  protected toggleReviewerRequired(reviewer: PrReviewer): void {
    this.run(
      () =>
        this.git.updatePrReviewer(this.prId(), {
          id: reviewer.id,
          required: !reviewer.isRequired,
          vote: reviewer.vote,
        }),
      () => this.reload(),
    );
  }

  protected removeReviewer(reviewer: PrReviewer): void {
    this.run(
      () => this.git.updatePrReviewer(this.prId(), { id: reviewer.id, remove: true }),
      () => this.reload(),
    );
  }

  protected openComplete(): void {
    this.mergeStrategy.set('noFastForward');
    this.deleteSourceBranch.set(false);
    this.completeWorkItems.set(false);
    this.transitionWorkItems.set(false);
    this.completeOpen.set(true);
  }

  protected openAutoComplete(): void {
    this.mergeStrategy.set('noFastForward');
    this.deleteSourceBranch.set(false);
    this.completeOpen.set(false);
    this.autoCompleteOpen.set(true);
  }

  private completionOptions() {
    return {
      mergeStrategy: this.mergeStrategy(),
      deleteSourceBranch: this.deleteSourceBranch(),
      completeWorkItems: this.completeWorkItems(),
      transitionWorkItems: this.completeWorkItems() && this.transitionWorkItems(),
    };
  }

  protected applyComplete(): void {
    this.run(
      () => this.git.completePr(this.prId(), this.completionOptions()),
      () => {
        this.completeOpen.set(false);
        this.reload();
      },
    );
  }

  protected applyAutoComplete(): void {
    this.run(
      () => this.git.setPrAutoComplete(this.prId(), true, this.completionOptions()),
      () => {
        this.autoCompleteOpen.set(false);
        this.reload();
      },
    );
  }

  protected cancelAutoComplete(): void {
    this.run(() => this.git.setPrAutoComplete(this.prId(), false), () => this.reload());
  }

  // ---- Comments ----

  protected addGeneralComment(): void {
    const content = this.newComment().trim();
    if (!content) {
      return;
    }
    this.run(() => this.git.addPrComment(this.prId(), { content }), () => {
      this.newComment.set('');
      this.reload();
    });
  }

  protected replyToThread(threadId: number, content: string): void {
    if (!content.trim()) {
      return;
    }
    this.run(() => this.git.addPrComment(this.prId(), { threadId, content }), () => this.reload());
  }

  protected setThreadStatus(threadId: number, status: PrThreadStatus): void {
    this.run(
      () => this.git.setPrThreadStatus(this.prId(), threadId, status),
      () => this.reload(),
    );
  }

  /** Opens the Files tab at a thread's file and line. */
  protected jumpToThread(thread: PrThread): void {
    const file =
      this.files().find((entry) => entry.path === thread.filePath) ??
      this.files().find((entry) => entry.oldPath === thread.filePath);
    if (!file || thread.line === null) {
      return;
    }
    this.tab.set('files');
    this.selectFile(file);
    this.fileFocus.set({ line: thread.line, side: thread.side ?? 'right' });
  }

  // ---- Files tab ----

  protected selectFile(file: PrFileChange): void {
    this.selectedFile.set(file);
    this.fileDiffError.set('');
    if (this.fileDiffs()[file.path] || file.changeType === 'binary') {
      return;
    }
    this.fileDiffLoading.set(true);
    this.git
      .getPrFileDiff(this.prId(), file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (diff) => {
          this.fileDiffs.update((current) => ({ ...current, [file.path]: diff }));
          this.fileDiffLoading.set(false);
        },
        error: (err) => {
          this.fileDiffLoading.set(false);
          this.fileDiffError.set(this.errorMessage(err));
        },
      });
  }

  // ---- helpers ----

  protected voteMeta(vote: number): { label: string; cls: string } {
    switch (vote) {
      case 10:
        return { label: 'Approved', cls: 'vote-approve' };
      case 5:
        return { label: 'Approved with suggestions', cls: 'vote-suggestions' };
      case -5:
        return { label: 'Waiting for author', cls: 'vote-waiting' };
      case -10:
        return { label: 'Rejected', cls: 'vote-reject' };
      default:
        return { label: 'No vote', cls: 'vote-none' };
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

  protected openInBrowser(): void {
    const url = this.pr()?.webUrl;
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.editing()) {
      this.editing.set(false);
      return;
    }
    if (this.reviewMenuOpen() || this.completeOpen() || this.autoCompleteOpen()) {
      this.reviewMenuOpen.set(false);
      this.completeOpen.set(false);
      this.autoCompleteOpen.set(false);
      return;
    }
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(): void {
    if (!this.busy() && !this.editing() && !this.completeOpen() && !this.autoCompleteOpen()) {
      this.closed.emit();
    }
  }

  private errorMessage(err: unknown): string {
    const response = err as { status?: number; error?: { error?: string } };
    if (response?.status === 400 && response.error?.error) {
      return response.error.error;
    }
    return 'Failed to communicate with the Guito server.';
  }
}

/** forkJoin with inferred tuple types (used for the parallel detail loads). */
function forkJoinTyped<T extends Record<string, Observable<any>>>(
  sources: T,
): Observable<{ [K in keyof T]: T[K] extends Observable<infer R> ? R : never }> {
  return new Observable((subscriber) => {
    const keys = Object.keys(sources) as (keyof T)[];
    const results: Record<string, unknown> = {};
    let pending = keys.length;
    let failed = false;
    if (!pending) {
      subscriber.next({} as any);
      subscriber.complete();
      return;
    }
    for (const key of keys) {
      sources[key].subscribe({
        next: (value: unknown) => {
          results[key as string] = value;
        },
        error: (err: unknown) => {
          if (!failed) {
            failed = true;
            subscriber.error(err);
          }
        },
        complete: () => {
          if (--pending === 0 && !failed) {
            subscriber.next(results as any);
            subscriber.complete();
          }
        },
      });
    }
  });
}
