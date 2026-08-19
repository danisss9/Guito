import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BranchInfo } from '../../models/git.models';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
  readonly branches = input.required<BranchInfo[]>();
  readonly selectedBranch = input.required<string>();
  readonly showRemote = input.required<boolean>();
  readonly search = input.required<string>();
  readonly busy = input.required<boolean>();

  readonly branchChange = output<string>();
  readonly remoteToggle = output<boolean>();
  readonly searchChange = output<string>();
  readonly refresh = output<void>();
  readonly remoteAction = output<'fetch' | 'pull' | 'push'>();

  protected readonly visibleBranches = computed(() => {
    const all = this.branches();
    return this.showRemote() ? all : all.filter((branch) => !branch.remote);
  });

  protected onBranchChange(event: Event): void {
    this.branchChange.emit((event.target as HTMLSelectElement).value);
  }

  protected onRemoteToggle(event: Event): void {
    this.remoteToggle.emit((event.target as HTMLInputElement).checked);
  }

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
