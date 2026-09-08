import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/** A selectable suggestion behind a chip input. */
export interface ChipSuggestion {
  id: string;
  label: string;
  description?: string;
}

/**
 * A chip list with a typeahead input. The parent owns the query, suggestion
 * and selected-chip state; this component only renders it and forwards
 * interactions. Suggestions are picked via mousedown so the input keeps
 * focus (a click would blur it and close the list first).
 */
@Component({
  selector: 'app-chip-input',
  templateUrl: './chip-input.html',
  styleUrl: './chip-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipInput {
  readonly placeholder = input('');
  readonly chips = input<ChipSuggestion[]>([]);
  readonly suggestions = input<ChipSuggestion[]>([]);
  readonly loading = input(false);
  readonly query = input('');
  readonly disabled = input(false);
  /** Enter adds the typed text as a chip when no suggestion matches (tags). */
  readonly allowFreeText = input(false);

  readonly queryChange = output<string>();
  readonly select = output<ChipSuggestion>();
  readonly remove = output<ChipSuggestion>();

  protected readonly open = signal(false);
  protected readonly highlight = signal(0);

  protected onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.highlight.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();
    if (event.key === 'ArrowDown' && list.length) {
      event.preventDefault();
      this.highlight.update((index) => Math.min(index + 1, list.length - 1));
    } else if (event.key === 'ArrowUp' && list.length) {
      event.preventDefault();
      this.highlight.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choice = list[this.highlight()];
      if (choice) {
        this.pick(choice);
        return;
      }
      // Free-text mode (e.g. tags): Enter adds the typed text as a chip.
      const text = this.query().trim();
      if (this.allowFreeText() && text) {
        this.open.set(false);
        this.select.emit({ id: text.toLowerCase(), label: text });
      }
    } else if (event.key === 'Escape') {
      // Close only the suggestion list; stopPropagation keeps the dialog open.
      if (this.open()) {
        event.stopPropagation();
        this.open.set(false);
      }
    }
  }

  protected pick(choice: ChipSuggestion): void {
    this.open.set(false);
    this.select.emit(choice);
  }

  protected onSuggestionMouseDown(event: MouseEvent, choice: ChipSuggestion): void {
    event.preventDefault();
    this.pick(choice);
  }

  protected onBlur(): void {
    // Give a pending focus-keeping pick a chance to run first.
    setTimeout(() => this.open.set(false), 120);
  }
}
