import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BranchInfo, CommitDiff, GitCommit, RepoInfo } from '../models/git.models';

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

  fetch(): Observable<unknown> {
    return this.http.get(`${this.base}/fetch`);
  }

  pull(): Observable<unknown> {
    return this.http.post(`${this.base}/pull`, {});
  }

  push(): Observable<unknown> {
    return this.http.post(`${this.base}/push`, {});
  }
}
