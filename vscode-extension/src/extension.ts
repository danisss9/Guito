import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { basename, normalize, resolve } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { startGuitoServer, type RunningGuitoServer } from '../../server/guito-server.js';

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
}

const sessions = new Map<string, RepositorySession>();

export function activate(context: vscode.ExtensionContext): void {
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

  updateStatusBar();
  context.subscriptions.push(
    statusBar,
    openCommand,
    vscode.workspace.onDidChangeWorkspaceFolders(updateStatusBar),
    { dispose: () => void closeAllSessions() },
  );
}

export async function deactivate(): Promise<void> {
  await closeAllSessions();
}

async function selectRepository(): Promise<RepositoryChoice | undefined> {
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
    title: 'Open Guito',
    placeHolder: 'Choose a Git repository',
    matchOnDescription: true,
  });
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
): Promise<void> {
  const existing = sessions.get(repository.key);
  if (existing) {
    existing.panel.reveal(vscode.ViewColumn.Active);
    return;
  }

  const token = randomBytes(32).toString('hex');
  const configuration = vscode.workspace.getConfiguration('guito');
  const azureDevOpsUrl = configuration.get<string>('azureDevOpsUrl')?.trim();
  const autoReload = configuration.get<boolean>('autoReload', true);
  const server = await startGuitoServer({
    repositoryPath: repository.root,
    uiRoot: vscode.Uri.joinPath(context.extensionUri, 'dist', 'ui').fsPath,
    host: '127.0.0.1',
    port: 0,
    apiToken: token,
    azureDevOpsUrl: azureDevOpsUrl || undefined,
    autoReload,
  });

  try {
    const localUri = vscode.Uri.parse(server.address).with({
      query: new URLSearchParams({ guitoToken: token }).toString(),
    });
    const externalUri = await vscode.env.asExternalUri(localUri);
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
    panel.webview.html = webviewHtml(externalUri);

    sessions.set(repository.key, { panel, server });
    panel.onDidDispose(() => {
      const session = sessions.get(repository.key);
      if (session?.panel === panel) {
        sessions.delete(repository.key);
        void session.server.close();
      }
    });
  } catch (error) {
    await server.close();
    throw error;
  }
}

function webviewHtml(externalUri: vscode.Uri): string {
  const frameSource = `${externalUri.scheme}://${externalUri.authority}`;
  // VS Code's default URI serialization escapes query delimiters such as `=`, which
  // would turn `?guitoToken=value` into a single, incorrectly named query parameter.
  const externalUrl = externalUri.toString(true);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${escapeHtml(frameSource)}; style-src 'unsafe-inline';">
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
  </body>
</html>`;
}

async function closeAllSessions(): Promise<void> {
  const active = [...sessions.values()];
  sessions.clear();
  await Promise.allSettled(active.map((session) => session.server.close()));
}

function repositoryKey(root: string): string {
  const normalized = normalize(root);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
