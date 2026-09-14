import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { Observable, of } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { GitService } from "../../services/git.service";
import { VscodeService } from "../../services/vscode.service";
import { AuthorAvatar } from "../author-avatar/author-avatar";
import { ChipInput, ChipSuggestion } from "../create-pr-dialog/chip-input";
import { MarkdownText } from "../markdown-text/markdown-text";
import {
  DiffFocus,
  LineCommentRequest,
  PrFileDiff,
  ThreadReplyRequest,
  ThreadStatusRequest,
} from "./pr-file-diff";
import {
  AzureSettings,
  FileDiff,
  PrCheck,
  PrDetail,
  PrFileChange,
  PrLinkedWorkItem,
  PrMergeStrategy,
  PrReviewer,
  PrThread,
  PrThreadStatus,
  PrVote,
} from "../../models/git.models";

type PrTab = "overview" | "files" | "comments";

const THREAD_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  fixed: "Resolved",
  wontFix: "Won't fix",
  closed: "Closed",
  byDesign: "By design",
  pending: "Pending",
};

const MERGE_STATUS_LABELS: Record<string, string> = {
  notSet: "Not merged",
  queued: "Queued for merge",
  conflicts: "Merge conflicts",
  succeeded: "Ready to merge",
  rejectedByPolicy: "Blocked by policy",
  failure: "Merge failed",
};

const CHECK_STATE_LABELS: Record<string, string> = {
  pending: "Pending",
  succeeded: "Passed",
  failed: "Failed",
  notApplicable: "N/A",
};

/**
 * Full pull request dialog mirroring the Azure DevOps PR page: Overview
 * (title/description/reviewers/votes/auto-complete/complete), Files (diffs
 * with inline line comments), and Comments (thread list with replies).
 */
