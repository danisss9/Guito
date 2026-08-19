import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ContextMenuEvent,
  GitCommit,
  RefBadge,
  WORKING_HASH,
  WorkingChanges,
} from '../../models/git.models';
import { GraphCommit, computeGraph, laneColor } from '../../utils/graph';
import { isHeadCommit, parseRefs } from '../../utils/refs';

interface GraphNodeView {
  hash: string;
  x: number;
  y: number;
  color: string;
  isHead: boolean;
}

interface GraphEdgeView {
  d: string;
  color: string;
}

interface HighlightSegment {
  text: string;
  match: boolean;
}

type ResizableColumn = 'graph' | 'date' | 'author' | 'commit';

const ROW_HEIGHT = 34;
const LANE_WIDTH = 14;
const GRAPH_PADDING = 10;
const MIN_GRAPH_WIDTH = 72;
const PAGE_SIZE = 500;

@Component({
  selector: 'app-commit-table',
  imports: [DatePipe],
  templateUrl: './commit-table.html',
  styleUrl: './commit-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitTable implements OnDestroy {
  readonly commits = input.required<GitCommit[]>();
  readonly selectedHash = input.required<string>();
  readonly search = input<string>('');
  readonly selectedBranch = input<string>('');
  readonly showRemote = input(true);
  readonly workingChanges = input<WorkingChanges | null>(null);

  readonly commitClick = output<GitCommit>();
  readonly contextMenu = output<ContextMenuEvent>();

  protected readonly limit = signal(PAGE_SIZE);

  protected readonly columnWidths = signal<Record<ResizableColumn, number>>({
    graph: 0,
    date: 132,
    author: 150,
    commit: 84,
  });

  protected readonly displayed = computed(() => this.commits().slice(0, this.limit()));

  protected readonly graphCommits = computed<GraphCommit[]>(() => computeGraph(this.displayed()));

  protected readonly graphWidth = computed(() => {
    const lanes = this.graphCommits().reduce((max, entry) => Math.max(max, entry.lane), 0) + 1;
    return Math.max(MIN_GRAPH_WIDTH, GRAPH_PADDING * 2 + lanes * LANE_WIDTH);
  });

  protected readonly graphColumnWidth = computed(() =>
    Math.max(this.graphWidth(), this.columnWidths().graph),
  );

  protected readonly graphHeight = computed(() => this.graphCommits().length * ROW_HEIGHT);

  protected readonly nodes = computed<GraphNodeView[]>(() =>
    this.graphCommits().map((entry, index) => ({
      hash: entry.commit.hash,
      x: this.laneX(entry.lane),
      y: index * ROW_HEIGHT + ROW_HEIGHT / 2,
      color: laneColor(entry.lane),
      isHead: isHeadCommit(entry.commit),
    })),
  );

  protected readonly edges = computed<GraphEdgeView[]>(() => {
    const graph = this.graphCommits();
    const rowOf = new Map(graph.map((entry, index) => [entry.commit.hash, index]));
    const laneOf = new Map(graph.map((entry) => [entry.commit.hash, entry.lane]));
    const height = this.graphHeight();
    const edges: GraphEdgeView[] = [];

    graph.forEach((entry, index) => {
      const color = laneColor(entry.lane);
      const x1 = this.laneX(entry.lane);
      const y1 = index * ROW_HEIGHT + ROW_HEIGHT / 2;

      for (const parent of entry.parents) {
        const parentRow = rowOf.get(parent);

        if (parentRow === undefined) {
          // Parent is outside the visible list: draw the lane to the bottom.
          edges.push({ d: `M ${x1} ${y1} L ${x1} ${height}`, color });
          continue;
        }

        const x2 = this.laneX(laneOf.get(parent) ?? entry.lane);
        const y2 = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        if (x1 === x2) {
          edges.push({ d: `M ${x1} ${y1} L ${x2} ${y2}`, color });
        } else {
          const midY = (y1 + y2) / 2;
          edges.push({ d: `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`, color });
        }
      }
    });

    return edges;
  });

  protected readonly remaining = computed(() => this.commits().length - this.displayed().length);

  protected readonly hasWorkingChanges = computed(
    () => (this.workingChanges()?.files.length ?? 0) > 0,
  );

  protected readonly workingHash = WORKING_HASH;

  protected readonly workingCommit = computed<GitCommit>(() => ({
    hash: WORKING_HASH,
    date: new Date().toISOString(),
    message: 'Uncommitted changes',
    refs: '',
    body: '',
    author_name: 'You',
    author_email: '',
    parents: [],
  }));

  // ==================== Column resizing ====================

  private resizeState: { column: ResizableColumn; startX: number; startWidth: number } | null =
    null;

  protected startResize(column: ResizableColumn, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const current = column === 'graph' ? this.graphColumnWidth() : this.columnWidths()[column];
    this.resizeState = { column, startX: event.clientX, startWidth: current };

    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private readonly onResizeMove = (event: MouseEvent): void => {
    const state = this.resizeState;
    if (!state) {
      return;
    }

    const delta = event.clientX - state.startX;
    const min = state.column === 'graph' ? this.graphWidth() : 48;
    const width = Math.max(min, state.startWidth + delta);

    this.columnWidths.update((widths) => ({ ...widths, [state.column]: width }));
  };

  private readonly onResizeEnd = (): void => {
    this.resizeState = null;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  ngOnDestroy(): void {
    this.onResizeEnd();
  }

  // ==================== Context menus ====================

  protected onRowContextMenu(event: MouseEvent, commit: GitCommit): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.emit({
      x: event.clientX,
      y: event.clientY,
      target: { kind: 'commit', commit },
    });
  }

  protected onBranchContextMenu(event: MouseEvent, commit: GitCommit, branch: RefBadge): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.emit({
      x: event.clientX,
      y: event.clientY,
      target: { kind: 'branch', commit, branch },
    });
  }

  protected onWorkingContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.emit({ x: event.clientX, y: event.clientY, target: { kind: 'working' } });
  }

  // ==================== Search highlighting ====================

  protected highlight(text: string): HighlightSegment[] {
    const query = this.search().trim().toLowerCase();
    if (!query || !text) {
      return [{ text, match: false }];
    }

    const segments: HighlightSegment[] = [];
    const lower = text.toLowerCase();
    let index = 0;
    let found = lower.indexOf(query);

    while (found !== -1) {
      if (found > index) {
        segments.push({ text: text.slice(index, found), match: false });
      }
      segments.push({ text: text.slice(found, found + query.length), match: true });
      index = found + query.length;
      found = lower.indexOf(query, index);
    }

    if (index < text.length) {
      segments.push({ text: text.slice(index), match: false });
    }

    return segments.length > 0 ? segments : [{ text, match: false }];
  }

  protected loadMore(): void {
    this.limit.set(this.limit() + PAGE_SIZE);
  }

  protected badges(commit: GitCommit): RefBadge[] {
    const selectedBranch = this.selectedBranch();
    const showRemote = this.showRemote();

    return parseRefs(commit.refs).filter((badge) => {
      if (badge.type === 'remote' && !showRemote) {
        return false;
      }
      if (!selectedBranch) {
        return true;
      }
      if (badge.type === 'tag') {
        return true;
      }
      return badge.name === selectedBranch;
    });
  }

  protected isHead(commit: GitCommit): boolean {
    return isHeadCommit(commit);
  }

  private laneX(lane: number): number {
    return GRAPH_PADDING + LANE_WIDTH / 2 + lane * LANE_WIDTH;
  }
}
