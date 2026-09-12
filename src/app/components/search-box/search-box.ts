import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

/** How long to wait after the last keystroke before applying the search. */
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-search-box',
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBox {
  /** 0-based position of the currently focused search match; -1 = none. */
  readonly matchIndex = input(-1);
  /** Total number of commits matching the current search. */
  readonly matchCount = input(0);
  readonly filterMode = input(false);

  readonly searchChange = output<string>();
  readonly searchNavigate = output<'next' | 'prev'>();

  /** Raw search text; bound to the input so typing stays responsive. */
  protected readonly searchValue = signal('');
  protected readonly badgeText = computed(() => {
    const total = this.matchCount();
    const formattedTotal = total > 99 ? '99+' : String(total);
    if (!this.filterMode() && this.matchIndex() >= 0) {
      return `${this.matchIndex() + 1}/${formattedTotal}`;
    }
    return formattedTotal;
  });

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    // Apply the search only after typing settles and only when it changed.
    toObservable(this.searchValue)
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.searchChange.emit(value));
  }

  protected onSearch(event: Event): void {
    this.searchValue.set((event.target as HTMLInputElement).value);
  }

  /** Enter jumps to the next match; Shift+Enter to the previous one. */
  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.filterMode()) {
      event.preventDefault();
      this.searchNavigate.emit(event.shiftKey ? 'prev' : 'next');
    }
  }

  /** Clears the search; the debounced pipeline emits the empty query itself. */
  protected clearSearch(): void {
    this.searchValue.set('');
    this.searchInput()?.nativeElement.focus();
  }
}
