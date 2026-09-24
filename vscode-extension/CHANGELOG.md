# Changelog

## Unreleased

## 1.0.6

- Publish the extension to Open VSX in addition to the Visual Studio Marketplace, so VSCodium and other Open VSX-compatible editors can install Guito.
- Review Azure DevOps pull requests automatically with Claude Code running on the extension host. Guito polls for the pull requests waiting on you, reviews every new commit, and queues the comments in the pull request dialog's new Review tab for you to post or dismiss; nothing is posted and no vote is cast without you. Configure it with the `guito.aiReview.*` settings, and check immediately with "Guito: Review Pull Requests Now".

## 1.0.5

- Virtualize the repository panel's branch and tag lists so repositories with thousands of refs scroll smoothly; only the rows around the viewport are rendered, while counts keep reporting the full totals.
- Slide the repository panel in from the left when it opens again; the width transition was skipped when the panel was inserted and expanded within the same rendering pass.
- Stop the repository panel's sections from flashing "Loading..." when their data arrives quickly; the notices now appear only after a short delay.

## 1.0.4

- Add a "Compare with Branch..." context-menu action for staged and unstaged files. A searchable picker lists every other branch, and the comparison opens in VS Code's diff tab or Guito's own diff dialog.
- Add the `guito.sidePanelSectionsExpanded` setting that opens the repository panel with all sections expanded, alongside the same checkbox in Guito's settings dialog.
- Collapse or expand every repository panel section at once with the button next to the panel's search field.
- Click a stash in the repository panel to open its changed files in the commit detail panel, with the selected stash highlighted.

## 1.0.3

- Add the `guito.refListView` setting that shows branches and tags as a flat list or grouped into collapsible namespace folders.
- Rebuild open repository panels when `guito.refListView` changes, and apply `guito.searchCaseSensitive` to repository-panel search as well as commit search, including accent sensitivity.
- Switch the current Guito tab to a worktree by double-clicking it, or use its context menu to switch the current tab, open a separate Guito tab, or open the folder in a new VS Code window.
- Resolve merge conflicts from a new section at the top of the Uncommitted changes panel; opening a conflicted file launches VS Code's merge editor.
- Select several branches in the repository panel with Ctrl/Cmd-click and Shift-click, and the commit table shows the union of their histories.
- Filter the repository panel with a search box that narrows branches, tags, stashes, worktrees, and pull requests as you type.

## 1.0.2

- Add a keyboard shortcut to open Guito: Ctrl+Alt+G on Windows and Linux, Cmd+Alt+G on macOS. The shortcut is available whenever a workspace folder is open and can be rebound in VS Code's Keyboard Shortcuts editor.

## 1.0.1

- Fix pull request policy evaluations in the merge checks card: build the documented `vstfs:///CodeReview/CodeReviewId/{projectId}/{pullRequestId}` artifact id instead of the rejected `CodeReviewIdentity` form, so the card shows branch policies again instead of degrading to pull request statuses only.
- Add and remove pull request tags and related work items from the review dialog sidebar: a "+" button beside each section opens an inline picker (project tags, or Azure Boards search by title/id for work items), and each tag chip and work item row has an "×" that removes it.

- Make the native VS Code diff tab the default diff viewer by defaulting `guito.diffViewer` to "vscode"; switch the setting to "guito" to keep opening diffs in Guito's own dialog.
- Default `guito.showStashes` to disabled so stash rows in the commit table appear only after enabling "Show stashes" in the settings.
- Add the `guito.allowMerge` setting that removes the "No fast-forward (merge commit)" and "Semi-linear merge" choices from the pull request completion and auto-complete dialogs.

## 1.0.0

- Add native VS Code commands for managing repository user details and Git remotes with Quick Pick and Input Box prompts.
- Add the `guito.searchCaseSensitive` setting for exact-case commit searches; searches remain case insensitive by default.
- Add an Azure DevOps Pull Requests section and full review dialog with details, reviewers, votes, completion, comments, changed files, and inline diff comments.
- List all repository tags in a collapsible section of the side panel below the branches; clicking a tag opens the commit it points to in the history, and right-clicking keeps the view details, delete, push, archive, and copy name actions.
- Add Show Tags, Show Remote Branches, and issue-linking regex/URL preferences to Guito's native VS Code settings.
- Add the `guito.prBranchNameTemplate` setting for remote-only pull request branch names, with variables for the computer user, random text, current and target branches, pull request title, repository, UTC date/time, and timestamp.
- Add the guito.diffViewer setting that chooses where file diffs open: Guito's own dialog (the default) or the native VS Code diff tab, showing both sides of the diff (commit, HEAD, index, or working tree) with VS Code's diff editor. Changing the setting applies immediately to open Guito panels; binary files keep using Guito's dialog.
- Log failed server requests (HTTP status 400 and above) in the Guito output channel with their method, path, status, and error body, prefixed with the repository name.
- Show the Guito logo on the webview editor tab.

## 0.6.2

- Show author avatars in the commit table and the commit detail pane, falling back to initials when no Gravatar image is available.
- Refresh history and the working tree automatically when the repository changes outside Guito, and keep the loaded history, selected branch, and selected commit in sync.
- Make the Description column of the commit table resizable and persist its width across sessions.
- Show your configured Git user name for uncommitted changes and your own commits.
- Move the commit search to the far right of the title bar.
- Fill the window width with the commit table on load and when the window is resized; resizing a column changes only that column.
- Add the guito.autoReload setting that controls automatic reloading of commits and the working tree (enabled by default).
- Add a "Create as draft" option to the Create Pull Request dialog.
- Suggest existing pull request labels instead of work item tags in the Create Pull Request tag field.
- Show per-field loading and error state, cancel outdated requests, and display a "No matches" hint for reviewer, work item, and tag lookups.
- Use the Azure DevOps repositories API for pull request and label URLs so they resolve on Azure DevOps Server.
- Fix work item linking, scope work item search to the current team project, accept `#id` queries, and cap results at 20.
- Strip `origin/` and `refs/heads/` prefixes from the pull request target branch.
- Avoid duplicating collection path segments when building Azure DevOps base URLs.
- Search reviewers through the collection identities API so they can be added to pull requests directly.

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
