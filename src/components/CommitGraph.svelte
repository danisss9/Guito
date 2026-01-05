<script lang="ts">
  import type { Commit } from '../model/commit';

  export let commits: Commit[];

  const GRAPH_WIDTH = 80;
  const GRAPH_HEIGHT = 50;
  const DOT_RADIUS = 5;
  const LANE_WIDTH = 16;
  const START_X = 10;

  interface CommitNode {
    commit: Commit;
    index: number;
    lane: number;
  }

  let nodes: CommitNode[] = [];

  $: if (commits && commits.length > 0) {
    calculateGraph();
  }

  function calculateGraph() {
    nodes = commits.map((commit, index) => ({
      commit,
      index,
      lane: calculateLane(index, commits),
    }));
  }

  function calculateLane(index: number, allCommits: Commit[]): number {
    // Assign lanes based on refs - commits with same refs stay in same lane
    // Rotate through lanes for variety
    return index % 3;
  }

  function getLaneX(lane: number): number {
    return START_X + lane * LANE_WIDTH;
  }

  function getColor(lane: number): string {
    const colors = ['#1976d2', '#d32f2f', '#388e3c'];
    return colors[lane % colors.length];
  }

  function parseBranches(refs: string): string[] {
    if (!refs) return [];
    // Parse refs like "HEAD -> main, origin/main" or "tag: v1.0.0"
    return refs
      .split(',')
      .map((ref) => ref.trim())
      .filter((ref) => !ref.startsWith('tag:'))
      .filter((ref) => ref.length > 0)
      .map((ref) => ref.replace('HEAD -> ', ''));
  }

  function isBranchRef(refName: string): boolean {
    return !refName.includes('tag:');
  }
</script>

<div class="graph-container">
  {#each nodes as node (node.commit.hash)}
    <div class="commit-row">
      <div class="graph-visual" style="width: {GRAPH_WIDTH}px; height: {GRAPH_HEIGHT}px;">
        <svg
          width={GRAPH_WIDTH}
          height={GRAPH_HEIGHT}
          class="graph-svg"
          viewBox="0 0 {GRAPH_WIDTH} {GRAPH_HEIGHT}"
        >
          <!-- Draw line to next commit -->
          {#if node.index < commits.length - 1}
            <line
              x1={getLaneX(node.lane)}
              y1={GRAPH_HEIGHT / 2 + DOT_RADIUS + 2}
              x2={getLaneX(node.lane)}
              y2={GRAPH_HEIGHT}
              stroke={getColor(node.lane)}
              stroke-width="2"
              class="graph-line"
            />
          {/if}

          <!-- Draw commit dot -->
          <circle
            cx={getLaneX(node.lane)}
            cy={GRAPH_HEIGHT / 2}
            r={DOT_RADIUS}
            fill={getColor(node.lane)}
            stroke="white"
            stroke-width="2"
            class="graph-dot"
          />
        </svg>
      </div>

      <!-- Branch pills -->
      {#if node.commit.refs}
        <div class="branch-pills">
          {#each parseBranches(node.commit.refs) as branch (branch)}
            {#if isBranchRef(branch)}
              <span class="branch-pill" class:head={branch === 'HEAD'}>
                {branch}
              </span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .graph-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .commit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 50px;
  }

  .graph-visual {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .graph-svg {
    overflow: visible;
  }

  .graph-line {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .graph-dot {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .graph-visual:hover .graph-dot {
    filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.4));
  }

  .branch-pills {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }

  .branch-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    background-color: #e3f2fd;
    color: #1976d2;
    border: 1px solid #90caf9;
    transition: all 0.2s ease;
  }

  .branch-pill:hover {
    background-color: #bbdefb;
    border-color: #64b5f6;
  }

  .branch-pill.head {
    background-color: #f3e5f5;
    color: #7b1fa2;
    border-color: #ce93d8;
  }

  .branch-pill.head:hover {
    background-color: #e1bee7;
    border-color: #ba68c8;
  }
</style>
