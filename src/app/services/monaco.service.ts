import { Injectable } from '@angular/core';

/**
 * Lazily loads the Monaco editor (AMD build) that is copied into the `vs`
 * asset folder by the Angular build, and exposes the monaco namespace.
 */
@Injectable({ providedIn: 'root' })
export class MonacoService {
  private loading: Promise<any> | null = null;

  load(): Promise<any> {
    if (!this.loading) {
      this.loading = new Promise<any>((resolve, reject) => {
        const w = window as any;

        if (w.monaco) {
          resolve(w.monaco);
          return;
        }

        const script = document.createElement('script');
        script.src = 'vs/loader.js';
        script.async = true;
        script.onload = () => {
          const require = w.require;
          if (!require) {
            reject(new Error('Monaco AMD loader not found.'));
            return;
          }
          require.config({ paths: { vs: 'vs' } });
          require(['vs/editor/editor.main'], () => {
            this.applyTheme(w.monaco);
            resolve(w.monaco);
          });
        };
        script.onerror = () => {
          this.loading = null;
          reject(new Error('Failed to load the Monaco editor.'));
        };
        document.head.appendChild(script);
      });
    }
    return this.loading;
  }

  private applyTheme(monaco: any): void {
    monaco.editor.defineTheme('guito', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editorGutter.background': '#1e1e1e',
        'editorLineNumber.foreground': '#5a5a5a',
        'editorLineNumber.activeForeground': '#cccccc',
        'diffEditor.insertedTextBackground': '#89d18526',
        'diffEditor.removedTextBackground': '#f4877126',
        'diffEditor.insertedLineBackground': '#89d1851a',
        'diffEditor.removedLineBackground': '#f487711a',
        'scrollbarSlider.background': '#4a4a4a80',
        'scrollbarSlider.hoverBackground': '#5a5a5a99',
        'editorWidget.background': '#232323',
        'editorWidget.border': '#3c3c3c',
        'editorSuggestWidget.background': '#232323',
      },
    });
  }
}
