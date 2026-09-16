/**
 * Turns flat branch/tag name lists into the rows of a collapsible namespace
 * tree. Names are split on "/" segments: "origin/feature/login" nests under
 * "origin" > "feature" with the leaf labeled "login". Mirrors the folder
 * handling of the changed-file tree (utils/file-tree.ts).
 */

/** A ref (branch or tag) with its full name. */
export interface NamedRef {
  name: string;
}

/** One rendered row of a ref tree: a collapsible namespace folder or a ref. */
export type RefTreeRow<T extends NamedRef> =
  | {
      kind: 'dir';
      /** Full folder path ("origin/feature"); keys the collapsed set. */
      path: string;
      /** Last path segment ("feature"). */
      name: string;
      /** Nesting level; 0 for top-level rows. */
      depth: number;
      /** Whether the folder's children are hidden. */
      collapsed: boolean;
    }
  | {
      kind: 'ref';
      /** Full ref name; the identity used for selection and context menus. */
      path: string;
      /** Display label: the last path segment in tree view. */
      name: string;
      depth: number;
      ref: T;
    };

interface Folder<T extends NamedRef> {
  name: string;
  dirs: Map<string, Folder<T>>;
  refs: T[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/**
 * Builds the visible rows of a ref tree. Folders sort before refs
 * (case-insensitive by name); collapsed folders hide their descendants.
 */
export function buildRefTreeRows<T extends NamedRef>(
  refs: T[],
  collapsed: Set<string>,
): RefTreeRow<T>[] {
  const root: Folder<T> = { name: '', dirs: new Map(), refs: [] };
  for (const ref of refs) {
    const segments = ref.name.split('/').filter(Boolean);
    let folder = root;
    for (const segment of segments.slice(0, -1)) {
      let child = folder.dirs.get(segment);
      if (!child) {
        child = { name: segment, dirs: new Map(), refs: [] };
        folder.dirs.set(segment, child);
      }
      folder = child;
    }
    folder.refs.push(ref);
  }

  const rows: RefTreeRow<T>[] = [];
  const visit = (folder: Folder<T>, path: string, depth: number): void => {
    for (const child of [...folder.dirs.values()].sort(byName)) {
      const childPath = path ? `${path}/${child.name}` : child.name;
      const isCollapsed = collapsed.has(childPath);
      rows.push({
        kind: 'dir',
        path: childPath,
        name: child.name,
        depth,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        visit(child, childPath, depth + 1);
      }
    }
    for (const ref of [...folder.refs].sort(byName)) {
      rows.push({
        kind: 'ref',
        path: ref.name,
        name: ref.name.split('/').pop() ?? ref.name,
        depth,
        ref,
      });
    }
  };
  visit(root, '', 0);
  return rows;
}

/** Flat-view rows: every ref at depth 0 labeled with its full name. */
export function flatRefRows<T extends NamedRef>(refs: T[]): RefTreeRow<T>[] {
  return refs.map((ref) => ({
    kind: 'ref' as const,
    path: ref.name,
    name: ref.name,
    depth: 0,
    ref,
  }));
}
