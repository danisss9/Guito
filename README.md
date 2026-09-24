# Guito

Explore and manage Git repositories in a focused visual client. Guito runs locally in your browser or directly inside Visual Studio Code.

The name combines **GUI** and **Git**: **G**u**IT**o. It is also a [Portuguese word for money](https://dicionario.priberam.org/guito).

[npm package](https://www.npmjs.com/package/guito) · [VS Code extension](https://marketplace.visualstudio.com/items?itemName=danisss9.guito) · [Open VSX extension](https://open-vsx.org/extension/danisss9/guito) · [Issue tracker](https://github.com/danisss9/Guito/issues)

<img width="1848" height="941" alt="image" src="https://github.com/user-attachments/assets/680f8ca0-acbf-4c61-baf5-58cfcb6c73d1" />

## Features

- Visual commit graph with branch and tag references.
- Stashes listed in the commit table with apply, pop, and drop actions.
- Commit search by subject, body, author, or hash, with loading feedback and retries.
- Local and remote branch filtering.
- Commit and working-tree diffs powered by the Monaco editor, with inline and side-by-side layouts.
- Fetch, pull, pull with rebase, push, and sync actions.
- Context actions for creating branches and tags, checking out commits, cherry-picking, reverting, merging, rebasing, resetting, and exporting archives.
- Working-tree actions for stashing changes, resetting tracked changes, and cleaning untracked files.
- Stage and unstage files with multi-selection, preview staged and unstaged diffs, and commit staged changes.
- Review your active Azure DevOps pull requests from the repository side panel: edit details, manage reviewers and votes, complete or auto-complete, discuss comment threads, and add inline comments on file diffs.
- Have pull requests reviewed for you by Claude Code, re-reviewed on every new commit, with the comments queued for your approval before anything is posted.
- Browser-based CLI and a VS Code extension with local, Remote SSH, Dev Container, and Codespaces support.

> [!CAUTION]
> Guito can run destructive Git operations, including hard resets, commit drops, forceful cleanup, and history changes. Review confirmation dialogs carefully and make sure important work is committed or backed up.

## Quick start

### Browser client

You need Git, Node.js 20 or newer, and npm. From inside the repository you want to inspect, run:

```sh
npx guito
```

Guito starts a local server at `http://localhost:8080` and opens it in your default browser.

To install the command globally instead:

```sh
npm install --global guito
guito
```

### Visual Studio Code

After installing the extension, open a trusted workspace containing a Git repository, then either:

- select **Guito** in the status bar; or
- run **Guito: Open Guito** from the Command Palette.

In a multi-root workspace, Guito asks which repository to open. Git must be available on the local or remote VS Code extension host.

## Stage and commit changes

Click **Uncommitted changes** to open the staged and unstaged file lists. Click to select a file, Ctrl/Cmd-click to toggle individual files, or Shift-click to select a range. Use the per-file buttons, selected-file actions, or **Stage all** / **Unstage all**. The separate **Diff** button previews only the changes in that list.

Enter a commit message and optional description, then choose **Commit staged changes**. Only staged changes are committed; unstaged edits remain on disk. Commit drafts stay available when you close and reopen the panel during the session.

## CLI options

```text
guito [--port <number>] [--no-open]
```

| Option            | Description                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `--port <number>` | Port used by the local server. Defaults to `8080`; use `0` to select an available port automatically. |
| `--no-open`       | Start the server without opening a browser.                                                           |

Run the command from anywhere inside the Git worktree you want Guito to manage. Press `Ctrl+C` in the terminal to stop the server.

## Using Guito

- Select a commit to inspect its changed files, then select a file to open its diff.
- Select **Uncommitted changes** to inspect the working tree.
- Use the branch selector and remote-branch toggle to narrow the graph.
- Right-click a commit, reference badge, or the working-tree row to open its available Git actions.
- Use the toolbar for remote operations and manual refreshes.

The standalone server can execute Git commands against the current repository. Keep it on a trusted machine and do not expose its port to untrusted networks.

## Automated pull request review

Guito can hand your Azure DevOps pull requests to [Claude Code](https://claude.com/claude-code) running on your own machine, then queue what it finds for you to approve.

Turn it on in **Settings** (gear icon), or with `guito.aiReview.enabled` in VS Code. Claude Code must be installed and signed in; no API key is configured in Guito, and no code leaves your machine except to the model Claude Code is already signed in to. Guito finds the CLI on `PATH`, in the standard install locations, and in the Claude Code VS Code extension's own bundled copy; set `guito.aiReview.claudePath` if yours lives somewhere else.

How it works:

- Guito checks Azure DevOps every few minutes for the pull requests in scope — by default the active ones that list you as a reviewer.
- Each pull request is reviewed once per merge source commit. When the author pushes, only the files that commit touched are reviewed again, and Claude is told what it already raised so it does not repeat itself.
- Findings land in the pull request dialog's **Review** tab, each with a severity, the file and line it is about, and the comment it would post. Tick the ones you want and choose **Post to pull request**; they become ordinary Azure DevOps comment threads from your account.
- **Dismiss** removes a finding and stops it being raised again for that pull request.
- Nothing is posted, and no vote is cast, without you clicking.

Inside VS Code the reviewer also runs while no Guito panel is open, so pull requests are reviewed as you work; run **Guito: Review Pull Requests Now** from the Command Palette to check immediately. Reviews are stored per repository in `.git/guito-ai-reviews.json` and are never committed.

| Setting                          | Description                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `guito.aiReview.enabled`         | Turns automated review on. Off by default.                                               |
| `guito.aiReview.scope`           | `reviewer` (default), `mine`, or `all`.                                                  |
| `guito.aiReview.pollMinutes`     | Minutes between checks. Defaults to 5.                                                   |
| `guito.aiReview.includeDrafts`   | Also review draft pull requests. Off by default.                                         |
| `guito.aiReview.claudePath`      | Path to the Claude Code executable. Empty means Guito looks for it (see above).           |
| `guito.aiReview.claudeArgs`      | Extra Claude Code arguments, for example `["--model", "opus"]`.                          |
| `guito.aiReview.timeoutSeconds`  | How long one review may take. Defaults to 600.                                           |
| `guito.aiReview.instructions`    | Extra reviewing instructions, such as your team's conventions.                           |

## Development and contributing

See [CONTRIBUTION.md](CONTRIBUTION.md) for local setup, development commands, project structure, testing, and pull-request guidance.

Release history is maintained in [CHANGELOG.md](CHANGELOG.md).

## License

Guito is available under the [MIT License](LICENSE).
