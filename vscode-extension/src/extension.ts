import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import {
  startGuitoServer,
  type GuitoHostSettings,
  type RunningGuitoServer,
} from '../../server/guito-server.js';

const execFileAsync = promisify(execFile);

interface RepositoryChoice {
  label: string;
  description: string;
  root: string;
  key: string;
}

interface RepositorySession {
  panel: vscode.WebviewPanel;
  server: RunningGuitoServer;
  repository: RepositoryChoice;
}

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

/** The app in the webview iframe asks the extension host to open a file diff. */
interface OpenDiffMessage {
  type: 'guito/openDiff';
  path: string;
  oldPath?: string;
  status: string;
  originalRef: string;
  modifiedRef: string;
  exactOriginal?: boolean;
}

interface OpenSettingsMessage {
  type: 'guito/openSettings';
}

interface OpenFileMessage {
  type: 'guito/openFile';
  path: string;
}

interface OpenRepositoryMessage {
  type: 'guito/openRepository';
  path: string;
  disposition: 'switch' | 'tab' | 'window';
}

interface OpenMergeConflictMessage {
  type: 'guito/openMergeConflict';
  path: string;
}

interface PickFolderMessage {
  type: 'guito/pickFolder';
  requestId: number;
}

/** The app asks the extension host to open an http(s) URL in the default browser. */
interface OpenExternalMessage {
  type: 'guito/openExternal';
  url: string;
}

