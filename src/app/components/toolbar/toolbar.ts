import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BranchInfo } from '../../models/git.models';

/** How long to wait after the last keystroke before applying the search. */
const SEARCH_DEBOUNCE_MS = 300;

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
  /** 0-based position of the currently focused search match; -1 = none. */
  readonly matchIndex = input(-1);
  /** Total number of commits matching the current search. */
  readonly matchCount = input(0);

  readonly branchChange = output<string>();
  readonly remoteToggle = output<boolean>();
  readonly searchChange = output<string>();
  readonly searchNavigate = output<'next' | 'prev'>();
  readonly refresh = output<void>();
  readonly remoteAction = output<
    'fetch' | 'pull' | 'pull-rebase' | 'rebase-from' | 'push' | 'push-force' | 'sync'
  >();
  protected readonly openMenu = signal<'pull' | 'push' | null>(null);

  /** Raw search text; bound to the input so typing stays responsive. */
  protected readonly searchValue = signal('');

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    // Apply the search only after typing settles and only when it changed.
    toObservable(this.searchValue)
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.searchChange.emit(value));
  }

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
    this.searchValue.set((event.target as HTMLInputElement).value);
  }

  /** Enter jumps to the next match; Shift+Enter to the previous one. */
  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchNavigate.emit(event.shiftKey ? 'prev' : 'next');
    }
  }

  /** Clears the search; the debounced pipeline emits the empty query itself. */
  protected clearSearch(): void {
    this.searchValue.set('');
    this.searchInput()?.nativeElement.focus();
  }

  protected toggleMenu(menu: 'pull' | 'push', event: MouseEvent): void {
    event.stopPropagation();
    this.openMenu.update((current) => (current === menu ? null : menu));
  }

  protected chooseRemoteAction(
    action: 'pull' | 'pull-rebase' | 'rebase-from' | 'push' | 'push-force' | 'sync',
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
