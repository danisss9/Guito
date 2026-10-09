/**
 * Helpers for showing a code minimap on Monaco diff editors.
 *
 * Monaco force-disables the minimap on the sub editors of a diff editor
 * (`DiffEditorEditors` clamps `minimap.enabled` to false), and its diff
 * decorations carry no minimap information. These helpers re-enable the
 * minimap on the modified side and turn diff hunks into minimap marks.
 */

/**
 * Mark colors as plain hex. Monaco's minimap only parses `#rrggbb` here —
 * `rgba()` strings fall back to pure red, and 8-digit hex paints nothing.
 * Inline marks are painted at half opacity, which keeps the miniaturized
 * code underneath readable.
 */
const INSERT_COLOR = '#89d185';
const REMOVE_COLOR = '#f48771';

/** Monaco `MinimapPosition.Inline`; spans the changed lines like VS Code's diff minimap. */
const MINIMAP_INLINE = 1;
/** Monaco `MinimapPosition.Gutter`; a narrow mark at the minimap's left edge. */
const MINIMAP_GUTTER = 2;

/** Minimap options to apply to the modified sub editor of a diff editor. */
export function diffMinimapOptions(enabled: boolean): any {
  return {
    enabled,
    renderCharacters: true,
    showSlider: 'always',
    size: 'fit',
  };
}

/**
 * Minimap decorations for the modified side of a diff: added or replaced
 * lines get a green mark spanning the line, pure deletions a red gutter mark
 * at the position they were removed from. `changes` comes from the diff
 * editor's `getLineChanges()`.
 */
export function diffMinimapMarks(changes: readonly any[]): any[] {
  const marks: any[] = [];
  for (const change of changes ?? []) {
    const start = change.modifiedStartLineNumber;
    const end = change.modifiedEndLineNumber;
    if (end === 0) {
      const line = Math.max(1, start);
      marks.push({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: { minimap: { position: MINIMAP_GUTTER, color: REMOVE_COLOR } },
      });
    } else if (end >= start) {
      marks.push({
        range: {
          startLineNumber: start,
          startColumn: 1,
          endLineNumber: end,
          endColumn: 1,
        },
        options: { minimap: { position: MINIMAP_INLINE, color: INSERT_COLOR } },
      });
    }
  }
  return marks;
}
