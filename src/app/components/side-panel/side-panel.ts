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
  PrSummary,
  RefBadge,
  StashEntry,
  TagInfo,
  WorktreeInfo,
} from '../../models/git.models';

/**
 * Left sidebar with tree views for pull requests, branches, tags, stashes,
 * and worktrees. Replaces the former branches dropdown in the toolbar.
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
  readonly tags = input.required<TagInfo[]>();
  /** Hash of the commit open in the detail panel; '' = none. */
  readonly selectedCommitHash = input('');
  readonly loading = input(false);
  /** Whether the Azure DevOps integration is configured (URL is set). */
  readonly azureEnabled = input(false);
  /** The signed-in user's pull requests; null while the first load is in flight. */
  readonly pullRequests = input<PrSummary[] | null>(null);
  /** Load error for the pull request list, shown inline in the section. */
  readonly prError = input('');

  readonly branchChange = output<string>();
  readonly tagSelect = output<TagInfo>();
  readonly contextMenu = output<ContextMenuEvent>();
  /** Opens the pull request detail dialog. */
  readonly prSelect = output<number>();
  /** Reloads the pull request list. */
  readonly prRefresh = output<void>();

  protected readonly prsOpen = signal(true);
  protected readonly branchesOpen = signal(true);
  protected readonly tagsOpen = signal(true);
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

  /** Opens the commit a tag points to in the commit table. */
  protected selectTag(tag: TagInfo): void {
    this.tagSelect.emit(tag);
  }

  /** Maps the user's vote to a coloring class for the row status icon. */
  protected voteClass(pr: PrSummary): string {
    switch (pr.myVote) {
      case 10:
        return 'vote-approve';
      case 5:
        return 'vote-suggestions';
      case -5:
        return 'vote-waiting';
      case -10:
        return 'vote-reject';
      default:
        return 'vote-none';
    }
  }

  /** Row tooltip with everything that does not fit the two-line row. */
  protected prTooltip(pr: PrSummary): string {
    const reviewers = pr.reviewers
      .map((reviewer) => `${reviewer.name}${reviewer.isRequired ? ' (required)' : ''}`)
      .join(', ');
    return [
      `!${pr.id} ${pr.title}`,
      `By ${pr.author.name}${pr.isDraft ? ' · draft' : ''}`,
      `${pr.sourceBranch} → ${pr.targetBranch}`,
      reviewers ? `Reviewers: ${reviewers}` : '',
    ]
      .filter(Boolean)
      .join('\n');
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
