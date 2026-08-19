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

export interface WorkingChanges {
  files: FileDiff[];
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface FileContent {
  content: string;
  binary?: boolean;
}

export interface RepoInfo {
  root: string;
  name: string;
}

/** Sentinel hash used to represent the working tree (uncommitted changes). */
export const WORKING_HASH = '__working__';

export interface ContextMenuTarget {
  kind: 'commit' | 'branch' | 'working';
  commit?: GitCommit;
  branch?: RefBadge;
}

export interface ContextMenuEvent {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

export interface MenuItem {
  label?: string;
  action?: string;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export interface PromptState {
  title: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmOnly?: boolean;
  allowEmpty?: boolean;
  danger?: boolean;
  okLabel?: string;
}
