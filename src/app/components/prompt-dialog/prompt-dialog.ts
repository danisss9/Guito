import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PromptState } from '../../models/git.models';

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

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    effect(() => {
      const state = this.state();
      if (state) {
        this.value.set(state.value ?? '');
      }
      const el = this.inputEl();
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

  protected confirm(): void {
    const state = this.state();
    if (!state) {
      return;
    }
    if (!state.confirmOnly && !state.allowEmpty && !this.value().trim()) {
      return;
    }
    this.confirmed.emit(state.confirmOnly ? '' : this.value().trim());
  }
}
