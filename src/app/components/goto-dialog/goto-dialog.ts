import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Ctrl+G dialog: jump to a commit by its row number or hash. */
@Component({
  selector: 'app-goto-dialog',
  templateUrl: './goto-dialog.html',
  styleUrl: './goto-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GotoDialog {
  readonly busy = input(false);
  readonly error = input('');
  readonly submitted = output<string>();
  readonly closed = output<void>();

  protected readonly query = signal('');

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    afterNextRender(() => this.inputEl()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const query = this.query().trim();
    if (query && !this.busy()) this.submitted.emit(query);
  }
}
