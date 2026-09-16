import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ConflictResolution, MergeConflict } from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { ErrorBanner } from '../error-banner/error-banner';

@Component({
  selector: 'app-conflict-dialog',
  imports: [ErrorBanner],
  templateUrl: './conflict-dialog.html',
  styleUrl: './conflict-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConflictDialog implements OnInit {
  private readonly git = inject(GitService);

  readonly path = input.required<string>();
  readonly resolved = output<void>();
  readonly closed = output<void>();

  protected readonly conflict = signal<MergeConflict | null>(null);
  protected readonly result = signal('');
  protected readonly deleted = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.git.getConflict(this.path()).subscribe({
      next: (conflict) => {
        this.conflict.set(conflict);
        this.result.set(conflict.result.content ?? '');
        this.deleted.set(conflict.result.content === null && !conflict.result.binary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Failed to load the merge conflict.');
        this.loading.set(false);
      },
    });
  }

  protected use(side: 'ours' | 'theirs'): void {
    const version = this.conflict()?.[side];
    if (!version || version.binary) return;
    this.deleted.set(version.content === null);
    this.result.set(version.content ?? '');
  }

  protected useBoth(): void {
    const conflict = this.conflict();
    if (!conflict || conflict.ours.binary || conflict.theirs.binary) return;
    this.deleted.set(false);
    const ours = conflict.ours.content ?? '';
    const theirs = conflict.theirs.content ?? '';
    this.result.set(ours && theirs && !ours.endsWith('\n') ? `${ours}\n${theirs}` : `${ours}${theirs}`);
  }

  protected updateResult(event: Event): void {
    this.deleted.set(false);
    this.result.set((event.target as HTMLTextAreaElement).value);
  }

  protected resolve(resolution: ConflictResolution = 'content'): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const effective = this.deleted() ? 'delete' : resolution;
    this.git
      .resolveConflict(this.path(), effective, effective === 'content' ? this.result() : undefined)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.resolved.emit(),
        error: (error) =>
          this.error.set(error?.error?.error || 'Failed to save the conflict resolution.'),
      });
  }
}
