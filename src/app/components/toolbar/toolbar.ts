import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { SearchBox } from '../search-box/search-box';

/** Remote actions offered by the toolbar menus. */
export type RemoteAction =
  | 'fetch'
  | 'fetch-prune'
  | 'pull'
  | 'pull-rebase'
  | 'rebase-from'
  | 'push'
  | 'push-force'
  | 'sync'
  | 'create-pr';

@Component({
  selector: 'app-toolbar',
  imports: [SearchBox],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
  readonly busy = input.required<boolean>();
  /** Azure DevOps URL is configured; enables the Create Pull Request menu item. */
  readonly prEnabled = input(false);
  /** Whether the left repository panel is open; reflected on the toggle button. */
  readonly panelOpen = input(false);

  readonly matchIndex = input(-1);
  readonly matchCount = input(0);
  readonly filterMode = input(false);

  readonly menuToggle = output<void>();
  readonly refresh = output<void>();
  readonly remoteAction = output<RemoteAction>();
  readonly settingsClick = output<void>();
  readonly searchChange = output<string>();
  readonly searchNavigate = output<'next' | 'prev'>();

  protected readonly openMenu = signal<'fetch' | 'pull' | 'push' | 'overflow' | null>(
    null,
  );

  protected toggleMenu(
    menu: 'fetch' | 'pull' | 'push' | 'overflow',
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected chooseRemoteAction(action: RemoteAction): void {
    this.openMenu.set(null);
    this.remoteAction.emit(action);
  }

  protected chooseRefresh(): void {
    this.openMenu.set(null);
    this.refresh.emit();
  }

  protected chooseSettings(): void {
    this.openMenu.set(null);
    this.settingsClick.emit();
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
