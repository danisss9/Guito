# Changelog

## Unreleased

- Stage and unstage individual files, selected ranges, or all changes from the Uncommitted changes panel, with Ctrl/Cmd and Shift selection and separate staged/unstaged diff previews.
- Write a commit message and optional description, then commit staged changes. Drafts survive panel closure and failed commits during the session.
- Keep the header, uncommitted row, graph, and commit columns aligned during horizontal scrolling and column resizing.
- Restore rows after searching or clearing empty results, with loading feedback and explicit retries for failed requests.
- Recover pending graph work when its worker fails, preserve working status after errors, and support initial commits, partial staging, renamed/deleted files, and literal filenames.
- Reject blank subjects, empty-index commits, and unresolved conflicts, and prevent overlapping UI mutations.

## 0.5.4

- Render only the visible rows with virtual scrolling and compute the commit graph in a web worker for large histories.
- Omit commit bodies from the list payload and fetch them on demand in the detail pane.
- Refresh only the working-tree status after discard, reset, and clean actions, and abort superseded requests.

## 0.5.3

- Load commit history in pages of 500 with load-more and load-all controls for faster startup on large repositories.
- Debounce commit search and search the full history, including commit bodies and commits on all branches.
- Compress server responses for faster loading in remote workspaces.

## 0.5.2

- Fix communication with the Guito server from the embedded VS Code webview.

## 0.5.1

- Add a marketplace icon for the Visual Studio Code extension.

## 0.5.0

- Add a Guito status-bar action and repository picker.
- Open Guito in a reusable editor webview.
- Support local and remote VS Code workspaces.
