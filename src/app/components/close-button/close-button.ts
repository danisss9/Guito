import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** The standard "X" close button used by panels and dialogs. */
@Component({
  selector: 'app-close-button',
  template: `
    <button
      type="button"
      [title]="label()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="pressed.emit()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  `,
  styleUrl: './close-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseButton {
  readonly label = input('Close');
  readonly disabled = input(false);
  readonly pressed = output<void>();
}
