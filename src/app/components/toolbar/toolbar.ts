import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HostListener, signal } from '@angular/core';
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
  readonly search = input.required<string>();
  readonly busy = input.required<boolean>();

  readonly branchChange = output<string>();
  readonly remoteToggle = output<boolean>();
  readonly searchChange = output<string>();
  readonly refresh = output<void>();
  readonly remoteAction = output<'fetch' | 'pull' | 'pull-rebase' | 'push' | 'sync'>();
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

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  protected toggleMenu(menu: 'pull' | 'push', event: MouseEvent): void {
    event.stopPropagation();
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected chooseRemoteAction(action: 'pull' | 'pull-rebase' | 'push' | 'sync'): void {
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
