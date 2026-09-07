# Contributing to Guito

Thanks for helping improve Guito. Contributions to the Angular client, Fastify server, CLI, VS Code extension, tests, and documentation are welcome.

## Before you start

- Search the [existing issues](https://github.com/danisss9/Guito/issues) before starting work.
- Discuss a large feature, behavior change, or architectural rewrite with the maintainer first. Use an issue when issue creation is available; otherwise, open a draft pull request with the proposal.
- Keep pull requests focused. Unrelated fixes are easier to review as separate changes.
- Never include repository credentials, tokens, personal paths, or sensitive Git data in code, tests, screenshots, or logs.

## Prerequisites

- Git
- Node.js 24 and npm (Node.js 24 matches the release workflow)
- Visual Studio Code 1.96 or newer when developing the extension

The Angular toolchain also supports the Node.js versions declared by `@angular/build`, but using Node.js 24 gives contributors the closest match to CI.

## Set up the project

Fork and clone the repository, then install the locked dependencies from the project root:

```sh
git clone https://github.com/<your-user>/Guito.git
cd Guito
npm ci
```

Create a focused branch for your change:

```sh
git switch -c feature/short-description
```

## Run the browser client locally

The API server and Angular development server run as separate processes. Start each command in its own terminal from the project root:

```sh
npm run dev:server
```

```sh
npm run dev
```

Open `http://localhost:4200`. The Angular development server proxies `/api` requests to the API server on port `8080`.

`npm run dev:server` compiles the server once before starting it. Restart that process after changing server code.

To build and run the packaged application instead:

```sh
npm run build
npm start
```

## Develop the VS Code extension

Build the extension and its bundled UI:

```sh
npm run build:extension
```

Open the repository in Visual Studio Code and launch the **Run Guito Extension** debug configuration. Its pre-launch task rebuilds the extension. In the Extension Development Host, open a trusted Git workspace and run **Guito: Open Guito**.

To create a local VSIX package:

```sh
npm run package:extension
```

The package is written to `vscode-extension/guito.vsix` and is ignored by Git.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | Angular application, components, models, utilities, and API client. |
| `server/` | Fastify API, Git integration, and CLI server entry point. |
| `vscode-extension/` | VS Code extension manifest, source, build script, and extension-specific docs. |
| `tests/` | Node integration tests for the local server. |
| `scripts/` | Release verification utilities. |
| `bin/` | Compiled server and UI assets shipped in the npm package. |
| `.github/workflows/` | Release automation. |

Treat `bin/`, `vscode-extension/dist/`, and packaged `.vsix` files as generated output. Make source changes under `src/`, `server/`, or `vscode-extension/src/`; do not edit generated bundles by hand. Regenerate build output with the npm scripts when it needs to be included or inspected.

## Validate your change

Run the same core checks used by the release workflow:

```sh
npm run check
npm run build
npm test
npx playwright install chromium --only-shell
npm run test:browser
```

The browser suite uses a disposable repository and authenticated API fixtures. Failure traces are saved under `test-results/`.

On Windows, after building, `node tests/browser/vscode-smoke.mjs` also opens an isolated Extension Development Host, stages a fixture file, and commits it through the authenticated webview. Set `GUITO_CODE_EXE` if VS Code is installed outside its default per-user location. The test closes its host and removes its temporary profile and repository afterward.

- Add or update tests when changing server routes, authentication, repository selection, or Git behavior.
- Test UI changes against a disposable repository with branches, merges, remote references, working-tree changes, and untracked files where relevant.
- Exercise destructive operations only in a disposable repository.
- Verify extension changes in an Extension Development Host. If remote behavior changes, also test an appropriate remote workspace when possible.

## Code and documentation guidelines

- Follow the existing TypeScript and Angular patterns in the surrounding files.
- Keep server operations scoped to the selected repository and validate any user-controlled paths or refs.
- Return useful API errors without exposing secrets or unrelated filesystem data.
- Preserve the confirmation flow for destructive Git operations.
- Update `README.md` or extension documentation when user-facing behavior changes.
- Add user-visible changes to the `Unreleased` section of `CHANGELOG.md`.

## Submit a pull request

Before submitting:

1. Rebase or merge the latest `main` branch into your branch and resolve conflicts.
2. Run the validation commands above.
3. Review the diff for generated noise, secrets, debug logging, and unrelated edits.
4. Explain what changed, why it changed, how it was tested, and any remaining limitations in the pull-request description.
5. Link the relevant issue when one exists.

Review feedback is part of the contribution process. Keep follow-up commits focused, and avoid force-pushing after review has started unless rebasing is necessary.

## Releases

Releases are maintained by the project owner. Pushing a stable `vX.Y.Z` Git tag triggers the release workflow, which verifies the root package and extension versions before building, testing, and publishing both packages. After both publishes succeed, the workflow creates the corresponding GitHub Release with generated release notes. npm uses trusted publishing, while the VS Code Marketplace publish reads the `VSCE_PAT` repository secret.

Release preparation should update:

- `package.json`
- `package-lock.json`
- `vscode-extension/package.json`
- `CHANGELOG.md`

Do not publish the npm package or VS Code extension from a contribution branch.