const sessions = new Map<string, Set<RepositorySession>>();

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Guito');
  const statusBar = vscode.window.createStatusBarItem(
    'guito.openStatusBar',
    vscode.StatusBarAlignment.Left,
    90,
  );
  statusBar.name = 'Guito';
  statusBar.text = '$(git-branch) Guito';
  statusBar.tooltip = 'Open Guito for a workspace repository';
  statusBar.command = 'guito.open';

  const updateStatusBar = () => {
    if (vscode.workspace.isTrusted && (vscode.workspace.workspaceFolders?.length ?? 0) > 0) {
      statusBar.show();
    } else {
      statusBar.hide();
    }
  };

  const openCommand = vscode.commands.registerCommand('guito.open', async () => {
    try {
      const repository = await selectRepository();
      if (repository) {
        await openRepository(context, repository);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Guito could not open: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  const configureUserDetailsCommand = vscode.commands.registerCommand(
    'guito.configureUserDetails',
    () => runRepositoryCommand('configure user details', configureUserDetails),
  );
  const configureRemotesCommand = vscode.commands.registerCommand('guito.configureRemotes', () =>
    runRepositoryCommand('configure remotes', configureRemotes),
  );
  const reviewPullRequestsCommand = vscode.commands.registerCommand(
    'guito.reviewPullRequests',
    () =>
      reviewPullRequestsNow(context).catch((error) => {
        void vscode.window.showErrorMessage(
          `Guito could not review pull requests: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }),
  );

  updateStatusBar();
  // Pull requests are reviewed while Guito is closed too, so the reviewers
  // start with the extension rather than with the first panel.
  void syncBackgroundReviewers(context);
  context.subscriptions.push(
    outputChannel,
    statusBar,
    openCommand,
    configureUserDetailsCommand,
    configureRemotesCommand,
    reviewPullRequestsCommand,
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      updateStatusBar();
      void syncBackgroundReviewers(context);
    }),
    vscode.workspace.registerTextDocumentContentProvider('guito-diff', {
      provideTextDocumentContent: (uri: vscode.Uri) => provideDiffContent(uri),
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('guito')) return;
      if (event.affectsConfiguration('guito.aiReview')) {
        void syncBackgroundReviewers(context);
      }
      const settings = readHostSettings();
      for (const [key, repositorySessions] of sessions) {
        // Applies the new settings to every server of this repository and
        // keeps exactly one of them polling.
        updatePollingOwner(key);
        for (const session of repositorySessions) {
          void session.panel.webview.postMessage({
            type: 'guito/config',
            diffViewer: settings.diffViewer,
          });
        }
      }
    }),
    {
      dispose: () => {
        void closeAllSessions();
        void stopBackgroundReviewers();
      },
    },
  );
}

export async function deactivate(): Promise<void> {
  await Promise.allSettled([closeAllSessions(), stopBackgroundReviewers()]);
}

async function runRepositoryCommand(
  action: string,
  command: (repository: RepositoryChoice) => Promise<void>,
): Promise<void> {
  try {
    const repository = await selectRepository(`Guito: ${action}`);
    if (repository) await command(repository);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Guito could not ${action}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function selectRepository(title = 'Open Guito'): Promise<RepositoryChoice | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showInformationMessage('Open a folder containing a Git repository first.');
    return undefined;
  }

  const repositories = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Guito: finding repositories',
    },
    async () => discoverRepositories(folders),
  );

  if (repositories.length === 0) {
    void vscode.window.showInformationMessage('No Git repository was found in this workspace.');
    return undefined;
  }
  if (repositories.length === 1) {
    return repositories[0];
  }

  return vscode.window.showQuickPick(repositories, {
    title,
    placeHolder: 'Choose a Git repository',
    matchOnDescription: true,
  });
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    windowsHide: true,
  });
  return stdout.trim();
}

async function optionalGit(root: string, args: string[]): Promise<string> {
  try {
    return await git(root, args);
  } catch {
    return '';
  }
}

async function configureUserDetails(repository: RepositoryChoice): Promise<void> {
  const [name, email, localName, localEmail] = await Promise.all([
    optionalGit(repository.root, ['config', '--get', 'user.name']),
    optionalGit(repository.root, ['config', '--get', 'user.email']),
    optionalGit(repository.root, ['config', '--local', '--get', 'user.name']),
    optionalGit(repository.root, ['config', '--local', '--get', 'user.email']),
  ]);
  const choices: vscode.QuickPickItem[] = [
    {
      label: '$(edit) Set user details',
      description: name && email ? `${name} <${email}>` : 'Name and email for this repository',
    },
  ];
  if (localName || localEmail) {
    choices.push({
      label: '$(trash) Remove repository user details',
      description: 'Fall back to the global Git configuration',
    });
  }
  const action = await vscode.window.showQuickPick(choices, {
    title: `Guito: User Details — ${repository.label}`,
    placeHolder: 'Choose how to manage the repository Git identity',
  });
  if (!action) return;

  if (action.label.includes('Remove')) {
    const confirmation = await vscode.window.showWarningMessage(
      `Remove the repository-specific Git user name and email for ${repository.label}?`,
      { modal: true },
      'Remove',
    );
    if (confirmation !== 'Remove') return;
    await Promise.all([
      optionalGit(repository.root, ['config', '--local', '--unset-all', 'user.name']),
      optionalGit(repository.root, ['config', '--local', '--unset-all', 'user.email']),
    ]);
    void vscode.window.showInformationMessage(
      `Guito removed user details for ${repository.label}.`,
    );
    return;
  }

  const nextName = await vscode.window.showInputBox({
    title: `Guito: User Details — ${repository.label}`,
    prompt: 'Git user name for this repository',
    value: name,
    validateInput: (value) => (value.trim() ? undefined : 'A user name is required.'),
  });
  if (nextName === undefined) return;
  const nextEmail = await vscode.window.showInputBox({
    title: `Guito: User Details — ${repository.label}`,
    prompt: 'Git user email for this repository',
    value: email,
    validateInput: (value) => (value.trim() ? undefined : 'An email address is required.'),
  });
  if (nextEmail === undefined) return;
  await git(repository.root, ['config', '--local', 'user.name', nextName.trim()]);
  await git(repository.root, ['config', '--local', 'user.email', nextEmail.trim()]);
  void vscode.window.showInformationMessage(`Guito updated user details for ${repository.label}.`);
}

async function listGitRemotes(root: string): Promise<GitRemote[]> {
  const names = (await optionalGit(root, ['remote'])).split(/\r?\n/).filter(Boolean);
  return Promise.all(
    names.map(async (name) => {
      const fetchUrl = await git(root, ['remote', 'get-url', name]);
      const pushUrl = (await optionalGit(root, ['remote', 'get-url', '--push', name])) || fetchUrl;
      return { name, fetchUrl, pushUrl };
    }),
  );
}

async function configureRemotes(repository: RepositoryChoice): Promise<void> {
  const remotes = await listGitRemotes(repository.root);
  const selected = await vscode.window.showQuickPick(
    [
      {
        label: '$(add) Add remote',
        description: 'Configure a new fetch and push destination',
      },
      ...remotes.map((remote) => ({
        label: `$(cloud) ${remote.name}`,
        description: remote.fetchUrl,
        remote,
      })),
    ],
    {
      title: `Guito: Remotes — ${repository.label}`,
      placeHolder: 'Choose a remote to manage, or add one',
      matchOnDescription: true,
    },
  );
  if (!selected) return;

  const remote = 'remote' in selected ? selected.remote : undefined;
  if (remote) {
    const action = await vscode.window.showQuickPick(
      [
        { label: '$(edit) Edit remote', description: remote.fetchUrl },
        {
          label: '$(trash) Remove remote',
          description: `Remove ${remote.name} from this repository`,
        },
      ],
      {
        title: `Guito: Remote ${remote.name}`,
        placeHolder: 'Choose an action',
      },
    );
    if (!action) return;
    if (action.label.includes('Remove')) {
      const confirmation = await vscode.window.showWarningMessage(
        `Remove the remote "${remote.name}" from ${repository.label}?`,
        { modal: true },
        'Remove',
      );
      if (confirmation !== 'Remove') return;
      await git(repository.root, ['remote', 'remove', remote.name]);
      void vscode.window.showInformationMessage(`Guito removed remote ${remote.name}.`);
      return;
    }
  }

  const name = await vscode.window.showInputBox({
    title: `Guito: ${remote ? 'Edit' : 'Add'} Remote — ${repository.label}`,
    prompt: 'Remote name',
    value: remote?.name ?? '',
    placeHolder: 'origin',
    validateInput: (value) =>
      /^[A-Za-z0-9._-]+$/.test(value.trim())
        ? undefined
        : 'Use letters, numbers, periods, underscores, or hyphens.',
  });
  if (name === undefined) return;
  const fetchUrl = await vscode.window.showInputBox({
    title: `Guito: ${remote ? 'Edit' : 'Add'} Remote — ${repository.label}`,
    prompt: 'Fetch URL',
    value: remote?.fetchUrl ?? '',
    validateInput: (value) => (value.trim() ? undefined : 'A fetch URL is required.'),
  });
  if (fetchUrl === undefined) return;
  const pushUrl = await vscode.window.showInputBox({
    title: `Guito: ${remote ? 'Edit' : 'Add'} Remote — ${repository.label}`,
    prompt: 'Push URL (leave blank to use the fetch URL)',
    value: remote?.pushUrl === remote?.fetchUrl ? '' : (remote?.pushUrl ?? ''),
  });
  if (pushUrl === undefined) return;

  const trimmedName = name.trim();
  const trimmedFetchUrl = fetchUrl.trim();
  if (!remote) {
    await git(repository.root, ['remote', 'add', trimmedName, trimmedFetchUrl]);
  } else if (remote.name !== trimmedName) {
    await git(repository.root, ['remote', 'rename', remote.name, trimmedName]);
  }
  await git(repository.root, ['remote', 'set-url', trimmedName, trimmedFetchUrl]);
  await git(repository.root, [
    'remote',
    'set-url',
    '--push',
    trimmedName,
    pushUrl.trim() || trimmedFetchUrl,
  ]);
  void vscode.window.showInformationMessage(
    `Guito ${remote ? 'updated' : 'added'} remote ${trimmedName}.`,
  );
}

async function discoverRepositories(
  folders: readonly vscode.WorkspaceFolder[],
): Promise<RepositoryChoice[]> {
  const discovered = await Promise.all(
    folders.map(async (folder): Promise<RepositoryChoice | undefined> => {
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['-C', folder.uri.fsPath, 'rev-parse', '--show-toplevel'],
          { windowsHide: true },
        );
        const root = resolve(stdout.trim());
        const key = repositoryKey(root);
        return { label: basename(root), description: root, root, key };
      } catch {
        return undefined;
      }
    }),
  );

  const unique = new Map<string, RepositoryChoice>();
  for (const repository of discovered) {
    if (repository) {
      unique.set(repository.key, repository);
    }
  }
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label));
}

async function openRepository(
  context: vscode.ExtensionContext,
  repository: RepositoryChoice,
  forceNew = false,
): Promise<void> {
  const existing = sessions.get(repository.key)?.values().next().value as
    | RepositorySession
    | undefined;
  if (existing && !forceNew) {
    existing.panel.reveal(vscode.ViewColumn.Active);
    return;
  }

  const started = await startRepositoryContext(context, repository);
  const server = started.server;

  try {
    const panel = vscode.window.createWebviewPanel(
      'guito.repository',
      `Guito — ${repository.label}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      },
    );
    const session: RepositorySession = { panel, server, repository };
    watchFindings(server, repository);
    // Shows the extension logo on the webview's editor tab.
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'logo.png');
    panel.webview.html = webviewHtml(started.externalUri, randomBytes(16).toString('hex'));
    panel.webview.onDidReceiveMessage(
      (
        message:
          | OpenDiffMessage
          | OpenFileMessage
          | OpenRepositoryMessage
          | OpenMergeConflictMessage
          | OpenSettingsMessage
          | PickFolderMessage
          | OpenExternalMessage,
      ) => {
        if (message?.type === 'guito/openSettings') {
          void vscode.commands.executeCommand(
            'workbench.action.openSettings',
            '@ext:danisss9.guito',
          );
          return;
        }
        if (message?.type === 'guito/openExternal' && typeof message.url === 'string') {
          try {
            const uri = vscode.Uri.parse(message.url);
            // Only real web links go to the OS default browser.
            if (uri.scheme === 'http' || uri.scheme === 'https') {
              void vscode.env.openExternal(uri);
            } else {
              void vscode.window.showErrorMessage(
                `Guito can only open http(s) links, not: ${uri.scheme}`,
              );
            }
          } catch {
            void vscode.window.showErrorMessage(`Guito could not open the link: ${message.url}`);
          }
          return;
        }
        if (message?.type === 'guito/pickFolder' && Number.isInteger(message.requestId)) {
          void vscode.window
            .showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              defaultUri: vscode.Uri.file(resolve(session.repository.root, '..')),
              openLabel: 'Select Worktree Folder',
              title: 'Select a folder for the new worktree',
            })
            .then((selection) =>
              panel.webview.postMessage({
                type: 'guito/folderSelected',
                requestId: message.requestId,
                path: selection?.[0]?.fsPath ?? '',
              }),
            );
          return;
        }
        if (message?.type === 'guito/openFile' && typeof message.path === 'string') {
          openFileInVsCode(session.repository.root, message.path).catch((error) => {
            void vscode.window.showErrorMessage(
              `Guito could not open the file: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
          return;
        }
        if (message?.type === 'guito/openRepository' && typeof message.path === 'string') {
          handleWorktreeRepositoryRequest(context, session, message).catch((error) => {
            void vscode.window.showErrorMessage(
              `Guito could not open the worktree: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
          return;
        }
        if (message?.type === 'guito/openMergeConflict' && typeof message.path === 'string') {
          openMergeConflictInVsCode(session.repository.root, message.path).catch((error) => {
            void vscode.window.showErrorMessage(
              `Guito could not open the merge editor: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
          return;
        }
        if (message?.type !== 'guito/openDiff' || typeof message.path !== 'string') {
          return;
        }
        openDiffInVsCode(session.repository.root, message).catch((error) => {
          void vscode.window.showErrorMessage(
            `Guito could not open the diff: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      },
    );

    addSession(session);
    panel.onDidDispose(() => {
      removeSession(session);
      void session.server.close();
    });
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function startRepositoryContext(
  context: vscode.ExtensionContext,
  repository: RepositoryChoice,
): Promise<{ server: RunningGuitoServer; externalUri: vscode.Uri }> {
  const token = randomBytes(32).toString('hex');
  const hostSettings = readHostSettings();
  const server = await startGuitoServer({
    repositoryPath: repository.root,
    uiRoot: vscode.Uri.joinPath(context.extensionUri, 'dist', 'ui').fsPath,
    host: '127.0.0.1',
    port: 0,
    apiToken: token,
    ...hostSettings,
    onLog: (line) => outputChannel?.appendLine(`[${repository.label}] ${line}`),
  });
  try {
    const localUri = vscode.Uri.parse(server.address).with({
      query: new URLSearchParams({ guitoToken: token }).toString(),
    });
    return { server, externalUri: await vscode.env.asExternalUri(localUri) };
  } catch (error) {
    await server.close();
    throw error;
  }
}

function webviewHtml(externalUri: vscode.Uri, nonce: string): string {
  const frameSource = `${externalUri.scheme}://${externalUri.authority}`;
  // VS Code's default URI serialization escapes query delimiters such as `=`, which
  // would turn `?guitoToken=value` into a single, incorrectly named query parameter.
  const externalUrl = externalUri.toString(true);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${escapeHtml(frameSource)}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guito</title>
    <style>html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; overflow: hidden; }</style>
  </head>
  <body>
    <iframe
      title="Guito"
      src="${escapeHtml(externalUrl)}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
    ></iframe>
    <script nonce="${nonce}">
      (function () {
        var vscode = acquireVsCodeApi();
        var frame = document.querySelector('iframe');
        window.addEventListener('message', function (event) {
          var data = event.data;
          if (!data || typeof data !== 'object' || typeof data.type !== 'string' || data.type.indexOf('guito/') !== 0) {
            return;
          }
          if (event.source === frame.contentWindow) {
            // The app asks the extension host to act (e.g. open a diff in a tab).
            vscode.postMessage(data);
          } else if (data.type.indexOf('guito/') === 0) {
            // The extension host pushed a response or settings update; relay it.
            frame.contentWindow.postMessage(data, '*');
          }
        });
      })();
    </script>
  </body>
</html>`;
}

async function closeAllSessions(): Promise<void> {
  const active = [...sessions.values()].flatMap((repositorySessions) => [
    ...repositorySessions,
  ]);
  sessions.clear();
  await Promise.allSettled(active.map((session) => session.server.close()));
}

function addSession(session: RepositorySession): void {
  const repositorySessions = sessions.get(session.repository.key) ?? new Set();
  repositorySessions.add(session);
  sessions.set(session.repository.key, repositorySessions);
  updatePollingOwner(session.repository.key);
}

function removeSession(session: RepositorySession): void {
  const repositorySessions = sessions.get(session.repository.key);
  if (!repositorySessions) return;
  repositorySessions.delete(session);
  if (repositorySessions.size === 0) sessions.delete(session.repository.key);
  // The background reviewer takes polling back when the last panel closes.
  updatePollingOwner(session.repository.key);
}

// ==================== Automated pull request review ====================
// The reviewer lives in the Guito server, which normally starts with a panel.
// So that pull requests are still reviewed while Guito is closed, each
// repository also gets a headless server whose only job is the poller. Exactly
// one server per repository polls at a time: a panel takes over when it opens,
// and hands back when the last one closes.

const backgroundReviewers = new Map<string, RunningGuitoServer>();

/** Whether the automated reviewer is switched on in the settings. */
function aiReviewEnabled(): boolean {
  return vscode.workspace.getConfiguration('guito').get<boolean>('aiReview.enabled', false);
}

/** Offers to open Guito on the pull request whose review just produced work. */
function watchFindings(server: RunningGuitoServer, repository: RepositoryChoice): void {
  server.aiReview.onFindings((state) => {
    const pending = state.findings.filter((finding) => finding.status === 'pending').length;
    if (!pending) return;
    outputChannel?.appendLine(
      `[${repository.label}] Pull request ${state.pullRequestId} has ${pending} review comment(s) ready.`,
    );
    void vscode.window
      .showInformationMessage(
        `Guito reviewed pull request #${state.pullRequestId} (${state.title}): ${pending} comment${
          pending === 1 ? '' : 's'
        } ready for you.`,
        'Open Guito',
      )
      .then((choice) => {
        if (choice === 'Open Guito') {
          void vscode.commands.executeCommand('guito.open');
        }
      });
  });
}

/**
 * Decides which server polls for this repository: a panel's if one is open,
 * otherwise the background one. Every other server keeps its routes (so a
 * manual review still works) but stops its timer, so one repository is never
 * reviewed twice over. The decision is pushed through updateSettings because
 * the server re-reads its review config there.
 */
function pollingServers(repositoryKey: string): RunningGuitoServer[] {
  const panels = [...(sessions.get(repositoryKey) ?? [])];
  const background = backgroundReviewers.get(repositoryKey);
  // A panel's server comes first, so it owns polling while Guito is open.
  return [...panels.map((session) => session.server), ...(background ? [background] : [])];
}

function updatePollingOwner(repositoryKey: string): void {
  const servers = pollingServers(repositoryKey);
  if (!servers.length) return;
  const owner = servers[0];
  const settings = readHostSettings();
  const enabled = settings.aiReview?.enabled === true;
  for (const server of servers) {
    server.updateSettings({
      ...settings,
      aiReview: { ...settings.aiReview, enabled: enabled && server === owner },
    });
  }
}

/** Starts, or stops, the headless reviewer for one repository. */
async function syncBackgroundReviewer(
  context: vscode.ExtensionContext,
  repository: RepositoryChoice,
): Promise<void> {
  const existing = backgroundReviewers.get(repository.key);
  if (!aiReviewEnabled()) {
    if (existing) {
      backgroundReviewers.delete(repository.key);
      await existing.close().catch(() => {});
    }
    return;
  }
  if (existing) {
    updatePollingOwner(repository.key);
    return;
  }
  try {
    const server = await startGuitoServer({
      repositoryPath: repository.root,
      uiRoot: vscode.Uri.joinPath(context.extensionUri, 'dist', 'ui').fsPath,
      host: '127.0.0.1',
      port: 0,
      apiToken: randomBytes(32).toString('hex'),
      ...readHostSettings(),
      onLog: (line) => outputChannel?.appendLine(`[${repository.label}] ${line}`),
    });
    backgroundReviewers.set(repository.key, server);
    watchFindings(server, repository);
    updatePollingOwner(repository.key);
    // Catch up on anything pushed while VS Code was closed. This has to go to
    // whichever server owns polling: if a Guito panel is already open, the
    // background one was just switched off and would do nothing.
    void pollingServers(repository.key)[0]?.aiReview.poll();
  } catch (error) {
    outputChannel?.appendLine(
      `[${repository.label}] Could not start the pull request reviewer: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** Brings the background reviewers in line with the current workspace. */
async function syncBackgroundReviewers(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (!vscode.workspace.isTrusted || folders.length === 0) {
    await stopBackgroundReviewers();
    return;
  }
  const repositories = await discoverRepositories(folders);
  const wanted = new Set(repositories.map((repository) => repository.key));
  for (const [key, server] of [...backgroundReviewers]) {
    if (!wanted.has(key)) {
      backgroundReviewers.delete(key);
      await server.close().catch(() => {});
    }
  }
  await Promise.allSettled(
    repositories.map((repository) => syncBackgroundReviewer(context, repository)),
  );
}

async function stopBackgroundReviewers(): Promise<void> {
  const servers = [...backgroundReviewers.values()];
  backgroundReviewers.clear();
  await Promise.allSettled(servers.map((server) => server.close()));
}

/** Reviews every pull request with new commits, across the workspace, now. */
async function reviewPullRequestsNow(context: vscode.ExtensionContext): Promise<void> {
  await syncBackgroundReviewers(context);
  const servers = new Map<string, RunningGuitoServer>();
  for (const [key, server] of backgroundReviewers) servers.set(key, server);
  for (const [key, repositorySessions] of sessions) {
    const first = [...repositorySessions][0];
    if (first) servers.set(key, first.server);
  }
  if (servers.size === 0) {
    void vscode.window.showInformationMessage(
      'Guito found no Git repository in this workspace to review pull requests for.',
    );
    return;
  }
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Guito: reviewing pull requests' },
    async () => {
      const reviewed = await Promise.all(
        [...servers.values()].map((server) => server.aiReview.poll().catch(() => [] as number[])),
      );
      const total = reviewed.flat().length;
      if (total === 0) {
        void vscode.window.showInformationMessage(
          aiReviewEnabled()
            ? 'Guito: no pull request has new commits to review.'
            : 'Guito: automated pull request review is off (guito.aiReview.enabled).',
        );
      }
    },
  );
}

function repositoryKey(root: string): string {
  const normalized = normalize(root);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function readDiffViewerSetting(): 'guito' | 'vscode' {
  return vscode.workspace.getConfiguration('guito').get<'guito' | 'vscode'>('diffViewer', 'vscode');
}

function readHostSettings(): GuitoHostSettings {
  const configuration = vscode.workspace.getConfiguration('guito');
  return {
    azureDevOpsUrl: configuration.get<string>('azureDevOpsUrl')?.trim() || undefined,
    prBranchNameTemplate: configuration
      .get<string>('prBranchNameTemplate', 'pr/${randomstring}')
      .trim(),
    autoReload: configuration.get<boolean>('autoReload', true),
    diffViewer: readDiffViewerSetting(),
    showGraph: configuration.get<boolean>('showGraph', true),
    showStashes: configuration.get<boolean>('showStashes', false),
    showTags: configuration.get<boolean>('showTags', true),
    showRemoteBranches: configuration.get<boolean>('showRemoteBranches', true),
    fileListView: configuration.get<'flat' | 'tree'>('fileListView', 'flat'),
    refListView: configuration.get<'flat' | 'tree'>('refListView', 'flat'),
    sidePanelSectionsExpanded: configuration.get<boolean>('sidePanelSectionsExpanded', true),
    searchMode: configuration.get<'navigate' | 'filter'>('searchMode', 'navigate'),
    searchCaseSensitive: configuration.get<boolean>('searchCaseSensitive', false),
    allowMerge: configuration.get<boolean>('allowMerge', true),
    issueRegex: configuration.get<string>('issueRegex')?.trim() || undefined,
    issueUrl: configuration.get<string>('issueUrl')?.trim() || undefined,
    aiReview: {
      enabled: configuration.get<boolean>('aiReview.enabled', false),
      scope: configuration.get<'reviewer' | 'mine' | 'all'>('aiReview.scope', 'reviewer'),
      pollMinutes: configuration.get<number>('aiReview.pollMinutes', 5),
      includeDrafts: configuration.get<boolean>('aiReview.includeDrafts', false),
      claudePath: configuration.get<string>('aiReview.claudePath', '').trim(),
      claudeArgs: configuration.get<string[]>('aiReview.claudeArgs', []),
      timeoutSeconds: configuration.get<number>('aiReview.timeoutSeconds', 600),
      instructions: configuration.get<string>('aiReview.instructions', ''),
    },
  };
}

/**
 * Serves the content of a file at a Git ref to the VS Code diff tab. Refs use
 * the same names as the Guito server: a commit hash (with an optional `^`
 * suffix for the parent), `HEAD`, `INDEX`, `WORKING`, and `EMPTY`.
 */
async function provideDiffContent(uri: vscode.Uri): Promise<string> {
  const segments = uri.path.split('/').filter(Boolean);
  const root = decodeURIComponent(segments[0] ?? '');
  const ref = decodeURIComponent(segments[1] ?? '');
  const path = segments.slice(2).map(decodeURIComponent).join('/');
  if (!root || !ref || !path) {
    return '';
  }

  if (ref === 'EMPTY') {
    return '';
  }

  if (ref === 'WORKING') {
    try {
      const buffer = await readFile(join(root, ...path.split('/')));
      return buffer.includes(0) ? '' : buffer.toString('utf8');
    } catch {
      // File no longer exists on disk (deleted).
      return '';
    }
  }

  try {
    const spec = ref === 'INDEX' ? `:${path}` : `${ref}:${path}`;
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'show', spec],
      // Diffs of minified or generated files can be far larger than the 1 MB default.
      { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout.includes('\u0000') ? '' : stdout;
  } catch {
    // Path did not exist at that revision (added file).
    return '';
  }
}

/** Builds a content URI such as `guito-diff:/C%3A%5Crepo/HEAD/src/app.ts`. */
function diffUri(root: string, ref: string, path: string): vscode.Uri {
  const encoded = [root, ref, ...path.split('/')].map(encodeURIComponent).join('/');
  return vscode.Uri.from({ scheme: 'guito-diff', path: `/${encoded}` });
}

function refLabel(ref: string): string {
  if (ref === 'WORKING') return 'Working tree';
  if (ref === 'INDEX') return 'Index';
  if (ref === 'EMPTY') return 'Empty';
  if (ref === 'HEAD') return 'HEAD';
  // Commit hashes: keep the short form, preserving the parent suffix (`abc1234^`).
  return ref.endsWith('^') ? `${ref.slice(0, -1).slice(0, 7)}^` : ref.slice(0, 7);
}

async function openDiffInVsCode(root: string, message: OpenDiffMessage): Promise<void> {
  // Mirrors the diff dialog: an added file without a previous path diffs from nothing.
  const originalRef =
    !message.exactOriginal && message.status === 'added' && !message.oldPath
      ? 'EMPTY'
      : message.originalRef;
  const left = diffUri(
    root,
    originalRef,
    message.exactOriginal ? message.path : message.oldPath || message.path,
  );
  const right = diffUri(root, message.modifiedRef, message.path);
  const title = `${basename(message.path)} (${refLabel(originalRef)} ↔ ${refLabel(message.modifiedRef)})`;
  await vscode.commands.executeCommand('vscode.diff', left, right, title, {
    preview: true,
  });
}

async function openFileInVsCode(root: string, path: string): Promise<void> {
  const absolutePath = resolve(root, path);
  const repositoryPath = relative(root, absolutePath);
  if (
    !path ||
    path.includes('\0') ||
    isAbsolute(path) ||
    repositoryPath === '..' ||
    repositoryPath.startsWith(`..${sep}`) ||
    isAbsolute(repositoryPath) ||
    path.split(/[\\/]/).some((part) => part.toLowerCase() === '.git')
  ) {
    throw new Error('Select a repository-relative file path.');
  }
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
  await vscode.window.showTextDocument(document, { preview: true });
}

/** Handles the three worktree-opening dispositions requested by the embedded app. */
async function handleWorktreeRepositoryRequest(
  context: vscode.ExtensionContext,
  session: RepositorySession,
  message: OpenRepositoryMessage,
): Promise<void> {
  const repository = await resolveWorktreeRepository(session.repository, message.path);
  if (message.disposition === 'switch') {
    await switchRepositoryContext(context, session, repository);
    return;
  }
  if (message.disposition === 'tab') {
    await openRepository(context, repository, true);
    return;
  }
  if (message.disposition === 'window') {
    await vscode.commands.executeCommand(
      'vscode.openFolder',
      repositoryWindowUri(repository.root),
      { forceNewWindow: true },
    );
    return;
  }
  throw new Error('Unknown worktree open action.');
}

/** Replaces the server and iframe behind a Guito tab without creating another tab. */
async function switchRepositoryContext(
  context: vscode.ExtensionContext,
  session: RepositorySession,
  repository: RepositoryChoice,
): Promise<void> {
  if (repository.key === session.repository.key) return;

  const started = await startRepositoryContext(context, repository);
  const previousServer = session.server;
  removeSession(session);
  session.repository = repository;
  session.server = started.server;
  addSession(session);
  session.panel.title = `Guito — ${repository.label}`;
  session.panel.webview.html = webviewHtml(started.externalUri, randomBytes(16).toString('hex'));
  await previousServer.close();
}

/** Validates that the requested path is a registered worktree of the source repository. */
async function resolveWorktreeRepository(
  repository: RepositoryChoice,
  requestedPath: string,
): Promise<RepositoryChoice> {
  if (!isAbsolute(requestedPath)) {
    throw new Error('The worktree path must be absolute.');
  }

  const requestedRoot = resolve(requestedPath);
  const porcelain = await git(repository.root, ['worktree', 'list', '--porcelain', '-z']);
  const registeredRoots = porcelain
    .split('\0')
    .filter((field) => field.startsWith('worktree '))
    .map((field) => resolve(field.slice('worktree '.length)));
  if (!registeredRoots.some((root) => repositoryKey(root) === repositoryKey(requestedRoot))) {
    throw new Error('The selected path is not a registered worktree of this repository.');
  }

  const root = resolve(await git(requestedRoot, ['rev-parse', '--show-toplevel']));
  if (repositoryKey(root) !== repositoryKey(requestedRoot)) {
    throw new Error('The selected worktree did not resolve to its registered root.');
  }
  return {
    label: basename(root),
    description: root,
    root,
    key: repositoryKey(root),
  };
}

/** Preserves the active remote authority when opening a worktree folder in a new window. */
function repositoryWindowUri(root: string): vscode.Uri {
  const fileUri = vscode.Uri.file(root);
  const remoteWorkspace = vscode.workspace.workspaceFolders?.find(
    (folder) => folder.uri.scheme !== 'file',
  )?.uri;
  return remoteWorkspace
    ? fileUri.with({ scheme: remoteWorkspace.scheme, authority: remoteWorkspace.authority })
    : fileUri;
}

async function openMergeConflictInVsCode(root: string, path: string): Promise<void> {
  const absolutePath = resolve(root, path);
  const repositoryPath = relative(root, absolutePath);
  if (
    !path ||
    path.includes('\0') ||
    isAbsolute(path) ||
    repositoryPath === '..' ||
    repositoryPath.startsWith(`..${sep}`) ||
    isAbsolute(repositoryPath) ||
    path.split(/[\\/]/).some((part) => part.toLowerCase() === '.git')
  ) {
    throw new Error('Select a repository-relative file path.');
  }
  await vscode.commands.executeCommand('git.openMergeEditor', vscode.Uri.file(absolutePath));
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
