import { ErrorBanner } from '../error-banner/error-banner';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  BranchInfo,
  ContextMenuState,
  FileDiff,
  PromptState,
  StashScope,
  WorkingChanges,
} from '../../models/git.models';
import { VscodeService } from '../../services/vscode.service';
import { copyTextToClipboard } from '../../utils/clipboard';
import { FileTreeRow, buildFileTreeRows } from '../../utils/file-tree';
import {
  clearPanelWidth,
  clampPanelWidth,
  loadPanelWidth,
  savePanelWidth,
  startPanelResize,
} from '../../utils/panel-resize';
import { ContextMenu } from '../context-menu/context-menu';
import { ConflictDialog } from '../conflict-dialog/conflict-dialog';
import { DiffDialog } from '../diff-dialog/diff-dialog';
import { PromptDialog } from '../prompt-dialog/prompt-dialog';
import { CloseButton } from '../close-button/close-button';

type Group = 'staged' | 'unstaged';

/** localStorage key holding the persisted detail-panel width; shared with the commit detail. */
const DETAIL_WIDTH_KEY = 'guito.detailPanelWidth';
/** Narrowest usable detail panel. */
const DETAIL_MIN_WIDTH = 300;

@Component({
  selector: 'app-working-panel',
  imports: [ErrorBanner, ContextMenu, ConflictDialog, DiffDialog, PromptDialog, CloseButton],
  templateUrl: './working-panel.html',
  styleUrl: './working-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--panel-width]': 'panelWidthCss()',
    '[class.resizing]': 'resizing()',
  },
})
export class WorkingPanel implements OnDestroy {
  private readonly vscode = inject(VscodeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly changes = input<WorkingChanges | null>(null);
  readonly branches = input.required<BranchInfo[]>();
  readonly busy = input(false);
  readonly statusLoading = input(false);
  readonly statusError = input('');
  readonly subject = input('');
  readonly description = input('');
  /** How the file lists are rendered: a flat list or a collapsible directory tree. */
  readonly fileListView = input<'flat' | 'tree'>('flat');
  readonly subjectChange = output<string>();
  readonly descriptionChange = output<string>();
  /** Asks the app to draft a commit message with Claude Code. */
  readonly generateMessage = output<void>();
  /** Asks the app to code review the uncommitted changes with Claude Code. */
  readonly reviewChanges = output<void>();
  /** Asks the app to stop the running code review. */
  readonly stopReview = output<void>();
  readonly stageChange = output<{ staged: boolean; files: string[] }>();
  readonly stashChange = output<StashScope>();
  readonly discardRequest = output<string[]>();
  readonly commitRequested = output<void>();
  readonly conflictResolved = output<void>();
  readonly retry = output<void>();
  readonly closed = output<void>();
  protected readonly groups: Group[] = ['staged', 'unstaged'];
  protected readonly selected = signal<Record<Group, Set<string>>>({
    staged: new Set(),
    unstaged: new Set(),
  });
  private readonly anchors: Record<Group, string | null> = { staged: null, unstaged: null };
  protected readonly dialog = signal<{
    file: FileDiff;
    originalRef: string;
    modifiedRef: string;
    exactOriginal: boolean;
  } | null>(null);
  protected readonly comparePrompt = signal<PromptState | null>(null);
  private compareTarget: { file: FileDiff; group: Group } | null = null;
  protected readonly selectedConflict = signal<string | null>(null);
  protected readonly contextMenu = signal<ContextMenuState | null>(null);
  private contextMenuTarget: { file: FileDiff; group: Group } | null = null;
  /** Collapsed directory paths (shared by both groups); keyed by full path so
   * the folders stay collapsed across working-tree refreshes. */
  protected readonly collapsed = signal<Set<string>>(new Set());
  protected readonly disabled = computed(
    () => this.busy() || !!this.statusError() || !this.changes(),
  );
  /** A message draft is running; the message box stays editable meanwhile. */
  readonly generating = input(false);
  /** Why the last draft attempt failed; cleared when the next one starts. */
  readonly generateError = input('');
  protected readonly canGenerate = computed(
    () => !this.disabled() && !this.generating() && !!this.changes()?.files.length,
  );
  /** A code review of the uncommitted changes is running. */
  readonly reviewing = input(false);
  /** Why the last code review failed. */
  readonly reviewError = input('');
  /** The finished code review, when the browser would not open it by itself. */
  readonly reviewLink = input('');
  protected readonly canReview = computed(
    () => !this.disabled() && !!this.changes()?.files.length,
  );
  protected readonly canCommit = computed(
    () =>
      !this.disabled() &&
      !!this.subject().trim() &&
      !!this.changes()?.staged.length &&
      !this.changes()?.conflicted.length,
  );

  constructor() {
    effect(() => {
      const changes = this.changes();
      this.selected.update((current) => {
        const next = { ...current };
        for (const group of this.groups) {
          const available = new Set(
            (group === 'staged' ? changes?.stagedFiles : changes?.unstagedFiles)?.map(
              (file) => file.path,
            ),
          );
          next[group] = new Set([...current[group]].filter((path) => available.has(path)));
          if (this.anchors[group] && !available.has(this.anchors[group]!))
            this.anchors[group] = null;
        }
        return next;
      });
      this.dialog.set(null);
      this.closeContextMenu();
    });
  }

  protected files(group: Group): FileDiff[] {
    return (group === 'staged' ? this.changes()?.stagedFiles : this.changes()?.unstagedFiles) ?? [];
  }

  /** Rows rendered for a group: tree folders plus files, or the flat file list. */
  protected rows(group: Group): FileTreeRow[] {
    const files = this.files(group);
    if (this.fileListView() !== 'tree') {
      // Flat view keeps the full path as the row label.
      return files.map((file) => ({
        kind: 'file',
        path: file.path,
        name: file.path,
        depth: 0,
        file,
      }));
    }
    return buildFileTreeRows(files, this.collapsed());
  }

  /** File paths in display order; drives shift-range selection and arrow focus. */
  private orderedPaths(group: Group): string[] {
    return this.rows(group)
      .filter((row) => row.kind === 'file')
      .map((row) => row.path);
  }

  /** Expands or collapses a directory row. */
  protected toggleDir(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  /** Opens the file's diff in VS Code when configured, otherwise in the dialog. */
  protected openDiff(group: Group, file: FileDiff): void {
    if (this.busy()) return;
    const originalRef = group === 'staged' ? 'HEAD' : 'INDEX';
    const modifiedRef = group === 'staged' ? 'INDEX' : 'WORKING';
    if (this.vscode.openDiff(file, originalRef, modifiedRef)) {
      return;
    }
    this.dialog.set({ file, originalRef, modifiedRef, exactOriginal: false });
  }

  private comparisonBranches(): BranchInfo[] {
    return this.branches().filter((branch) => !branch.current && !branch.name.endsWith('/HEAD'));
  }

  private openBranchComparison(group: Group, file: FileDiff): void {
    const branches = this.comparisonBranches();
    if (this.busy() || !branches.length) return;
    this.compareTarget = { file, group };
    this.comparePrompt.set({
      title: 'Compare with Branch',
      label: `Select the branch version to compare with ${file.path}.`,
      okLabel: 'Compare',
      searchable: true,
      options: branches.map((branch) => ({
        value: branch.name,
        label: branch.name,
        description: branch.remote ? 'Remote branch' : 'Local branch',
      })),
    });
  }

  protected compareWithBranch(branch: string): void {
    const target = this.compareTarget;
    this.closeComparePrompt();
    if (!target || !this.comparisonBranches().some((candidate) => candidate.name === branch))
      return;
    const modifiedRef = target.group === 'staged' ? 'INDEX' : 'WORKING';
    if (this.vscode.openDiff(target.file, branch, modifiedRef, true)) return;
    this.dialog.set({ file: target.file, originalRef: branch, modifiedRef, exactOriginal: true });
  }

  protected closeComparePrompt(): void {
    this.comparePrompt.set(null);
    this.compareTarget = null;
  }

  /** Shows file-specific actions without changing the current multi-selection. */
  protected openContextMenu(event: MouseEvent, group: Group, file: FileDiff): void {
    event.preventDefault();
    this.contextMenuTarget = { file, group };
    this.contextMenu.set({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Open Diff', action: 'open-diff', disabled: this.busy() },
        {
          label: 'Compare with Branch...',
          action: 'compare-branch',
          disabled: this.busy() || !this.comparisonBranches().length,
        },
        {
          label: 'Open File',
          action: 'open-file',
          disabled: !this.vscode.canOpenFile(),
        },
        { label: 'Copy File Path', action: 'copy-file-path' },
      ],
    });
  }

  protected runContextAction(action: string): void {
    const target = this.contextMenuTarget;
    if (!target) return;
    if (action === 'open-diff') {
      this.openDiff(target.group, target.file);
    } else if (action === 'compare-branch') {
      this.openBranchComparison(target.group, target.file);
    } else if (action === 'open-file') {
      this.vscode.openFile(target.file.path);
    } else if (action === 'copy-file-path') {
      void copyTextToClipboard(target.file.path);
    }
  }

  protected closeContextMenu(): void {
    this.contextMenu.set(null);
    this.contextMenuTarget = null;
  }

  protected select(group: Group, path: string, event: MouseEvent | KeyboardEvent): void {
    const additive = event.ctrlKey || event.metaKey;
    const paths = this.orderedPaths(group);
    const anchor = this.anchors[group];
    const range = event.shiftKey && anchor !== null && paths.includes(anchor);
    const selection = additive ? new Set(this.selected()[group]) : new Set<string>();
    if (range) {
      const start = paths.indexOf(anchor!);
      const end = paths.indexOf(path);
      for (const value of paths.slice(Math.min(start, end), Math.max(start, end) + 1))
        selection.add(value);
    } else {
      if (additive && selection.has(path)) selection.delete(path);
      else selection.add(path);
      this.anchors[group] = path;
    }
    this.selected.update((current) => ({ ...current, [group]: selection }));
  }

  protected keySelect(group: Group, path: string, event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.select(group, path, event);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // Only file rows are selectable; directory toggles are skipped.
      const rows = Array.from(
        (event.currentTarget as HTMLElement)
          .closest('.file-list')!
          .querySelectorAll<HTMLElement>('.file-row'),
      );
      const index = rows.indexOf(event.currentTarget as HTMLElement);
      const next = Math.max(
        0,
        Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
      );
      rows[next]?.focus();
      if (event.shiftKey) this.select(group, this.orderedPaths(group)[next], event);
    }
  }

