import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { BranchInfo } from '../../models/git.models';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
  readonly branches = input.required<BranchInfo[]>();
  readonly selectedBranch = input.required<string>();
  readonly showRemote = input.required<boolean>();
  readonly busy = input.required<boolean>();
  /** Azure DevOps URL is configured; enables the Create Pull Request menu item. */
  readonly prEnabled = input(false);

  readonly branchChange = output<string>();
  readonly remoteToggle = output<boolean>();
  readonly refresh = output<void>();
  readonly remoteAction = output<
    'fetch' | 'pull' | 'pull-rebase' | 'rebase-from' | 'push' | 'push-force' | 'sync' | 'create-pr'
  >();
  readonly settingsClick = output<void>();
  protected readonly openMenu = signal<'pull' | 'push' | null>(null);

  protected readonly visibleBranches = computed(() => {
    return this.branches();
  });

  protected onBranchChange(event: Event): void {
    this.branchChange.emit((event.target as HTMLSelectElement).value);
  }

  protected onRemoteToggle(event: Event): void {
    this.remoteToggle.emit((event.target as HTMLInputElement).checked);
  }

  protected toggleMenu(menu: 'pull' | 'push', event: MouseEvent): void {
    event.stopPropagation();
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected chooseRemoteAction(
    action: 'pull' | 'pull-rebase' | 'rebase-from' | 'push' | 'push-force' | 'sync' | 'create-pr',
  ): void {
    this.openMenu.set(null);
    this.remoteAction.emit(action);
  }

  @HostListener('document:click')
  protected closeMenu(): void {
    this.openMenu.set(null);
  }

  @HostListener('document:keydown.escape')
  protected closeMenuOnEscape(): void {
    this.openMenu.set(null);
  }
}
