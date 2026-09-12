export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  refs: string;
  /** Commit body. Omitted by the list endpoint; fetch via /api/commit/detail. */
  body?: string;
  author_name: string;
  author_email: string;
  parents: string[];
}

/** Paged commit history returned by the server. */
export interface CommitsResponse {
  commits: GitCommit[];
  /** Total number of commits in the repository history. */
  total: number;
}

/** Hashes of commits whose message (subject or body) matches a query. */
export interface CommitSearchResponse {
  hashes: string[];
  /** Zero-based positions in the unfiltered history, keyed by matching hash. */
  indices: Record<string, number>;
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

export type StashScope = 'all' | 'staged' | 'unstaged';

/** One entry of the stash stack, listed newest first. */
export interface StashEntry {
  index: number;
  hash: string;
  message: string;
  /** Stash commit metadata, shown in the commit table rows. */
  date?: string;
  author_name?: string;
  author_email?: string;
}

/** A working directory attached to the repository (git worktree). */
export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string;
  bare: boolean;
  detached: boolean;
  /** Whether this worktree is the one Guito is currently serving. */
  current: boolean;
}

export interface WorkingChanges {
  stagedFiles: FileDiff[];
  unstagedFiles: FileDiff[];
  conflicted: string[];
  files: FileDiff[];
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface FileContent {
  content: string;
  binary?: boolean;
}

export interface GitIdentity {
  name: string;
  email: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface IssueLinkingSettings {
  regex: string;
  url: string;
  useGlobally: boolean;
}

export interface RepositoryState {
  history: string;
  working: string;
}

export interface RepoInfo {
  identity: GitIdentity;
  root: string;
  name: string;
}

/** Sentinel hash used to represent the working tree (uncommitted changes). */
export const WORKING_HASH = '__working__';

export interface ContextMenuTarget {
  kind: 'commit' | 'branch' | 'tag' | 'working' | 'stash' | 'worktree';
  commit?: GitCommit;
  branch?: RefBadge;
  stash?: StashEntry;
  worktree?: WorktreeInfo;
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

/** A selectable choice inside a prompt dialog. */
export interface PromptOption {
  value: string;
  label: string;
  description?: string;
  danger?: boolean;
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
  /** When present, the dialog shows a choice list instead of a text input. */
  options?: PromptOption[];
  /** Shows a filter box above the choice list (useful for long option lists). */
  searchable?: boolean;
}

/** Azure DevOps integration settings served by the Guito server. */
export interface AzureSettings {
  azureDevOpsUrl: string;
  /** Template used for remote-only branches created for pull requests. */
  prBranchNameTemplate?: string;
  /** Where the effective URL comes from: the VS Code setting or the server-side file. */
  source: 'vscode' | 'file' | '';
  /** Whether Guito polls the repository and refreshes automatically; defaults to true. */
  autoReload?: boolean;
  /** Where file diffs open; 'vscode' only inside the VS Code extension. */
  diffViewer?: 'guito' | 'vscode';
  /** Whether the commit table shows the graph column; defaults to true. */
  showGraph?: boolean;
  /** Whether the commit table shows stash rows; defaults to true. */
  showStashes?: boolean;
  /** Whether tag badges are shown in commit history. */
  showTags?: boolean;
  /** Whether remote branches are shown in the repository panel and history filter. */
  showRemoteBranches?: boolean;
  /** How changed-file lists (staged, unstaged, commit) are shown; defaults to flat. */
  fileListView?: 'flat' | 'tree';
  /** Optional conversion of issue references in commit messages to links. */
  issueLinking?: IssueLinkingSettings | null;
}

export interface CreatePrRequest {
  sourceBranch: string;
  targetBranch: string;
  title?: string;
  description?: string;
  /** Creates a remote-only branch from HEAD as the PR source. */
  newBranch?: boolean;
  isDraft?: boolean;
  /** Reviewers to add: identity id from the picker + whether required. */
  reviewers?: { id: string; required: boolean }[];
  /** Work item ids to link to the pull request. */
  workItems?: number[];
  /** Tags (labels) to add to the pull request. */
  labels?: string[];
}

export interface CreatePrResult {
  id: number;
  url: string;
  branch: string;
  /** Non-fatal problems, e.g. tags that could not be added. */
  warnings?: string[];
}

/** Reviewer candidate returned by the Azure DevOps identity picker. */
export interface PrReviewerSuggestion {
  id: string;
  label: string;
  description?: string;
}

/** Work item match returned by the Azure DevOps WIQL search. */
export interface PrWorkItemSuggestion {
  id: number;
  title: string;
  state: string;
}

/** Existing label name from Azure DevOps pull requests. */
export interface PrTagSuggestion {
  name: string;
}
