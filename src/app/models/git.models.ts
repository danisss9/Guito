export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  refs: string;
  body: string;
  author_name: string;
  author_email: string;
  parents: string[];
}

export type RefType = 'head' | 'local' | 'remote' | 'tag';

export interface RefBadge {
  type: RefType;
  name: string;
}

export interface BranchInfo {
  name: string;
  commit: string;
  current: boolean;
  remote: boolean;
}

export type DiffLineType = 'add' | 'del' | 'context' | 'hunk';

export interface DiffLine {
  type: DiffLineType;
  oldLine?: number;
  newLine?: number;
  text: string;
}

export type FileStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'binary';

export interface FileDiff {
  path: string;
  oldPath: string;
  status: FileStatus;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

export interface CommitDiff {
  hash: string;
  files: FileDiff[];
}

export interface RepoInfo {
  root: string;
  name: string;
}
