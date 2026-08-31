#! /usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import { startGuitoServer } from './guito-server.js';

function parsePort(args: string[]): number {
  const index = args.findIndex((arg) => arg.toLowerCase() === '--port');
  if (index === -1) {
    return 8080;
  }

  const port = Number(args[index + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('The --port argument must be an integer between 0 and 65535.');
  }
  return port;
}

void (async () => {
  try {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const server = await startGuitoServer({
      repositoryPath: process.cwd(),
      uiRoot: join(currentDirectory, 'ui'),
      port: parsePort(process.argv.slice(2)),
    });

    console.log(`Visit "${server.address}" to see git explorer.`);
    if (!process.argv.some((arg) => arg.toLowerCase() === '--no-open')) {
      await open(server.address);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
})();
