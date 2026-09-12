import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, defer, throwError, finalize } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AzureSettings,
  BranchInfo,
  CommitDiff,
  CommitSearchResponse,
  CommitsResponse,
  CreatePrRequest,
  CreatePrResult,
  FileContent,
  FileDiff,
  GitCommit,
  GitIdentity,
  GitRemote,
  IssueLinkingSettings,
  PrCommentRequest,
  PrCompletionOptions,
  PrDetail,
  PrFileChange,
  PrIdentity,
  PrReviewerSuggestion,
  PrSummary,
  PrTagSuggestion,
  PrThread,
  PrThreadStatus,
  PrVote,
  PrWorkItemSuggestion,
  RepoInfo,
  RepositoryState,
  StashEntry,
  StashScope,
  TagInfo,
  WorkingChanges,
  WorktreeInfo,
} from '../models/git.models';

@Injectable({ providedIn: 'root' })
export class GitService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';
  readonly mutating = signal(false);

  private mutate<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      if (this.mutating())
        return throwError(() => ({
          status: 400,
          error: { error: 'Another Git operation is in progress.' },
        }));
      this.mutating.set(true);
      return request().pipe(finalize(() => this.mutating.set(false)));
    });
  }

  getRepositoryState(): Observable<RepositoryState> {
    return this.http.get<RepositoryState>(`${this.base}/repository-state`);
  }

  getRepoInfo(): Observable<RepoInfo> {
    return this.http.get<RepoInfo>(`${this.base}/repo`);
  }

  getCommits(limit?: number, skip = 0): Observable<CommitsResponse> {
    let params = new HttpParams();
    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }
    if (skip > 0) {
      params = params.set('skip', String(skip));
    }
    return this.http.get<CommitsResponse>(`${this.base}/commits`, { params });
  }

  /** Hashes of commits whose message (subject or body) contains the query. */
  searchCommits(query: string): Observable<CommitSearchResponse> {
    const params = new HttpParams().set('query', query);
    return this.http.get<CommitSearchResponse>(`${this.base}/commits/search`, { params });
  }

  /** Full commit including the body, which the list endpoint omits. */
  getCommitDetail(hash: string): Observable<GitCommit> {
    return this.http.post<GitCommit>(`${this.base}/commit/detail`, { hash });
  }

  getAllBranches(): Observable<BranchInfo[]> {
    return this.http.get<BranchInfo[]>(`${this.base}/branches/all`);
  }

  getCommitDiff(hash: string): Observable<CommitDiff> {
    return this.http.post<CommitDiff>(`${this.base}/commit/diff`, { hash });
  }

  getWorkingChanges(): Observable<WorkingChanges> {
    return this.http.get<WorkingChanges>(`${this.base}/working-changes`);
  }

  getFileContent(path: string, ref: string): Observable<FileContent> {
    return this.http.post<FileContent>(`${this.base}/file-content`, { path, ref });
  }

  /** Fetches the remote; with prune it also deletes stale remote-tracking branches. */
  fetch(prune = false): Observable<unknown> {
    const params = prune ? new HttpParams().set('prune', '1') : undefined;
    return this.mutate(() => this.http.get(`${this.base}/fetch`, { params }));
  }

  pull(rebase = false): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/pull`, { rebase }));
  }

  push(force = false): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/push`, { force }));
  }

  sync(): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/sync`, {}));
  }

  checkout(ref: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/checkout`, { ref }));
  }

  revert(hash: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/revert`, { commit: hash }));
  }

  cherryPick(hash: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/cherry-pick`, { commit: hash }));
  }

  dropCommit(hash: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/commit/drop`, { commit: hash }));
  }

  resetToCommit(hash: string, mode: 'soft' | 'mixed' | 'hard' = 'hard'): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/reset-commit`, { commit: hash, mode }));
  }

  commit(message: string, description?: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/commit`, { message, description }));
  }

  stage(files: string[]): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/stage`, { files }));
  }

  unstage(files: string[]): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/unstage`, { files }));
  }

  discard(files: string[], mode?: 'unstaged'): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/discard`, { files, mode }));
  }

  resetWorking(): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/reset`, {}));
  }

  cleanUntracked(): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/clean`, {}));
  }

  stashSave(message?: string, scope: StashScope = 'all'): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/stash/save`, { message, scope }));
  }

  /** Stash stack, newest first; index is the position used by stash@{index}. */
  getStashes(): Observable<StashEntry[]> {
    return this.http
      .get<{
        all?: { hash: string; message: string; date?: string; author_name?: string; author_email?: string }[];
      }>(`${this.base}/stash/list`)
      .pipe(
        map((result) =>
          (result.all ?? []).map((stash, index) => ({
            index,
            hash: stash.hash,
            message: stash.message,
            date: stash.date,
            author_name: stash.author_name,
            author_email: stash.author_email,
          })),
        ),
      );
  }

  stashApply(index: number): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/stash/apply`, { index }));
  }

  stashPop(index: number): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/stash/pop`, { index }));
  }

  stashDrop(index: number): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/stash/drop`, { index }));
  }

  /** Worktrees linked to the repository, main worktree first. */
  getWorktrees(): Observable<WorktreeInfo[]> {
    return this.http.get<WorktreeInfo[]>(`${this.base}/worktrees`);
  }

  /** All repository tags, sorted by name, each with the commit it points to. */
  getTags(): Observable<TagInfo[]> {
    return this.http.get<TagInfo[]>(`${this.base}/tags`);
  }

  createBranch(name: string, startPoint?: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/branch/create`, { name, startPoint }));
  }

  deleteBranch(name: string, force = false): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/branch/delete`, { name, force }));
  }

  deleteRemoteBranch(remote: string, branch: string): Observable<unknown> {
    return this.mutate(() =>
      this.http.post(`${this.base}/branch/delete-remote`, { remote, branch }),
    );
  }

  renameBranch(oldName: string, newName: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/branch/rename`, { oldName, newName }));
  }

  merge(branch: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/merge`, { branch }));
  }

  rebase(branch: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/rebase`, { branch }));
  }

  createTag(name: string, commit?: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/tag/create`, { name, commit }));
  }

  deleteTag(name: string): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/tag/delete`, { name }));
  }

  pushTag(name: string, remote = 'origin'): Observable<unknown> {
    return this.mutate(() => this.http.post(`${this.base}/tag/push`, { name, remote }));
  }

  getSettings(): Observable<AzureSettings> {
    return this.http.get<AzureSettings>(`${this.base}/settings`);
  }

  /** Persists the given settings keys server-side; omitted keys keep their value. */
  saveSettings(settings: {
    azureDevOpsUrl?: string;
    prBranchNameTemplate?: string;
    autoReload?: boolean;
    showGraph?: boolean;
    showStashes?: boolean;
    showTags?: boolean;
    showRemoteBranches?: boolean;
    fileListView?: 'flat' | 'tree';
    issueLinking?: IssueLinkingSettings | null;
    issueLinkingGlobal?: boolean;
  }): Observable<AzureSettings> {
    return this.http.post<AzureSettings>(`${this.base}/settings`, settings);
  }

  getRemotes(): Observable<GitRemote[]> {
    return this.http.get<GitRemote[]>(`${this.base}/remotes`);
  }

  saveIdentity(identity: GitIdentity): Observable<GitIdentity> {
    return this.http.post<GitIdentity>(`${this.base}/identity`, identity);
  }

  removeIdentity(): Observable<GitIdentity> {
    return this.http.delete<GitIdentity>(`${this.base}/identity`);
  }

  saveRemote(remote: GitRemote & { originalName?: string }): Observable<GitRemote[]> {
    return this.http.post<GitRemote[]>(`${this.base}/remotes`, remote);
  }

  removeRemote(name: string): Observable<GitRemote[]> {
    return this.http.delete<GitRemote[]>(`${this.base}/remotes/${encodeURIComponent(name)}`);
  }

  /** Creates an Azure DevOps pull request; may push the source branch first. */
  createPr(request: CreatePrRequest): Observable<CreatePrResult> {
    return this.mutate(() =>
      this.http.post<CreatePrResult>(`${this.base}/azure-devops/pullrequest`, request),
    );
  }

  /** Identity picker search for pull request reviewers. */
  searchReviewers(query: string): Observable<PrReviewerSuggestion[]> {
    return this.http
      .get<{ reviewers: PrReviewerSuggestion[] }>(`${this.base}/azure-devops/reviewers`, {
        params: new HttpParams().set('query', query),
      })
      .pipe(map((response) => response.reviewers));
  }

  /** Work item search (by id or title) for pull request linking. */
  searchWorkItems(query: string): Observable<PrWorkItemSuggestion[]> {
    return this.http
      .get<{ workItems: PrWorkItemSuggestion[] }>(`${this.base}/azure-devops/workitems`, {
        params: new HttpParams().set('query', query),
      })
      .pipe(map((response) => response.workItems));
  }

  /** Existing pull request label names for tag autocomplete. */
  getPrTags(): Observable<PrTagSuggestion[]> {
    return this.http
      .get<{ tags: string[] }>(`${this.base}/azure-devops/tags`)
      .pipe(map((response) => response.tags.map((name) => ({ name }))));
  }

  // ---- Azure DevOps pull request review ----
  // These call Azure DevOps directly; they are plain HTTP so they never get
  // blocked by (nor block) local git operations. Busy state lives in the
  // PR dialog.

  /** Identity of the authenticated Azure DevOps user. */
  getAzureMe(): Observable<PrIdentity> {
    return this.http.get<PrIdentity>(`${this.base}/azure-devops/me`);
  }

  /** Pull requests created by or assigned to the current user. */
  getMyPullRequests(status = 'active'): Observable<PrSummary[]> {
    const params = new HttpParams().set('status', status);
    return this.http
      .get<{ pullRequests: PrSummary[] }>(`${this.base}/azure-devops/pullrequests`, { params })
      .pipe(map((response) => response.pullRequests));
  }

  /** Full pull request detail for the PR dialog. */
  getPrDetail(id: number): Observable<PrDetail> {
    return this.http.get<PrDetail>(`${this.base}/azure-devops/pullrequests/${id}`);
  }

  /** Edits the title/description or flips the draft flag. */
  updatePr(
    id: number,
    changes: { title?: string; description?: string; isDraft?: boolean },
  ): Observable<unknown> {
    return this.http.patch(`${this.base}/azure-devops/pullrequests/${id}`, changes);
  }

  /** Records the current user's vote on a pull request. */
  votePr(id: number, vote: PrVote): Observable<unknown> {
    return this.http.post(`${this.base}/azure-devops/pullrequests/${id}/vote`, { vote });
  }

  /** Adds, updates (required flag), or removes a reviewer. */
  updatePrReviewer(
    id: number,
    reviewer: { id: string; required?: boolean; vote?: number; remove?: boolean },
  ): Observable<unknown> {
    return this.http.post(`${this.base}/azure-devops/pullrequests/${id}/reviewers`, reviewer);
  }

  /** Sets or clears auto-complete, with optional completion options. */
  setPrAutoComplete(
    id: number,
    enabled: boolean,
    options?: PrCompletionOptions,
  ): Observable<unknown> {
    return this.http.post(`${this.base}/azure-devops/pullrequests/${id}/autocomplete`, {
      enabled,
      ...options,
    });
  }

  /** Completes (merges) the pull request. */
  completePr(id: number, options?: PrCompletionOptions): Observable<unknown> {
    return this.http.post(`${this.base}/azure-devops/pullrequests/${id}/complete`, options ?? {});
  }

  /** Comment threads of a pull request, general and inline. */
  getPrThreads(id: number): Observable<PrThread[]> {
    return this.http
      .get<{ threads: PrThread[] }>(`${this.base}/azure-devops/pullrequests/${id}/threads`)
      .pipe(map((response) => response.threads));
  }

  /** Adds a reply, general comment, or inline line comment. */
  addPrComment(id: number, comment: PrCommentRequest): Observable<unknown> {
    return this.http.post(`${this.base}/azure-devops/pullrequests/${id}/threads`, comment);
  }

  /** Resolves, reactivates, or closes a thread. */
  setPrThreadStatus(id: number, threadId: number, status: PrThreadStatus): Observable<unknown> {
    return this.http.post(
      `${this.base}/azure-devops/pullrequests/${id}/threads/${threadId}/status`,
      { status },
    );
  }

  /** Changed files of the latest pull request iteration. */
  getPrChanges(id: number): Observable<PrFileChange[]> {
    return this.http
      .get<{ files: PrFileChange[] }>(`${this.base}/azure-devops/pullrequests/${id}/changes`)
      .pipe(map((response) => response.files));
  }

  /** Unified diff of one pull request file (fetched on demand). */
  getPrFileDiff(id: number, file: PrFileChange): Observable<FileDiff> {
    const params = new HttpParams()
      .set('path', file.path)
      .set('oldPath', file.oldPath || '')
      .set('changeType', file.changeType);
    return this.http.get<FileDiff>(`${this.base}/azure-devops/pullrequests/${id}/file-diff`, {
      params,
    });
  }
}
