# Changelog

All notable changes to Guito are documented in this file. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and this changelog is structured around [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
