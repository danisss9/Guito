export interface Tag {
  commit: string;
  hash: string;
  message?: string;
  name: string;
}

export interface TagsSummary {
  all: string[];
  latest?: string;
}
