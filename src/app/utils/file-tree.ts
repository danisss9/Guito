import { FileDiff } from '../models/git.models';

/** One rendered row of a file tree: a collapsible folder or a changed file. */
export type FileTreeRow =
  | {
      kind: 'dir';
      /** Full directory path ("src/app"); keys the collapsed set. */
      path: string;
      /** Last path segment ("app"). */
      name: string;
      /** Nesting level; 0 for top-level rows. */
      depth: number;
      /** Whether the folder's children are hidden. */
      collapsed: boolean;
      /** Additions and deletions summed over every file below the folder. */
      additions: number;
      deletions: number;
    }
  | {
      kind: 'file';
      path: string;
      /** Display label: the file name in tree view, the full path in flat view. */
      name: string;
      depth: number;
      file: FileDiff;
    };

interface Directory {
  name: string;
  dirs: Map<string, Directory>;
  files: FileDiff[];
  additions: number;
  deletions: number;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

const baseName = (path: string): string => path.split('/').pop() ?? path;

const byFileName = (a: FileDiff, b: FileDiff): number =>
  baseName(a.path).toLowerCase().localeCompare(baseName(b.path).toLowerCase());

/**
 * Turns changed files into the rows of a directory tree. Folders sort before
 * files (case-insensitive by name), collapsed folders hide their children,
 * and folder rows sum the additions and deletions below them.
 */
export function buildFileTreeRows(files: FileDiff[], collapsed: Set<string>): FileTreeRow[] {
  const root: Directory = { name: '', dirs: new Map(), files: [], additions: 0, deletions: 0 };
  for (const file of files) {
    const segments = file.path.split('/');
    let dir = root;
    for (const segment of segments.slice(0, -1)) {
      let child = dir.dirs.get(segment);
      if (!child) {
        child = { name: segment, dirs: new Map(), files: [], additions: 0, deletions: 0 };
        dir.dirs.set(segment, child);
      }
      child.additions += file.additions;
      child.deletions += file.deletions;
      dir = child;
    }
    dir.files.push(file);
  }

  const rows: FileTreeRow[] = [];
  const visit = (dir: Directory, path: string, depth: number): void => {
    for (const child of [...dir.dirs.values()].sort(byName)) {
      const childPath = path ? `${path}/${child.name}` : child.name;
      const isCollapsed = collapsed.has(childPath);
      rows.push({
        kind: 'dir',
        path: childPath,
        name: child.name,
        depth,
        collapsed: isCollapsed,
        additions: child.additions,
        deletions: child.deletions,
      });
      if (!isCollapsed) {
        visit(child, childPath, depth + 1);
      }
    }
    for (const file of [...dir.files].sort(byFileName)) {
      rows.push({
        kind: 'file',
        path: file.path,
        name: file.path.split('/').pop() ?? file.path,
        depth,
        file,
      });
    }
  };
  visit(root, '', 0);
  return rows;
}
