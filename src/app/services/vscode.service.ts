import { Injectable, inject, signal } from '@angular/core';
import { FileDiff } from '../models/git.models';
import { GitService } from './git.service';

/**
 * Bridge to the VS Code extension host. The app runs in an iframe inside the
 * extension's webview, so requests travel via postMessage to a relay script
 * in the webview page (see the extension's webviewHtml). Outside VS Code the
 * messages have nowhere to go and Guito's own dialogs are used.
 */
@Injectable({ providedIn: 'root' })
export class VscodeService {
  private readonly git = inject(GitService);
  private readonly inVsCode = typeof window !== 'undefined' && window.parent !== window;

  /** Mirrors the guito.diffViewer VS Code setting; relayed live on changes. */
  private readonly diffViewer = signal<'guito' | 'vscode'>('guito');
  /** Increments when the extension host reports a VS Code setting change. */
  readonly settingsVersion = signal(0);
  private folderRequest = 0;
  private readonly folderResolvers = new Map<number, (path: string | null) => void>();

  readonly canPickFolder = this.inVsCode;

  constructor() {
    if (!this.inVsCode) {
      return;
    }
    window.addEventListener('message', (event) => {
      const data = event.data as {
        type?: string;
        diffViewer?: string;
        requestId?: number;
        path?: string;
      } | null;
      if (
        data?.type === 'guito/config' &&
        (data.diffViewer === 'guito' || data.diffViewer === 'vscode')
      ) {
        this.diffViewer.set(data.diffViewer);
        this.settingsVersion.update((version) => version + 1);
      }
      if (data?.type === 'guito/folderSelected' && typeof data.requestId === 'number') {
        const resolve = this.folderResolvers.get(data.requestId);
        if (resolve) {
          this.folderResolvers.delete(data.requestId);
          resolve(typeof data.path === 'string' && data.path ? data.path : null);
        }
      }
    });
    this.git.getSettings().subscribe({
      next: (settings) => {
        if (settings.diffViewer) {
          this.diffViewer.set(settings.diffViewer);
        }
      },
      error: () => {},
    });
  }

  /** Opens VS Code's native folder picker; standalone Guito returns null. */
  pickFolder(): Promise<string | null> {
    if (!this.inVsCode) {
      return Promise.resolve(null);
    }
    const requestId = ++this.folderRequest;
    window.parent.postMessage({ type: 'guito/pickFolder', requestId }, '*');
    return new Promise((resolve) => this.folderResolvers.set(requestId, resolve));
  }

  /** Opens Guito's contributed settings in VS Code; standalone callers return false. */
  openSettings(): boolean {
    if (!this.inVsCode) {
      return false;
    }
    window.parent.postMessage({ type: 'guito/openSettings' }, '*');
    return true;
  }

  /** Whether repository files can be opened in the hosting VS Code window. */
  canOpenFile(): boolean {
    return this.inVsCode;
  }

  /** Opens a repository-relative working-tree file in VS Code. */
  openFile(path: string): boolean {
    if (!this.inVsCode) {
      return false;
    }
    window.parent.postMessage({ type: 'guito/openFile', path }, '*');
    return true;
  }

  /**
   * Opens the diff in the VS Code diff tab; returns false when the caller
   * should fall back to Guito's own dialog (standalone usage, binary files).
   */
  openDiff(file: FileDiff, originalRef: string, modifiedRef: string): boolean {
    if (!this.inVsCode || this.diffViewer() !== 'vscode' || file.status === 'binary') {
      return false;
    }
    // Mirrors the diff dialog: an added file without a previous path diffs from nothing.
    const effectiveOriginalRef = file.status === 'added' && !file.oldPath ? 'EMPTY' : originalRef;
    window.parent.postMessage(
      {
        type: 'guito/openDiff',
        path: file.path,
        oldPath: file.oldPath,
        status: file.status,
        originalRef: effectiveOriginalRef,
        modifiedRef,
      },
      '*',
    );
    return true;
  }
}
