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
import { CommitDiff, FileDiff, GitCommit, WORKING_HASH } from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { hashString, laneColor } from '../../utils/graph';
import { DiffDialog } from '../diff-dialog/diff-dialog';

@Component({
  selector: 'app-commit-detail',
  imports: [DatePipe, DiffDialog],
  templateUrl: './commit-detail.html',
  styleUrl: './commit-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitDetail implements OnDestroy {
  private readonly git = inject(GitService);

  readonly commit = input.required<GitCommit>();
  readonly closed = output<void>();

  protected readonly diff = signal<CommitDiff | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly dialogFile = signal<FileDiff | null>(null);

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

  protected readonly initials = computed(() => {
    const name = this.commit().author_name.trim();
    if (!name) {
      return '?';
    }
    const parts = name.split(/\s+/);
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  });

  protected readonly avatarColor = computed(() => laneColor(hashString(this.commit().author_name)));

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
    this.dialogFile.set(file);
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
