/**
 * Helpers for showing a code minimap on Monaco diff editors.
 *
 * Monaco force-disables the minimap on the sub editors of a diff editor
 * (`DiffEditorEditors` clamps `minimap.enabled` to false), and its diff
 * decorations carry no minimap information. These helpers re-enable the
 * minimap on the modified side and turn diff hunks into minimap marks.
 */

/** Monaco `MinimapPosition.Gutter` (avoids depending on the monaco global here). */
const MINIMAP_GUTTER = 2;

const INSERT_COLOR = 'rgba(137, 209, 133, 0.6)';
const REMOVE_COLOR = 'rgba(244, 135, 113, 0.6)';

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
 * Minimap decorations for the modified side of a diff: added or replaced lines
 * get an insert mark, pure deletions a remove mark at the position they were
 * removed from. `changes` comes from the diff editor's `getLineChanges()`.
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
        options: { minimap: { position: MINIMAP_GUTTER, color: INSERT_COLOR } },
      });
    }
  }
  return marks;
}
