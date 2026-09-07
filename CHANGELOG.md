# Changelog

All notable changes to Guito are documented in this file. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and this changelog is structured around [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Stage and unstage individual files, selected ranges, or all changes from the Uncommitted changes panel, with Ctrl/Cmd and Shift selection and separate index/working-tree diff previews.
- Write a commit subject and optional description, then commit staged changes without leaving Guito. Drafts survive panel closure and failed commits during the session.
- Added browser regressions and Git integration coverage for search, table alignment, staging, and committing.

### Fixed

- Keep the table header, uncommitted row, graph, and commit columns aligned while scrolling horizontally or resizing columns.
- Restore virtual rows after searching or clearing empty results; show loading feedback during search, refresh, history loading, and graph computation.
- Recover pending graph work when its worker fails, ignore superseded search requests, and allow explicit retries without automatic failure loops.
- Preserve the last known working status after errors and support initial commits, partial staging, renamed/deleted files, and literal filenames.
- Reject blank subjects, empty-index commits, and unresolved conflicts, and prevent overlapping UI mutations.

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
