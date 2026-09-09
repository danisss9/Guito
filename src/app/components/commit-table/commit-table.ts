import { AuthorAvatar } from '../author-avatar/author-avatar';
import { DatePipe } from '@angular/common';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  afterRenderEffect,
  untracked,
  NgZone,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ContextMenuEvent,
  GitCommit,
  GitIdentity,
  RefBadge,
  WORKING_HASH,
  WorkingChanges,
} from '../../models/git.models';
import { GraphService } from '../../services/graph.service';
import { GraphCommit, laneColor } from '../../utils/graph';
import { isHeadCommit, parseRefs } from '../../utils/refs';
import { loadJson, saveJson } from '../../utils/storage';

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

/** A commit→parent edge resolved against the full graph. */
interface GraphEdgeSpec {
  childRow: number;
  childLane: number;
  /** Row of the parent, or -1 when it is not part of the loaded history. */
  parentRow: number;
  parentLane: number;
}

interface HighlightSegment {
  text: string;
  match: boolean;
}

type ResizableColumn = 'graph' | 'description' | 'date' | 'author' | 'commit';

const ROW_HEIGHT = 34;
const LANE_WIDTH = 14;
const GRAPH_PADDING = 10;
const MIN_GRAPH_WIDTH = 72;
/** Extra rows drawn above and below the viewport so scrolling stays smooth. */
const GRAPH_ROW_BUFFER = 10;

/** localStorage key holding the persisted column widths. */
const COLUMN_WIDTHS_KEY = 'guito.columnWidths';

const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumn, number> = {
  graph: 0, // 0 = auto (derived from the lane count)
  description: 480,
  date: 132,
  author: 150,
  commit: 84,
};

/** Smallest width a column can be resized to; the graph column is auto-sized. */
const MIN_COLUMN_WIDTHS: Record<ResizableColumn, number> = {
  graph: 0,
  description: 48,
  date: 48,
  author: 48,
  commit: 48,
};

function loadColumnWidths(): Record<ResizableColumn, number> {
  const stored = loadJson<Partial<Record<ResizableColumn, number>>>(COLUMN_WIDTHS_KEY, {});
  const widths = { ...DEFAULT_COLUMN_WIDTHS };
  for (const column of Object.keys(DEFAULT_COLUMN_WIDTHS) as ResizableColumn[]) {
    const value = stored[column];
    if (typeof value === 'number' && Number.isFinite(value) && value >= MIN_COLUMN_WIDTHS[column]) {
      widths[column] = value;
    }
  }
  return widths;
}

