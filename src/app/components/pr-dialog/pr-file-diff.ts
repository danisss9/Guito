import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { AuthorAvatar } from "../author-avatar/author-avatar";
import { MarkdownText } from "../markdown-text/markdown-text";
import { FileDiff, PrThread, PrThreadStatus } from "../../models/git.models";
import { MonacoService } from "../../services/monaco.service";

/** A comment the user wrote on a specific diff line. */
export interface LineCommentRequest {
  filePath: string;
  line: number;
  endLine?: number;
  side: "left" | "right";
  content: string;
}

/** A reply posted to an existing thread. */
export interface ThreadReplyRequest {
  threadId: number;
  content: string;
}

/** A status change (resolve, reactivate, close) on a thread. */
export interface ThreadStatusRequest {
  threadId: number;
  status: PrThreadStatus;
}

/** A line the dialog wants revealed: expand and scroll to its threads. */
export interface DiffFocus {
  line: number;
  side: "left" | "right";
}

interface DiffSelection extends DiffFocus {
  endLine: number;
}

let prDiffCounter = 0;

const THREAD_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  fixed: "Resolved",
  wontFix: "Won't fix",
  closed: "Closed",
  byDesign: "By design",
  pending: "Pending",
};

/**
 * Unified diff of one pull request file with Azure-style inline comments:
 * hovering a line offers a comment button, and existing threads render
 * beneath their line.
 */
