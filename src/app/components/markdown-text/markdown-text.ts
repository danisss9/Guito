import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Renders a markdown string (PR descriptions and comments) as sanitized
 * HTML, matching how Azure DevOps shows pull request text.
 */
@Component({
  selector: 'app-markdown-text',
  template: `<div class="markdown" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-text.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownText {
  /** Raw markdown source; empty when unset. */
  readonly markdown = input.required<string>();

  protected readonly html = computed(() => {
    const source = (this.markdown() ?? '').trim();
    if (!source) {
      return '';
    }
    return DOMPurify.sanitize(marked.parse(source, { async: false }) as string);
  });
}
