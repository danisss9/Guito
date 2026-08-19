import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommitDiff, DiffLine, GitCommit } from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { hashString, laneColor } from '../../utils/graph';

@Component({
  selector: 'app-commit-detail',
  imports: [DatePipe],
  templateUrl: './commit-detail.html',
  styleUrl: './commit-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitDetail {
  private readonly git = inject(GitService);

  readonly commit = input.required<GitCommit>();
  readonly closed = output<void>();

  protected readonly diff = signal<CommitDiff | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

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
    });
  }

  protected marker(type: DiffLine['type']): string {
    if (type === 'add') {
      return '+';
    }
    if (type === 'del') {
      return '-';
    }
    return '';
  }

  private loadDiff(hash: string): void {
    this.loading.set(true);
    this.error.set('');
    this.diff.set(null);

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
