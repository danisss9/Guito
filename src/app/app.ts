import { ErrorBanner } from "./components/error-banner/error-banner";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { Subscription } from "rxjs";
import { forkJoin, Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { CommitDetail } from "./components/commit-detail/commit-detail";
import { CommitTable } from "./components/commit-table/commit-table";
import { ContextMenu } from "./components/context-menu/context-menu";
import { CreatePrDialog } from "./components/create-pr-dialog/create-pr-dialog";
import {
  GuitoSettingsUpdate,
  SettingsDialog,
} from "./components/settings-dialog/settings-dialog";
import { PromptDialog } from "./components/prompt-dialog/prompt-dialog";
import { PrDialog } from "./components/pr-dialog/pr-dialog";
import { SidePanel } from "./components/side-panel/side-panel";
import { WorkingPanel } from "./components/working-panel/working-panel";
import { WorktreeDialog } from "./components/worktree-dialog/worktree-dialog";
import { Toolbar, RemoteAction } from "./components/toolbar/toolbar";
import {
  AzureSettings,
  BranchInfo,
  CommitsResponse,
  ContextMenuState,
  GitCommit,
  GitIdentity,
  RepositoryState,
  MenuItem,
  PromptState,
  PrSummary,
  StashEntry,
  StashScope,
  TagInfo,
  WORKING_HASH,
  WorkingChanges,
  WorktreeInfo,
} from "./models/git.models";
import { GitService } from "./services/git.service";
import { VscodeService } from "./services/vscode.service";
import { authenticatedApiUrl } from "./utils/session";
import { loadJson, saveJson } from "./utils/storage";

/** Number of commits fetched from the server per request. */
const LOAD_PAGE_SIZE = 500;

/** localStorage key holding the persisted commit message draft. */
const COMMIT_DRAFT_KEY = "guito.commitDraft";

interface CommitDraft {
  subject: string;
  description: string;
}

function loadCommitDraft(): CommitDraft {
  const draft = loadJson<Partial<CommitDraft>>(COMMIT_DRAFT_KEY, {});
  return {
    subject: typeof draft.subject === "string" ? draft.subject : "",
    description: typeof draft.description === "string" ? draft.description : "",
  };
}

@Component({
  selector: "app-root",
  imports: [
    ErrorBanner,
    Toolbar,
    SidePanel,
    CommitTable,
    CommitDetail,
    ContextMenu,
    PromptDialog,
    WorkingPanel,
    CreatePrDialog,
    SettingsDialog,
    PrDialog,
    WorktreeDialog,
  ],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {
  private readonly git = inject(GitService);
  private readonly vscode = inject(VscodeService);

  protected readonly workingHash = WORKING_HASH;
  protected readonly mutationBusy = this.git.mutating;
  protected readonly statusLoading = signal(false);
  protected readonly statusError = signal("");
  /** Commit message draft, persisted across sessions. */
  private readonly commitDraft = loadCommitDraft();
  protected readonly commitSubject = signal(this.commitDraft.subject);
  protected readonly commitDescription = signal(this.commitDraft.description);
  protected readonly displayedCommits = signal<GitCommit[]>([]);
  protected readonly searchLoading = signal(false);
  private readonly historyGeneration = signal(0);
  private readonly filterFailed = signal(false);
  protected readonly tableLoading = computed(() =>
    this.loading()
      ? "Refreshing commits..."
      : this.searchLoading() || (this.search().trim() && this.historyLoading())
        ? "Searching commits..."
        : this.historyLoading()
          ? "Loading history..."
          : "",
  );

  protected readonly commits = signal<GitCommit[]>([]);
  protected readonly branches = signal<BranchInfo[]>([]);
  protected readonly selectedBranch = signal("");
  protected readonly showRemote = signal(true);
  protected readonly search = signal("");
  protected readonly selectedCommit = signal<GitCommit | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal("");
  protected readonly repoName = signal("");
  protected readonly identity = signal<GitIdentity>({ name: "", email: "" });
  private lastRepositoryState: RepositoryState | null = null;
  private stateSub: Subscription | null = null;
  private readonly refreshTimer = window.setInterval(
    () => this.checkRepository(),
    3000,
  );
  protected readonly workingChanges = signal<WorkingChanges | null>(null);
  protected readonly totalCommits = signal(0);
  protected readonly historyLoading = signal(false);
  protected readonly contextMenuState = signal<ContextMenuState | null>(null);
  protected readonly contextMenuTarget = signal<any>(null);
  protected readonly promptState = signal<PromptState | null>(null);
  /** Azure DevOps integration settings; null until the first refresh. */
  protected readonly azureSettings = signal<AzureSettings | null>(null);
  protected readonly hasAzureUrl = computed(
    () => !!this.azureSettings()?.azureDevOpsUrl,
  );
  /** Automatic reloading can be disabled with the guito.autoReload setting. */
  protected readonly autoReload = computed(
    () => this.azureSettings()?.autoReload !== false,
  );
  /** The commit graph column can be hidden from the settings menu. */
  protected readonly showGraph = computed(
    () => this.azureSettings()?.showGraph !== false,
  );
  /** Stash rows in the commit table stay hidden until the settings enable them. */
  protected readonly showStashes = computed(
    () => this.azureSettings()?.showStashes === true,
  );
  protected readonly showTags = computed(
    () => this.azureSettings()?.showTags !== false,
  );
  protected readonly issueLinking = computed(
    () => this.azureSettings()?.issueLinking ?? null,
  );
  /** Whether changed-file lists render as a directory tree instead of a flat list. */
  protected readonly fileListView = computed(() =>
    this.azureSettings()?.fileListView === "tree" ? "tree" : "flat",
  );
  /** Whether commit search shows only matches instead of navigating through history. */
  protected readonly filterSearch = computed(
    () => this.azureSettings()?.searchMode === "filter",
  );
  /** Whether commit search matches the query's exact letter casing. */
  protected readonly searchCaseSensitive = computed(
    () => this.azureSettings()?.searchCaseSensitive === true,
  );
  /** Whether the Create Pull Request dialog is open. */
  protected readonly prDialogOpen = signal(false);
  /** Full standalone settings dialog; VS Code uses its native Settings editor instead. */
  protected readonly settingsDialogOpen = signal(false);
  protected readonly settingsSaving = signal(false);
  /** Files awaiting confirmation for the unstaged-discard dialog. */
  private readonly pendingDiscard = signal<string[] | null>(null);

  /** Whether the left repository panel (branches, tags, stashes, worktrees) is open. */
  protected readonly panelOpen = signal(false);
  protected readonly panelLoading = signal(false);
  protected readonly stashes = signal<StashEntry[]>([]);
  protected readonly worktrees = signal<WorktreeInfo[]>([]);
  protected readonly worktreeDialogOpen = signal(false);
  protected readonly worktreeDialogError = signal("");
  protected readonly tags = signal<TagInfo[]>([]);

  /** The signed-in user's Azure DevOps pull requests; null until first load. */
  protected readonly pullRequests = signal<PrSummary[] | null>(null);
  protected readonly pullRequestsError = signal("");
  /** Id of the pull request open in the PR detail dialog; null = closed. */
  protected readonly prDetailId = signal<number | null>(null);

  /** Hash of the focused search match; '' = none focused. */
  protected readonly searchFocusHash = signal("");
  /** Match awaiting focus while pages are still being loaded. */
  private readonly pendingSearchHash = signal("");
  /** Scroll request for the commit table; the id re-triggers same-hash scrolls. */
  protected readonly scrollRequest = signal<{
    hash: string;
    id: number;
  } | null>(null);
  private scrollRequestCounter = 0;

  /**
   * Hashes of commits whose body matches the current search, in history
   * order. The list payload omits bodies, so body matching is done by the
   * server across the whole history.
   */
  protected readonly bodyMatches = signal<string[]>([]);
  private readonly searchHistoryIndices = signal<Record<string, number>>({});

  // In-flight requests; unsubscribing aborts the HTTP call and supersedes it.
  private refreshSub: Subscription | null = null;
  private historySub: Subscription | null = null;
  private workingSub: Subscription | null = null;
  private searchSub: Subscription | null = null;
  private panelSub: Subscription | null = null;
  private prListSub: Subscription | null = null;

  /** Commits known to exist in the repository but not yet fetched. */
  protected readonly unloadedCommits = computed(() =>
    Math.max(0, this.totalCommits() - this.commits().length),
  );

  private readonly commitIndex = computed(() => {
    const byHash = new Map<string, GitCommit>();
    for (const commit of this.commits()) {
      byHash.set(commit.hash, commit);
    }
    return byHash;
  });

  protected readonly filteredCommits = computed(() => {
    let list = this.commits();

    const selectedBranch = this.selectedBranch();
    const visibleBranches = this.branches().filter(
      (branch) => this.showRemote() || !branch.remote,
    );
    const branchesToShow = selectedBranch
      ? visibleBranches.filter((branch) => branch.name === selectedBranch)
      : visibleBranches;

    if (branchesToShow.length > 0) {
      const visibleHashes = new Set<string>();
      for (const branch of branchesToShow) {
        for (const hash of this.ancestorsOf(branch.commit)) {
          visibleHashes.add(hash);
        }
      }
      list = list.filter((commit) => visibleHashes.has(commit.hash));
    } else {
      list = [];
    }

    // Branch visibility applies in both search modes.
    return list;
  });

  /** Hashes of commits matching the search, in display order. */
  protected readonly searchMatches = computed(() => {
    const rawQuery = this.search().trim();
    const caseSensitive = this.searchCaseSensitive();
    const query = caseSensitive ? rawQuery : rawQuery.toLowerCase();
    if (!query) {
      return [];
    }
    const bodySet = new Set(this.bodyMatches());
    const loaded = this.filteredCommits()
      .filter(
        (commit) =>
          (caseSensitive
            ? commit.message
            : commit.message.toLowerCase()
          ).includes(query) ||
          (caseSensitive
            ? commit.author_name
            : commit.author_name.toLowerCase()
          ).includes(query) ||
          (caseSensitive ? commit.hash : commit.hash.toLowerCase()).startsWith(
            query,
          ) ||
          bodySet.has(commit.hash),
      )
      .map((commit) => commit.hash);
    const loadedSet = new Set(loaded);
    // Server matches outside the loaded pages follow, in history order.
    const rest = this.bodyMatches().filter((hash) => !loadedSet.has(hash));
    return [...loaded, ...rest];
  });

  /** 0-based position of the focused match within searchMatches; -1 = none. */
  protected readonly searchIndex = computed(() => {
    const hash = this.searchFocusHash();
    return hash ? this.searchMatches().indexOf(hash) : -1;
  });

  constructor() {
    this.refresh();

    // Only a new filter or history generation starts requests. A failed request
    // must not retrigger itself by clearing its loading flag.
    effect(() => {
      const query = this.search().trim();
      this.selectedBranch();
      this.historyGeneration();
      this.filterSearch();
      const caseSensitive = this.searchCaseSensitive();
      untracked(() => {
        this.searchSub?.unsubscribe();
        this.searchLoading.set(false);
        this.bodyMatches.set([]);
        this.searchHistoryIndices.set({});
        this.filterFailed.set(false);
        this.error.set("");
        this.searchFocusHash.set("");
        this.pendingSearchHash.set("");
        if (this.loading()) return;
        // Branch filtering is client-side, so the full history is needed.
        if (
          (this.selectedBranch() || (query && this.filterSearch())) &&
          this.unloadedCommits() > 0
        )
          this.loadAllCommits();
        if (query) this.fetchBodyMatches(query, caseSensitive);
      });
    });
    effect(() => {
      if (
        !this.loading() &&
        !this.searchLoading() &&
        !this.historyLoading() &&
        !this.filterFailed()
      ) {
        const matches = new Set(this.searchMatches());
        this.displayedCommits.set(
          this.filterSearch() && this.search().trim()
            ? this.filteredCommits().filter((commit) =>
                matches.has(commit.hash),
              )
            : this.filteredCommits(),
        );
      }
    });

    // Focus a search match once it is displayed; while it is still unloaded,
    // fetch the missing history through its page in a single request.
    effect(() => {
      const hash = this.pendingSearchHash();
      if (!hash) return;
      if (this.filterFailed()) return;
      const match = this.displayedCommits().find(
        (commit) => commit.hash === hash,
      );
      if (match) {
        untracked(() => {
          this.selectedCommit.set(match);
          this.scrollRequestCounter += 1;
          this.scrollRequest.set({ hash, id: this.scrollRequestCounter });
          this.pendingSearchHash.set("");
        });
      } else if (
        this.unloadedCommits() > 0 &&
        !this.historyLoading() &&
        !this.loading()
      ) {
        const index = this.searchHistoryIndices()[hash];
        const skip = this.commits().length;
        if (index !== undefined && index < skip) {
          // Already loaded but hidden by the active branch filter.
          this.pendingSearchHash.set("");
          return;
        }
        const limit =
          index === undefined
            ? undefined
            : Math.ceil((index + 1 - skip) / LOAD_PAGE_SIZE) * LOAD_PAGE_SIZE;
        untracked(() => this.loadHistory(this.git.getCommits(limit, skip)));
      } else if (!this.historyLoading() && !this.loading()) {
        // The match never appeared (e.g. outside the selected branch).
        this.pendingSearchHash.set("");
      }
    });

    // Persist the commit message draft as it is typed; clearing it after a
    // successful commit persists the cleared state too.
    effect(() => {
      saveJson(COMMIT_DRAFT_KEY, {
        subject: this.commitSubject(),
        description: this.commitDescription(),
      });
    });

    // VS Code settings are owned by the extension host. Refresh the effective
    // values after its webview bridge reports that they changed.
    effect(() => {
      if (this.vscode.settingsVersion() === 0) return;
      untracked(() => {
        this.git.getSettings().subscribe({
          next: (settings) => {
            this.azureSettings.set(settings);
            this.showRemote.set(settings.showRemoteBranches !== false);
          },
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      });
    });
  }

  ngOnDestroy(): void {
    window.clearInterval(this.refreshTimer);
    this.stateSub?.unsubscribe();
    this.refreshSub?.unsubscribe();
    this.historySub?.unsubscribe();
    this.workingSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    this.panelSub?.unsubscribe();
    this.prListSub?.unsubscribe();
  }

  @HostListener("window:focus")
  @HostListener("document:visibilitychange")
  protected checkRepository(): void {
    if (
      !this.autoReload() ||
      document.hidden ||
      this.loading() ||
      this.historyLoading() ||
      this.statusLoading() ||
      this.busy() ||
      this.mutationBusy() ||
      (this.stateSub && !this.stateSub.closed)
    )
      return;
    this.stateSub = this.git.getRepositoryState().subscribe({
      next: (state) => {
        // A user action may have started while the probe was in flight.
        if (
          this.loading() ||
          this.historyLoading() ||
          this.statusLoading() ||
          this.busy() ||
          this.mutationBusy()
        )
          return;
        const previous = this.lastRepositoryState;
        this.lastRepositoryState = state;
        if (!previous || previous.history !== state.history) this.refresh(true);
        else if (previous.working !== state.working) this.refreshWorking();
      },
      error: () => {
        /* Retry on the next interval or when focus returns. */
      },
    });
  }

  /** Opens/closes the left repository panel, loading its data on open. */
  protected toggleSidePanel(): void {
    this.panelOpen.update((open) => !open);
    if (this.panelOpen()) this.loadSidePanelData();
  }

  /** Loads stashes, worktrees and tags shown in the left repository panel. */
  private loadSidePanelData(): void {
    this.panelSub?.unsubscribe();
    this.panelLoading.set(true);
    this.panelSub = forkJoin({
      stashes: this.git.getStashes(),
      worktrees: this.git.getWorktrees(),
      tags: this.git.getTags().pipe(catchError(() => of([] as TagInfo[]))),
    }).subscribe({
      next: ({ stashes, worktrees, tags }) => {
        this.stashes.set(stashes);
        this.worktrees.set(worktrees);
        this.tags.set(tags);
        this.panelLoading.set(false);
      },
      error: (err) => {
        this.panelLoading.set(false);
        this.error.set(this.errorMessage(err));
      },
    });
    this.loadPullRequests();
  }

  /**
   * Loads the signed-in user's pull requests for the side panel list. No-op
   * without the Azure DevOps URL; failures only mark the section, never the app.
   */
  protected loadPullRequests(): void {
    if (!this.hasAzureUrl()) {
      this.pullRequests.set(null);
      this.pullRequestsError.set("");
      return;
    }
    this.prListSub?.unsubscribe();
    this.prListSub = this.git.getMyPullRequests().subscribe({
      next: (pullRequests) => {
        this.pullRequests.set(pullRequests);
        this.pullRequestsError.set("");
      },
      error: (err) => {
        if (this.pullRequests() === null) {
          this.pullRequests.set([]);
        }
        this.pullRequestsError.set(this.errorMessage(err));
      },
    });
  }

  /** Opens the pull request detail dialog for a side panel row. */
  protected openPrDetail(id: number): void {
    this.prDetailId.set(id);
  }

  /** Closes the PR dialog and refreshes the list (votes/status may have changed). */
  protected closePrDetail(): void {
    this.prDetailId.set(null);
    this.loadPullRequests();
  }

  protected refresh(automatic = false): void {
    // A refresh supersedes any in-flight history page or working-tree request.
    this.historySub?.unsubscribe();
    this.workingSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    this.searchLoading.set(false);
    this.filterFailed.set(false);
    this.statusLoading.set(true);
    this.historyLoading.set(false);
    this.loading.set(true);
    this.error.set("");

    this.refreshSub?.unsubscribe();
    this.refreshSub = forkJoin({
      history: this.git.getCommits(
        automatic
          ? Math.max(LOAD_PAGE_SIZE, this.commits().length)
          : LOAD_PAGE_SIZE,
      ),
      repositoryState: this.git
        .getRepositoryState()
        .pipe(catchError(() => of(null))),
      branches: this.git.getAllBranches(),
      repo: this.git.getRepoInfo(),
      settings: this.git.getSettings().pipe(catchError(() => of(null))),
      // The commit table shows stash rows even when the side panel is closed.
      stashes: this.git
        .getStashes()
        .pipe(catchError(() => of([] as StashEntry[]))),
      working: this.git.getWorkingChanges().pipe(
        catchError((err) => {
          this.lastRepositoryState = null;
          this.statusError.set(this.errorMessage(err));
          return of(null);
        }),
      ),
    }).subscribe({
      next: ({
        history,
        repositoryState,
        branches,
        repo,
        settings,
        stashes,
        working,
      }) => {
        this.commits.set(history.commits);
        this.totalCommits.set(Math.max(history.total, history.commits.length));
        if (repositoryState) this.lastRepositoryState = repositoryState;
        this.branches.set(branches);
        this.repoName.set(repo.name);
        this.identity.set(repo.identity ?? { name: "", email: "" });
        this.stashes.set(stashes);
        if (
          this.selectedBranch() &&
          !branches.some((branch) => branch.name === this.selectedBranch())
        ) {
          this.selectedBranch.set("");
        }
        const selected = this.selectedCommit();
        if (selected && selected.hash !== WORKING_HASH) {
          const updated = history.commits.find(
            (commit) => commit.hash === selected.hash,
          );
          if (updated) this.selectedCommit.set({ ...selected, ...updated });
        }
        if (settings) {
          this.azureSettings.set(settings);
          this.showRemote.set(settings.showRemoteBranches !== false);
        }
        if (working) {
          this.workingChanges.set(working);
          this.statusError.set("");
        }
        this.statusLoading.set(false);
        this.loading.set(false);
        this.historyGeneration.update((value) => value + 1);
        // Stashes and worktrees may have changed with the history.
        if (this.panelOpen()) this.loadSidePanelData();
      },
      error: (err) => {
        this.lastRepositoryState = null;
        this.error.set(this.errorMessage(err));
        this.filterFailed.set(true);
        this.statusError.set(this.errorMessage(err));
        this.statusLoading.set(false);
        this.loading.set(false);
      },
    });
  }

  /** Refetches only the working-tree status after working-tree-only changes. */
  protected refreshWorking(): void {
    this.workingSub?.unsubscribe();
    this.statusLoading.set(true);
    this.workingSub = this.git.getWorkingChanges().subscribe({
      next: (working) => {
        this.workingChanges.set(working);
        this.statusError.set("");
        this.statusLoading.set(false);
      },
      error: (err) => {
        this.lastRepositoryState = null;
        this.statusError.set(this.errorMessage(err));
        this.statusLoading.set(false);
      },
    });
  }

  protected changeStage(event: { staged: boolean; files: string[] }): void {
    if (
      this.busy() ||
      this.mutationBusy() ||
      this.statusLoading() ||
      this.statusError()
    )
      return;
    this.busy.set(true);
    this.error.set("");
    (event.staged
      ? this.git.unstage(event.files)
      : this.git.stage(event.files)
    ).subscribe({
      next: () => {
        this.refreshWorking();
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err));
        this.refreshWorking();
        this.busy.set(false);
      },
    });
  }

  protected stashChanges(scope: StashScope): void {
    if (
      this.busy() ||
      this.mutationBusy() ||
      this.statusLoading() ||
      this.statusError()
    )
      return;
    this.git.stashSave(undefined, scope).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(this.errorMessage(err)),
    });
  }

  protected discardUnstaged(files: string[]): void {
    if (
      this.busy() ||
      this.mutationBusy() ||
      this.statusLoading() ||
      this.statusError()
    )
      return;
    if (!files.length) return;
    this.pendingDiscard.set(files);
    this.promptState.set({
      title: "Discard unstaged changes?",
      label:
        files.length === 1
          ? `${files[0]} will be discarded. This cannot be undone.`
          : `${files.length} files will be discarded. This cannot be undone.`,
      confirmOnly: true,
      okLabel: "Discard",
      danger: true,
    });
  }

  protected onPromptCancel(): void {
    this.pendingDiscard.set(null);
    this.promptState.set(null);
  }

  protected commitChanges(): void {
    if (
      this.busy() ||
      this.mutationBusy() ||
      this.statusLoading() ||
      this.statusError() ||
      !this.commitSubject().trim() ||
      !this.workingChanges()?.staged.length ||
      this.workingChanges()?.conflicted.length
    )
      return;
    this.busy.set(true);
    this.error.set("");
    this.git.commit(this.commitSubject(), this.commitDescription()).subscribe({
      next: () => {
        this.commitSubject.set("");
        this.commitDescription.set("");
        this.refresh();
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err));
        this.refreshWorking();
        this.busy.set(false);
      },
    });
  }

  protected loadMoreCommits(): void {
    this.loadHistory(
      this.git.getCommits(LOAD_PAGE_SIZE, this.commits().length),
    );
  }

  protected loadAllCommits(): void {
    this.loadHistory(this.git.getCommits(undefined, this.commits().length));
  }

  private loadHistory(request: Observable<CommitsResponse>): void {
    if (this.historyLoading() || this.loading()) {
      return;
    }

    const skip = this.commits().length;
    this.filterFailed.set(false);
    this.historyLoading.set(true);

    this.historySub?.unsubscribe();
    this.historySub = request.subscribe({
      next: ({ commits, total }) => {
        // Drop the response if the list was replaced while loading (e.g. a refresh).
        if (this.commits().length === skip) {
          this.commits.update((current) => [...current, ...commits]);
          // An empty page means there is nothing left to load.
          this.totalCommits.set(
            commits.length > 0
              ? Math.max(total, this.commits().length)
              : this.commits().length,
          );
        }
        this.historyLoading.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err));
        this.filterFailed.set(true);
        this.historyLoading.set(false);
      },
    });
  }

  private fetchBodyMatches(query: string, caseSensitive: boolean): void {
    // Rapid searches abort each other; only the latest response applies.
    this.searchSub?.unsubscribe();
    this.searchLoading.set(true);
    this.searchSub = this.git.searchCommits(query, caseSensitive).subscribe({
      next: (result) => {
        this.bodyMatches.set(result.hashes);
        this.searchHistoryIndices.set(result.indices ?? {});
        this.searchLoading.set(false);
      },
      error: (err) => {
        this.filterFailed.set(true);
        this.error.set(this.errorMessage(err));
        this.searchLoading.set(false);
      },
    });
  }

  /** Focus the next/previous search match, loading history until it appears. */
  protected navigateSearch(direction: "next" | "prev"): void {
    const matches = this.searchMatches();
    if (matches.length === 0) {
      return;
    }
    const current = this.searchIndex();
    const next =
      current < 0
        ? direction === "next"
          ? 0
          : matches.length - 1
        : direction === "next"
          ? (current + 1) % matches.length
          : (current - 1 + matches.length) % matches.length;
    const hash = matches[next];
    this.searchFocusHash.set(hash);
    this.pendingSearchHash.set(hash);
  }

  protected runRemoteAction(action: RemoteAction): void {
    if (this.busy() || this.mutationBusy() || this.statusLoading()) return;
    if (action === "rebase-from") {
      this.openRebaseFromDialog();
      return;
    }
    if (action === "create-pr") {
      this.prDialogOpen.set(true);
      return;
    }
    if (action === "push-force") {
      // Force push rewrites remote history; confirm before running it.
      this.promptState.set({
        title: "Force push?",
        label:
          "This will overwrite the remote branch with your local history. Remote commits missing locally may be lost.",
        confirmOnly: true,
        okLabel: "Force Push",
        danger: true,
      });
      return;
    }
    this.busy.set(true);
    this.error.set("");

    const request =
      action === "fetch" || action === "fetch-prune"
        ? this.git.fetch(action === "fetch-prune")
        : action === "pull"
          ? this.git.pull()
          : action === "pull-rebase"
            ? this.git.pull(true)
            : action === "push"
              ? this.git.push()
              : this.git.sync();

    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(this.errorMessage(err));
      },
    });
  }

  /** Opens the branch picker behind the pull button's "Rebase (from)..." entry. */
  private openRebaseFromDialog(): void {
    const names = new Set(this.branches().map((branch) => branch.name));
    // origin/main wins over origin/master; both float to the top as the default choice.
    const preferred = ["origin/main", "origin/master"].filter((name) =>
      names.has(name),
    );
    preferred.forEach((name) => names.delete(name));
    const options = [...preferred, ...names];
    if (options.length === 0) {
      options.push("origin/main", "origin/master");
    }
    this.promptState.set({
      title: "Rebase from branch",
      label: "Rebase the current branch onto:",
      options: options.map((name) => ({ value: name, label: name })),
      okLabel: "Rebase",
      searchable: true,
    });
  }

  /** Opens native extension settings in VS Code, or Guito's full dialog standalone. */
  protected openSettings(): void {
    if (!this.vscode.openSettings()) {
      this.settingsDialogOpen.set(true);
    }
  }

  protected saveSettings(update: GuitoSettingsUpdate): void {
    this.settingsSaving.set(true);
    this.git.saveSettings(update).subscribe({
      next: (settings) => {
        this.azureSettings.set(settings);
        this.showRemote.set(settings.showRemoteBranches !== false);
        this.settingsSaving.set(false);
        this.settingsDialogOpen.set(false);
      },
      error: (err) => {
        this.settingsSaving.set(false);
        this.error.set(this.errorMessage(err));
      },
    });
  }

  /** Refreshes after a pull request was created (a new remote branch may exist). */
  protected onPrCreated(): void {
    this.refresh();
  }

  protected onContextMenu(event: { x: number; y: number; target: any }): void {
    // Sidebar tag rows only know the tag name; attach the tagged commit when
    // it is loaded so the shared menu behaves like commit-table tag badges.
    if (event.target.kind === "tag" && !event.target.commit) {
      const commit = this.taggedCommit(event.target.branch?.name ?? "");
      if (commit) event.target = { ...event.target, commit };
    }

    const items: MenuItem[] = [];

    if (event.target.kind === "commit") {
      items.push({ label: "Add Tag...", action: "add-tag" });
      items.push({ label: "Create Branch...", action: "create-branch" });
      items.push({ separator: true });
      items.push({ label: "Checkout...", action: "checkout-commit" });
      items.push({ label: "Cherry Pick...", action: "cherry-pick" });
      items.push({ label: "Revert...", action: "revert-commit", danger: true });
      items.push({ label: "Drop...", action: "drop-commit", danger: true });
      items.push({ separator: true });
      items.push({
        label: "Merge into current branch...",
        action: "merge-commit",
      });
      items.push({
        label: "Rebase current branch on this Commit...",
        action: "rebase-commit",
      });
      items.push({
        label: "Reset current branch to this Commit...",
        action: "reset-commit",
        danger: true,
      });
      items.push({ separator: true });
      items.push({
        label: "Copy Commit Hash to Clipboard",
        action: "copy-hash",
      });
      items.push({
        label: "Copy Commit Subject to Clipboard",
        action: "copy-subject",
      });
    } else if (event.target.kind === "tag") {
      items.push({ label: "View Details", action: "tag-details" });
      items.push({ separator: true });
      items.push({
        label: "Delete Tag...",
        action: "tag-delete",
        danger: true,
      });
      items.push({ label: "Push Tag...", action: "tag-push" });
      items.push({ separator: true });
      items.push({ label: "Create Archive", action: "create-archive" });
      items.push({
        label: "Copy Tag Name to Clipboard",
        action: "copy-tag-name",
      });
    } else if (event.target.kind === "branch") {
      const badgeType = event.target.branch.type;
      const isLocal = badgeType === "head" || badgeType === "local";
      items.push({ label: "Checkout Branch...", action: "checkout-branch" });
      if (isLocal) {
        items.push({ label: "Rename Branch...", action: "rename-branch" });
        items.push({
          label: "Delete Branch...",
          action: "delete-branch",
          danger: true,
          // Git refuses to delete the checked-out branch.
          disabled: badgeType === "head",
        });
      }
      items.push({
        label: "Delete Remote Branch...",
        action: "delete-remote-branch",
        danger: true,
      });
      items.push({
        label: "Merge into current branch...",
        action: "merge-branch",
      });
      items.push({
        label: "Pull into current branch...",
        action: "pull-branch",
      });
      items.push({ separator: true });
      items.push({ label: "Create Archive", action: "create-archive" });
      items.push({
        label: "Unselect in Branches Dropdown",
        action: "unselect-branch",
      });
      items.push({ separator: true });
      items.push({
        label: "Copy Branch Name to Clipboard",
        action: "copy-branch-name",
      });
    } else if (event.target.kind === "stash") {
      items.push({ label: "Apply Stash", action: "stash-apply" });
      items.push({ label: "Pop Stash", action: "stash-pop" });
      items.push({ separator: true });
      items.push({
        label: "Drop Stash...",
        action: "stash-drop",
        danger: true,
      });
      items.push({ separator: true });
      items.push({
        label: "Copy Stash Name to Clipboard",
        action: "copy-stash-name",
      });
    } else if (event.target.kind === "worktree") {
      items.push({
        label: "Delete Worktree...",
        action: "delete-worktree",
        danger: true,
        disabled: event.target.worktree?.current || event.target.worktree?.bare,
      });
      items.push({ separator: true });
      items.push({
        label: "Copy Worktree Path to Clipboard",
        action: "copy-worktree-path",
      });
    } else {
      items.push({
        label: "Stash uncommitted changes...",
        action: "stash-working",
      });
      items.push({
        label: "Reset uncommitted changes...",
        action: "reset-working",
        danger: true,
      });
      items.push({
        label: "Clean untracked files...",
        action: "clean-untracked",
        danger: true,
      });
      items.push({ separator: true });
      items.push({
        label: "Open Source Control View",
        action: "open-source-control",
      });
    }

    this.contextMenuTarget.set(event.target);
    this.contextMenuState.set({ x: event.x, y: event.y, items });
  }

  /** Commit a tag points to, looked up in the loaded history. */
  private taggedCommit(name: string): GitCommit | undefined {
    if (!name) return undefined;
    const tag = this.tags().find((candidate) => candidate.name === name);
    return tag ? this.commitIndex().get(tag.hash) : undefined;
  }

  /** Jumps to the commit a tag points to; pages load until it appears. */
  protected selectTag(tag: TagInfo): void {
    this.pendingSearchHash.set(tag.hash);
  }

  protected openWorktreeDialog(): void {
    this.worktreeDialogError.set("");
    this.worktreeDialogOpen.set(true);
  }

  protected createWorktree(request: { path: string; branch: string }): void {
    if (this.busy() || this.mutationBusy() || this.statusLoading()) return;
    this.worktreeDialogError.set("");
    this.git.createWorktree(request.path, request.branch).subscribe({
      next: () => {
        this.worktreeDialogOpen.set(false);
        this.loadSidePanelData();
      },
      error: (err) => this.worktreeDialogError.set(this.errorMessage(err)),
    });
  }

  protected onContextAction(action: string): void {
    if (this.busy() || this.mutationBusy() || this.statusLoading()) return;
    const selected = this.contextMenuTarget()?.commit ?? this.selectedCommit();

    switch (action) {
      case "add-tag":
        this.promptState.set({
          title: "Add Tag",
          label: "Tag name",
          placeholder: "v1.0.0",
          okLabel: "Add Tag",
        });
        break;
      case "create-branch":
        this.promptState.set({
          title: "Create Branch",
          label: "Branch name",
          placeholder: "feature/my-branch",
          okLabel: "Create Branch",
        });
        break;
      case "checkout-commit":
        if (selected) {
          this.git.checkout(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "cherry-pick":
        if (selected) {
          this.git.cherryPick(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "open-commit":
        if (this.selectedCommit() === null) {
          this.selectedCommit.set(this.commits()[0] ?? null);
        }
        break;
      case "copy-hash":
        if (selected) {
          void navigator.clipboard?.writeText(selected.hash);
        }
        break;
      case "copy-subject":
        if (selected) {
          void navigator.clipboard?.writeText(selected.message);
        }
        break;
      case "view-commit-diff":
        if (selected) {
          this.selectedCommit.set(selected);
        }
        break;
      case "revert-commit":
        if (selected) {
          this.git.revert(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "drop-commit":
        this.promptState.set({
          title: "Drop commit?",
          label: "This will reset the current branch to the commit before it.",
          confirmOnly: true,
          okLabel: "Drop",
          danger: true,
        });
        break;
      case "merge-commit":
        if (selected) {
          this.git.merge(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "rebase-commit":
        if (selected) {
          this.git.rebase(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "reset-commit":
        this.promptState.set({
          title: "Reset current branch to this commit?",
          label: "Choose the reset type:",
          options: [
            {
              value: "soft",
              label: "Soft",
              description: "Keep all changes staged",
            },
            {
              value: "mixed",
              label: "Mixed",
              description: "Keep changes, but unstage them",
            },
            {
              value: "hard",
              label: "Hard",
              description: "Discard all changes",
              danger: true,
            },
          ],
          okLabel: "Reset",
          danger: true,
        });
        break;
      case "checkout-branch":
        if (this.contextMenuTarget()?.branch?.name) {
          this.git.checkout(this.contextMenuTarget().branch.name).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "delete-remote-branch": {
        const branchName = this.contextMenuTarget()?.branch?.name ?? "";
        const separator = branchName.indexOf("/");
        if (separator > 0) {
          this.git
            .deleteRemoteBranch(
              branchName.slice(0, separator),
              branchName.slice(separator + 1),
            )
            .subscribe({
              next: () => this.refresh(),
              error: (err) => this.error.set(this.errorMessage(err)),
            });
        }
        break;
      }
      case "merge-branch":
        if (this.contextMenuTarget()?.branch?.name) {
          this.git.merge(this.contextMenuTarget().branch.name).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case "pull-branch":
        this.git.pull().subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
        break;
      case "create-archive": {
        const target = this.contextMenuTarget();
        const ref =
          target?.kind === "tag" ? target.branch?.name : target?.commit?.hash;
        if (ref) {
          window.open(
            authenticatedApiUrl(`/api/archive?ref=${encodeURIComponent(ref)}`),
            "_blank",
          );
        }
        break;
      }
      case "tag-details":
        if (this.contextMenuTarget()?.commit) {
          this.selectedCommit.set(this.contextMenuTarget().commit);
        }
        break;
      case "tag-delete": {
        const name = this.contextMenuTarget()?.branch?.name ?? "";
        this.promptState.set({
          title: "Delete tag?",
          label: `This will delete the tag "${name}".`,
          confirmOnly: true,
          okLabel: "Delete",
          danger: true,
        });
        break;
      }
      case "tag-push": {
        const name = this.contextMenuTarget()?.branch?.name ?? "";
        this.promptState.set({
          title: "Push tag?",
          label: `This will push the tag "${name}" to the remote.`,
          confirmOnly: true,
          okLabel: "Push",
        });
        break;
      }
      case "copy-tag-name":
        if (this.contextMenuTarget()?.branch?.name) {
          void navigator.clipboard?.writeText(
            this.contextMenuTarget().branch.name,
          );
        }
        break;
      case "unselect-branch":
        this.selectedBranch.set("");
        break;
      case "stash-apply": {
        const index = this.contextMenuTarget()?.stash?.index;
        if (index !== undefined) {
          this.git.stashApply(index).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      }
      case "stash-pop": {
        const index = this.contextMenuTarget()?.stash?.index;
        if (index !== undefined) {
          this.git.stashPop(index).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      }
      case "stash-drop": {
        const stash = this.contextMenuTarget()?.stash;
        if (stash) {
          this.promptState.set({
            title: "Drop stash?",
            label: `This will permanently drop stash@{${stash.index}}.`,
            confirmOnly: true,
            okLabel: "Drop",
            danger: true,
          });
        }
        break;
      }
      case "copy-stash-name": {
        const stash = this.contextMenuTarget()?.stash;
        if (stash) {
          void navigator.clipboard?.writeText(`stash@{${stash.index}}`);
        }
        break;
      }
      case "copy-worktree-path": {
        const path = this.contextMenuTarget()?.worktree?.path;
        if (path) {
          void navigator.clipboard?.writeText(path);
        }
        break;
      }
      case "delete-worktree": {
        const worktree = this.contextMenuTarget()?.worktree;
        if (worktree && !worktree.current && !worktree.bare) {
          this.promptState.set({
            title: "Delete worktree?",
            label: `This will remove the worktree folder "${worktree.path}". Git will refuse if it contains uncommitted changes.`,
            confirmOnly: true,
            okLabel: "Delete",
            danger: true,
          });
        }
        break;
      }
      case "copy-branch-name":
        if (this.contextMenuTarget()?.branch?.name) {
          void navigator.clipboard?.writeText(
            this.contextMenuTarget().branch.name,
          );
        }
        break;
      case "rename-branch":
        this.promptState.set({
          title: "Rename branch",
          label: "New branch name",
          placeholder: "feature/my-branch",
          value: this.contextMenuTarget()?.branch?.name,
          okLabel: "Rename",
        });
        break;
      case "delete-branch":
        this.promptState.set({
          title: "Delete branch?",
          label: "This will delete the local branch.",
          confirmOnly: true,
          okLabel: "Delete",
          danger: true,
        });
        break;
      case "open-working":
        this.selectedCommit.set({
          hash: WORKING_HASH,
          date: new Date().toISOString(),
          message: "Uncommitted changes",
          refs: "",
          body: "",
          author_name: this.identity().name || "You",
          author_email: this.identity().email,
          parents: [],
        });
        break;
      case "stash-working":
        this.promptState.set({
          title: "Stash uncommitted changes",
          label: "Stash message (optional)",
          placeholder: "WIP",
          allowEmpty: true,
          okLabel: "Stash",
        });
        break;
      case "reset-working":
        this.promptState.set({
          title: "Reset uncommitted changes?",
          label:
            "Tracked changes will be discarded. Untracked files will remain.",
          confirmOnly: true,
          okLabel: "Reset",
          danger: true,
        });
        break;
      case "clean-untracked":
        this.promptState.set({
          title: "Clean untracked files?",
          label: "Untracked files will be permanently deleted.",
          confirmOnly: true,
          okLabel: "Clean",
          danger: true,
        });
        break;
      case "discard-working":
        this.git.getWorkingChanges().subscribe({
          next: (changes) => {
            const files = [
              ...changes.files.map((f) => f.path),
              ...changes.untracked,
            ];
            if (files.length > 0) {
              this.git.discard(files).subscribe({
                next: () => this.refreshWorking(),
                error: (err) => this.error.set(this.errorMessage(err)),
              });
            }
          },
          error: (err) => this.error.set(this.errorMessage(err)),
        });
        break;
      case "refresh-status":
        this.refresh();
        break;
      case "open-source-control":
        window.open("vscode://command/workbench.view.scm", "_blank");
        break;
      default:
        break;
    }

    this.contextMenuState.set(null);
  }

  protected onPromptConfirm(value: string): void {
    if (this.busy() || this.mutationBusy() || this.statusLoading()) return;
    const state = this.promptState();
    if (!state) {
      return;
    }
    this.promptState.set(null);

    const commit = this.contextMenuTarget()?.commit;

    if (state.title === "Add Tag" && commit) {
      this.git.createTag(value, commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Create Branch" && commit) {
      this.git.createBranch(value, commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Drop commit?" && commit) {
      this.git.dropCommit(commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Reset current branch to this commit?" && commit) {
      const mode = value === "soft" || value === "mixed" ? value : "hard";
      this.git.resetToCommit(commit.hash, mode).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Delete tag?") {
      const name = this.contextMenuTarget()?.branch?.name;
      if (name) {
        this.git.deleteTag(name).subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Delete worktree?") {
      const worktree = this.contextMenuTarget()?.worktree;
      if (worktree && !worktree.current && !worktree.bare) {
        this.git.removeWorktree(worktree.path).subscribe({
          next: () => this.loadSidePanelData(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Push tag?") {
      const name = this.contextMenuTarget()?.branch?.name;
      if (name) {
        this.git.pushTag(name).subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Force push?") {
      this.git.push(true).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Discard unstaged changes?") {
      const files = this.pendingDiscard();
      this.pendingDiscard.set(null);
      if (files?.length) {
        this.git.discard(files, "unstaged").subscribe({
          next: () => this.refreshWorking(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Stash uncommitted changes") {
      this.git.stashSave(value || undefined).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Reset uncommitted changes?") {
      this.git.resetWorking().subscribe({
        next: () => this.refreshWorking(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Clean untracked files?") {
      this.git.cleanUntracked().subscribe({
        next: () => this.refreshWorking(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === "Rename branch") {
      const name = this.contextMenuTarget()?.branch?.name;
      const newName = value.trim();
      if (name && newName && newName !== name) {
        this.git.renameBranch(name, newName).subscribe({
          next: () => {
            // Keep the branches dropdown on the renamed branch.
            if (this.selectedBranch() === name)
              this.selectedBranch.set(newName);
            this.refresh();
          },
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Delete branch?") {
      const name = this.contextMenuTarget()?.branch?.name;
      if (name) {
        this.git.deleteBranch(name).subscribe({
          next: () => {
            // Fall back to Show All when the selected branch is gone.
            if (this.selectedBranch() === name) this.selectedBranch.set("");
            this.refresh();
          },
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Drop stash?") {
      const index = this.contextMenuTarget()?.stash?.index;
      if (index !== undefined) {
        this.git.stashDrop(index).subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }

    if (state.title === "Rebase from branch") {
      const branch = value.trim();
      if (branch) {
        this.git.rebase(branch).subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
      }
      return;
    }
  }

  private ancestorsOf(head: string): Set<string> {
    const byHash = this.commitIndex();
    const seen = new Set<string>();
    const stack = [head];

    while (stack.length) {
      const hash = stack.pop()!;
      if (seen.has(hash)) {
        continue;
      }
      seen.add(hash);
      const commit = byHash.get(hash);
      if (commit) {
        stack.push(...commit.parents);
      }
    }

    return seen;
  }

  private errorMessage(err: unknown): string {
    const response = err as { status?: number; error?: { error?: string } };
    if (response?.status === 400 && response.error?.error) {
      return response.error.error;
    }
    return "Failed to communicate with the Guito server.";
  }
}
