# Guito for Visual Studio Code

Explore and manage the Git repositories in your workspace without leaving Visual Studio Code.

## Use

Open a folder containing a Git repository, then select **Guito** in the status bar or run **Guito: Open Guito** from the Command Palette. Multi-root workspaces prompt you to choose a repository.

Use **Guito: Configure User Details** and **Guito: Configure Remotes** from the Command Palette to manage repository Git configuration with native VS Code pickers.

Guito runs against the selected repository and supports local workspaces, Remote SSH, Dev Containers, and GitHub Codespaces.

## Automated pull request review

Guito can review your Azure DevOps pull requests with [Claude Code](https://claude.com/claude-code) running on this machine. Set `guito.aiReview.enabled` to turn it on.

Guito checks for pull requests every few minutes (by default the active ones that list you as a reviewer), reviews each new commit, and queues what it finds in the pull request dialog's **Review** tab. You pick the comments worth posting; nothing reaches Azure DevOps and no vote is cast until you do. Pushing a new commit re-reviews only the files it touched, without repeating points already raised.

The reviewer keeps running while no Guito panel is open. Run **Guito: Review Pull Requests Now** from the Command Palette to check immediately.

Settings: `guito.aiReview.enabled`, `.scope`, `.pollMinutes`, `.includeDrafts`, `.claudePath`, `.claudeArgs`, `.timeoutSeconds`, and `.instructions`.

## Requirements

- Git must be available on the workspace extension host.
- The workspace must be trusted.
- Automated pull request review additionally needs Claude Code installed and signed in on the extension host.

Report issues at [github.com/danisss9/Guito/issues](https://github.com/danisss9/Guito/issues).
