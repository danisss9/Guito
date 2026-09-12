import { ErrorBanner } from '../error-banner/error-banner';
import { AuthorAvatar } from '../author-avatar/author-avatar';
import { IssueText } from '../issue-text/issue-text';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CommitDiff, FileDiff, GitCommit, IssueLinkingSettings, WORKING_HASH } from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { VscodeService } from '../../services/vscode.service';
import { FileTreeRow, buildFileTreeRows } from '../../utils/file-tree';
import { DiffDialog } from '../diff-dialog/diff-dialog';

@Component({
  selector: 'app-commit-detail',
  imports: [ErrorBanner, AuthorAvatar, DatePipe, DiffDialog, IssueText],
  templateUrl: './commit-detail.html',
  styleUrl: './commit-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitDetail implements OnDestroy {
  private readonly git = inject(GitService);
  private readonly vscode = inject(VscodeService);

  readonly commit = input.required<GitCommit>();
  readonly issueLinking = input<IssueLinkingSettings | null>(null);
  /** How the changed-file list is rendered: a flat list or a collapsible directory tree. */
  readonly fileListView = input<'flat' | 'tree'>('flat');
  readonly closed = output<void>();

  protected readonly diff = signal<CommitDiff | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly dialogFile = signal<FileDiff | null>(null);

  /** Collapsed directory paths; keyed by full path so folders stay collapsed
   * across diff reloads. */
  protected readonly collapsed = signal<Set<string>>(new Set());

  /** Rows rendered for the changed files: tree folders plus files, or the flat list. */
  protected readonly rows = computed<FileTreeRow[]>(() => {
    const files = this.diff()?.files ?? [];
    if (this.fileListView() !== 'tree') {
      // Flat view keeps the full path as the row label.
      return files.map((file) => ({ kind: 'file', path: file.path, name: file.path, depth: 0, file }));
    }
    return buildFileTreeRows(files, this.collapsed());
  });

  /** Commit body, fetched on demand because the list payload omits it. */
  protected readonly body = signal('');

  private bodySub: Subscription | null = null;

  protected readonly workingHash = WORKING_HASH;

  protected readonly isWorking = computed(() => this.commit().hash === this.workingHash);

  /** Ref holding the original content of the diff (parent of the commit or HEAD). */
  protected readonly originalRef = computed(() =>
    this.isWorking() ? 'HEAD' : `${this.commit().hash}^`,
  );

  /** Ref holding the modified content of the diff (commit or working tree). */
  protected readonly modifiedRef = computed(() =>
    this.isWorking() ? 'WORKING' : this.commit().hash,
  );

  constructor() {
    effect(() => {
      this.loadDiff(this.commit().hash);
      this.loadBody(this.commit());
    });
  }

  ngOnDestroy(): void {
    this.bodySub?.unsubscribe();
  }

  protected openFile(file: FileDiff): void {
    if (this.vscode.openDiff(file, this.originalRef(), this.modifiedRef())) {
      return;
    }
    this.dialogFile.set(file);
  }

  /** Expands or collapses a directory row. */
  protected toggleDir(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  private loadBody(commit: GitCommit): void {
    this.bodySub?.unsubscribe();
    this.body.set('');

    if (commit.body !== undefined) {
      // Synthetic commits (working tree) carry their body inline.
      this.body.set(commit.body);
      return;
    }

    this.bodySub = this.git.getCommitDetail(commit.hash).subscribe({
      next: (detail) => this.body.set(detail.body ?? ''),
      error: () => this.body.set(''),
    });
  }

  private loadDiff(hash: string): void {
    this.loading.set(true);
    this.error.set('');
    this.diff.set(null);
    this.dialogFile.set(null);

    if (hash === WORKING_HASH) {
      this.git.getWorkingChanges().subscribe({
        next: (changes) => {
          this.loading.set(false);
          this.diff.set({ hash: WORKING_HASH, files: changes.files });
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Failed to load the working changes.');
        },
      });
      return;
    }

    this.git.getCommitDiff(hash).subscribe({
      next: (diff) => {
        this.loading.set(false);
        this.diff.set(diff);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load the commit diff.');
      },
    });
  }
}
