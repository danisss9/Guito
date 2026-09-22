import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
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
import { RefTreeRow, buildRefTreeRows, flatRefRows } from '../../utils/ref-tree';
import { normalizeSearchText } from '../../utils/search-text';

/** Height of one row in a windowed section; must match `.row` in side-panel.css. */
const PANEL_ROW_HEIGHT = 24;
/** Extra rows rendered above and below the viewport in windowed sections. */
const PANEL_WINDOW_BUFFER = 10;

/** One uniformly tall line of the windowed branch section body. */
type BranchSectionItem =
  | { type: 'loading' }
  | { type: 'all' }
  | { type: 'label'; text: 'Local' | 'Remote' }
  | { type: 'row'; group: 'local' | 'remote'; row: RefTreeRow<BranchInfo> };

/** One uniformly tall line of the windowed tag section body. */
type TagSectionItem = { type: 'loading' } | { type: 'row'; row: RefTreeRow<TagInfo> };

/** Visible row range of a windowed section, with its spacer heights. */
interface PanelWindow {
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
}

/**
 * Computes the row window of a virtualized section: the rows overlapping
 * the panel viewport plus a buffer on both sides, with the spacer heights
 * that stand in for the hidden rows. Results are clamped, so a stale body
 * offset can only shift the window, never slice out of bounds.
 */
