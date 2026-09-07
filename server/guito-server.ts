import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import { simpleGit } from 'simple-git';
import { promisify } from 'node:util';
import { workingTree } from './working-tree.js';

const execFileAsync = promisify(execFile);

export interface GuitoServerOptions {
  repositoryPath: string;
  uiRoot: string;
  host?: string;
  port?: number;
  apiToken?: string;
}

export interface RunningGuitoServer {
  address: string;
  close(): Promise<void>;
}

export async function startGuitoServer({
  repositoryPath,
  uiRoot,
  host,
  port = 8080,
  apiToken,
}: GuitoServerOptions): Promise<RunningGuitoServer> {
  // Initialize server
  const app = fastify({
    logger: false,
  });

  // Register cors
  await app.register(fastifyCors);

  // Compress JSON responses (commit history payloads are highly repetitive)
  await app.register(fastifyCompress);

  if (apiToken) {
    app.addHook('onRequest', async (request, reply) => {
      const pathname = request.url.split('?', 1)[0];
      if (!pathname.startsWith('/api/')) {
        return;
      }

      const headerToken = request.headers['x-guito-token'];
      const queryToken = (request.query as { guitoToken?: string } | undefined)?.guitoToken;
      const archiveToken = pathname === '/api/archive' ? queryToken : undefined;
      if (headerToken !== apiToken && archiveToken !== apiToken) {
        await reply.status(401).type('application/json').send({ error: 'unauthorized' });
      }
    });
  }

  // Register static file provider (supports both `ui/` and `ui/browser/` layouts)
  const staticRoot = existsSync(join(uiRoot, 'browser', 'index.html'))
    ? join(uiRoot, 'browser')
    : uiRoot;

  if (existsSync(staticRoot)) {
    await app.register(fastifyStatic, { root: staticRoot });

    // Serve UI
    app.get('/', (_req, resp) => resp.sendFile('index.html'));
  } else {
    app.get('/', (_req, resp) =>
      resp.send('Guito API is running. Build the UI with `npm run build:ui`.'),
    );
  }

  // Initialize git lib
  const git = simpleGit(repositoryPath);

  // ==================== Diff parsing ====================
  function parseUnifiedDiff(rawDiff: string): any[] {
    const files: any[] = [];
    const lines = rawDiff.split('\n');

    let current: any = null;
    let inHunk = false;
    let oldLine = 0;
    let newLine = 0;

    const startFile = (line: string) => {
      current = {
        path: '',
        oldPath: '',
        status: 'modified',
        lines: [],
        additions: 0,
        deletions: 0,
      };
      const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      if (match) {
        current.oldPath = match[1];
        current.path = match[2];
      }
      inHunk = false;
    };

    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        if (current) files.push(current);
        startFile(line);
        continue;
      }

      if (!current) continue;

      if (line.startsWith('@@')) {
        inHunk = true;
        const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        current.lines.push({ type: 'hunk', text: line });
        continue;
      }

      if (!inHunk) {
        // File meta headers (mode, index, rename, binary...)
        if (line.startsWith('new file mode')) current.status = 'added';
        else if (line.startsWith('deleted file mode')) current.status = 'deleted';
        else if (line.startsWith('rename from ')) current.status = 'renamed';
        else if (line.startsWith('rename to ')) current.path = line.slice('rename to '.length);
        else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch'))
          current.status = 'binary';
        continue;
      }

      if (line.startsWith('\\')) {
        // "\ No newline at end of file"
        continue;
      }

      if (line.startsWith('+')) {
        current.lines.push({ type: 'add', newLine: newLine++, text: line.slice(1) });
        current.additions++;
      } else if (line.startsWith('-')) {
        current.lines.push({ type: 'del', oldLine: oldLine++, text: line.slice(1) });
        current.deletions++;
      } else {
        current.lines.push({
          type: 'context',
          oldLine: oldLine++,
          newLine: newLine++,
          text: line.slice(1),
        });
      }
    }

    if (current) files.push(current);
    return files;
  }

  const working = workingTree(git, parseUnifiedDiff);
  // Keep validation and the corresponding index mutation in one operation.
  let mutationQueue = Promise.resolve();
  const mutate = (action: () => Promise<void>) => {
    const result = mutationQueue.then(action);
    mutationQueue = result.catch(() => {});
    return result;
  };

  const repoRoot = async (): Promise<string> => (await git.revparse(['--show-toplevel'])).trim();

  // ==================== Repository ====================
  app.get('/api/repo', async (_req, resp) => {
    try {
      const root = (await git.revparse(['--show-toplevel'])).trim();
      return resp.type('application/json').send({ root, name: basename(root) });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Commits ====================
  app.get('/api/commits', async (req: any, resp) => {
    try {
      const query = (req.query ?? {}) as { limit?: string; skip?: string };
      const limit = Number.parseInt(query.limit ?? '', 10);
      const skip = Number.parseInt(query.skip ?? '', 10);

      // Build simple-git options conditionally: an explicit key with an
      // undefined value would still be emitted as a bare command flag.
      // The commit body is intentionally omitted: it roughly doubles the
      // payload and is only needed when a commit is opened, so it is served
      // on demand by /api/commit/detail instead.
      const options: Record<string, unknown> = {
        format: {
          hash: '%H',
          date: '%aI',
          message: '%s',
          refs: '%D',
          author_name: '%aN',
          author_email: '%aE',
          parents: '%P',
        },
        '--all': null,
      };
      if (Number.isFinite(limit) && limit > 0) {
        options.maxCount = limit;
      }
      if (Number.isFinite(skip) && skip > 0) {
        options['--skip'] = String(skip);
      }

      const [log, count] = await Promise.all([
        git.log(options as Parameters<typeof git.log>[0]),
        git.raw(['rev-list', '--count', '--all']),
      ]);

      const commits = log.all.map((commit: any) => ({
        ...commit,
        parents: String(commit.parents ?? '')
          .split(' ')
          .filter(Boolean),
      }));

      return resp
        .type('application/json')
        .send({ commits, total: Number.parseInt(count, 10) || 0 });
    } catch (err: any) {
      // A repository without any commits has no history to list.
      if (
        /does not have any commits yet|unknown revision|bad default revision/i.test(
          err.message ?? '',
        )
      ) {
        return resp.type('application/json').send({ commits: [], total: 0 });
      }
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // Full-text commit search. The list payload omits commit bodies, so body
  // matching runs here (git --grep covers subject and body together) and the
  // client unions the resulting hashes with its local subject/author/hash
  // matches over the loaded history.
  app.get('/api/commits/search', async (req: any, resp) => {
    const query = String((req.query ?? {}).query ?? '').trim();
    if (!query) {
      return resp.type('application/json').send({ hashes: [] });
    }

    try {
      const raw = await git.raw([
        'log',
        '--all',
        '-i',
        '--fixed-strings',
        `--grep=${query}`,
        '--format=%H',
      ]);
      return resp
        .type('application/json')
        .send({ hashes: raw.split('\n').map((hash) => hash.trim()).filter(Boolean) });
    } catch (err: any) {
      if (
        /does not have any commits yet|unknown revision|bad default revision/i.test(
          err.message ?? '',
        )
      ) {
        return resp.type('application/json').send({ hashes: [] });
      }
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/commit', async (req: any, resp) => {
    try {
      const { message, description } = req.body ?? {};
      await mutate(() => working.commit(message, description));
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/amend', async (req: any, resp) => {
    try {
      const { message, description } = req.body;
      await git.commit([message, ...(description ? [description] : [])], {
        '--amend': null,
        '--no-edit': null,
      });
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/revert', async (req: any, resp) => {
    try {
      const { commit } = req.body;
      await git.revert(commit);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/cherry-pick', async (req: any, resp) => {
    try {
      await git.raw(['cherry-pick', req.body.commit]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/commit/drop', async (req: any, resp) => {
    try {
      await git.raw(['reset', '--hard', `${req.body.commit}^`]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/reset-commit', async (req: any, resp) => {
    try {
      await git.raw(['reset', '--hard', req.body.commit]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Staging ====================
  app.get('/api/status', async (_req, resp) => {
    try {
      const status = await git.status();
      return resp.type('application/json').send(status);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stage', async (req: any, resp) => {
    try {
      await mutate(() => working.stage(req.body?.files));
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/unstage', async (req: any, resp) => {
    try {
      await mutate(() => working.unstage(req.body?.files));
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stage-lines', async (req: any, resp) => {
    try {
      const { file, patch } = req.body;
      // Stage specific lines using git add -p equivalent (patch mode)
      await git.raw('add --patch', { input: patch });
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Branches ====================
  app.get('/api/branches/all', async (_req, resp) => {
    try {
      const raw = await git.raw([
        'for-each-ref',
        '--format=%(refname)%09%(objectname)%09%(HEAD)',
        'refs/heads',
        'refs/remotes',
      ]);

      const branches = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [refname, commit, headMarker] = line.split('\t');
          const remote = refname.startsWith('refs/remotes/');
          const name = refname.replace(/^refs\/(heads|remotes)\//, '');
          return { name, commit, current: headMarker === '*', remote };
        });

      return resp.type('application/json').send(branches);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.get('/api/branches', async (_req, resp) => {
    try {
      const branchSummary = await git.branchLocal();
      return resp.type('application/json').send(branchSummary);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/create', async (req: any, resp) => {
    try {
      const { name, startPoint } = req.body;
      await git.branch([...(startPoint ? [name, startPoint] : [name])]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/delete', async (req: any, resp) => {
    try {
      const { name, force } = req.body;
      await git.deleteLocalBranch(name, force);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/delete-remote', async (req: any, resp) => {
    try {
      const { remote, branch } = req.body;
      await git.push([remote, '--delete', branch]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/rename', async (req: any, resp) => {
    try {
      const { oldName, newName } = req.body;
      await git.branch(['-m', oldName, newName]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/checkout', async (req: any, resp) => {
    try {
      const { ref } = req.body;
      await git.checkout(ref);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Merge & Rebase ====================
  app.post('/api/merge', async (req: any, resp) => {
    try {
      const { branch } = req.body;
      await git.merge([branch]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.get('/api/archive', async (req: any, resp) => {
    try {
      const ref = String(req.query?.ref ?? 'HEAD');
      if (!/^[0-9a-fA-F]{7,40}$/.test(ref) && !/^[A-Za-z0-9._/-]+$/.test(ref)) {
        return resp.status(400).type('application/json').send({ error: 'invalid ref' });
      }
      const result = await execFileAsync('git', ['archive', '--format=zip', ref], {
        cwd: repositoryPath,
        encoding: 'buffer',
        maxBuffer: 100 * 1024 * 1024,
      });
      return resp
        .header('Content-Disposition', `attachment; filename="guito-${ref.slice(0, 8)}.zip"`)
        .type('application/zip')
        .send(result.stdout);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/rebase', async (req: any, resp) => {
    try {
      const { branch } = req.body;
      await git.rebase([branch]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/squash', async (req: any, resp) => {
    try {
      const { commits } = req.body;
      // Squash: rebase -i with squash operation
      await git.rebase(['-i', 'HEAD~' + commits]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Stash ====================
  app.get('/api/stash/list', async (_req, resp) => {
    try {
      const stashList = await git.stashList();
      return resp.type('application/json').send(stashList);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/save', async (req: any, resp) => {
    try {
      const { message } = req.body;
      await git.stash(['save', message || '']);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/apply', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['apply', `stash@{${index}}`]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/pop', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['pop', `stash@{${index}}`]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/drop', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['drop', `stash@{${index}}`]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/show', async (req: any, resp) => {
    try {
      const { index } = req.body;
      const show = await git.stash(['show', '-p', `stash@{${index}}`]);
      return resp.type('application/json').send({ preview: show });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Tags ====================
  app.get('/api/tags', async (_req, resp) => {
    try {
      const tags = await git.tags();
      return resp.type('application/json').send(tags);
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/tag/create', async (req: any, resp) => {
    try {
      const { name, message, commit } = req.body;
      if (message) {
        await git.tag(['-a', name, '-m', message, ...(commit ? [commit] : [])]);
      } else {
        await git.tag([name, ...(commit ? [commit] : [])]);
      }
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/tag/delete', async (req: any, resp) => {
    try {
      const { name } = req.body;
      await git.tag(['-d', name]);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Remote Operations ====================
  app.get('/api/fetch', async (_req, resp) => {
    try {
      await git.fetch();
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/pull', async (req: any, resp) => {
    try {
      const { remote, branch, rebase } = req.body;
      await git.pull(remote || 'origin', branch || undefined, rebase ? { '--rebase': null } : {});
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/push', async (req: any, resp) => {
    try {
      const { remote, branch, force } = req.body;
      await git.push(remote || 'origin', branch || undefined, force ? { '-f': null } : {});
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/sync', async (_req, resp) => {
    try {
      await git.pull('origin', undefined, {});
      await git.push('origin', undefined, {});
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/prune', async (req: any, resp) => {
    try {
      const { remote } = req.body;
      await git.remote(['prune', remote || 'origin']);
      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Commit Detail ====================
  app.post('/api/commit/detail', async (req: any, resp) => {
    try {
      const { hash } = req.body;
      if (!hash) {
        return resp.status(400).type('application/json').send({ error: 'hash required' });
      }

      // Fields are NUL-separated; %b may span lines and contain anything
      // except NUL, so it cannot be split naively by newline.
      const raw = await git.raw([
        'show',
        '-s',
        '--format=%H%x00%aI%x00%s%x00%b%x00%aN%x00%aE%x00%P',
        hash,
      ]);
      const [fullHash, date, message, body, authorName, authorEmail, parents] =
        raw.trimEnd().split('\u0000');

      return resp.type('application/json').send({
        hash: fullHash,
        date,
        message,
        refs: '',
        body: body ?? '',
        author_name: authorName,
        author_email: authorEmail,
        parents: String(parents ?? '')
          .split(' ')
          .filter(Boolean),
      });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Diff Viewer ====================
  app.post('/api/commit/diff', async (req: any, resp) => {
    try {
      const { hash } = req.body;
      if (!hash) {
        return resp.status(400).type('application/json').send({ error: 'hash required' });
      }

      // Get the raw unified diff (diff against the first parent for merges)
      const rawDiff = await git.raw([
        'show',
        '--no-color',
        '--pretty=format:',
        '--find-renames',
        '--first-parent',
        '-m',
        hash,
      ]);

      return resp.type('application/json').send({ hash, files: parseUnifiedDiff(rawDiff) });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Working Changes ====================
  app.get('/api/working-changes', async (_req, resp) => {
    try {
      await mutationQueue;
      return resp.type('application/json').send(await working.snapshot());
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== File Content ====================
  app.post('/api/file-content', async (req: any, resp) => {
    try {
      const { path, ref } = req.body;
      if (!path || !ref) {
        return resp.status(400).type('application/json').send({ error: 'path and ref required' });
      }

      if (ref === 'WORKING') {
        const root = await repoRoot();
        const abs = resolve(root, path);
        const rel = relative(root, abs);
        if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
          return resp.status(400).type('application/json').send({ error: 'invalid path' });
        }
        try {
          const buffer = await readFile(abs);
          if (buffer.includes(0)) {
            return resp.type('application/json').send({ binary: true, content: '' });
          }
          return resp.type('application/json').send({ content: buffer.toString('utf8') });
        } catch {
          // File no longer exists on disk (deleted).
          return resp.type('application/json').send({ content: '' });
        }
      }

      if (ref === 'EMPTY') {
        return resp.type('application/json').send({ content: '' });
      }

      try {
        const content = await git.raw(['show', ref === 'INDEX' ? `:${path}` : `${ref}:${path}`]);
        if (content.includes('\u0000')) {
          return resp.type('application/json').send({ binary: true, content: '' });
        }
        return resp.type('application/json').send({ content });
      } catch {
        // Path did not exist at that revision (added file).
        return resp.type('application/json').send({ content: '' });
      }
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Discard ====================
  app.post('/api/discard', async (req: any, resp) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files) || files.length === 0) {
        return resp.status(400).type('application/json').send({ error: 'files required' });
      }

      const root = await repoRoot();
      const status = await git.status();
      const untracked = new Set<string>(status.not_added ?? []);

      const tracked = files.filter((file: string) => !untracked.has(file));
      const removed = files.filter((file: string) => untracked.has(file));

      if (tracked.length > 0) {
        await git.raw(['checkout', 'HEAD', '--', ...tracked]);
      }
      for (const file of removed) {
        await rm(join(root, file), { force: true, recursive: true });
      }

      return resp.type('application/json').send({ success: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Working Tree Actions ====================
  app.post('/api/reset', async (_req, resp) => {
    try {
      await git.raw(['reset', '--hard', 'HEAD']);
      return resp.type('application/json').send({ ok: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/clean', async (_req, resp) => {
    try {
      await git.raw(['clean', '-fd']);
      return resp.type('application/json').send({ ok: true });
    } catch (err: any) {
      return resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  const address = await app.listen({ port, ...(host ? { host } : {}) });
  return {
    address,
    close: () => app.close(),
  };
}
