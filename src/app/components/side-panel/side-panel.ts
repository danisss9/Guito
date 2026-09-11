import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  BranchInfo,
  ContextMenuEvent,
  ContextMenuTarget,
  RefBadge,
  StashEntry,
  WorktreeInfo,
} from '../../models/git.models';

/**
 * Left sidebar with tree views for branches, stashes, and worktrees.
 * Replaces the former branches dropdown in the toolbar.
 */
@Component({
  selector: 'app-side-panel',
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePanel {
  readonly branches = input.required<BranchInfo[]>();
  readonly selectedBranch = input.required<string>();
  readonly showRemote = input.required<boolean>();
  readonly stashes = input.required<StashEntry[]>();
  readonly worktrees = input.required<WorktreeInfo[]>();
  readonly loading = input(false);

  readonly branchChange = output<string>();
  readonly remoteToggle = output<boolean>();
  readonly contextMenu = output<ContextMenuEvent>();

  protected readonly branchesOpen = signal(true);
  protected readonly stashesOpen = signal(true);
  protected readonly worktreesOpen = signal(true);

  protected readonly localBranches = computed(() =>
    this.branches().filter((branch) => !branch.remote),
  );
  protected readonly remoteBranches = computed(() =>
    this.branches().filter((branch) => branch.remote),
  );

  /** Toggles branch selection; clicking the selected branch clears it. */
  protected selectBranch(name: string): void {
    this.branchChange.emit(this.selectedBranch() === name ? '' : name);
  }

  /** Maps a branch row to the badge shape used by the shared context menu. */
  protected badgeOf(branch: BranchInfo): RefBadge {
    return {
      type: branch.current ? 'head' : branch.remote ? 'remote' : 'local',
      name: branch.name,
    };
  }

  protected onContextMenu(event: MouseEvent, target: ContextMenuTarget): void {
    event.preventDefault();
    this.contextMenu.emit({ x: event.clientX, y: event.clientY, target });
  }

  protected onRemoteToggle(event: Event): void {
    this.remoteToggle.emit((event.target as HTMLInputElement).checked);
  }

  /** Folder or worktree name shown as the row label. */
  protected worktreeLabel(worktree: WorktreeInfo): string {
    const name = worktree.path.split(/[\\/]/).filter(Boolean).pop() ?? worktree.path;
    if (worktree.bare) return `${name} (bare)`;
    if (worktree.detached) return `${name} (detached)`;
    return name;
  }

  /** Display name of a stash, e.g. stash@{0}. */
  protected stashLabel(stash: StashEntry): string {
    return `stash@{${stash.index}}`;
  }
}
