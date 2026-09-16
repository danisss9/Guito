import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-error-banner',
  templateUrl: './error-banner.html',
  styleUrl: './error-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBanner {
  readonly message = input.required<string>();
  readonly retryLabel = input('');
  readonly busy = input(false);
  readonly retry = output<void>();
  protected readonly dismissed = signal(false);
  protected readonly closing = signal(false);

  constructor() {
    effect(() => {
      this.message();
      this.busy();
      this.closing.set(false);
      this.dismissed.set(false);
    });
  }

  protected dismiss(): void {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.dismissed.set(true);
      return;
    }
    this.closing.set(true);
  }

  protected finishDismiss(event: AnimationEvent): void {
    if (event.target !== event.currentTarget || !this.closing()) return;
    this.dismissed.set(true);
  }
}
