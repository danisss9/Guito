import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FileDiff, WorkingChanges } from '../../models/git.models';
import { DiffDialog } from '../diff-dialog/diff-dialog';

type Group = 'staged' | 'unstaged';

@Component({
  selector: 'app-working-panel',
  imports: [DiffDialog],
  templateUrl: './working-panel.html',
  styleUrl: './working-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingPanel {
  readonly changes = input<WorkingChanges | null>(null);
  readonly busy = input(false);
  readonly statusLoading = input(false);
  readonly statusError = input('');
  readonly subject = input('');
  readonly description = input('');
  readonly subjectChange = output<string>();
  readonly descriptionChange = output<string>();
  readonly stageChange = output<{ staged: boolean; files: string[] }>();
  readonly commitRequested = output<void>();
  readonly retry = output<void>();
  readonly closed = output<void>();
  protected readonly groups: Group[] = ['staged', 'unstaged'];
  protected readonly selected = signal<Record<Group, Set<string>>>({ staged: new Set(), unstaged: new Set() });
  private readonly anchors: Record<Group, string | null> = { staged: null, unstaged: null };
  protected readonly dialog = signal<{ file: FileDiff; group: Group } | null>(null);
  protected readonly disabled = computed(() => this.busy() || !!this.statusError() || !this.changes());
  protected readonly canCommit = computed(() => !this.disabled() && !!this.subject().trim() &&
    !!this.changes()?.staged.length && !this.changes()?.conflicted.length);

  constructor() {
    effect(() => {
      const changes = this.changes();
      this.selected.update(current => {
        const next = { ...current };
        for (const group of this.groups) {
          const available = new Set((group === 'staged' ? changes?.stagedFiles : changes?.unstagedFiles)?.map(file => file.path));
          next[group] = new Set([...current[group]].filter(path => available.has(path)));
          if (this.anchors[group] && !available.has(this.anchors[group]!)) this.anchors[group] = null;
        }
        return next;
      });
      this.dialog.set(null);
    });
  }

  protected files(group: Group): FileDiff[] {
    return (group === 'staged' ? this.changes()?.stagedFiles : this.changes()?.unstagedFiles) ?? [];
  }

  protected select(group: Group, path: string, event: MouseEvent | KeyboardEvent): void {
    const additive = event.ctrlKey || event.metaKey;
    const paths = this.files(group).map(file => file.path);
    const anchor = this.anchors[group];
    const range = event.shiftKey && anchor !== null && paths.includes(anchor);
    const selection = additive ? new Set(this.selected()[group]) : new Set<string>();
    if (range) {
      const start = paths.indexOf(anchor!); const end = paths.indexOf(path);
      for (const value of paths.slice(Math.min(start, end), Math.max(start, end) + 1)) selection.add(value);
    } else {
      if (additive && selection.has(path)) selection.delete(path); else selection.add(path);
      this.anchors[group] = path;
    }
    this.selected.update(current => ({ ...current, [group]: selection }));
  }

  protected keySelect(group: Group, path: string, event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); this.select(group, path, event);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const rows = Array.from((event.currentTarget as HTMLElement).closest('.file-list')!.querySelectorAll<HTMLElement>('[role="option"]'));
      const index = rows.indexOf(event.currentTarget as HTMLElement);
      const next = Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      rows[next]?.focus();
      if (event.shiftKey) this.select(group, this.files(group)[next].path, event);
    }
  }

  protected move(group: Group, paths: string[]): void {
    if (this.disabled() || !paths.length) return;
    this.stageChange.emit({ staged: group === 'staged', files: paths });
  }

  protected moveSelected(group: Group): void { this.move(group, [...this.selected()[group]]); }
  protected moveAll(group: Group): void { this.move(group, this.files(group).map(file => file.path)); }
  protected updateSubject(event: Event): void { this.subjectChange.emit((event.target as HTMLInputElement).value); }
  protected updateDescription(event: Event): void { this.descriptionChange.emit((event.target as HTMLTextAreaElement).value); }
  protected commit(event: Event): void { event.preventDefault(); if (this.canCommit()) this.commitRequested.emit(); }
}