@Component({
  selector: "app-pr-file-diff",
  imports: [AuthorAvatar, MarkdownText],
  templateUrl: "./pr-file-diff.html",
  styleUrl: "./pr-file-diff.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrFileDiff implements AfterViewInit, OnDestroy {
  private readonly monacoService = inject(MonacoService);
  private readonly host = viewChild<ElementRef<HTMLElement>>("host");

  readonly diff = input<FileDiff | null>(null);
  readonly threads = input<PrThread[]>([]);
  readonly loading = input(false);
  readonly error = input("");
  readonly posting = input(false);
  /** Set by the parent to expand and scroll to a line's threads. */
  readonly focus = input<DiffFocus | null>(null);

  readonly commentSubmit = output<LineCommentRequest>();
  readonly replySubmit = output<ThreadReplyRequest>();
  readonly statusSubmit = output<ThreadStatusRequest>();

  protected readonly threadStatuses = Object.keys(THREAD_STATUS_LABELS);

  protected readonly editorLoading = signal(false);
  protected readonly editorError = signal("");
  protected readonly selection = signal<DiffSelection | null>(null);
  protected readonly composerOpen = signal(false);
  protected readonly composerText = signal("");
  protected readonly expanded = signal<Record<number, boolean>>({});
  protected readonly replyDrafts = signal<Record<number, string>>({});

  private viewReady = false;
  private destroyed = false;
  private renderVersion = 0;
  private editor: any = null;
  private models: any[] = [];
  private disposables: any[] = [];
  private decorations: any[] = [];

  protected readonly threadsByAnchor = computed(() => {
    const map = new Map<string, PrThread[]>();
    for (const thread of this.threads()) {
      if (!thread.filePath || thread.line === null || !thread.side) {
        continue;
      }
      const key = `${thread.side}:${thread.line}`;
      map.set(key, [...(map.get(key) ?? []), thread]);
    }
    return map;
  });

  protected readonly selectedThreads = computed(() => {
    const selection = this.selection();
    if (!selection) return [];
    const found: PrThread[] = [];
    for (let line = selection.line; line <= selection.endLine; line += 1) {
      found.push(
        ...(this.threadsByAnchor().get(`${selection.side}:${line}`) ?? []),
      );
    }
    return found;
  });

  constructor() {
    effect(() => {
      const diff = this.diff();
      if (this.viewReady) queueMicrotask(() => void this.renderDiff(diff));
    });

    effect(() => {
      this.threads();
      if (this.viewReady) this.updateThreadDecorations();
    });

    effect(() => {
      const target = this.focus();
      if (!target) {
        return;
      }
      const threads =
        this.threadsByAnchor().get(`${target.side}:${target.line}`) ?? [];
      const updates: Record<number, boolean> = {};
      for (const thread of threads) {
        updates[thread.id] = true;
      }
      if (Object.keys(updates).length) {
        this.expanded.update((current) => ({ ...current, ...updates }));
      }
      this.selection.set({ ...target, endLine: target.line });
      queueMicrotask(() => this.revealSelection(target));
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    queueMicrotask(() => void this.renderDiff(this.diff()));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.disposeEditor();
  }

  protected openComposer(): void {
    if (!this.selection()) return;
    this.composerOpen.set(true);
    this.composerText.set("");
  }

  protected submitComposer(): void {
    const target = this.selection();
    const content = this.composerText().trim();
    if (!target || !content) {
      return;
    }
    this.commentSubmit.emit({
      filePath: this.diff()?.path ?? "",
      ...target,
      content,
    });
    this.closeComposer();
  }

  protected closeComposer(): void {
    this.composerOpen.set(false);
    this.composerText.set("");
  }

  protected selectionLabel(): string {
    const selection = this.selection();
    if (!selection) return "";
    const side = selection.side === "left" ? "original" : "modified";
    return selection.line === selection.endLine
      ? `${side} line ${selection.line}`
      : `${side} lines ${selection.line}-${selection.endLine}`;
  }

  protected isExpanded(threadId: number): boolean {
    return this.expanded()[threadId] === true;
  }

  protected toggleThread(threadId: number): void {
    this.expanded.update((current) => ({
      ...current,
      [threadId]: !current[threadId],
    }));
  }

  protected replyDraft(threadId: number): string {
    return this.replyDrafts()[threadId] ?? "";
  }

  protected setReplyDraft(threadId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.replyDrafts.update((current) => ({ ...current, [threadId]: value }));
  }

  protected sendReply(threadId: number): void {
    const content = this.replyDraft(threadId).trim();
    if (!content) {
      return;
    }
    this.replySubmit.emit({ threadId, content });
  }

  protected onStatusChange(thread: PrThread, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as PrThreadStatus;
    if (status && status !== thread.status) {
      this.statusSubmit.emit({ threadId: thread.id, status });
    }
  }

  protected statusLabel(status: string): string {
    return THREAD_STATUS_LABELS[status] ?? status;
  }

  protected threadPreview(thread: PrThread): string {
    const first = thread.comments[0];
    return first ? `${first.author.name}: ${first.content}` : "Review comment";
  }

  protected formatDate(iso: string): string {
    if (!iso) {
      return "";
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  private async renderDiff(diff: FileDiff | null): Promise<void> {
    const version = ++this.renderVersion;
    this.disposeEditor();
    this.selection.set(null);
    this.composerOpen.set(false);
    this.editorError.set("");
    if (!diff || diff.binary || diff.status === "binary") return;

    this.editorLoading.set(true);
    try {
      const monaco = await this.monacoService.load();
      if (this.destroyed || version !== this.renderVersion) return;
      const host = this.host();
      if (!host) return;
      const id = ++prDiffCounter;
      const originalPath = (diff.oldPath || diff.path).replace(/^\/+/, "");
      const modifiedPath = diff.path.replace(/^\/+/, "");
      const originalModel = monaco.editor.createModel(
        diff.originalContent ?? this.contentFromLines(diff, "left"),
        undefined,
        monaco.Uri.parse(`inmemory://pr-diff/${id}/original/${originalPath}`),
      );
      const modifiedModel = monaco.editor.createModel(
        diff.modifiedContent ?? this.contentFromLines(diff, "right"),
        undefined,
        monaco.Uri.parse(`inmemory://pr-diff/${id}/modified/${modifiedPath}`),
      );
      this.models = [originalModel, modifiedModel];
      this.editor = monaco.editor.createDiffEditor(host.nativeElement, {
        theme: "guito",
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        ignoreTrimWhitespace: false,
        automaticLayout: true,
        fontSize: 12,
        fontFamily:
          "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
        minimap: { enabled: false },
        glyphMargin: true,
        scrollBeyondLastLine: false,
        renderOverviewRuler: false,
        hideUnchangedRegions: { enabled: true, contextLineCount: 3 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        padding: { top: 8 },
      });
      this.editor.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
      this.watchSelection(this.editor.getOriginalEditor(), "left");
      this.watchSelection(this.editor.getModifiedEditor(), "right");
      this.updateThreadDecorations();
      const target = this.focus();
      if (target) {
        this.selection.set({ ...target, endLine: target.line });
        this.revealSelection(target);
      }
    } catch {
      if (version === this.renderVersion)
        this.editorError.set("Failed to load the diff viewer.");
    } finally {
      if (version === this.renderVersion) this.editorLoading.set(false);
    }
  }

  private watchSelection(editor: any, side: "left" | "right"): void {
    this.disposables.push(
      editor.onDidChangeCursorSelection((event: any) => {
        const range = event.selection;
        this.selection.set({
          line: Math.min(range.startLineNumber, range.endLineNumber),
          endLine: Math.max(range.startLineNumber, range.endLineNumber),
          side,
        });
        this.composerOpen.set(false);
      }),
    );
  }

  private updateThreadDecorations(): void {
    if (!this.editor) return;
    for (const collection of this.decorations) collection.clear();
    const bySide = (side: "left" | "right") =>
      this.threads()
        .filter((thread) => thread.side === side && thread.line !== null)
        .map((thread) => ({
          range: {
            startLineNumber: thread.line,
            startColumn: 1,
            endLineNumber: thread.line,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            glyphMarginClassName: "pr-thread-glyph",
            glyphMarginHoverMessage: { value: "Review comment" },
          },
        }));
    this.decorations = [
      this.editor
        .getOriginalEditor()
        .createDecorationsCollection(bySide("left")),
      this.editor
        .getModifiedEditor()
        .createDecorationsCollection(bySide("right")),
    ];
  }

  private revealSelection(target: DiffFocus): void {
    if (!this.editor) return;
    const editor =
      target.side === "left"
        ? this.editor.getOriginalEditor()
        : this.editor.getModifiedEditor();
    editor.setPosition({ lineNumber: target.line, column: 1 });
    editor.revealLineInCenter(target.line);
    editor.focus();
  }

  private contentFromLines(diff: FileDiff, side: "left" | "right"): string {
    return diff.lines
      .filter(
        (line) =>
          line.type === "context" ||
          (side === "left" ? line.type === "del" : line.type === "add"),
      )
      .map((line) => line.text)
      .join("\n");
  }

  private disposeEditor(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables = [];
    for (const collection of this.decorations) collection.clear();
    this.decorations = [];
    this.editor?.dispose();
    this.editor = null;
    for (const model of this.models) model.dispose();
    this.models = [];
  }
}
