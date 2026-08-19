import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { ContextMenuState, MenuItem } from '../../models/git.models';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenu {
  readonly menu = input.required<ContextMenuState | null>();
  readonly select = output<string>();
  readonly closed = output<void>();

  protected readonly left = computed(() => {
    const menu = this.menu();
    if (!menu) {
      return 0;
    }
    return Math.max(4, Math.min(menu.x, window.innerWidth - 250));
  });

  protected readonly top = computed(() => {
    const menu = this.menu();
    if (!menu) {
      return 0;
    }
    const height = menu.items.length * 30 + 12;
    return Math.max(4, Math.min(menu.y, window.innerHeight - height - 8));
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menu()) {
      this.closed.emit();
    }
  }

  protected onSelect(item: MenuItem): void {
    if (item.disabled || !item.action) {
      return;
    }
    this.select.emit(item.action);
    this.closed.emit();
  }
}
