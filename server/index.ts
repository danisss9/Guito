#! /usr/bin/env node
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import open from 'open';
import simpleGit from 'simple-git';

void (async function main() {
  // Calculate dirname
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Get port number
  const portArgIndex = process.argv.findIndex((a) => a.toLowerCase() === '--port');
  const port = portArgIndex !== -1 ? +process.argv[portArgIndex + 1] : 8080;

  // Get if should not open browser
  const shouldOpenBrowser = process.argv.findIndex((a) => a.toLowerCase() === '--no-open') === -1;

  // Initialize server
  const app = fastify({
    logger: false,
  });

  // Register cors
  await app.register(fastifyCors);

  // Register static file provider (supports both `ui/` and `ui/browser/` layouts)
  const uiRoot = join(__dirname, 'ui');
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
  const git = simpleGit(process.cwd());

  // ==================== Repository ====================
  app.get('/api/repo', async (_req, resp) => {
    try {
      const root = (await git.revparse(['--show-toplevel'])).trim();
      resp.type('application/json').send({ root, name: basename(root) });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Commits ====================
  app.get('/api/commits', async (_req, resp) => {
    try {
      const log = await git.log({
        format: {
          hash: '%H',
          date: '%aI',
          message: '%s',
          refs: '%D',
          body: '%b',
          author_name: '%aN',
          author_email: '%aE',
          parents: '%P',
        },
      });

      const commits = log.all.map((commit: any) => ({
        ...commit,
        parents: String(commit.parents ?? '')
          .split(' ')
          .filter(Boolean),
      }));

      resp.type('application/json').send(commits);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/commit', async (req: any, resp) => {
    try {
      const { message, description } = req.body;
      await git.commit([message, ...(description ? [description] : [])], { '--allow-empty': null });
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/amend', async (req: any, resp) => {
    try {
      const { message, description } = req.body;
      await git.commit([message, ...(description ? [description] : [])], {
        '--amend': null,
        '--no-edit': null,
      });
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/revert', async (req: any, resp) => {
    try {
      const { commit } = req.body;
      await git.revert(commit);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Staging ====================
  app.get('/api/status', async (_req, resp) => {
    try {
      const status = await git.status();
      resp.type('application/json').send(status);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stage', async (req: any, resp) => {
    try {
      const { files } = req.body;
      if (Array.isArray(files) && files.length > 0) {
        await git.add(files);
      }
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/unstage', async (req: any, resp) => {
    try {
      const { files } = req.body;
      if (Array.isArray(files) && files.length > 0) {
        await git.reset(['HEAD', ...files]);
      }
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stage-lines', async (req: any, resp) => {
    try {
      const { file, patch } = req.body;
      // Stage specific lines using git add -p equivalent (patch mode)
      await git.raw('add --patch', { input: patch });
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
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

      resp.type('application/json').send(branches);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.get('/api/branches', async (_req, resp) => {
    try {
      const branchSummary = await git.branchLocal();
      resp.type('application/json').send(branchSummary);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/create', async (req: any, resp) => {
    try {
      const { name, startPoint } = req.body;
      await git.branch([...(startPoint ? [name, startPoint] : [name])]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/delete', async (req: any, resp) => {
    try {
      const { name, force } = req.body;
      await git.deleteLocalBranch(name, force);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/branch/rename', async (req: any, resp) => {
    try {
      const { oldName, newName } = req.body;
      await git.branch(['-m', oldName, newName]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/checkout', async (req: any, resp) => {
    try {
      const { ref } = req.body;
      await git.checkout(ref);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Merge & Rebase ====================
  app.post('/api/merge', async (req: any, resp) => {
    try {
      const { branch } = req.body;
      await git.merge([branch]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/rebase', async (req: any, resp) => {
    try {
      const { branch } = req.body;
      await git.rebase([branch]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/squash', async (req: any, resp) => {
    try {
      const { commits } = req.body;
      // Squash: rebase -i with squash operation
      await git.rebase(['-i', 'HEAD~' + commits]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Stash ====================
  app.get('/api/stash/list', async (_req, resp) => {
    try {
      const stashList = await git.stashList();
      resp.type('application/json').send(stashList);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/save', async (req: any, resp) => {
    try {
      const { message } = req.body;
      await git.stash(['save', message || '']);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/apply', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['apply', `stash@{${index}}`]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/pop', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['pop', `stash@{${index}}`]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/drop', async (req: any, resp) => {
    try {
      const { index } = req.body;
      await git.stash(['drop', `stash@{${index}}`]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/stash/show', async (req: any, resp) => {
    try {
      const { index } = req.body;
      const show = await git.stash(['show', '-p', `stash@{${index}}`]);
      resp.type('application/json').send({ preview: show });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Tags ====================
  app.get('/api/tags', async (_req, resp) => {
    try {
      const tags = await git.tags();
      resp.type('application/json').send(tags);
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
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
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/tag/delete', async (req: any, resp) => {
    try {
      const { name } = req.body;
      await git.tag(['-d', name]);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // ==================== Remote Operations ====================
  app.get('/api/fetch', async (_req, resp) => {
    try {
      await git.fetch();
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/pull', async (req: any, resp) => {
    try {
      const { remote, branch } = req.body;
      await git.pull(remote || 'origin', branch || undefined);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/push', async (req: any, resp) => {
    try {
      const { remote, branch, force } = req.body;
      await git.push(remote || 'origin', branch || undefined, force ? { '-f': null } : {});
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  app.post('/api/prune', async (req: any, resp) => {
    try {
      const { remote } = req.body;
      await git.remote(['prune', remote || 'origin']);
      resp.type('application/json').send({ success: true });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
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

      resp.type('application/json').send({ hash, files });
    } catch (err: any) {
      resp.status(400).type('application/json').send({ error: err.message });
    }
  });

  // Run the server
  app.listen({ port }, (err, address) => {
    if (err) throw err;

    console.log(`Visit "${address}" to see git explorer.`);

    if (shouldOpenBrowser) open(address);
  });
})();
