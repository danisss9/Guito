# Changelog

## 0.6.1

- Add a "Rebase (from)..." action to the pull menu that rebases the current branch onto a picked branch, with origin/main as the default choice and a scrollable option list.
- Add a "Push (force)" action to the push menu, shown in red and confirmed with a dialog before overwriting the remote branch.
- Add a "Create Pull Request..." action to the push menu that creates a pull request on an on-prem Azure DevOps Server and shows a link to the created pull request.
- Add required and optional reviewers, work item links, and tags to pull request creation, with autocomplete suggestions from the Azure DevOps API.
- Add the guito.azureDevOpsUrl setting that points Guito at the Azure DevOps Server and enables the pull request actions, authenticated with Windows integrated authentication.

## 0.6.0

- Stage and unstage individual files, selected ranges, or all changes from the Uncommitted changes panel, with Ctrl/Cmd and Shift selection and separate staged/unstaged diff previews.
- Write a commit message and optional description, then commit staged changes. Drafts survive panel closure and failed commits during the session.
- Add rename and delete actions for local branches to the branch context menu.
- Navigate commit search results with up/down arrows (or Enter and Shift+Enter) instead of filtering the list; matches are highlighted in place and navigating to an unloaded match loads more history until it can be shown.
- Ask for the reset type (soft, mixed, or hard) when resetting the current branch to a commit.
- Add a tag context menu with view details, delete tag, push tag, create archive, and copy tag name actions.
- Add a clear button to the commit search.
- Persist column widths and the commit message draft across sessions.
- Add stash all, staged, and unstaged actions to the Uncommitted changes panel.
- Add discard selected and discard all actions for unstaged changes, with a confirmation dialog.
- Remove the per-file stage/unstage buttons from file rows in favor of the selection and bulk actions.
- Keep the header, uncommitted row, graph, and commit columns aligned during horizontal scrolling and column resizing.
- Restore rows after searching or clearing empty results, with loading feedback and explicit retries for failed requests.
- Recover pending graph work when its worker fails, preserve working status after errors, and support initial commits, partial staging, renamed/deleted files, and literal filenames.
- Reject blank subjects, empty-index commits, and unresolved conflicts, and prevent overlapping UI mutations.
- Keep commit graph edges connected across viewport boundaries while scrolling.

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
