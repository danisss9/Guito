import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IssueLinkingSettings } from '../../models/git.models';

interface TextSegment { text: string; href?: string; match: boolean; }

@Component({ selector: 'app-issue-text', templateUrl: './issue-text.html', styleUrl: './issue-text.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class IssueText {
  readonly text = input('');
  readonly search = input('');
  readonly linking = input<IssueLinkingSettings | null>(null);

  protected readonly segments = computed<TextSegment[]>(() => {
    const text = this.text();
    const linking = this.linking();
    const linked: { text: string; href?: string }[] = [];
    if (!linking) linked.push({ text });
    else {
      try {
        const regex = new RegExp(linking.regex, 'g');
        let offset = 0;
        for (const match of text.matchAll(regex)) {
          const index = match.index ?? 0;
          if (index > offset) linked.push({ text: text.slice(offset, index) });
          const href = linking.url.replace(/\$(\d+)/g, (_token, group) => match[Number(group)] ?? '');
          linked.push({ text: match[0], ...(/^https?:\/\//i.test(href) ? { href } : {}) });
          offset = index + match[0].length;
          if (match[0].length === 0) break;
        }
        if (offset < text.length) linked.push({ text: text.slice(offset) });
      } catch { linked.push({ text }); }
    }
    const search = this.search().trim().toLowerCase();
    if (!search) return linked.map((segment) => ({ ...segment, match: false }));
    return linked.flatMap((segment) => {
      const pieces: TextSegment[] = [];
      const lower = segment.text.toLowerCase();
      let offset = 0;
      while (offset < segment.text.length) {
        const index = lower.indexOf(search, offset);
        if (index === -1) { pieces.push({ ...segment, text: segment.text.slice(offset), match: false }); break; }
        if (index > offset) pieces.push({ ...segment, text: segment.text.slice(offset, index), match: false });
        pieces.push({ ...segment, text: segment.text.slice(index, index + search.length), match: true });
        offset = index + search.length;
      }
      return pieces;
    });
  });
}