@Component({
  selector: "app-pr-dialog",
  imports: [
    AuthorAvatar,
    ChipInput,
    MarkdownText,
    NgTemplateOutlet,
    PrFileDiff,
  ],
  templateUrl: "./pr-dialog.html",
  styleUrl: "./pr-dialog.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrDialog implements OnInit {
  private readonly git = inject(GitService);
  private readonly vscode = inject(VscodeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Azure DevOps pull request id. */
  readonly prId = input.required<number>();
  /** Repository settings; controls which merge strategies are offered. */
  readonly settings = input<AzureSettings | null>(null);
  readonly closed = output<void>();
  /** Notifies the app so the side-panel summary stays current after mutations. */
  readonly changed = output<void>();

  protected readonly pr = signal<PrDetail | null>(null);
  protected readonly threads = signal<PrThread[]>([]);
  protected readonly files = signal<PrFileChange[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal("");
  protected readonly busy = signal(false);

  // Auxiliary sections load independently with their own state, so one
  // failing Azure call neither blanks the dialog nor fakes an empty section.
  protected readonly workItems = signal<PrLinkedWorkItem[]>([]);
  protected readonly workItemsLoading = signal(false);
  protected readonly workItemsError = signal("");
  protected readonly checks = signal<PrCheck[]>([]);
  protected readonly checksLoading = signal(false);
  protected readonly checksError = signal("");
  protected readonly checksWarnings = signal<string[]>([]);
  protected readonly filesLoading = signal(false);
  protected readonly filesError = signal("");

  protected readonly tab = signal<PrTab>("overview");

  // Title/description editing.
  protected readonly editing = signal(false);
  protected readonly editTitle = signal("");
  protected readonly editDescription = signal("");

  // Reviewer picker (chip input with Azure identity search). The trailing
  // toggle decides whether picked reviewers are added as required.
  protected readonly reviewerQuery = signal("");
  protected readonly reviewerSuggestions = signal<ChipSuggestion[]>([]);
  protected readonly reviewersLoading = signal(false);
  protected readonly reviewersError = signal("");
  protected readonly reviewerRequired = signal(false);

  // Vote dropdown.
  protected readonly reviewMenuOpen = signal(false);

  // Completion / auto-complete sub-dialog options.
  protected readonly completeOpen = signal(false);
  protected readonly autoCompleteOpen = signal(false);
  protected readonly abandonOpen = signal(false);
  protected readonly mergeStrategy = signal<PrMergeStrategy>("noFastForward");
  protected readonly deleteSourceBranch = signal(false);
  protected readonly completeWorkItems = signal(false);
  protected readonly transitionWorkItems = signal(false);

  // Comment composer on the Comments tab.
  protected readonly newComment = signal("");

  // Files tab state; per-file diffs are fetched lazily and cached.
  protected readonly selectedFile = signal<PrFileChange | null>(null);
  protected readonly fileDiffs = signal<Partial<Record<string, FileDiff>>>({});
  protected readonly fileDiffLoading = signal(false);
  protected readonly fileDiffError = signal("");
  protected readonly fileFocus = signal<DiffFocus | null>(null);

  protected readonly mergeStrategies = computed(() =>
    PrDialog.allMergeStrategies.filter((strategy) => {
      const settings = this.settings();
      if (
        strategy.value === "noFastForward" ||
        strategy.value === "rebaseMerge"
      ) {
        return settings?.allowMerge !== false;
      }
      return true;
    }),
  );

  private static readonly allMergeStrategies: {
    value: PrMergeStrategy;
    label: string;
  }[] = [
    { value: "noFastForward", label: "No fast-forward (merge commit)" },
    { value: "squash", label: "Squash changes" },
    { value: "rebase", label: "Rebase and fast-forward" },
    { value: "rebaseMerge", label: "Semi-linear merge" },
  ];

  protected readonly voteOptions: {
    value: PrVote;
    label: string;
    icon: string;
  }[] = [
    { value: "approve", label: "Approve", icon: "approve" },
    {
      value: "approveWithSuggestions",
      label: "Approve with suggestions",
      icon: "suggestions",
    },
    { value: "waitForAuthor", label: "Waiting for author", icon: "waiting" },
    { value: "reject", label: "Reject", icon: "reject" },
    { value: "reset", label: "Remove my vote", icon: "none" },
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
  protected readonly selectedFileThreads = computed(() => {
    const selected = this.selectedFile();
    if (!selected) {
      return [];
    }
    return this.inlineThreads().filter(
      (thread) =>
        thread.filePath === selected.path ||
        thread.filePath === selected.oldPath,
    );
  });

  constructor() {
    // Debounced reviewer typeahead, mirroring the create-PR dialog.
    toObservable(this.reviewerQuery)
      .pipe(
        switchMap((value) => {
          this.reviewerSuggestions.set([]);
          this.reviewersError.set("");
          this.reviewersLoading.set(value.trim().length >= 2);
          if (value.trim().length < 2) {
            return of([] as ChipSuggestion[]);
          }
          return this.git.searchReviewers(value.trim()).pipe(
            catchError(() => {
              this.reviewersError.set("Unable to load suggestions.");
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

  /** Loads the pull request with its threads, then its auxiliary sections. */
  protected load(): void {
    this.loading.set(true);
    this.error.set("");
    this.git
      .getPrDetail(this.prId())
      .pipe(
        switchMap((detail) =>
          forkJoinTyped({
            detail: of(detail),
            threads: this.git
              .getPrThreads(this.prId())
              .pipe(catchError(() => of([] as PrThread[]))),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ detail, threads }) => {
          this.pr.set(detail);
          this.threads.set(threads);
          this.loading.set(false);
          // Each auxiliary section loads (and fails) independently, so a
          // broken Azure endpoint cannot hide unrelated data as empty.
          this.loadFiles();
          this.loadWorkItems();
          this.loadChecks();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.errorMessage(err));
        },
      });
  }

  /** Loads the changed files with section-local loading/error state. */
  protected loadFiles(): void {
    this.filesLoading.set(true);
    this.filesError.set("");
    this.git
      .getPrChanges(this.prId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (files) => {
          this.files.set(files);
          this.filesLoading.set(false);
          const selected = this.selectedFile();
          if (selected && !files.some((file) => file.path === selected.path)) {
            this.selectedFile.set(null);
          }
          // Show the first file's diff right away instead of an empty pane.
          if (!this.selectedFile() && files.length) {
            this.selectFile(files[0]);
          }
        },
        error: (err) => {
          // Keep any previously loaded list; a failed reload must not be
          // misread as "no changed files".
          this.filesLoading.set(false);
          this.filesError.set(this.errorMessage(err));
        },
      });
  }

  /** Loads the work items linked to the pull request. */
  protected loadWorkItems(): void {
    this.workItemsLoading.set(true);
    this.workItemsError.set("");
    this.git
      .getPrWorkItems(this.prId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workItems) => {
          this.workItems.set(workItems);
          this.workItemsLoading.set(false);
        },
        error: (err) => {
          this.workItemsLoading.set(false);
          this.workItemsError.set(this.errorMessage(err));
        },
      });
  }

  /** Loads the merge checks (policies plus native statuses). */
  protected loadChecks(): void {
    this.checksLoading.set(true);
    this.checksError.set("");
    this.checksWarnings.set([]);
    this.git
      .getPrChecks(this.prId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.checks.set(report.checks);
          this.checksWarnings.set(report.warnings ?? []);
          this.checksLoading.set(false);
        },
        error: (err) => {
          this.checksLoading.set(false);
          this.checksError.set(this.errorMessage(err));
        },
      });
  }

  /** Re-fetches detail, threads, and checks after a mutation. */
  private reload(): void {
    forkJoinTyped({
      detail: this.git.getPrDetail(this.prId()),
      threads: this.git
        .getPrThreads(this.prId())
        .pipe(catchError(() => of([] as PrThread[]))),
    }).subscribe({
      next: ({ detail, threads }) => {
        this.pr.set(detail);
        this.threads.set(threads);
        // Votes and completions move policy checks; keep them in sync.
        this.loadChecks();
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
    this.error.set("");
    action()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.changed.emit();
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
    this.run(
      () => this.git.votePr(this.prId(), voteValue),
      () => this.reload(),
    );
  }

  protected startEditing(): void {
    this.editing.set(true);
    this.editTitle.set(this.pr()?.title ?? "");
    this.editDescription.set(this.pr()?.description ?? "");
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
    this.reviewerQuery.set("");
    this.reviewerSuggestions.set([]);
    this.run(
      () =>
        this.git.updatePrReviewer(this.prId(), {
          id: choice.id,
          required: this.reviewerRequired(),
        }),
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
      () =>
        this.git.updatePrReviewer(this.prId(), {
          id: reviewer.id,
          remove: true,
        }),
      () => this.reload(),
    );
  }

  protected openComplete(): void {
    this.mergeStrategy.set(this.defaultMergeStrategy());
    this.deleteSourceBranch.set(false);
    this.completeWorkItems.set(false);
    this.transitionWorkItems.set(false);
    this.completeOpen.set(true);
  }

  protected openAutoComplete(): void {
    this.mergeStrategy.set(this.defaultMergeStrategy());
    this.deleteSourceBranch.set(false);
    this.completeWorkItems.set(false);
    this.transitionWorkItems.set(false);
    this.completeOpen.set(false);
    this.autoCompleteOpen.set(true);
  }

  /** First offered strategy, so a disabled default falls back gracefully. */
  private defaultMergeStrategy(): PrMergeStrategy {
    return this.mergeStrategies()[0]?.value ?? "noFastForward";
  }

  private completionOptions() {
    return {
      mergeStrategy: this.mergeStrategy(),
      deleteSourceBranch: this.deleteSourceBranch(),
      completeWorkItems: this.completeWorkItems(),
      transitionWorkItems:
        this.completeWorkItems() && this.transitionWorkItems(),
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
      () =>
        this.git.setPrAutoComplete(this.prId(), true, this.completionOptions()),
      () => {
        this.autoCompleteOpen.set(false);
        this.reload();
      },
    );
  }

  protected cancelAutoComplete(): void {
    this.run(
      () => this.git.setPrAutoComplete(this.prId(), false),
      () => this.reload(),
    );
  }

  // ---- Comments ----

  protected addGeneralComment(): void {
    const content = this.newComment().trim();
    if (!content) {
      return;
    }
    this.run(
      () => this.git.addPrComment(this.prId(), { content }),
      () => {
        this.newComment.set("");
        this.reload();
      },
    );
  }

  protected replyToThread(threadId: number, content: string): void {
    if (!content.trim()) {
      return;
    }
    this.run(
      () => this.git.addPrComment(this.prId(), { threadId, content }),
      () => this.reload(),
    );
  }

  protected setThreadStatus(threadId: number, status: PrThreadStatus): void {
    this.run(
      () => this.git.setPrThreadStatus(this.prId(), threadId, status),
      () => this.reload(),
    );
  }

  protected addInlineComment(comment: LineCommentRequest): void {
    this.run(
      () => this.git.addPrComment(this.prId(), comment),
      () => this.reload(),
    );
  }

  protected replyFromDiff(reply: ThreadReplyRequest): void {
    this.replyToThread(reply.threadId, reply.content);
  }

  protected setStatusFromDiff(change: ThreadStatusRequest): void {
    this.setThreadStatus(change.threadId, change.status);
  }

  /** Opens the Files tab at a thread's file and line. */
  protected jumpToThread(thread: PrThread): void {
    const file =
      this.files().find((entry) => entry.path === thread.filePath) ??
      this.files().find((entry) => entry.oldPath === thread.filePath);
    if (!file || thread.line === null) {
      return;
    }
    this.tab.set("files");
    this.selectFile(file);
    this.fileFocus.set({ line: thread.line, side: thread.side ?? "right" });
  }

  // ---- Files tab ----

  protected selectFile(file: PrFileChange): void {
    this.selectedFile.set(file);
    this.fileDiffError.set("");
    if (this.fileDiffs()[file.path] || file.changeType === "binary") {
      return;
    }
    this.fileDiffLoading.set(true);
    this.git
      .getPrFileDiff(this.prId(), file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (diff) => {
          this.fileDiffs.update((current) => ({
            ...current,
            [file.path]: diff,
          }));
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
        return { label: "Approved", cls: "vote-approve" };
      case 5:
        return { label: "Approved with suggestions", cls: "vote-suggestions" };
      case -5:
        return { label: "Waiting for author", cls: "vote-waiting" };
      case -10:
        return { label: "Rejected", cls: "vote-reject" };
      default:
        return { label: "No vote", cls: "vote-none" };
    }
  }

  protected statusLabel(status: string): string {
    return THREAD_STATUS_LABELS[status] ?? status;
  }

  protected mergeStatusLabel(status: string): string {
    return MERGE_STATUS_LABELS[status] ?? status;
  }

  protected checkStateLabel(state: string): string {
    return CHECK_STATE_LABELS[state] ?? state;
  }

  protected formatDate(iso: string): string {
    if (!iso) {
      return "";
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  protected openInBrowser(): void {
    const url = this.pr()?.webUrl;
    if (url) {
      this.vscode.openExternal(url);
    }
  }

  /** Opens an http(s) link (work item, build result) in the default browser. */
  protected openExternalLink(url: string): void {
    if (url) {
      this.vscode.openExternal(url);
    }
  }

  /** Publishes the draft pull request (isDraft: false). */
  protected publishPr(): void {
    this.run(
      () => this.git.updatePr(this.prId(), { isDraft: false }),
      () => this.reload(),
    );
  }

  protected openAbandonConfirm(): void {
    this.abandonOpen.set(true);
  }

  /** Abandons the PR, refreshes the list, and leaves the dialog. */
  protected abandonPr(): void {
    this.run(
      () => this.git.abandonPr(this.prId()),
      () => {
        this.abandonOpen.set(false);
        this.changed.emit();
        this.closed.emit();
      },
    );
  }

  @HostListener("document:keydown.escape")
  protected onEscape(): void {
    if (this.editing()) {
      this.editing.set(false);
      return;
    }
    if (
      this.reviewMenuOpen() ||
      this.completeOpen() ||
      this.autoCompleteOpen() ||
      this.abandonOpen()
    ) {
      this.reviewMenuOpen.set(false);
      this.completeOpen.set(false);
      this.autoCompleteOpen.set(false);
      this.abandonOpen.set(false);
      return;
    }
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(): void {
    if (
      !this.busy() &&
      !this.editing() &&
      !this.completeOpen() &&
      !this.autoCompleteOpen() &&
      !this.abandonOpen()
    ) {
      this.closed.emit();
    }
  }

  private errorMessage(err: unknown): string {
    const response = err as { status?: number; error?: { error?: string } };
    if (response?.status === 400 && response.error?.error) {
      return response.error.error;
    }
    return "Failed to communicate with the Guito server.";
  }
}

/** forkJoin with inferred tuple types (used for the parallel detail loads). */
function forkJoinTyped<T extends Record<string, Observable<any>>>(
  sources: T,
): Observable<{
  [K in keyof T]: T[K] extends Observable<infer R> ? R : never;
}> {
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
