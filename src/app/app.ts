import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommitDetail } from './components/commit-detail/commit-detail';
import { CommitTable } from './components/commit-table/commit-table';
import { Toolbar } from './components/toolbar/toolbar';
import { BranchInfo, GitCommit } from './models/git.models';
import { GitService } from './services/git.service';

@Component({
  selector: 'app-root',
  imports: [Toolbar, CommitTable, CommitDetail],
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

  protected readonly filteredCommits = computed(() => {
    let list = this.commits();

    const branch = this.selectedBranch();
    if (branch) {
      const head = this.branches().find((b) => b.name === branch)?.commit;
      if (head) {
        const ancestors = this.ancestorsOf(head, list);
        list = list.filter((commit) => ancestors.has(commit.hash));
      }
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
    }).subscribe({
      next: ({ commits, branches, repo }) => {
        this.commits.set(commits);
        this.branches.set(branches);
        this.repoName.set(repo.name);
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

    // Reset the branch filter if the selected branch is now hidden.
    const selected = this.selectedBranch();
    if (selected) {
      const branch = this.branches().find((b) => b.name === selected);
      if (branch?.remote && !show) {
        this.selectedBranch.set('');
      }
    }
  }

  protected runRemoteAction(action: 'fetch' | 'pull' | 'push'): void {
    this.busy.set(true);
    this.error.set('');

    const request =
      action === 'fetch' ? this.git.fetch() : action === 'pull' ? this.git.pull() : this.git.push();

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