function panelWindowRange(
  scrollTop: number,
  viewportHeight: number,
  offsetTop: number,
  total: number,
): PanelWindow {
  const first = Math.floor((scrollTop - offsetTop) / PANEL_ROW_HEIGHT) - PANEL_WINDOW_BUFFER;
  const last =
    Math.ceil((scrollTop + viewportHeight - offsetTop) / PANEL_ROW_HEIGHT) + PANEL_WINDOW_BUFFER;
  const start = Math.max(0, Math.min(first, total));
  const end = Math.max(start, Math.min(Math.max(last, 0), total));
  return {
    start,
    end,
    padTop: start * PANEL_ROW_HEIGHT,
    padBottom: (total - end) * PANEL_ROW_HEIGHT,
  };
}

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
  /** Names of the branches whose history is shown; [] = all branches. */
  readonly selectedBranches = input.required<string[]>();
  readonly showRemote = input.required<boolean>();
  readonly stashes = input.required<StashEntry[]>();
  readonly worktrees = input.required<WorktreeInfo[]>();
  readonly tags = input.required<TagInfo[]>();
  /** Whether branches and tags nest into collapsible namespace folders. */
  readonly refListView = input<'flat' | 'tree'>('flat');
  /** Whether panel filtering preserves case and accents. */
  readonly searchCaseSensitive = input(false);
  /** Initial state for every top-level section. */
  readonly sectionsExpandedByDefault = input(true);
  /** Hash of the commit open in the detail panel; '' = none. */
  readonly selectedCommitHash = input('');
  readonly loading = input(false);
  /**
   * Loading flag delayed by a short grace period: fast loads (data already
   * cached or a snappy repository) never flash the "Loading..." notices,
   * while slow ones still get feedback after the delay elapses.
   */
  protected readonly showLoading = signal(false);
  /** Whether the Azure DevOps integration is configured (URL is set). */
  readonly azureEnabled = input(false);
  /** The signed-in user's pull requests; null while the first load is in flight. */
  readonly pullRequests = input<PrSummary[] | null>(null);
  /** Load error for the pull request list, shown inline in the section. */
  readonly prError = input('');

  readonly branchChange = output<string[]>();
  readonly tagSelect = output<TagInfo>();
  /** Opens a stash in the commit detail pane so its changed files are visible. */
  readonly stashSelect = output<StashEntry>();
  readonly contextMenu = output<ContextMenuEvent>();
  readonly worktreeCreate = output<void>();
  /** Opens a worktree as its own repository context in the VS Code host. */
  readonly worktreeOpen = output<WorktreeInfo>();
  /** Opens the pull request detail dialog. */
  readonly prSelect = output<number>();
  /** Reloads the pull request list. */
  readonly prRefresh = output<void>();

  protected readonly prsOpen = linkedSignal(() => this.sectionsExpandedByDefault());
  protected readonly branchesOpen = linkedSignal(() => this.sectionsExpandedByDefault());
  protected readonly tagsOpen = linkedSignal(() => this.sectionsExpandedByDefault());
  protected readonly stashesOpen = linkedSignal(() => this.sectionsExpandedByDefault());
  protected readonly worktreesOpen = linkedSignal(() => this.sectionsExpandedByDefault());

  /** Current text of the panel search bar; empty = show everything. */
  protected readonly filter = signal('');

  /** Normalized, trimmed filter text; '' means "no filter". */
  protected readonly filterText = computed(() =>
    normalizeSearchText(this.filter().trim(), this.searchCaseSensitive()),
  );
  /** Whether the filter is active; sections then only show matching rows. */
  protected readonly filtering = computed(() => this.filterText() !== '');

  protected onFilterInput(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected clearFilter(): void {
    this.filter.set('');
  }

  /** While filtering, every section expands so matches stay visible. */
  protected readonly branchesExpanded = computed(() => this.filtering() || this.branchesOpen());
  protected readonly tagsExpanded = computed(() => this.filtering() || this.tagsOpen());
  protected readonly stashesExpanded = computed(() => this.filtering() || this.stashesOpen());
  protected readonly worktreesExpanded = computed(() => this.filtering() || this.worktreesOpen());
  protected readonly prsExpanded = computed(() => this.filtering() || this.prsOpen());

  /** Whether every currently available top-level section is open. */
  protected readonly allSectionsOpen = computed(
    () =>
      this.branchesOpen() &&
      this.tagsOpen() &&
      this.stashesOpen() &&
      this.worktreesOpen() &&
      (!this.azureEnabled() || this.prsOpen()),
  );

  /** Opens every section, or closes every section when they are already open. */
  protected toggleAllSections(): void {
    const open = !this.allSectionsOpen();
    this.branchesOpen.set(open);
    this.tagsOpen.set(open);
    this.stashesOpen.set(open);
    this.worktreesOpen.set(open);
    this.prsOpen.set(open);
  }

  protected readonly localBranches = computed(() =>
    this.branches().filter((branch) => !branch.remote),
  );
  protected readonly remoteBranches = computed(() =>
    this.branches().filter((branch) => branch.remote),
  );

  /** Collapsed namespace folders of the local-branch, remote-branch and tag trees. */
  private readonly localDirsCollapsed = signal(new Set<string>());
  private readonly remoteDirsCollapsed = signal(new Set<string>());
  private readonly tagDirsCollapsed = signal(new Set<string>());

  /** Refs whose full name contains the filter text; all refs when unfiltered. */
  private filterRefs<T extends { name: string }>(refs: T[]): T[] {
    if (!this.filtering()) return refs;
    return refs.filter((ref) => this.matchesFilter(ref.name));
  }

  private matchesFilter(value: string): boolean {
    return normalizeSearchText(value, this.searchCaseSensitive()).includes(this.filterText());
  }

  /**
   * Renderable rows; flat view shows every ref with its full name at depth 0.
   * While filtering, matching refs always render flat with their full names,
   * regardless of the tree view, so their namespace path stays readable.
   */
  protected readonly localBranchRows = computed<RefTreeRow<BranchInfo>[]>(() => {
    if (this.filtering()) return flatRefRows(this.filterRefs(this.localBranches()));
    return this.refListView() === 'tree'
      ? buildRefTreeRows(this.localBranches(), this.localDirsCollapsed())
      : flatRefRows(this.localBranches());
  });
  protected readonly remoteBranchRows = computed<RefTreeRow<BranchInfo>[]>(() => {
    if (this.filtering()) return flatRefRows(this.filterRefs(this.remoteBranches()));
    return this.refListView() === 'tree'
      ? buildRefTreeRows(this.remoteBranches(), this.remoteDirsCollapsed())
      : flatRefRows(this.remoteBranches());
  });
  protected readonly tagRows = computed<RefTreeRow<TagInfo>[]>(() => {
    if (this.filtering()) return flatRefRows(this.filterRefs(this.tags()));
    return this.refListView() === 'tree'
      ? buildRefTreeRows(this.tags(), this.tagDirsCollapsed())
      : flatRefRows(this.tags());
  });

  // ---- Virtual scrolling ----
  // Repositories can hold thousands of branches and tags, so the branch and
  // tag section bodies render only the rows overlapping the viewport (plus a
  // buffer) between two spacer divs that keep the native scrollbar sized for
  // the full list. Every other section stays small and fully rendered.

  /**
   * The branch body flattened into one stream of uniform 24px rows: the
   * loading notice, the "All Branches" row, the Local/Remote labels and
   * every branch row in display order. Labels of groups the filter emptied
   * are left out instead of hidden, keeping the row math exact.
   */
  protected readonly branchSectionRows = computed<BranchSectionItem[]>(() => {
    const items: BranchSectionItem[] = [];
    if (this.showLoading()) items.push({ type: 'loading' });
    items.push({ type: 'all' });
    const local = this.localBranchRows();
    if (!this.filtering() || local.length > 0) items.push({ type: 'label', text: 'Local' });
    for (const row of local) items.push({ type: 'row', group: 'local', row });
    if (this.showRemote()) {
      const remote = this.remoteBranchRows();
      if (!this.filtering() || remote.length > 0) items.push({ type: 'label', text: 'Remote' });
      for (const row of remote) items.push({ type: 'row', group: 'remote', row });
    }
    return items;
  });

  /** The tag body flattened the same way; tags have no group labels. */
  protected readonly tagSectionRows = computed<TagSectionItem[]>(() => {
    const rows: TagSectionItem[] = this.tagRows().map((row) => ({ type: 'row', row }));
    return this.showLoading() ? [{ type: 'loading' }, ...rows] : rows;
  });

  private readonly zone = inject(NgZone);
  private readonly panelEl = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly branchBodyEl = viewChild<ElementRef<HTMLElement>>('branchBody');
  private readonly tagBodyEl = viewChild<ElementRef<HTMLElement>>('tagBody');

  private readonly scrollTop = signal(0);
  /** Panel viewport height; 0 while the panel is hidden. */
  private readonly panelHeight = signal(0);
  /** Distance of each windowed body from the panel content top. */
  private readonly branchBodyTop = signal(0);
  private readonly tagBodyTop = signal(0);

  private readonly branchWindow = computed(() =>
    panelWindowRange(
      this.scrollTop(),
      this.panelHeight(),
      this.branchBodyTop(),
      this.branchSectionRows().length,
    ),
  );
  private readonly tagWindow = computed(() =>
    panelWindowRange(
      this.scrollTop(),
      this.panelHeight(),
      this.tagBodyTop(),
      this.tagSectionRows().length,
    ),
  );

  /** Branch rows overlapping the viewport, shown between the two spacers. */
  protected readonly branchSlice = computed(() => {
    const win = this.branchWindow();
    return this.branchSectionRows().slice(win.start, win.end);
  });
  protected readonly branchPadTop = computed(() => this.branchWindow().padTop);
  protected readonly branchPadBottom = computed(() => this.branchWindow().padBottom);

  protected readonly tagSlice = computed(() => {
    const win = this.tagWindow();
    return this.tagSectionRows().slice(win.start, win.end);
  });
  protected readonly tagPadTop = computed(() => this.tagWindow().padTop);
  protected readonly tagPadBottom = computed(() => this.tagWindow().padBottom);

  constructor() {
    // Raise the delayed loading flag only when loading outlasts the grace
    // period; clearing stays immediate so rows appear the moment data lands.
    effect((onCleanup) => {
      if (!this.loading()) {
        this.showLoading.set(false);
        return;
      }
      const timer = setTimeout(() => this.zone.run(() => this.showLoading.set(true)), 200);
      onCleanup(() => clearTimeout(timer));
    });
    effect((onCleanup) => {
      const element = this.panelEl().nativeElement;
      const measure = () => this.measureScroll();
      const observer = new ResizeObserver(() => this.zone.run(measure));
      observer.observe(element);
      element.addEventListener('scroll', measure, { passive: true });
      onCleanup(() => {
        observer.disconnect();
        element.removeEventListener('scroll', measure);
      });
    });
    // Section offsets shift whenever the layout above or inside the windowed
    // bodies changes; re-measure once the DOM has settled. panelHeight covers
    // the panel appearing from its hidden state.
    afterRenderEffect(() => {
      this.branchesExpanded();
      this.tagsExpanded();
      this.filtering();
      this.branchCount();
      this.branchSectionRows().length;
      this.tagSectionRows().length;
      this.panelHeight();
      untracked(() => this.measureOffsets());
    });
  }

  /** Stable row identity so scrolling reuses DOM nodes at the window edges. */
  protected trackBranchItem(_index: number, item: BranchSectionItem): string {
    switch (item.type) {
      case 'loading':
        return 'loading';
      case 'all':
        return 'all';
      case 'label':
        return `label:${item.text}`;
      default:
        return `${item.group}:${item.row.kind}:${item.row.path}`;
    }
  }

  protected trackTagItem(_index: number, item: TagSectionItem): string {
    return item.type === 'loading' ? 'loading' : `${item.row.kind}:${item.row.path}`;
  }

  private measureScroll(): void {
    const element = this.panelEl().nativeElement;
    this.scrollTop.set(element.scrollTop);
    this.panelHeight.set(element.clientHeight);
  }

  private measureOffsets(): void {
    const branch = this.branchBodyEl();
    const tags = this.tagBodyEl();
    if (branch) this.branchBodyTop.set(branch.nativeElement.offsetTop);
    if (tags) this.tagBodyTop.set(tags.nativeElement.offsetTop);
  }

  /** Section-header counts; while filtering, the number of visible matches. */
  protected readonly branchCount = computed(() => {
    if (!this.filtering()) return this.branches().length;
    const leafCount = (rows: RefTreeRow<BranchInfo>[]) =>
      rows.filter((row) => row.kind === 'ref').length;
    let count = leafCount(this.localBranchRows());
    if (this.showRemote()) count += leafCount(this.remoteBranchRows());
    return count;
  });
  protected readonly tagCount = computed(() =>
    this.filtering() ? this.tagRows().length : this.tags().length,
  );

  /** Stashes whose label or message contains the filter text. */
  protected readonly filteredStashes = computed(() => {
    const stashes = this.stashes();
    if (!this.filtering()) return stashes;
    return stashes.filter(
      (stash) => this.matchesFilter(this.stashLabel(stash)) || this.matchesFilter(stash.message),
    );
  });
  protected readonly stashCount = computed(() =>
    this.filtering() ? this.filteredStashes().length : this.stashes().length,
  );

  /** Worktrees matching by folder name, branch or full path. */
  protected readonly filteredWorktrees = computed(() => {
    const worktrees = this.worktrees();
    if (!this.filtering()) return worktrees;
    return worktrees.filter(
      (worktree) =>
        this.matchesFilter(this.worktreeLabel(worktree)) ||
        this.matchesFilter(worktree.branch ?? '') ||
        this.matchesFilter(worktree.path),
    );
  });
  protected readonly worktreeCount = computed(() =>
    this.filtering() ? this.filteredWorktrees().length : this.worktrees().length,
  );

  /** Pull requests matching by id, title, branches or author. */
  protected readonly filteredPullRequests = computed(() => {
    const pullRequests = this.pullRequests();
    if (pullRequests === null || !this.filtering()) return pullRequests;
    return pullRequests.filter(
      (pr) =>
        this.matchesFilter(pr.title) ||
        this.matchesFilter(pr.sourceBranch) ||
        this.matchesFilter(pr.targetBranch) ||
        this.matchesFilter(pr.author.name),
    );
  });
  protected readonly prCount = computed(() => {
    if (!this.filtering()) return (this.pullRequests() ?? []).length;
    return (this.filteredPullRequests() ?? []).length;
  });

  /** Expands or collapses one namespace folder of the given tree. */
  protected toggleDir(tree: 'local' | 'remote' | 'tag', path: string): void {
    const collapsedSignal =
      tree === 'local'
        ? this.localDirsCollapsed
        : tree === 'remote'
          ? this.remoteDirsCollapsed
          : this.tagDirsCollapsed;
    collapsedSignal.update((collapsed) => {
      const next = new Set(collapsed);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  /** First branch of the most recent click; the fixed end of shift ranges. */
  private selectionAnchor: string | null = null;

  /**
   * Branch names in visible row order (local group, then remote group); the
   * coordinate system for shift-click range selection.
   */
  private readonly branchOrder = computed(() => {
    const leafNames = (rows: RefTreeRow<BranchInfo>[]) =>
      rows.filter((row) => row.kind === 'ref').map((row) => row.ref.name);
    return [...leafNames(this.localBranchRows()), ...leafNames(this.remoteBranchRows())];
  });

  /**
   * Applies a branch-row click:
   * - plain click selects that branch (clicking it again shows all);
   * - ctrl/cmd-click toggles the branch in the selection;
   * - shift-click selects the whole range since the last plain click.
   */
  protected selectBranch(name: string, event: MouseEvent): void {
    const current = this.selectedBranches();
    const order = this.branchOrder();
    let next: string[];

    if (event.shiftKey) {
      const anchor = this.selectionAnchor ?? name;
      const from = order.indexOf(anchor);
      const to = order.indexOf(name);
      next =
        from === -1 || to === -1 ? [name] : order.slice(Math.min(from, to), Math.max(from, to) + 1);
    } else if (event.ctrlKey || event.metaKey) {
      next = current.includes(name)
        ? current.filter((selected) => selected !== name)
        : [...current, name];
      this.selectionAnchor = name;
    } else {
      next = current.length === 1 && current[0] === name ? [] : [name];
      this.selectionAnchor = name;
    }

    this.branchChange.emit(next);
  }

  /** Shows the commits of every branch. */
  protected selectAllBranches(): void {
    this.selectionAnchor = null;
    this.branchChange.emit([]);
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

  protected openWorktree(worktree: WorktreeInfo): void {
    if (!worktree.bare) this.worktreeOpen.emit(worktree);
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
