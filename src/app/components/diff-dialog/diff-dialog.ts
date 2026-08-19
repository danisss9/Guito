import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileDiff } from '../../models/git.models';
import { GitService } from '../../services/git.service';
import { MonacoService } from '../../services/monaco.service';

let dialogCounter = 0;

@Component({
  selector: 'app-diff-dialog',
  templateUrl: './diff-dialog.html',
  styleUrl: './diff-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiffDialog implements AfterViewInit, OnDestroy {
  private readonly git = inject(GitService);
  private readonly monacoService = inject(MonacoService);

  readonly file = input.required<FileDiff>();
  /** Git ref for the original side (e.g. `abc^`, `HEAD`). */
  readonly originalRef = input.required<string>();
  /** Git ref for the modified side (e.g. `abc`, `WORKING`). */
  readonly modifiedRef = input.required<string>();
  readonly closed = output<void>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly binary = signal(false);
  protected readonly sideBySide = signal(true);

  private editor: any = null;
  private models: any[] = [];

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }

  async ngAfterViewInit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.binary.set(false);

    try {
      const monaco = await this.monacoService.load();
      const file = this.file();
      const originalRef = file.status === 'added' && !file.oldPath ? 'EMPTY' : this.originalRef();

      const [original, modified] = await Promise.all([
        firstValueFrom(this.git.getFileContent(file.oldPath || file.path, originalRef)),
        firstValueFrom(this.git.getFileContent(file.path, this.modifiedRef())),
      ]);

      if (original.binary || modified.binary) {
        this.binary.set(true);
        this.loading.set(false);
        return;
      }

      const id = ++dialogCounter;
      const originalModel = monaco.editor.createModel(
        original.content,
        undefined,
        monaco.Uri.parse(`inmemory://diff/${id}/original/${file.oldPath || file.path}`),
      );
      const modifiedModel = monaco.editor.createModel(
        modified.content,
        undefined,
        monaco.Uri.parse(`inmemory://diff/${id}/modified/${file.path}`),
      );
      this.models = [originalModel, modifiedModel];

      this.editor = monaco.editor.createDiffEditor(this.host().nativeElement, {
        theme: 'guito',
        readOnly: true,
        originalEditable: false,
        renderSideBySide: this.sideBySide(),
        ignoreTrimWhitespace: false,
        automaticLayout: true,
        fontSize: 12,
        fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderOverviewRuler: false,
        hideUnchangedRegions: { enabled: true, contextLineCount: 3 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 8 },
      });

      this.editor.setModel({ original: originalModel, modified: modifiedModel });
      this.loading.set(false);
    } catch {
      this.error.set('Failed to load the diff.');
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    this.editor = null;
    for (const model of this.models) {
      model.dispose();
    }
    this.models = [];
  }

  protected toggleLayout(): void {
    this.sideBySide.update((value) => !value);
    this.editor?.updateOptions({ renderSideBySide: this.sideBySide() });
  }
}
