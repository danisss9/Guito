import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PromptOption, PromptState } from '../../models/git.models';

@Component({
  selector: 'app-prompt-dialog',
  templateUrl: './prompt-dialog.html',
  styleUrl: './prompt-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptDialog {
  readonly state = input.required<PromptState | null>();
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly value = signal('');
  /** Chosen option when the dialog renders a choice list. */
  protected readonly choice = signal('');

  protected readonly options = computed<PromptOption[]>(() => this.state()?.options ?? []);

  /** Filter text for searchable choice lists (e.g. the rebase branch picker). */
  protected readonly search = signal('');

  /** Options narrowed by the search box; the full list when no filter is set. */
  protected readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    const options = this.options();
    if (!query) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    );
  });

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly searchEl = viewChild<ElementRef<HTMLInputElement>>('searchEl');

  constructor() {
    effect(() => {
      const state = this.state();
      if (state) {
        this.value.set(state.value ?? '');
        this.choice.set(state.options?.[0]?.value ?? '');
        this.search.set('');
      }
      const el = this.inputEl() ?? this.searchEl();
      if (state && el) {
        el.nativeElement.focus();
        el.nativeElement.select();
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.state()) {
      this.cancelled.emit();
    }
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected choose(option: PromptOption): void {
    this.choice.set(option.value);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    // Keep a visible option selected so OK/Enter always acts on a shown choice.
    const visible = this.filteredOptions();
    if (visible.length && !visible.some((option) => option.value === this.choice())) {
      this.choice.set(visible[0].value);
    }
  }

  /** Enter in the filter box confirms with the current selection. */
  protected onSearchEnter(event: Event): void {
    event.preventDefault();
    if (this.filteredOptions().length > 0) {
      this.confirm();
    }
  }

  protected confirm(): void {
    const state = this.state();
    if (!state) {
      return;
    }
    if (state.options?.length) {
      this.confirmed.emit(this.choice());
      return;
    }
    if (!state.confirmOnly && !state.allowEmpty && !this.value().trim()) {
      return;
    }
    this.confirmed.emit(state.confirmOnly ? '' : this.value().trim());
  }
}
