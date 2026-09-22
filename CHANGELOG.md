# Changelog

All notable changes to Guito are documented in this file. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and this changelog is structured around [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Review Azure DevOps pull requests automatically with Claude Code running on your own machine. Guito polls for the pull requests in scope (by default the active ones waiting on your review), hands each new merge source commit to Claude Code, and queues the findings in the pull request dialog's new **Review** tab, where each one shows its severity, file and line, and jumps to the diff. Tick the comments you want and post them as ordinary Azure DevOps threads, or dismiss them so they are never raised again. Nothing is posted and no vote is cast without you. When the author pushes a new commit, only the files that commit touched are reviewed again, and Claude is told what it already raised so the same point is not repeated. Configure it in the settings dialog or with the `guito.aiReview.*` VS Code settings; inside VS Code the reviewer keeps running with no Guito panel open, and **Guito: Review Pull Requests Now** checks immediately.

## [1.0.5] - 2026-09-22

### Added

- A unified Git operation dialog for every mutating context action. Adding a tag (lightweight or annotated, with an optional push), creating a branch (with checkout and publish-and-set-upstream), checking out commits (detached or as a new branch) and remote branches (tracking branch or detached), cherry-picking and reverting (no-commit, sign-off, source recording, and the mainline parent for merge commits), merging (default, no-fast-forward, fast-forward-only, squash, no-commit, autostash), rebasing (autostash, preserved merges), resetting (soft/mixed/hard), pushing tags (remote picker, force), deleting tags and branches (optional remote deletion), renaming branches (publish the new name, delete the old remote ref), pulling remote branches (merge, rebase, or fast-forward-only), and stashing (message, scope, untracked files, staged-state restoration on apply/pop) all collect their options before running. Every menu item that ends in "..." now opens its dialog, including the working panel's stash buttons, and dialogs show the target commit or ref plus the current branch, disable remote-dependent options when no remotes are configured, and reset their options each time they open.
- The server now validates and serializes these operations: enum options are allowlisted, branch and tag names are checked with Git's own ref-format rules, remotes must be configured, merge commits require an in-bounds mainline parent, and all rewritten mutations run through the server's mutation queue. Dropping a commit no longer hard-resets the branch to the parent (which lost every descendant); it now rebases the descendants onto the dropped commit's parent and refuses dirty, detached, root, merge, or unreachable commits. Pulling a specific remote branch sends the chosen remote and branch instead of the defaults.
- Composite actions report partial failures as warnings instead of failing overall: a created tag or branch whose push was rejected, or a rename or deletion whose remote step failed, keeps the local change and returns a precise warning that Guito shows after refreshing. Remote steps resolve to the explicitly chosen remote, else "origin", else the first configured remote.
- Virtual scrolling in the repository panel's branch and tag lists. Repositories with thousands of refs no longer render every row at once: only the rows around the viewport are materialized between two spacers, so the panel scrolls smoothly and the counts still report the full totals. Stashes, worktrees and pull requests stay fully rendered.

### Fixed

- Slide the repository side panel in again when it opens. Inserting the panel and expanding it within the same rendering pass left the browser no collapsed width to transition from, so the panel appeared at full width instantly; opening now commits the collapsed width first and the slide-in always plays. Closing was unaffected.
- Stop the repository panel's sections from flashing "Loading..." when their data arrives quickly. The loading notices now appear only after a short grace period, so fast loads show the lists immediately while slow ones still get feedback.

### Changed

- "Pull into current branch..." and "Delete Remote Branch..." now appear only on remote-tracking branches, where they apply, and the working-panel and history reset/clean confirmations report the affected tracked and untracked file counts.

## [1.0.4] - 2026-09-18

### Added

- Compare a staged or unstaged file with its version on another branch from the file's context menu. A searchable picker lists every other branch, and the comparison opens in VS Code's diff tab inside the extension or Guito's own diff dialog otherwise.
- Collapse or expand every repository panel section at once with the button next to the panel's search field.
- Choose whether the repository panel opens with all sections expanded through the "Expand repository panel sections" setting, available in the settings dialog and as the VS Code `guito.sidePanelSectionsExpanded` setting; changing it rebuilds an open panel immediately.
- Click a stash in the repository panel to open its changed files in the commit detail panel, with the selected stash highlighted.

## [1.0.3] - 2026-09-17

### Fixed

- Rebuild the open repository panel when the branch/tag flat-or-tree setting changes, including live changes from VS Code settings.
- Apply the search sensitivity setting to both commit search and repository-panel search; insensitive matching now ignores casing and accents in both places.

### Added

- Switch the current Guito tab to a worktree by double-clicking it. The worktree context menu can also switch the current tab, open a separate Guito tab, or open the folder in a new VS Code window; every Guito context shows that worktree's graph, staging area, and unstaged changes.
- Resolve merge conflicts without leaving Guito. Conflicted files are collected in a "Merge conflicts" section at the top of the Uncommitted changes panel, and opening one shows the current ("ours") and incoming ("theirs") versions side by side with the conflicted result below: take either side, combine both, edit the merged text, or delete the file, and confirming stages the file as resolved. Inside the VS Code extension, opening a conflict launches VS Code's own merge editor instead.
- Select several branches at once in the repository side panel with Ctrl/Cmd-click and Shift-click, and the commit table shows the union of their histories. Clicking a branch without a modifier goes back to a single selection, and the "All Branches" row clears it.
- Filter the repository side panel with a search box that narrows branches, tags, stashes, worktrees, and pull requests as you type.
- Show branches and tags grouped into collapsible namespace folders. The new "Branches and tags" choice in the repository settings switches between the flat list and the directory tree, and is also available as `guito.refListView` in VS Code.

## [1.0.2] - 2026-09-16

### Added

- Open Guito with a keyboard shortcut: Ctrl+Alt+G on Windows and Linux, Cmd+Alt+G on macOS. The shortcut works whenever a workspace folder is open and can be rebound in VS Code's Keyboard Shortcuts editor.

## [1.0.1] - 2026-09-14

### Fixed

- Load Azure DevOps pull request policy evaluations again in the merge checks card. The checks request used the undocumented `CodeReviewIdentity` artifact id, which Azure rejects with "Artifact id ... does not exist" and degraded the card to pull request statuses only; it now builds the documented `vstfs:///CodeReview/CodeReviewId/{projectId}/{pullRequestId}` id and parses the live response shape (generic `count`/`value` list, plain string evaluation statuses, `isBlocking` for required gates, and build links/expiry from the evaluation context).

### Added

- Manage pull request tags and related work items directly from the review dialog's sidebar. A "+" button beside each heading opens an inline picker — tags search the project's existing PR labels and also accept a new name, while related work items search Azure Boards by title or ID — and every tag chip and work item row gets an "×" button that removes it again. Adding and removing tags goes through the PR labels resource; linking and unlinking work items patches the work item's artifact-link relation pointing at the pull request, mirroring Azure DevOps' own behavior.

### Changed

- Redesign the inline comment box in pull request file diffs. The composer now has a titled header, a comfortable text area in the UI font with a visible focus ring, and a footer that pairs a keyboard hint with properly styled Cancel and Comment buttons instead of the browser's default ones. The text area is focused as soon as the box opens, `Ctrl`/`Cmd`+`Enter` posts the comment, and `Escape` discards it without closing the pull request dialog.
- Hide stash rows in the commit table by default. Repositories that never saved a stash choice now show them only after enabling "Show stashes" in the repository settings (or `guito.showStashes` in VS Code); repositories with a saved choice keep it.
- Open file diffs in the native VS Code diff tab by default inside the VS Code extension: the `guito.diffViewer` setting now defaults to "vscode" instead of Guito's own dialog. Switch the setting back to "guito" to restore the diff dialog; binary files and the standalone browser app keep using Guito's dialog.
- Slide the repository side panel and the commit details pane in and out instead of showing and hiding them instantly: opening a panel slides it in from its side while the commit history is pushed aside, and closing it slides back out before the layout reclaims the space. The slide is skipped when the operating system requests reduced motion.

## [1.0.0] - 2026-09-13

### Fixed

- Keep Azure DevOps Windows single sign-on working with curl builds that do not support `--ntlm`, using Negotiate with the current Windows session credentials.

### Changed

- Replace the toolbar settings dropdown with a full repository settings dialog in standalone Guito. Inside the VS Code extension, the same gear opens VS Code's Settings editor filtered to Guito, including graph, stash, and changed-file layout settings that update open panels immediately.
- Remove the Guito title bar; a compact "Guito" title remains in the toolbar next to the repository panel toggle, the app icon and name stay in the browser or VS Code tab, and the commit search moved into the toolbar, right before the Fetch button.
- Replace the branches dropdown with a hamburger button on the left of the toolbar that opens a repository side panel.
- Restyle error banners across the app with softer colors, rounded borders, an error icon, improved text wrapping, and accessible close buttons. Keep retry actions available and preserve staging and commit safeguards when status errors are dismissed.
- Speed up navigation to unloaded search results by calculating their history indexes and loading all missing pages through the selected result in one request.
- Keep the toolbar usable on narrow windows: below 720px the commit search shrinks, and below 640px the Fetch, Pull, Push, Refresh, and Settings buttons collapse into a three-dots "More actions" menu that keeps every entry, including the pull request and settings actions.

### Added

- Add a setting to disable pull request merge strategies: unchecking "Allow merge completion" in the repository settings (also available as `guito.allowMerge` in VS Code) removes the "No fast-forward (merge commit)" and "Semi-linear merge" choices from the completion and auto-complete dialogs, falling back to the first remaining strategy.
- Create worktrees from the repository side panel with a folder path, a native VS Code folder picker, and an available local-branch selector. Right-click a linked worktree to remove it after confirmation; the current worktree and dirty worktrees remain protected.
- Add an Azure DevOps Pull Requests section to the repository side panel for active pull requests created by or assigned to the signed-in user. A full review dialog provides Overview, Files, and Comments tabs with sanitized Markdown, title and description editing, reviewer and vote management, draft publishing, completion and auto-complete options, comment threads, lazy per-file diffs, and inline line comments.
- List every repository tag in a collapsible Tags section of the side panel, below the branches. Clicking a tag opens the commit it points to in the history, loading older pages until that commit becomes visible, the tag whose commit is open in the details pane is highlighted, and right-clicking a tag keeps the existing tag actions: view details, delete tag, push tag, create archive, and copy tag name. Tags load together with the rest of the panel and refresh with the repository.
- Expand standalone repository settings with Show Tags and Show Remote Branches controls — the latter shows or hides remote branches in both the repository side panel and the branch pills on commits — plus editable/removable Git user details, add/edit/remove remote configuration with separate fetch and push URLs, and local or global issue-linking rules that turn matching issue references in commit subjects and bodies into hyperlinks. The VS Code extension also contributes tag, remote-branch, and issue-linking preferences to its native Settings page.
- Configure the automatic branch name used when creating a pull request from a new remote-only branch. The template supports computer user name, random text, current and target branches, pull request title, repository, UTC date/time, and timestamp variables, and defaults to `pr/${randomstring}`.
- View stashes in the commit table. Each stash appears as a pinned row above the history, newest first, with a `stash@{n}` pill (styled like the tag pills), the stash message, date, author, and short hash; clicking a row opens its diff in the details pane, and right-clicking keeps the Apply, Pop, Drop, and Copy Name actions. The new "Hide Stashes" / "Show Stashes" toggle in the toolbar Settings menu turns the rows off and on, persisted per repository in the server-side settings file like the graph setting; stashes also load without opening the repository side panel.
- Turn the Fetch button into a menu with "Fetch" and "Fetch (prune)" entries; pruning runs `git fetch --prune`, which also deletes remote-tracking branches that no longer exist on the remote.
- View changed files (staged, unstaged, and commit changes) as a directory tree or a flat list. The new "View Files as Tree" / "View Files as Flat List" toggle in the toolbar Settings menu switches both the uncommitted-changes panel and commit details; folders can be collapsed (hiding the files inside), nest by depth, sort before files, and show the additions and deletions summed below them. The choice is persisted per repository in the server-side settings file, and collapsed folders stay collapsed while the working tree refreshes.
- Add a repository side panel with collapsible tree views for branches, tags, stashes, and worktrees. Branches are grouped into local and remote sections, clicking a branch filters the history like the old dropdown, and right-clicking keeps the branch context menu. Stashes offer apply, pop, drop, and copy-name actions from their context menu, and worktrees are listed with their branch and the served worktree marked as current; tags, stashes, and worktrees load when the panel opens and refresh together with the repository.
- Add a Settings menu behind the toolbar gear icon with a "Hide Git Graph" toggle. The choice is persisted per repository in the server-side settings file (like the Azure DevOps URL) and survives reloads; hiding the graph also skips its layout computation.
- Make commit search more compact by placing its navigation arrows inside the input and showing a top-right count badge (`2/10` for a focused match, or a total capped at `99+`). Move the Navigate/Filter choice into the persisted Search mode setting, defaulting to Navigate and also exposed as `guito.searchMode` in VS Code; filtering shows only matching commits and hides the Git graph.
- Add a persisted case-sensitive commit-search setting, also exposed as `guito.searchCaseSensitive` in VS Code. Searches remain case insensitive by default.
- Open file diffs in the native VS Code diff tab. The new `guito.diffViewer` setting chooses between Guito's own diff dialog (the default) and a VS Code diff tab, which shows the file at both refs (commit, HEAD, index, or working tree) with VS Code's own diff editor. The setting takes effect immediately in open Guito panels; binary files and the standalone browser app keep using Guito's dialog.
- Show server error responses in the Guito output channel of the VS Code extension. Failed API requests (HTTP status 400 and above, including unhandled server errors) are logged with their method, path, status, and error body, prefixed with the repository name so that several open Guito panels do not mix their entries.
- Show the Guito logo on the VS Code webview editor tab.

## [0.6.2] - 2026-09-09

### Added

- Show author avatars in the commit table and the commit detail pane. Avatars are looked up by the author email on Gravatar, cached for a day, and fall back to initials when no image is available.
- Refresh Guito automatically when the repository changes. A lightweight probe runs every few seconds and whenever the window regains focus, detects commits, branches, tags, configuration, mailmap, and working tree changes made outside Guito (for example from a terminal or another tool), and then refreshes the history and the Uncommitted changes panel. History pages that were already loaded are kept, and the selected branch and commit stay valid after the refresh.
- Resize the Description column of the commit table by dragging, like the other columns. The chosen width is persisted across sessions together with the other column widths.
- Create draft pull requests with a "Create as draft" option in the Create Pull Request dialog.
- Move the commit search to the far right of the Guito title bar. The search box with its clear button, match counter, and previous/next navigation now sits next to the title instead of in the toolbar.
- Add the guito.autoReload setting (enabled by default) that controls whether Guito refreshes automatically as described above; it can also be set per repository in the server-side settings file.

### Changed

- Fill the window width with the commit table on load and when the window is resized: the Description column widens to absorb spare room, while resizing a column changes only that column and may leave the table narrower until the window is resized again. The saved widths act as minimums on narrow windows.
- The Uncommitted changes row shows your configured Git user name instead of "You", and commits display the author name from your Git configuration when the commit email matches it, while other authors and mailmap-rewritten names are left untouched.
- Tag suggestions in the Create Pull Request dialog now list labels already used by the repository's pull requests instead of Azure Boards work item tags.
- Reviewer, work item, and tag lookups in the Create Pull Request dialog show their own loading state and error message, cancel outdated requests while typing, and show a "No matches" hint instead of an empty list.

### Fixed

- Build pull request and pull request label URLs through the Azure DevOps repositories API so they resolve on Azure DevOps Server.
- Link work items to pull requests using the refs format Azure DevOps expects, and scope work item search to the current team project, accepting `#id` queries and returning at most 20 results.
- Strip `origin/` and `refs/heads/` prefixes from the pull request target branch before creating the pull request.
- Build Azure DevOps base URLs without duplicating collection path segments when the server URL path overlaps the remote repository path.
- Search reviewers through the collection identities API so the returned identities can be used directly as pull request reviewers.

## [0.6.1] - 2026-09-08

### Added

- Rebase the current branch onto any branch from the pull menu. The new "Rebase (from)..." entry opens a branch picker with origin/main as the default choice, and the option list scrolls when a repository has many branches.
- Force push from the push menu. The red "Push (force)" entry asks for confirmation before overwriting the remote branch with the local history.
- Create pull requests on an on-prem Azure DevOps Server from the push menu. After setting the server URL with the new settings button (or the guito.azureDevOpsUrl VS Code setting), a "Create Pull Request..." entry opens a dialog with title, description, source and target branches, and shows a link to the created pull request when it is created.
- Fill pull requests with optional metadata: required and optional reviewers, linked work items searched by id or title, and tags, all with autocomplete suggestions from the Azure DevOps API.
- Create the pull request from a new remote branch with a random name without leaving the current branch, and publish the source branch to the remote automatically when it has not been pushed yet.
- Authenticate to Azure DevOps with Windows integrated authentication, so no credentials are stored or entered for on-prem servers.

## [0.6.0] - 2026-09-07

### Added

- Stage and unstage individual files, selected ranges, or all changes from the Uncommitted changes panel, with Ctrl/Cmd and Shift selection and separate index/working-tree diff previews.
- Write a commit subject and optional description, then commit staged changes without leaving Guito. Drafts survive panel closure and failed commits during the session.
- Rename and delete local branches from the branch context menu. Deleting the checked-out branch is disabled, the branches dropdown follows renames, and it falls back to "Show All" when the selected branch is deleted.
- Navigate commit search results with up/down arrows (or Enter and Shift+Enter in the search box) instead of filtering the list. Matches are highlighted in place, the counter shows the focused match, and navigating to a match outside the loaded history fetches more commits until it can be selected and scrolled into view.
- Choose the reset type when resetting the current branch to a commit. A dialog offers soft (keep changes staged), mixed (keep changes unstaged), and hard (discard all changes) resets.
- Add a tag context menu with view details, delete tag, push tag, create archive, and copy tag name actions. Pushing a tag uploads it to the remote through the new `/api/tag/push` endpoint.
- Clear the commit search with a dedicated button.
- Persist column widths and the commit message draft across sessions using browser storage.
- Stash all, staged, or unstaged changes directly from the Uncommitted changes panel. Staged-only stashes keep unstaged work in place, and unstaged stashes keep staged changes staged.
- Discard selected or all unstaged changes from the Uncommitted changes panel after a confirmation dialog. Discarding unstaged edits preserves staged changes for files with both.
- Added browser regressions and Git integration coverage for search, table alignment, staging, committing, and branch management.

### Changed

- Remove the per-file stage/unstage buttons from file rows in the Uncommitted changes panel; staging and unstaging now use the selection and bulk actions in each section header.

### Fixed

- Keep the table header, uncommitted row, graph, and commit columns aligned while scrolling horizontally or resizing columns.
- Restore virtual rows after searching or clearing empty results; show loading feedback during search, refresh, history loading, and graph computation.
- Recover pending graph work when its worker fails, ignore superseded search requests, and allow explicit retries without automatic failure loops.
- Preserve the last known working status after errors and support initial commits, partial staging, renamed/deleted files, and literal filenames.
- Reject blank subjects, empty-index commits, and unresolved conflicts, and prevent overlapping UI mutations.
- Keep commit graph edges connected across viewport boundaries while scrolling, so long merge edges no longer disappear from view.

## [0.5.4] - 2026-09-06

### Changed

- The commit table now renders only the visible rows with virtual scrolling, so scrolling stays smooth no matter how much history is loaded.
- The commit graph is drawn as a viewport-sized overlay that tracks the scroll position, replacing the full-height SVG canvas.
- Lane assignment for large histories (over 2,000 commits) runs in a web worker, keeping the interface responsive after "Load all" on repositories with 10k+ commits.
- The commit list payload omits commit bodies, roughly halving its size; the detail pane fetches the body on demand when a commit is opened.
- Commit body search now runs on the server, preserving full-history body matching with the trimmed list payload.
- Working-tree actions (discard, reset, clean) refresh only the working-tree status instead of refetching the commit history, branches, and repository info.
- Refreshing or searching aborts superseded in-flight requests instead of letting stale responses race newer ones.

## [0.5.3] - 2026-09-06

### Changed

- Commit history now loads 500 commits at a time with "Load more" and "Load all" controls, so large repositories open without fetching the entire history up front.
- Commit search is debounced and now matches commit bodies in addition to messages, authors, and hashes; searching or filtering by a branch loads the full history automatically so results always cover every commit.
- The history view includes commits from all branches, and server responses are compressed for faster loading in remote workspaces.

### Fixed

- Fixed the commit table keeping a stale visible-row limit when switching branches or changing the search query.
- Fixed the commits endpoint returning an error instead of an empty list for repositories without commits.

## [0.5.2] - 2026-09-01

### Fixed

- Fixed VS Code extension server authentication by preserving the session token in the embedded webview URL.

## [0.5.1] - 2026-08-31

### Added

- Added a marketplace icon for the Visual Studio Code extension.

## [0.5.0] - 2026-08-31

### Added

- Added a VS Code extension with a status-bar action, Command Palette command, repository picker, and reusable editor webviews.
- Added support for local and remote VS Code workspaces, including Remote SSH, Dev Containers, and GitHub Codespaces.
- Added authenticated per-repository server sessions for VS Code webviews.
- Added server integration tests and release-version verification.
- Added automated npm and Visual Studio Marketplace publishing for stable GitHub releases.
- Added a project-wide contribution guide and changelog.

### Changed

- Split the reusable Fastify server from the CLI entry point so the browser client and VS Code extension share the same backend.
- Added the VS Code extension as an npm workspace and integrated it into the project build.
- Updated the Fastify server dependencies and Monaco editor.

## [0.4.0] - 2026-08-20

### Added

- Added branch filtering, remote-branch visibility controls, and commit search.
- Added a visual commit graph with branch and tag badges.
- Added working-tree status to the history view.
- Added commit and working-tree diff views with Monaco-powered inline and side-by-side layouts.
- Added context menus for commit, branch, remote, archive, stash, reset, and cleanup actions.
- Added toolbar actions for fetch, pull, pull with rebase, push, sync, and refresh.

### Changed

- Rebuilt the frontend with Angular.
- Expanded the local Git API and refreshed the application layout and interactions.

## [0.3.0] - 2026-01-05

### Added

- Added core Git workflows for commits, staging, branches, stashes, tags, merges, rebases, and remotes.
- Added the first commit diff viewer with Monaco editor support.
- Added the initial commit graph visualization.

## [0.2.1] - 2025-05-23

### Changed

- Renamed the project and npm command from `easy-git-explorer` to `guito`.

## [0.2.0] - 2024-06-26

### Added

- Added the first repository header and commit table.
- Added initial npm usage documentation for the browser client.

## [0.1.0] - 2024-06-20

### Added

- Added the first browser-based Git explorer MVP.
