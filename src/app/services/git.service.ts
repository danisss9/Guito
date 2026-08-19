import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BranchInfo,
  CommitDiff,
  FileContent,
  GitCommit,
  RepoInfo,
  WorkingChanges,
} from '../models/git.models';

@Injectable({ providedIn: 'root' })
export class GitService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  getRepoInfo(): Observable<RepoInfo> {
    return this.http.get<RepoInfo>(`${this.base}/repo`);
  }

  getCommits(): Observable<GitCommit[]> {
    return this.http.get<GitCommit[]>(`${this.base}/commits`);
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

  fetch(): Observable<unknown> {
    return this.http.get(`${this.base}/fetch`);
  }

  pull(rebase = false): Observable<unknown> {
    return this.http.post(`${this.base}/pull`, { rebase });
  }

  push(): Observable<unknown> {
    return this.http.post(`${this.base}/push`, {});
  }

  sync(): Observable<unknown> {
    return this.http.post(`${this.base}/sync`, {});
  }

  checkout(ref: string): Observable<unknown> {
    return this.http.post(`${this.base}/checkout`, { ref });
  }

  revert(hash: string): Observable<unknown> {
    return this.http.post(`${this.base}/revert`, { commit: hash });
  }

  cherryPick(hash: string): Observable<unknown> {
    return this.http.post(`${this.base}/cherry-pick`, { commit: hash });
  }

  dropCommit(hash: string): Observable<unknown> {
    return this.http.post(`${this.base}/commit/drop`, { commit: hash });
  }

  resetToCommit(hash: string): Observable<unknown> {
    return this.http.post(`${this.base}/reset-commit`, { commit: hash });
  }

  commit(message: string, description?: string): Observable<unknown> {
    return this.http.post(`${this.base}/commit`, { message, description });
  }

  stage(files: string[]): Observable<unknown> {
    return this.http.post(`${this.base}/stage`, { files });
  }

  unstage(files: string[]): Observable<unknown> {
    return this.http.post(`${this.base}/unstage`, { files });
  }

  discard(files: string[]): Observable<unknown> {
    return this.http.post(`${this.base}/discard`, { files });
  }

  resetWorking(): Observable<unknown> {
    return this.http.post(`${this.base}/reset`, {});
  }

  cleanUntracked(): Observable<unknown> {
    return this.http.post(`${this.base}/clean`, {});
  }

  stashSave(message?: string): Observable<unknown> {
    return this.http.post(`${this.base}/stash/save`, { message });
  }

  createBranch(name: string, startPoint?: string): Observable<unknown> {
    return this.http.post(`${this.base}/branch/create`, { name, startPoint });
  }

  deleteBranch(name: string, force = false): Observable<unknown> {
    return this.http.post(`${this.base}/branch/delete`, { name, force });
  }

  deleteRemoteBranch(remote: string, branch: string): Observable<unknown> {
    return this.http.post(`${this.base}/branch/delete-remote`, { remote, branch });
  }

  renameBranch(oldName: string, newName: string): Observable<unknown> {
    return this.http.post(`${this.base}/branch/rename`, { oldName, newName });
  }

  merge(branch: string): Observable<unknown> {
    return this.http.post(`${this.base}/merge`, { branch });
  }

  rebase(branch: string): Observable<unknown> {
    return this.http.post(`${this.base}/rebase`, { branch });
  }

  createTag(name: string, commit?: string): Observable<unknown> {
    return this.http.post(`${this.base}/tag/create`, { name, commit });
  }
}