@Component({
  selector: 'app-commit-table',
  imports: [
    AuthorAvatar,
    DatePipe,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    CdkVirtualScrollViewport,
  ],
  templateUrl: './commit-table.html',
  styleUrl: './commit-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitTable implements OnDestroy {
  readonly commits = input.required<GitCommit[]>();
  readonly selectedHash = input.required<string>();
  readonly identity = input<GitIdentity>({ name: '', email: '' });
  readonly search = input<string>('');
  readonly selectedBranch = input<string>('');
  readonly showRemote = input(true);
  readonly workingChanges = input<WorkingChanges | null>(null);
  readonly unloaded = input(0);
  readonly historyLoading = input(false);
  readonly loadingLabel = input('');
  /** When set, scrolls the table so this commit is visible (id re-triggers). */
  readonly scrollToHash = input<{ hash: string; id: number } | null>(null);
  protected readonly graphLoading = signal(false);
  protected readonly pendingLabel = computed(
    () => this.loadingLabel() || (this.graphLoading() ? 'Drawing commit graph...' : ''),
  );

  readonly commitClick = output<GitCommit>();
  readonly contextMenu = output<ContextMenuEvent>();
  readonly loadMoreRequested = output<void>();
  readonly loadAllRequested = output<void>();

  protected readonly rowHeight = ROW_HEIGHT;

  private readonly graph = inject(GraphService);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  /** Scroll offset and viewport height drive which graph rows are drawn. */
  private readonly zone = inject(NgZone);
  protected readonly scrollTop = signal(0);
  protected readonly scrollLeft = signal(0);
  protected readonly viewportWidth = signal(0);
  private readonly viewportHeight = signal(0);

  constructor() {
    // Compute lanes whenever the loaded history changes; large histories are
    // computed in a worker, so the previous graph stays visible until then.
    effect(() => {
      const commits = this.commits();
      this.updateGraph(commits);
    });

    // Resizing and CDK data updates need measurement after the DOM has rendered.
    afterRenderEffect(() => {
      this.graphCommits();
      this.columnWidths();
      const viewport = this.viewport();
      if (viewport)
        untracked(() => {
          viewport.checkViewportSize();
          this.measureViewport();
        });
    });
    afterRenderEffect(() => {
      this.selectedBranch();
      this.showRemote();
      const viewport = this.viewport();
      if (viewport)
        untracked(() => {
          viewport.scrollToOffset(0);
          this.measureViewport();
        });
    });
    // Scroll the requested match into view (centered) once it is rendered.
    effect(() => {
      const request = this.scrollToHash();
      if (!request) return;
      const index = this.graphCommits().findIndex((entry) => entry.commit.hash === request.hash);
      if (index === -1) return;
      const viewport = this.viewport();
      if (!viewport) return;
      untracked(() => this.scrollToIndex(viewport, index));
    });
    effect((onCleanup) => {
      const viewport = this.viewport();
      if (!viewport) return;
      const observer = new ResizeObserver(() => {
        this.zone.run(() => {
          viewport.checkViewportSize();
          this.measureViewport();
        });
      });
      observer.observe(viewport.elementRef.nativeElement);
      const subscription = viewport.elementScrolled().subscribe(() => {
        this.zone.run(() => this.measureViewport());
      });
      onCleanup(() => {
        observer.disconnect();
        subscription.unsubscribe();
      });
    });
    // Fill the window with the table on load and after window resizes. The
    // saved column widths are read untracked so dragging a column never
    // re-fills it: a drag changes only the dragged column and may leave the
    // table narrower until the window is resized again.
    effect(() => {
      this.viewportWidth();
      this.graphCommits();
      untracked(() => {
        const spare =
          this.viewportWidth() -
          this.graphColumnWidth() -
          this.columnWidths().date -
          this.columnWidths().author -
          this.columnWidths().commit -
          this.columnWidths().description;
        this.fillerWidth.set(Math.max(0, spare));
      });
    });
  }

  private measureViewport(): void {
    const element = this.viewport()?.elementRef.nativeElement;
    if (!element) return;
    this.scrollTop.set(element.scrollTop);
    this.scrollLeft.set(element.scrollLeft);
    this.viewportWidth.set(element.clientWidth);
    this.viewportHeight.set(element.clientHeight);
  }

  /**
   * Centers the row in the viewport. The CDK spacer may not have grown to the
   * new history size yet right after a page load, in which case the browser
   * clamps the offset; retry until the offset sticks.
   */
  private scrollToIndex(viewport: CdkVirtualScrollViewport, index: number): void {
    const element = viewport.elementRef.nativeElement;
    const height = element.clientHeight || this.viewportHeight();
    const target = Math.max(0, index * ROW_HEIGHT - (height - ROW_HEIGHT) / 2);
    let attempts = 0;
    const apply = () => {
      viewport.scrollToOffset(target);
      this.measureViewport();
      if (Math.abs(element.scrollTop - target) > 1 && ++attempts < 10) {
        requestAnimationFrame(apply);
      }
    };
    apply();
  }

  /** Column widths, persisted across sessions; graph 0 = auto. */
  protected readonly columnWidths = signal<Record<ResizableColumn, number>>(loadColumnWidths());

  protected readonly graphCommits = signal<GraphCommit[]>([]);

  private graphSubscription: Subscription | null = null;

  private updateGraph(commits: readonly GitCommit[]): void {
    // Supersede any in-flight worker request; its reply is dropped on arrival.
    this.graphSubscription?.unsubscribe();
    this.graphLoading.set(true);
    this.graphSubscription = this.graph.compute(commits).subscribe((lanes) => {
      // Length mismatch means the history changed while computing.
      if (lanes.length !== commits.length) {
        return;
      }
      this.graphLoading.set(false);
      this.graphCommits.set(
        commits.map((commit, index) => ({
          commit,
          lane: lanes[index],
          parents: commit.parents ?? [],
        })),
      );
    });
  }

  protected readonly graphWidth = computed(() => {
    const lanes = this.graphCommits().reduce((max, entry) => Math.max(max, entry.lane), 0) + 1;
    return Math.max(MIN_GRAPH_WIDTH, GRAPH_PADDING * 2 + lanes * LANE_WIDTH);
  });

  protected readonly graphColumnWidth = computed(() =>
    Math.max(this.graphWidth(), this.columnWidths().graph),
  );

  /**
   * Extra width added to the saved Description width so the table fills the
   * window. Frozen between window resizes (see the refill effect): a column
   * drag changes only the dragged column, and the saved widths act as the
   * minimums when the window is narrow.
   */
  protected readonly fillerWidth = signal(0);

  protected readonly descriptionWidth = computed(
    () => this.columnWidths().description + this.fillerWidth(),
  );

  protected readonly tableWidth = computed(
    () =>
      this.graphColumnWidth() +
      this.columnWidths().date +
      this.columnWidths().author +
      this.columnWidths().commit +
      this.descriptionWidth(),
  );
  protected readonly horizontalTransform = computed(
    () => 'translateX(' + -this.scrollLeft() + 'px)',
  );

  protected readonly graphHeight = computed(() => this.graphCommits().length * ROW_HEIGHT);

  /** Every commit→parent edge of the graph, resolved once per graph update. */
  private readonly allEdges = computed<GraphEdgeSpec[]>(() => {
    const graph = this.graphCommits();
    const rowOf = new Map<string, number>();
    const laneOf = new Map<string, number>();
    graph.forEach((entry, index) => {
      rowOf.set(entry.commit.hash, index);
      laneOf.set(entry.commit.hash, entry.lane);
    });
    const specs: GraphEdgeSpec[] = [];
    for (let index = 0; index < graph.length; index++) {
      const entry = graph[index];
      for (const parent of entry.parents) {
        const parentRow = rowOf.get(parent);
        specs.push({
          childRow: index,
          childLane: entry.lane,
          parentRow: parentRow ?? -1,
          parentLane: parentRow === undefined ? entry.lane : (laneOf.get(parent) ?? entry.lane),
        });
      }
    }
    return specs;
  });

  /** Range of rows whose nodes and edges need to be drawn right now. */
  private readonly visibleRange = computed(() => {
    const total = this.graphCommits().length;
    if (total === 0 || this.viewportHeight() === 0) {
      return { start: 0, end: 0 };
    }
    const start = Math.max(0, Math.floor(this.scrollTop() / ROW_HEIGHT) - GRAPH_ROW_BUFFER);
    const end = Math.min(
      total,
      Math.ceil((this.scrollTop() + this.viewportHeight()) / ROW_HEIGHT) + GRAPH_ROW_BUFFER,
    );
    return { start, end };
  });

  protected readonly nodes = computed<GraphNodeView[]>(() => {
    const { start, end } = this.visibleRange();
    const nodes: GraphNodeView[] = [];
    for (let index = start; index < end; index++) {
      const entry = this.graphCommits()[index];
      nodes.push({
        hash: entry.commit.hash,
        x: this.laneX(entry.lane),
        y: index * ROW_HEIGHT + ROW_HEIGHT / 2,
        color: laneColor(entry.lane),
        isHead: isHeadCommit(entry.commit),
      });
    }
    return nodes;
  });

  protected readonly edges = computed<GraphEdgeView[]>(() => {
    const specs = this.allEdges();
    const { start, end } = this.visibleRange();
    const height = this.graphHeight();
    const edges: GraphEdgeView[] = [];

    for (const spec of specs) {
      // Keep every edge crossing the visible band, including edges anchored
      // above it whose lower part is on screen (e.g. long merge edges).
      const parentRow = spec.parentRow;
      const top = Math.min(spec.childRow, parentRow < 0 ? spec.childRow : parentRow);
      const bottom = parentRow < 0 ? Number.MAX_SAFE_INTEGER : Math.max(spec.childRow, parentRow);
      if (bottom < start || top >= end) {
        continue;
      }

      const color = laneColor(spec.childLane);
      const x1 = this.laneX(spec.childLane);
      const y1 = spec.childRow * ROW_HEIGHT + ROW_HEIGHT / 2;

      if (parentRow < 0) {
        // Parent is outside the loaded history: draw the lane to the bottom.
        edges.push({ d: `M ${x1} ${y1} L ${x1} ${height}`, color });
        continue;
      }

      const x2 = this.laneX(spec.parentLane);
      const y2 = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;

      if (x1 === x2) {
        edges.push({ d: `M ${x1} ${y1} L ${x2} ${y2}`, color });
      } else {
        const midY = (y1 + y2) / 2;
        edges.push({ d: `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`, color });
      }
    }

    return edges;
  });

  protected readonly hasWorkingChanges = computed(() => {
    const changes = this.workingChanges();
    return (
      !!changes &&
      changes.staged.length +
        changes.unstaged.length +
        changes.untracked.length +
        changes.conflicted.length >
        0
    );
  });

  protected readonly workingHash = WORKING_HASH;

  protected readonly workingCommit = computed<GitCommit>(() => ({
    hash: WORKING_HASH,
    date: new Date().toISOString(),
    message: 'Uncommitted changes',
    refs: '',
    body: '',
    author_name: this.identity().name || 'You',
    author_email: this.identity().email,
    parents: [],
  }));

  // ==================== Column resizing ====================

  private resizeState: { column: ResizableColumn; startX: number; startWidth: number } | null =
    null;

  protected startResize(column: ResizableColumn, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (column === 'graph') {
      this.resizeState = { column, startX: event.clientX, startWidth: this.graphColumnWidth() };
    } else if (column === 'description') {
      // Fold the fill width into the saved width: from here on the drag sets
      // the exact on-screen width, and the table may end up narrower until
      // the window is resized again.
      const width = this.descriptionWidth();
      this.columnWidths.update((widths) => ({ ...widths, description: width }));
      this.fillerWidth.set(0);
      this.resizeState = { column, startX: event.clientX, startWidth: width };
    } else {
      this.resizeState = { column, startX: event.clientX, startWidth: this.columnWidths()[column] };
    }

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
    if (this.resizeState) {
      saveJson(COLUMN_WIDTHS_KEY, this.columnWidths());
    }
    this.resizeState = null;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  ngOnDestroy(): void {
    this.onResizeEnd();
    this.graphSubscription?.unsubscribe();
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

  protected onBadgeContextMenu(event: MouseEvent, commit: GitCommit, badge: RefBadge): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.emit({
      x: event.clientX,
      y: event.clientY,
      target: { kind: badge.type === 'tag' ? 'tag' : 'branch', commit, branch: badge },
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

  /** Ask the app to fetch the next page of commits. */
  protected onLoadMoreCommits(): void {
    this.loadMoreRequested.emit();
  }

  /** Fetch and render the entire remaining history. */
  protected onLoadAllCommits(): void {
    this.loadAllRequested.emit();
  }

  protected trackByHash(_index: number, entry: GraphCommit): string {
    return entry.commit.hash;
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
