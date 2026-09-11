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

  constructor() {
    if (!this.inVsCode) {
      return;
    }
    window.addEventListener('message', (event) => {
      const data = event.data as { type?: string; diffViewer?: string } | null;
      if (
        data?.type === 'guito/config' &&
        (data.diffViewer === 'guito' || data.diffViewer === 'vscode')
      ) {
        this.diffViewer.set(data.diffViewer);
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
