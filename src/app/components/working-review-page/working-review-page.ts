import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  AiReviewSeverity,
  FileDiff,
  WorkingReviewFinding,
  WorkingReviewState,
} from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { VscodeService } from '../../services/vscode.service';
import { DiffDialog } from '../diff-dialog/diff-dialog';
import { MarkdownText } from '../markdown-text/markdown-text';

const SEVERITY_LABELS: Record<AiReviewSeverity, string> = {
  blocker: 'Blocker',
  concern: 'Concern',
  suggestion: 'Suggestion',
  nit: 'Nit',
};

/** How often a running review or fix is polled. */
const POLL_MS = 1500;

/**
 * The results of the code review of the uncommitted changes, shown in a tab
 * of its own (`?guitoView=working-review`): a VS Code editor tab opened by the
 * extension host, or a browser tab in standalone Guito. Each finding links to
 * its place in the code and can be handed to Claude Code to fix.
 */
@Component({
  selector: 'app-root',
  imports: [DiffDialog, MarkdownText],
  templateUrl: './working-review-page.html',
  styleUrl: './working-review-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingReviewPage implements OnDestroy {
  private readonly git = inject(GitService);
  private readonly vscode = inject(VscodeService);

  protected readonly state = signal<WorkingReviewState | null>(null);
  protected readonly loadError = signal('');
  protected readonly actionError = signal('');
  /** The working diff shown in Guito's own dialog (standalone, or a binary file). */
  protected readonly diff = signal<FileDiff | null>(null);
  protected readonly running = computed(() => this.state()?.status === 'running');
  protected readonly fixingId = computed(() => this.state()?.fixingId ?? '');
  protected readonly busy = computed(() => this.running() || !!this.fixingId());
  protected readonly counts = computed(() => {
    const counts: Partial<Record<AiReviewSeverity, number>> = {};
    for (const finding of this.state()?.findings ?? []) {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    }
    return (Object.keys(SEVERITY_LABELS) as AiReviewSeverity[])
      .filter((severity) => counts[severity])
      .map((severity) => ({ severity, count: counts[severity]! }));
  });
  private timer: number | undefined;

  constructor() {
    // Loads now, and again whenever the extension host reports a new review.
    effect(() => {
      this.vscode.workingReviewVersion();
      untracked(() => this.load());
    });
    effect(() => {
      const branch = this.state()?.branch;
      document.title = branch ? `Code Review — ${branch}` : 'Code Review';
    });
  }

  ngOnDestroy(): void {
    window.clearTimeout(this.timer);
  }

  protected severityLabel(severity: AiReviewSeverity): string {
    return SEVERITY_LABELS[severity];
  }

  protected formatTime(value: string): string {
    return value ? new Date(value).toLocaleString() : '';
  }

  protected load(): void {
    this.git.getWorkingReview().subscribe({
      next: (state) => this.show(state),
      error: (err) => this.loadError.set(this.errorMessage(err)),
    });
  }

  /** Shows a state, and polls while a review or fix is running. */
  private show(state: WorkingReviewState): void {
    this.state.set(state);
    this.loadError.set('');
    window.clearTimeout(this.timer);
    if (state.status === 'running' || state.fixingId) {
      this.timer = window.setTimeout(() => this.load(), POLL_MS);
    }
  }

  protected reviewAgain(): void {
    if (this.busy()) return;
    this.actionError.set('');
    this.git.startWorkingReview().subscribe({
      next: (state) => this.show(state),
      error: (err) => this.actionError.set(this.errorMessage(err)),
    });
  }

  protected stopReview(): void {
    this.git.cancelWorkingReview().subscribe({
      next: () => this.load(),
      error: (err) => this.actionError.set(this.errorMessage(err)),
    });
  }

  protected fix(finding: WorkingReviewFinding): void {
    if (this.busy()) return;
    this.actionError.set('');
    this.git.fixWorkingReviewFinding(finding.id).subscribe({
      next: (state) => this.show(state),
      error: (err) => this.actionError.set(this.errorMessage(err)),
    });
  }

  protected stopFix(): void {
    this.git.cancelWorkingReviewFix().subscribe({
      next: () => this.load(),
      error: (err) => this.actionError.set(this.errorMessage(err)),
    });
  }

  /** Opens the code the finding is about: the editor in VS Code, else the working diff. */
  protected open(finding: WorkingReviewFinding): void {
    if (!finding.file) return;
    if (this.vscode.openFile(finding.file, finding.line, finding.endLine)) return;
    this.showDiff(finding.file);
  }

  /** Shows the file's uncommitted changes (HEAD ↔ working tree), e.g. after a fix. */
  protected showDiff(path: string): void {
    this.actionError.set('');
    this.git.getWorkingChanges().subscribe({
      next: (changes) => {
        const file = changes.files.find((entry) => entry.path === path);
        if (!file) {
          this.actionError.set(`${path} has no uncommitted changes any more.`);
          return;
        }
        if (!this.vscode.openDiff(file, 'HEAD', 'WORKING')) this.diff.set(file);
      },
      error: (err) => this.actionError.set(this.errorMessage(err)),
    });
  }

  private errorMessage(err: any): string {
    return err?.error?.error || err?.message || 'The request failed.';
  }
}
