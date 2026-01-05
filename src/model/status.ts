export interface FileStatus {
  path: string;
  index: string;
  working_dir: string;
}

export interface StatusSummary {
  not_added: string[];
  conflicted: string[];
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: Array<{ from: string; to: string }>;
  files: FileStatus[];
  staged: string[];
  ahead: number;
  behind: number;
  current: string | null;
  tracking: string | null;
  detached: boolean;
  isClean(): boolean;
}
