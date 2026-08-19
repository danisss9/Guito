import { GitCommit } from '../models/git.models';

export interface GraphCommit {
  commit: GitCommit;
  lane: number;
  parents: string[];
}

/**
 * Assigns a lane (column) to every commit so the history can be drawn as a
 * graph. Commits are expected in newest-first order (git log order).
 *
 * The algorithm keeps a list of "lanes", where each lane holds the hash of the
 * commit it expects next. When a commit is reached:
 *  - it takes over the first lane expecting it (other lanes merge into it),
 *  - its first parent continues on the same lane,
 *  - any additional parent branches out into its own lane.
 */
export function computeGraph(commits: readonly GitCommit[]): GraphCommit[] {
  const lanes: (string | null)[] = [];
  const result: GraphCommit[] = [];

  const laneFor = (hash: string): number => {
    let index = lanes.indexOf(hash);
    if (index === -1) {
      index = lanes.indexOf(null);
      if (index === -1) {
        lanes.push(null);
        index = lanes.length - 1;
      }
      lanes[index] = hash;
    }
    return index;
  };

  for (const commit of commits) {
    const parents = commit.parents ?? [];

    // Lanes waiting for this commit (merge targets).
    const expecting = lanes
      .map((expected, index) => (expected === commit.hash ? index : -1))
      .filter((index) => index !== -1);

    let lane: number;
    if (expecting.length > 0) {
      lane = expecting[0];
      for (let i = 1; i < expecting.length; i++) {
        lanes[expecting[i]] = null;
      }
    } else {
      lane = laneFor(commit.hash);
    }

    // The first parent continues on the same lane.
    lanes[lane] = parents[0] ?? null;

    // Additional parents branch out into their own lanes.
    for (let i = 1; i < parents.length; i++) {
      laneFor(parents[i]);
    }

    result.push({ commit, lane, parents });
  }

  return result;
}

export const LANE_COLORS = [
  '#3794ff',
  '#4ec9b0',
  '#d7ba7d',
  '#c586c0',
  '#89d185',
  '#ce9178',
  '#d16969',
  '#569cd6',
  '#b5cea8',
  '#dcdcaa',
];

export function laneColor(lane: number): string {
  return LANE_COLORS[Math.abs(lane) % LANE_COLORS.length];
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
