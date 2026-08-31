import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const extensionRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(extensionRoot, '..');
const outputRoot = join(extensionRoot, 'dist');
const uiRoot = join(repositoryRoot, 'bin', 'ui');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await build({
  entryPoints: [join(extensionRoot, 'src', 'extension.ts')],
  outfile: join(outputRoot, 'extension.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
});

await cp(uiRoot, join(outputRoot, 'ui'), { recursive: true });
