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

  constructor() {
    effect(() => {
      this.message();
      this.busy();
      this.dismissed.set(false);
    });
  }
}
