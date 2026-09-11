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
  GitCommit,
  PrReviewerSuggestion,
  PrTagSuggestion,
  PrWorkItemSuggestion,
  RepoInfo,
  RepositoryState,
  StashEntry,
  StashScope,
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
      .get<{ all?: { hash: string; message: string }[] }>(`${this.base}/stash/list`)
      .pipe(
        map((result) =>
          (result.all ?? []).map((stash, index) => ({
            index,
            hash: stash.hash,
            message: stash.message,
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
    showGraph?: boolean;
  }): Observable<AzureSettings> {
    return this.http.post<AzureSettings>(`${this.base}/settings`, settings);
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
}
