import { readFile } from 'node:fs/promises';

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Release tag must use the stable vX.Y.Z format; received ${tag || 'nothing'}.`);
}

const readPackage = async (path) => JSON.parse(await readFile(path, 'utf8'));
const rootPackage = await readPackage(new URL('../package.json', import.meta.url));
const extensionPackage = await readPackage(new URL('../vscode-extension/package.json', import.meta.url));
const expectedVersion = tag.slice(1);

if (rootPackage.version !== expectedVersion) {
  throw new Error(`npm package version ${rootPackage.version} does not match ${tag}.`);
}
if (extensionPackage.version !== expectedVersion) {
  throw new Error(`VS Code extension version ${extensionPackage.version} does not match ${tag}.`);
}

console.log(`Verified shared release version ${expectedVersion}.`);
