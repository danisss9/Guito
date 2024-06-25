#! /usr/bin/env node
import { dirname, join } from 'node:path';
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

  // Register static file provider
  app.register(fastifyStatic, {
    root: join(__dirname, 'ui'),
  });

  // Serve UI
  app.get('/', (_req, resp) => resp.sendFile('index.html'));

  // Initialize git lib
  const git = simpleGit(process.cwd());

  // Git Api
  app.get('/api/commits', (_req, resp) => {
    git.log({}, (err, data) => {
      resp.type('application/json').send(data.all);
    });
  });

  app.get('/api/fetch', (_req, resp) => {
    git.fetch({}, (err, data) => {
      resp.type('application/json').send();
    });
  });

  // Run the server
  app.listen({ port }, (err, address) => {
    if (err) throw err;

    console.log(`Visit "${address}" to see git explorer.`);

    if (shouldOpenBrowser) open(address);
  });
})();
