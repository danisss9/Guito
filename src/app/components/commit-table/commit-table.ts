import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { GitCommit, RefBadge } from '../../models/git.models';
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
export class CommitTable {
  readonly commits = input.required<GitCommit[]>();
  readonly selectedHash = input.required<string>();
  readonly commitClick = output<GitCommit>();

  protected readonly limit = signal(PAGE_SIZE);

  protected readonly displayed = computed(() => this.commits().slice(0, this.limit()));

  protected readonly graphCommits = computed<GraphCommit[]>(() => computeGraph(this.displayed()));

  protected readonly graphWidth = computed(() => {
    const lanes = this.graphCommits().reduce((max, entry) => Math.max(max, entry.lane), 0) + 1;
    return Math.max(MIN_GRAPH_WIDTH, GRAPH_PADDING * 2 + lanes * LANE_WIDTH);
  });

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

  protected loadMore(): void {
    this.limit.set(this.limit() + PAGE_SIZE);
  }

  protected badges(commit: GitCommit): RefBadge[] {
    return parseRefs(commit.refs);
  }

  protected isHead(commit: GitCommit): boolean {
    return isHeadCommit(commit);
  }

  private laneX(lane: number): number {
    return GRAPH_PADDING + LANE_WIDTH / 2 + lane * LANE_WIDTH;
  }
}