  protected move(group: Group, paths: string[]): void {
    if (this.disabled() || !paths.length) return;
    this.stageChange.emit({ staged: group === 'staged', files: paths });
  }

  protected openConflict(path: string): void {
    if (this.disabled()) return;
    if (!this.vscode.openMergeConflict(path)) this.selectedConflict.set(path);
  }

  protected onConflictResolved(): void {
    this.selectedConflict.set(null);
    this.conflictResolved.emit();
  }

  protected moveSelected(group: Group): void {
    this.move(group, [...this.selected()[group]]);
  }
  protected moveAll(group: Group): void {
    this.move(
      group,
      this.files(group).map((file) => file.path),
    );
  }
  protected stash(scope: StashScope): void {
    if (this.disabled()) return;
    this.stashChange.emit(scope);
  }
  protected discard(files: string[]): void {
    if (this.disabled() || !files.length) return;
    this.discardRequest.emit(files);
  }
  protected discardSelected(): void {
    this.discard([...this.selected()['unstaged']]);
  }
  protected discardAll(): void {
    this.discard(this.files('unstaged').map((file) => file.path));
  }
  protected updateSubject(event: Event): void {
    this.subjectChange.emit((event.target as HTMLInputElement).value);
  }
  protected updateDescription(event: Event): void {
    this.descriptionChange.emit((event.target as HTMLTextAreaElement).value);
  }
  protected generate(): void {
    if (this.canGenerate()) this.generateMessage.emit();
  }
  protected review(): void {
    if (this.canReview()) this.reviewChanges.emit();
  }
  protected commit(event: Event): void {
    event.preventDefault();
    if (this.canCommit()) this.commitRequested.emit();
  }

