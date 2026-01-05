export interface Stash {
  hash: string;
  index: number;
  message: string;
}

export interface StashListSummary {
  all: Stash[];
  latest?: Stash;
  total: number;
}
