import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommitDetail } from './components/commit-detail/commit-detail';
import { CommitTable } from './components/commit-table/commit-table';
import { ContextMenu } from './components/context-menu/context-menu';
import { PromptDialog } from './components/prompt-dialog/prompt-dialog';
import { Toolbar } from './components/toolbar/toolbar';
import {
  BranchInfo,
  ContextMenuState,
  GitCommit,
  MenuItem,
  PromptState,
  WORKING_HASH,
  WorkingChanges,
} from './models/git.models';
import { GitService } from './services/git.service';

@Component({
  selector: 'app-root',
  imports: [Toolbar, CommitTable, CommitDetail, ContextMenu, PromptDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly git = inject(GitService);

  protected readonly commits = signal<GitCommit[]>([]);
  protected readonly branches = signal<BranchInfo[]>([]);
  protected readonly selectedBranch = signal('');
  protected readonly showRemote = signal(true);
  protected readonly search = signal('');
  protected readonly selectedCommit = signal<GitCommit | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly repoName = signal('');
  protected readonly workingChanges = signal<WorkingChanges | null>(null);
  protected readonly contextMenuState = signal<ContextMenuState | null>(null);
  protected readonly contextMenuTarget = signal<any>(null);
  protected readonly promptState = signal<PromptState | null>(null);

  protected readonly filteredCommits = computed(() => {
    let list = this.commits();

    const selectedBranch = this.selectedBranch();
    const visibleBranches = this.branches().filter((branch) => this.showRemote() || !branch.remote);
    const branchesToShow = selectedBranch
      ? visibleBranches.filter((branch) => branch.name === selectedBranch)
      : visibleBranches;

    if (branchesToShow.length > 0) {
      const visibleHashes = new Set<string>();
      for (const branch of branchesToShow) {
        for (const hash of this.ancestorsOf(branch.commit, list)) {
          visibleHashes.add(hash);
        }
      }
      list = list.filter((commit) => visibleHashes.has(commit.hash));
    } else {
      list = [];
    }

    const query = this.search().trim().toLowerCase();
    if (query) {
      list = list.filter(
        (commit) =>
          commit.message.toLowerCase().includes(query) ||
          commit.author_name.toLowerCase().includes(query) ||
          commit.hash.toLowerCase().startsWith(query),
      );
    }

    return list;
  });

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      commits: this.git.getCommits(),
      branches: this.git.getAllBranches(),
      repo: this.git.getRepoInfo(),
      working: this.git
        .getWorkingChanges()
        .pipe(catchError(() => of({ files: [], staged: [], unstaged: [], untracked: [] }))),
    }).subscribe({
      next: ({ commits, branches, repo, working }) => {
        this.commits.set(commits);
        this.branches.set(branches);
        this.repoName.set(repo.name);
        this.workingChanges.set(working);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onRemoteToggle(show: boolean): void {
    this.showRemote.set(show);
  }

  protected runRemoteAction(action: 'fetch' | 'pull' | 'pull-rebase' | 'push' | 'sync'): void {
    this.busy.set(true);
    this.error.set('');

    const request =
      action === 'fetch'
        ? this.git.fetch()
        : action === 'pull'
          ? this.git.pull()
          : action === 'pull-rebase'
            ? this.git.pull(true)
            : action === 'push'
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

  protected onContextMenu(event: { x: number; y: number; target: any }): void {
    const items: MenuItem[] = [];

    if (event.target.kind === 'commit') {
      items.push({ label: 'Add Tag...', action: 'add-tag' });
      items.push({ label: 'Create Branch...', action: 'create-branch' });
      items.push({ separator: true });
      items.push({ label: 'Checkout...', action: 'checkout-commit' });
      items.push({ label: 'Cherry Pick...', action: 'cherry-pick' });
      items.push({ label: 'Revert...', action: 'revert-commit', danger: true });
      items.push({ label: 'Drop...', action: 'drop-commit', danger: true });
      items.push({ separator: true });
      items.push({ label: 'Merge into current branch...', action: 'merge-commit' });
      items.push({ label: 'Rebase current branch on this Commit...', action: 'rebase-commit' });
      items.push({
        label: 'Reset current branch to this Commit...',
        action: 'reset-commit',
        danger: true,
      });
      items.push({ separator: true });
      items.push({ label: 'Copy Commit Hash to Clipboard', action: 'copy-hash' });
      items.push({ label: 'Copy Commit Subject to Clipboard', action: 'copy-subject' });
    } else if (event.target.kind === 'branch') {
      items.push({ label: 'Checkout Branch...', action: 'checkout-branch' });
      items.push({
        label: 'Delete Remote Branch...',
        action: 'delete-remote-branch',
        danger: true,
      });
      items.push({ label: 'Merge into current branch...', action: 'merge-branch' });
      items.push({ label: 'Pull into current branch...', action: 'pull-branch' });
      items.push({ separator: true });
      items.push({ label: 'Create Archive', action: 'create-archive' });
      items.push({ label: 'Unselect in Branches Dropdown', action: 'unselect-branch' });
      items.push({ separator: true });
      items.push({ label: 'Copy Branch Name to Clipboard', action: 'copy-branch-name' });
    } else {
      items.push({ label: 'Stash uncommitted changes...', action: 'stash-working' });
      items.push({ label: 'Reset uncommitted changes...', action: 'reset-working', danger: true });
      items.push({ label: 'Clean untracked files...', action: 'clean-untracked', danger: true });
      items.push({ separator: true });
      items.push({ label: 'Open Source Control View', action: 'open-source-control' });
    }

    this.contextMenuTarget.set(event.target);
    this.contextMenuState.set({ x: event.x, y: event.y, items });
  }

  protected onContextAction(action: string): void {
    const selected = this.contextMenuTarget()?.commit ?? this.selectedCommit();

    switch (action) {
      case 'add-tag':
        this.promptState.set({
          title: 'Add Tag',
          label: 'Tag name',
          placeholder: 'v1.0.0',
          okLabel: 'Add Tag',
        });
        break;
      case 'create-branch':
        this.promptState.set({
          title: 'Create Branch',
          label: 'Branch name',
          placeholder: 'feature/my-branch',
          okLabel: 'Create Branch',
        });
        break;
      case 'checkout-commit':
        if (selected) {
          this.git.checkout(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'cherry-pick':
        if (selected) {
          this.git.cherryPick(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'open-commit':
        if (this.selectedCommit() === null) {
          this.selectedCommit.set(this.commits()[0] ?? null);
        }
        break;
      case 'copy-hash':
        if (selected) {
          void navigator.clipboard?.writeText(selected.hash);
        }
        break;
      case 'copy-subject':
        if (selected) {
          void navigator.clipboard?.writeText(selected.message);
        }
        break;
      case 'view-commit-diff':
        if (selected) {
          this.selectedCommit.set(selected);
        }
        break;
      case 'revert-commit':
        if (selected) {
          this.git.revert(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'drop-commit':
        this.promptState.set({
          title: 'Drop commit?',
          label: 'This will reset the current branch to the commit before it.',
          confirmOnly: true,
          okLabel: 'Drop',
          danger: true,
        });
        break;
      case 'merge-commit':
        if (selected) {
          this.git.merge(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'rebase-commit':
        if (selected) {
          this.git.rebase(selected.hash).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'reset-commit':
        this.promptState.set({
          title: 'Reset current branch to this commit?',
          label: 'All commits after this commit will be removed from the current branch.',
          confirmOnly: true,
          okLabel: 'Reset',
          danger: true,
        });
        break;
      case 'checkout-branch':
        if (this.contextMenuTarget()?.branch?.name) {
          this.git.checkout(this.contextMenuTarget().branch.name).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'delete-remote-branch': {
        const branchName = this.contextMenuTarget()?.branch?.name ?? '';
        const separator = branchName.indexOf('/');
        if (separator > 0) {
          this.git
            .deleteRemoteBranch(branchName.slice(0, separator), branchName.slice(separator + 1))
            .subscribe({
              next: () => this.refresh(),
              error: (err) => this.error.set(this.errorMessage(err)),
            });
        }
        break;
      }
      case 'merge-branch':
        if (this.contextMenuTarget()?.branch?.name) {
          this.git.merge(this.contextMenuTarget().branch.name).subscribe({
            next: () => this.refresh(),
            error: (err) => this.error.set(this.errorMessage(err)),
          });
        }
        break;
      case 'pull-branch':
        this.git.pull().subscribe({
          next: () => this.refresh(),
          error: (err) => this.error.set(this.errorMessage(err)),
        });
        break;
      case 'create-archive':
        if (this.contextMenuTarget()?.commit?.hash) {
          window.open(
            `/api/archive?ref=${encodeURIComponent(this.contextMenuTarget().commit.hash)}`,
            '_blank',
          );
        }
        break;
      case 'unselect-branch':
        this.selectedBranch.set('');
        break;
      case 'copy-branch-name':
        if (this.contextMenuTarget()?.branch?.name) {
          void navigator.clipboard?.writeText(this.contextMenuTarget().branch.name);
        }
        break;
      case 'rename-branch':
        this.promptState.set({
          title: 'Rename branch',
          label: 'New branch name',
          placeholder: 'feature/my-branch',
          okLabel: 'Rename',
        });
        break;
      case 'delete-branch':
        this.promptState.set({
          title: 'Delete branch?',
          label: 'This will delete the local branch.',
          confirmOnly: true,
          okLabel: 'Delete',
          danger: true,
        });
        break;
      case 'open-working':
        this.selectedCommit.set({
          hash: WORKING_HASH,
          date: new Date().toISOString(),
          message: 'Uncommitted changes',
          refs: '',
          body: '',
          author_name: 'You',
          author_email: '',
          parents: [],
        });
        break;
      case 'stash-working':
        this.promptState.set({
          title: 'Stash uncommitted changes',
          label: 'Stash message (optional)',
          placeholder: 'WIP',
          allowEmpty: true,
          okLabel: 'Stash',
        });
        break;
      case 'reset-working':
        this.promptState.set({
          title: 'Reset uncommitted changes?',
          label: 'Tracked changes will be discarded. Untracked files will remain.',
          confirmOnly: true,
          okLabel: 'Reset',
          danger: true,
        });
        break;
      case 'clean-untracked':
        this.promptState.set({
          title: 'Clean untracked files?',
          label: 'Untracked files will be permanently deleted.',
          confirmOnly: true,
          okLabel: 'Clean',
          danger: true,
        });
        break;
      case 'discard-working':
        this.git.getWorkingChanges().subscribe({
          next: (changes) => {
            const files = [...changes.files.map((f) => f.path), ...changes.untracked];
            if (files.length > 0) {
              this.git.discard(files).subscribe({
                next: () => this.refresh(),
                error: (err) => this.error.set(this.errorMessage(err)),
              });
            }
          },
          error: (err) => this.error.set(this.errorMessage(err)),
        });
        break;
      case 'refresh-status':
        this.refresh();
        break;
      case 'open-source-control':
        window.open('vscode://command/workbench.view.scm', '_blank');
        break;
      default:
        break;
    }

    this.contextMenuState.set(null);
  }

  protected onPromptConfirm(value: string): void {
    const state = this.promptState();
    if (!state) {
      return;
    }
    this.promptState.set(null);

    const commit = this.contextMenuTarget()?.commit;

    if (state.title === 'Add Tag' && commit) {
      this.git.createTag(value, commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Create Branch' && commit) {
      this.git.createBranch(value, commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Drop commit?' && commit) {
      this.git.dropCommit(commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Reset current branch to this commit?' && commit) {
      this.git.resetToCommit(commit.hash).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Stash uncommitted changes') {
      this.git.stashSave(value || undefined).subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Reset uncommitted changes?') {
      this.git.resetWorking().subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Clean untracked files?') {
      this.git.cleanUntracked().subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(this.errorMessage(err)),
      });
      return;
    }

    if (state.title === 'Rename branch') {
      this.error.set('Branch rename is not available from the current menu flow.');
      return;
    }

    if (state.title === 'Delete branch?') {
      this.error.set('Branch deletion is not available from the current menu flow.');
      return;
    }
  }

  private ancestorsOf(head: string, commits: readonly GitCommit[]): Set<string> {
    const byHash = new Map(commits.map((commit) => [commit.hash, commit]));
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
    return 'Failed to communicate with the Guito server.';
  }
}
