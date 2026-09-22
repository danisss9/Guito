import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { GitService } from '../../services/git.service';
import {
  GitOperationDialogState,
  GitOperationRequest,
  GitRemote,
  MergeMode,
  PullMode,
  StashScope,
} from '../../models/git.models';

/** Actions whose dialog includes a remote picker. */
const REMOTE_ACTIONS = new Set([
  'add-tag',
  'create-branch',
  'checkout-commit',
  'push-tag',
  'delete-tag',
  'rename-branch',
  'delete-branch',
  'delete-remote-branch',
]);

interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  danger?: boolean;
}

/**
 * Dialog for mutating Git operations (tags, branches, checkout, cherry-pick,
 * revert, drop, merge, rebase, reset, pull, stash). One component renders a
 * per-action form; every option resets when the dialog opens.
 */
@Component({
  selector: 'app-git-operation-dialog',
  templateUrl: './git-operation-dialog.html',
  styleUrl: './git-operation-dialog.css',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GitOperationDialog {
  private readonly git = inject(GitService);

  readonly state = input.required<GitOperationDialogState>();
  readonly busy = input(false);
  readonly error = input('');
  readonly confirmed = output<GitOperationRequest>();
  readonly closed = output<void>();

  private readonly focusEl = viewChild<ElementRef<HTMLElement>>('focusEl');

  // ---- shared option signals (reset on every open) ----
  protected readonly remote = signal('');
  protected readonly remotes = signal<GitRemote[]>([]);
  protected readonly remotesLoaded = signal(false);

  // add tag
  protected readonly tagName = signal('');
  protected readonly tagAnnotated = signal(false);
  protected readonly tagMessage = signal('');
  protected readonly pushAfter = signal(false);

  // create branch
  protected readonly branchName = signal('');
  protected readonly checkoutAfter = signal(false);
  protected readonly publishBranch = signal(false);

  // checkout commit / branch
  protected readonly checkoutMode = signal<'detach' | 'branch'>('detach');
  protected readonly remoteCheckoutMode = signal<'track' | 'detach'>('track');
  protected readonly remoteBranchName = signal('');

  // cherry-pick / revert
  protected readonly noCommit = signal(false);
  protected readonly recordSource = signal(false);
  protected readonly signoff = signal(false);
  protected readonly mainline = signal(1);

  // merge / rebase
  protected readonly mergeMode = signal<MergeMode>('default');
  protected readonly mergeNoCommit = signal(false);
  protected readonly autostash = signal(false);
  protected readonly preserveMerges = signal(false);

  // reset commit
  protected readonly resetMode = signal<'soft' | 'mixed' | 'hard'>('soft');

  // tag push/delete, branch delete
  protected readonly pushForce = signal(false);
  protected readonly deleteRemoteToo = signal(false);
  protected readonly deleteForce = signal(false);

  // rename branch
  protected readonly publishRename = signal(false);
  protected readonly deleteRemoteOld = signal(false);
  protected readonly renameName = signal('');

  // pull
  protected readonly pullMode = signal<PullMode>('merge');

  // stash
  protected readonly stashMessage = signal('');
  protected readonly stashScope = signal<StashScope>('all');
  protected readonly includeUntracked = signal(true);
  protected readonly restoreIndex = signal(false);

  protected readonly mergeChoices: Choice<MergeMode>[] = [
    { value: 'default', label: 'Default', description: 'Fast-forward when possible, otherwise create a merge commit' },
    { value: 'no-ff', label: 'No fast-forward', description: 'Always create a merge commit' },
    { value: 'ff-only', label: 'Fast-forward only', description: 'Refuse the merge when it cannot be fast-forwarded' },
    { value: 'squash', label: 'Squash', description: 'Stage the merged changes without a merge commit' },
  ];

  protected readonly pullChoices: Choice<PullMode>[] = [
    { value: 'merge', label: 'Merge', description: 'Create a merge commit when needed (default Git behavior)' },
    { value: 'rebase', label: 'Rebase', description: 'Replay local commits on top of the pulled commits' },
    { value: 'ff-only', label: 'Fast-forward only', description: 'Only update when the branch can be fast-forwarded' },
  ];

  protected readonly resetChoices: Choice<'soft' | 'mixed' | 'hard'>[] = [
    { value: 'soft', label: 'Soft', description: 'Move the branch pointer; keep the index and working tree' },
    { value: 'mixed', label: 'Mixed', description: 'Unstage the changes; keep them in the working tree' },
    { value: 'hard', label: 'Hard', description: 'Discard all index and working-tree changes', danger: true },
  ];

  constructor() {
    effect(() => {
      const state = this.state();
      untracked(() => {
        this.resetDefaults(state);
        // Focus the primary control once the per-action form is rendered.
        queueMicrotask(() => this.focusEl()?.nativeElement.focus());
      });
    });
    // Keep the remote selection valid once the remote list arrives.
    effect(() => {
      const remotes = this.remotes();
      if (!remotes.length) return;
      if (!remotes.some((remote) => remote.name === this.remote())) {
        this.remote.set(
          remotes.some((remote) => remote.name === 'origin') ? 'origin' : remotes[0].name,
        );
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.busy()) this.closed.emit();
  }

  // ---- derived state ----

  protected readonly action = computed(() => this.state().action);

  protected readonly title = computed(() => {
    switch (this.action()) {
      case 'add-tag':
        return 'Add Tag';
      case 'create-branch':
        return 'Create Branch';
      case 'checkout-commit':
        return 'Checkout Commit';
      case 'checkout-branch':
        return 'Checkout Branch';
      case 'cherry-pick':
        return 'Cherry Pick';
      case 'revert':
        return 'Revert Commit';
      case 'drop-commit':
        return 'Drop Commit';
      case 'merge':
        return 'Merge';
      case 'rebase':
        return 'Rebase';
      case 'reset-commit':
        return 'Reset Branch';
      case 'push-tag':
        return 'Push Tag';
      case 'delete-tag':
        return 'Delete Tag';
      case 'rename-branch':
        return 'Rename Branch';
      case 'delete-branch':
        return 'Delete Branch';
      case 'delete-remote-branch':
        return 'Delete Remote Branch';
      case 'pull-branch':
        return 'Pull';
      case 'stash-save':
        return 'Stash Changes';
      case 'stash-apply':
        return 'Apply Stash';
      case 'stash-pop':
        return 'Pop Stash';
    }
  });

  protected readonly okLabel = computed(() => {
    switch (this.action()) {
      case 'checkout-commit':
      case 'checkout-branch':
        return 'Checkout';
      case 'cherry-pick':
        return 'Cherry Pick';
      case 'revert':
        return 'Revert';
      case 'push-tag':
        return 'Push Tag';
      case 'delete-tag':
        return 'Delete Tag';
      case 'rename-branch':
        return 'Rename';
      case 'delete-branch':
        return 'Delete Branch';
      case 'delete-remote-branch':
        return 'Delete Remote Branch';
      case 'stash-save':
        return 'Stash';
      case 'stash-apply':
        return 'Apply';
      case 'stash-pop':
        return 'Pop';
      default:
        return this.title();
    }
  });

  protected readonly danger = computed(() =>
    [
      'revert',
      'drop-commit',
      'reset-commit',
      'delete-tag',
      'delete-branch',
      'delete-remote-branch',
    ].includes(this.action()),
  );

  /** One-line description of what the action targets. */
  protected readonly targetSummary = computed(() => {
    const state = this.state();
    if (state.commit) {
      return `${state.commit.hash.slice(0, 8)} ${state.commit.message}`;
    }
    if (state.stash) {
      return `stash@{${state.stash.index}} ${state.stash.message}`;
    }
    return state.ref ?? '';
  });

  protected readonly targetKind = computed(() => {
    const state = this.state();
    if (state.commit) return 'Commit';
    if (state.stash) return 'Stash';
    if (state.action === 'add-tag' || state.action === 'push-tag' || state.action === 'delete-tag')
      return 'Tag';
    return 'Branch';
  });

  /** Secondary line explaining the operation in terms of the current branch. */
  protected readonly contextLine = computed(() => {
    const state = this.state();
    const branch = state.currentBranch || 'detached HEAD';
    switch (state.action) {
      case 'merge':
        return `Merge ${this.targetSummary()} into ${branch}`;
      case 'rebase':
        return `Rebase ${branch} onto ${this.targetSummary()}`;
      case 'pull-branch':
        return `Pull ${state.ref ?? ''} into ${branch}`;
      case 'checkout-branch':
        return state.isRemote
          ? `Currently on ${branch}`
          : `Switch the working tree from ${branch} to ${state.ref ?? ''}`;
      default:
        return '';
    }
  });

  /** Whether the target commit has more than one parent (merge commit). */
  protected readonly isMerge = computed(
    () => (this.state().commit?.parents.length ?? 0) > 1,
  );

  protected readonly parentCount = computed(() => this.state().commit?.parents.length ?? 0);

  protected readonly mainlineChoices = computed<Choice<string>[]>(() => {
    const count = Math.max(this.parentCount(), 2);
    return Array.from({ length: count }, (_, i) => ({
      value: String(i + 1),
      label: `Parent ${i + 1}`,
      description: i === 0 ? 'First parent (the branch merged into)' : 'Side parent (the branch merged in)',
    }));
  });

  protected readonly stashChoices: Choice<StashScope>[] = [
    { value: 'all', label: 'All changes', description: 'Stash staged and unstaged changes' },
    { value: 'staged', label: 'Staged only', description: 'Stash the index without the working tree' },
    { value: 'unstaged', label: 'Unstaged only', description: 'Stash working-tree changes, keeping staged files staged' },
  ];

  /** Whether the remote picker is shown for the current option combination. */
  protected readonly showRemoteSelect = computed(() => {
    switch (this.action()) {
      case 'add-tag':
        return this.pushAfter();
      case 'create-branch':
        return this.publishBranch();
      case 'checkout-commit':
        return this.checkoutMode() === 'branch' && this.publishBranch();
      case 'push-tag':
      case 'delete-remote-branch':
        return true;
      case 'delete-tag':
        return this.deleteRemoteToo();
      case 'rename-branch':
        return this.publishRename() || this.deleteRemoteOld();
      case 'delete-branch':
        return this.deleteRemoteToo();
      default:
        return false;
    }
  });

  protected readonly hasRemotes = computed(() => this.remotes().length > 0);

  /** Remote-dependent options explain themselves when no remote exists. */
  protected readonly noRemotes = computed(
    () => this.remotesLoaded() && !this.hasRemotes(),
  );

  protected readonly canSubmit = computed(() => {
    if (this.busy()) return false;
    switch (this.action()) {
      case 'add-tag':
        return (
          !!this.tagName().trim() &&
          (!this.tagAnnotated() || !!this.tagMessage().trim()) &&
          (!this.pushAfter() || this.hasRemotes())
        );
      case 'create-branch':
        return !!this.branchName().trim() && (!this.publishBranch() || this.hasRemotes());
      case 'checkout-commit':
        return (
          this.checkoutMode() === 'detach' ||
          (!!this.remoteBranchName().trim() && (!this.publishBranch() || this.hasRemotes()))
        );
      case 'checkout-branch': {
        const state = this.state();
        if (!state.isRemote) return true;
        return this.remoteCheckoutMode() === 'detach' || !!this.remoteBranchName().trim();
      }
      case 'delete-remote-branch':
        return this.hasRemotes();
      case 'rename-branch':
        return !!this.renameName().trim();
      default:
        return true;
    }
  });

  // ---- handlers ----

  protected setText(event: Event, target: { set(value: string): void }): void {
    target.set((event.target as HTMLInputElement).value);
  }

  /** Reads the checked state of a checkbox input event. */
  protected check(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected onRemote(event: Event): void {
    this.remote.set((event.target as HTMLSelectElement).value);
  }

  protected onStashScope(scope: StashScope): void {
    this.stashScope.set(scope);
    // Untracked files only ride along when there is a working-tree scope.
    this.includeUntracked.set(scope !== 'staged');
  }

  protected submit(): void {
    const state = this.state();
    if (!state || !this.canSubmit()) return;
    const commit = state.commit;
    let request: GitOperationRequest;
    switch (state.action) {
      case 'add-tag':
        request = {
          action: 'add-tag',
          name: this.tagName().trim(),
          annotate: this.tagAnnotated(),
          message: this.tagAnnotated() ? this.tagMessage().trim() : '',
          push: this.pushAfter(),
          remote: this.remote(),
          ...(commit ? { commit: commit.hash } : {}),
        };
        break;
      case 'create-branch':
        request = {
          action: 'create-branch',
          name: this.branchName().trim(),
          checkout: this.checkoutAfter(),
          publish: this.publishBranch(),
          remote: this.remote(),
          ...(commit ? { commit: commit.hash } : {}),
        };
        break;
      case 'checkout-commit':
        request = {
          action: 'checkout-commit',
          hash: commit?.hash ?? '',
          mode: this.checkoutMode(),
          branchName: this.remoteBranchName().trim(),
          publish: this.publishBranch(),
          remote: this.remote(),
        };
        break;
      case 'checkout-branch':
        request = {
          action: 'checkout-branch',
          branch: state.ref ?? '',
          isRemote: !!state.isRemote,
          mode: state.isRemote ? this.remoteCheckoutMode() : 'switch',
          branchName: this.remoteBranchName().trim(),
        };
        break;
      case 'cherry-pick':
        request = {
          action: 'cherry-pick',
          hash: commit?.hash ?? '',
          noCommit: this.noCommit(),
          recordSource: this.recordSource(),
          signoff: this.signoff(),
          ...(this.isMerge() ? { mainline: this.mainline() } : {}),
        };
        break;
      case 'revert':
        request = {
          action: 'revert',
          hash: commit?.hash ?? '',
          noCommit: this.noCommit(),
          signoff: this.signoff(),
          ...(this.isMerge() ? { mainline: this.mainline() } : {}),
        };
        break;
      case 'drop-commit':
        request = { action: 'drop-commit', hash: commit?.hash ?? '' };
        break;
      case 'merge':
        request = {
          action: 'merge',
          source: commit?.hash ?? state.ref ?? '',
          mode: this.mergeMode(),
          noCommit: this.mergeNoCommit(),
          autostash: this.autostash(),
        };
        break;
      case 'rebase':
        request = {
          action: 'rebase',
          onto: commit?.hash ?? state.ref ?? '',
          autostash: this.autostash(),
          preserveMerges: this.preserveMerges(),
        };
        break;
      case 'reset-commit':
        request = {
          action: 'reset-commit',
          hash: commit?.hash ?? '',
          mode: this.resetMode(),
        };
        break;
      case 'push-tag':
        request = {
          action: 'push-tag',
          name: state.ref ?? '',
          force: this.pushForce(),
          remote: this.remote(),
        };
        break;
      case 'delete-tag':
        request = {
          action: 'delete-tag',
          name: state.ref ?? '',
          deleteRemote: this.deleteRemoteToo(),
          remote: this.remote(),
        };
        break;
      case 'rename-branch':
        request = {
          action: 'rename-branch',
          oldName: state.ref ?? '',
          newName: this.renameName().trim(),
          publish: this.publishRename(),
          deleteRemoteOld: this.deleteRemoteOld(),
          remote: this.remote(),
        };
        break;
      case 'delete-branch':
        request = {
          action: 'delete-branch',
          name: state.ref ?? '',
          force: this.deleteForce(),
          deleteRemote: this.deleteRemoteToo(),
          remote: this.remote(),
        };
        break;
      case 'delete-remote-branch':
        request = {
          action: 'delete-remote-branch',
          branch: (state.ref ?? '').slice((state.ref ?? '').indexOf('/') + 1),
          remote: this.remote(),
        };
        break;
      case 'pull-branch':
        request = {
          action: 'pull-branch',
          branch: (state.ref ?? '').slice((state.ref ?? '').indexOf('/') + 1),
          remote: state.remote ?? this.remote(),
          mode: this.pullMode(),
        };
        break;
      case 'stash-save':
        request = {
          action: 'stash-save',
          message: this.stashMessage().trim(),
          scope: this.stashScope(),
          includeUntracked: this.stashScope() === 'staged' ? false : this.includeUntracked(),
        };
        break;
      case 'stash-apply':
      case 'stash-pop':
        request = {
          action: state.action,
          index: state.stash?.index ?? 0,
          restoreIndex: this.restoreIndex(),
        };
        break;
    }
    this.confirmed.emit(request);
  }

  // ---- internals ----

  private resetDefaults(state: GitOperationDialogState): void {
    this.remote.set(state.remote ?? '');
    this.remotes.set([]);
    this.remotesLoaded.set(false);

    this.tagName.set('');
    this.tagAnnotated.set(false);
    this.tagMessage.set('');
    this.pushAfter.set(false);

    this.branchName.set('');
    this.checkoutAfter.set(false);
    this.publishBranch.set(false);

    this.checkoutMode.set('detach');
    this.remoteCheckoutMode.set('track');
    const ref = state.ref ?? '';
    const slash = ref.indexOf('/');
    this.remoteBranchName.set(state.isRemote && slash > 0 ? ref.slice(slash + 1) : '');
    this.renameName.set(state.action === 'rename-branch' ? ref : '');

    this.noCommit.set(false);
    this.recordSource.set(false);
    this.signoff.set(false);
    this.mainline.set(1);

    this.mergeMode.set('default');
    this.mergeNoCommit.set(false);
    this.autostash.set(false);
    this.preserveMerges.set(false);

    this.resetMode.set('soft');
    this.pushForce.set(false);
    this.deleteRemoteToo.set(false);
    this.deleteForce.set(false);

    this.publishRename.set(false);
    this.deleteRemoteOld.set(false);
    this.pullMode.set('merge');

    const scope = state.stashScope ?? 'all';
    this.stashMessage.set('');
    this.stashScope.set(scope);
    this.includeUntracked.set(scope !== 'staged');
    this.restoreIndex.set(false);

    this.loadRemotes(state.action);
  }

  private loadRemotes(action: GitOperationDialogState['action']): void {
    if (!REMOTE_ACTIONS.has(action)) return;
    this.git.getRemotes().subscribe({
      next: (remotes) => {
        this.remotes.set(remotes);
        this.remotesLoaded.set(true);
      },
      error: () => {
        this.remotes.set([]);
        this.remotesLoaded.set(true);
      },
    });
  }
}