  // ==================== Panel resizing ====================

  /** Customized panel width; null keeps the stylesheet default. */
  protected readonly panelWidth = signal<number | null>(loadPanelWidth(DETAIL_WIDTH_KEY));
  /** True while the edge is dragged; pauses the open/close width animation. */
  protected readonly resizing = signal(false);
  /** Value for the host's --panel-width property; null removes the override. */
  protected readonly panelWidthCss = computed(() => {
    const width = this.panelWidth();
    return width === null ? null : `${width}px`;
  });

  /** Ends an in-flight drag early when the component is torn down. */
  private detachResize: (() => void) | null = null;

  /** Starts dragging the panel's left edge. */
  protected startResize(event: MouseEvent): void {
    if (this.detachResize) return;
    this.resizing.set(true);
    this.detachResize = startPanelResize(event, {
      direction: -1,
      startWidth: this.effectiveWidth(),
      min: DETAIL_MIN_WIDTH,
      onResize: (width) => this.panelWidth.set(width),
      onEnd: (width) => {
        this.detachResize = null;
        this.resizing.set(false);
        this.panelWidth.set(width);
        savePanelWidth(DETAIL_WIDTH_KEY, width);
      },
    });
  }

  /** Arrow keys resize (Shift for coarse steps); the panel grows leftwards. */
  protected resizeKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 50 : 10;
    const delta = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    if (delta === 0) return;
    event.preventDefault();
    const width = clampPanelWidth(this.effectiveWidth() - delta, DETAIL_MIN_WIDTH);
    this.panelWidth.set(width);
    savePanelWidth(DETAIL_WIDTH_KEY, width);
  }

  /** Double-click restores the stylesheet default. */
  protected resetWidth(): void {
    this.panelWidth.set(null);
    clearPanelWidth(DETAIL_WIDTH_KEY);
  }

  /** The width in effect right now: customized or whatever the stylesheet says. */
  private effectiveWidth(): number {
    return this.panelWidth() ?? this.host.nativeElement.offsetWidth;
  }

  ngOnDestroy(): void {
    this.detachResize?.();
    this.detachResize = null;
  }
}
