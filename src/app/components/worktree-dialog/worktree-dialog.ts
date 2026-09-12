import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, input, output, signal } from '@angular/core';
import { BranchInfo, WorktreeInfo } from '../../models/git.models';
import { VscodeService } from '../../services/vscode.service';

@Component({
  selector: 'app-worktree-dialog',
  templateUrl: './worktree-dialog.html',
  styleUrl: './worktree-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorktreeDialog {
  private readonly vscode = inject(VscodeService);

  readonly branches = input.required<BranchInfo[]>();
  readonly worktrees = input.required<WorktreeInfo[]>();
  readonly busy = input(false);
  readonly error = input('');
  readonly created = output<{ path: string; branch: string }>();
  readonly closed = output<void>();

  protected readonly path = signal('');
  protected readonly branch = signal('');
  protected readonly canBrowse = this.vscode.canPickFolder;
  protected readonly availableBranches = computed(() => {
    const checkedOut = new Set(this.worktrees().map((worktree) => worktree.branch).filter(Boolean));
    return this.branches().filter((candidate) => !candidate.remote && !checkedOut.has(candidate.name));
  });

  constructor() {
    effect(() => {
      const available = this.availableBranches();
      if (!available.some((candidate) => candidate.name === this.branch())) {
        this.branch.set(available[0]?.name ?? '');
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected onPath(event: Event): void {
    this.path.set((event.target as HTMLInputElement).value);
  }

  protected onBranch(event: Event): void {
    this.branch.set((event.target as HTMLSelectElement).value);
  }

  protected async browse(): Promise<void> {
    const path = await this.vscode.pickFolder();
    if (path) this.path.set(path);
  }

  protected submit(): void {
    const path = this.path().trim();
    const branch = this.branch();
    if (path && branch && !this.busy()) this.created.emit({ path, branch });
  }
}
