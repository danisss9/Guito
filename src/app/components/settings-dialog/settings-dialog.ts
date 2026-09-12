import { ChangeDetectionStrategy, Component, HostListener, effect, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AzureSettings, GitIdentity, GitRemote, IssueLinkingSettings } from '../../models/git.models';
import { GitService } from '../../services/git.service';

export interface GuitoSettingsUpdate {
  azureDevOpsUrl: string;
  prBranchNameTemplate: string;
  autoReload: boolean;
  showGraph: boolean;
  showStashes: boolean;
  showTags: boolean;
  showRemoteBranches: boolean;
  fileListView: 'flat' | 'tree';
  searchMode: 'navigate' | 'filter';
  searchCaseSensitive: boolean;
}

type EditorMode = 'main' | 'identity' | 'remote' | 'issue';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialog {
  private readonly git = inject(GitService);
  readonly settings = input.required<AzureSettings>();
  readonly identity = input.required<GitIdentity>();
  readonly saving = input(false);
  readonly saved = output<GuitoSettingsUpdate>();
  readonly settingsUpdated = output<AzureSettings>();
  readonly identityChanged = output<GitIdentity>();
  readonly repositoryChanged = output<void>();
  readonly closed = output<void>();

  protected readonly azureDevOpsUrl = signal('');
  protected readonly prBranchNameTemplate = signal('pr/${randomstring}');
  protected readonly autoReload = signal(true);
  protected readonly showGraph = signal(true);
  protected readonly showStashes = signal(true);
  protected readonly showTags = signal(true);
  protected readonly showRemoteBranches = signal(true);
  protected readonly fileListView = signal<'flat' | 'tree'>('flat');
  protected readonly searchMode = signal<'navigate' | 'filter'>('navigate');
  protected readonly searchCaseSensitive = signal(false);
  protected readonly remotes = signal<GitRemote[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly mode = signal<EditorMode>('main');
  protected readonly userName = signal('');
  protected readonly userEmail = signal('');
  protected readonly originalRemoteName = signal('');
  protected readonly remoteName = signal('');
  protected readonly fetchUrl = signal('');
  protected readonly pushUrl = signal('');
  protected readonly issueRegex = signal('');
  protected readonly issueUrl = signal('');
  protected readonly issueGlobal = signal(false);
  private remotesLoaded = false;

  constructor() {
    effect(() => {
      const settings = this.settings();
      this.azureDevOpsUrl.set(settings.azureDevOpsUrl ?? '');
      this.prBranchNameTemplate.set(settings.prBranchNameTemplate ?? 'pr/${randomstring}');
      this.autoReload.set(settings.autoReload !== false);
      this.showGraph.set(settings.showGraph !== false);
      this.showStashes.set(settings.showStashes !== false);
      this.showTags.set(settings.showTags !== false);
      this.showRemoteBranches.set(settings.showRemoteBranches !== false);
      this.fileListView.set(settings.fileListView === 'tree' ? 'tree' : 'flat');
      this.searchMode.set(settings.searchMode === 'filter' ? 'filter' : 'navigate');
      this.searchCaseSensitive.set(settings.searchCaseSensitive === true);
      if (!this.remotesLoaded) {
        this.remotesLoaded = true;
        this.loadRemotes();
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.saving() || this.busy()) return;
    if (this.mode() === 'main') this.closed.emit();
    else this.mode.set('main');
  }

  protected setChecked(target: EventTarget | null, setting: 'autoReload' | 'showGraph' | 'showStashes' | 'showTags' | 'showRemoteBranches' | 'searchCaseSensitive'): void {
    this[setting].set((target as HTMLInputElement).checked);
  }

  protected save(): void {
    this.saved.emit({ azureDevOpsUrl: this.azureDevOpsUrl().trim(), prBranchNameTemplate: this.prBranchNameTemplate().trim(), autoReload: this.autoReload(), showGraph: this.showGraph(), showStashes: this.showStashes(), showTags: this.showTags(), showRemoteBranches: this.showRemoteBranches(), fileListView: this.fileListView(), searchMode: this.searchMode(), searchCaseSensitive: this.searchCaseSensitive() });
  }

  protected changeSearchMode(target: EventTarget | null): void {
    const value = (target as HTMLSelectElement).value;
    this.searchMode.set(value === 'filter' ? 'filter' : 'navigate');
  }

  protected editIdentity(): void {
    this.userName.set(this.identity().name);
    this.userEmail.set(this.identity().email);
    this.error.set('');
    this.mode.set('identity');
  }

  protected saveIdentity(): void {
    this.run(this.git.saveIdentity({ name: this.userName().trim(), email: this.userEmail().trim() }), (identity) => {
      this.identityChanged.emit(identity);
      this.repositoryChanged.emit();
      this.mode.set('main');
    });
  }

  protected removeIdentity(): void {
    if (!window.confirm('Remove the repository-specific Git user name and email?')) return;
    this.run(this.git.removeIdentity(), (identity) => {
      this.identityChanged.emit(identity);
      this.repositoryChanged.emit();
    });
  }

  protected editRemote(remote?: GitRemote): void {
    this.originalRemoteName.set(remote?.name ?? '');
    this.remoteName.set(remote?.name ?? '');
    this.fetchUrl.set(remote?.fetchUrl ?? '');
    this.pushUrl.set(remote?.pushUrl ?? '');
    this.error.set('');
    this.mode.set('remote');
  }

  protected saveRemote(): void {
    this.run(this.git.saveRemote({ originalName: this.originalRemoteName() || undefined, name: this.remoteName().trim(), fetchUrl: this.fetchUrl().trim(), pushUrl: this.pushUrl().trim() }), (remotes) => {
      this.remotes.set(remotes);
      this.repositoryChanged.emit();
      this.mode.set('main');
    });
  }

  protected removeRemote(name: string): void {
    if (!window.confirm(`Remove the remote "${name}" from this repository?`)) return;
    this.run(this.git.removeRemote(name), (remotes) => {
      this.remotes.set(remotes);
      this.repositoryChanged.emit();
    });
  }

  protected editIssueLinking(): void {
    const issue = this.settings().issueLinking;
    this.issueRegex.set(issue?.regex ?? '#(\\d+)');
    this.issueUrl.set(issue?.url ?? '');
    this.issueGlobal.set(issue?.useGlobally ?? false);
    this.error.set('');
    this.mode.set('issue');
  }

  protected saveIssueLinking(): void {
    const issueLinking: IssueLinkingSettings = { regex: this.issueRegex().trim(), url: this.issueUrl().trim(), useGlobally: this.issueGlobal() };
    this.run(this.git.saveSettings({ issueLinking }), (settings) => {
      this.settingsUpdated.emit(settings);
      this.mode.set('main');
    });
  }

  protected removeIssueLinking(): void {
    if (!window.confirm('Remove this issue-linking rule?')) return;
    this.run(this.git.saveSettings({ issueLinking: null, issueLinkingGlobal: this.settings().issueLinking?.useGlobally ?? false }), (settings) => this.settingsUpdated.emit(settings));
  }

  private loadRemotes(): void {
    this.git.getRemotes().subscribe({ next: (remotes) => this.remotes.set(remotes), error: (error) => this.error.set(this.errorMessage(error)) });
  }

  private run<T>(request: Observable<T>, next: (value: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    request.subscribe({ next: (value) => { this.busy.set(false); next(value); }, error: (error) => { this.busy.set(false); this.error.set(this.errorMessage(error)); } });
  }

  private errorMessage(error: any): string {
    return error?.error?.error ?? error?.message ?? 'The setting could not be saved.';
  }
}
