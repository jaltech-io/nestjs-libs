// Reproduit exactement la cible Nx `nestjs-cache:build` du monorepo d'origine :
// 1. rm -rf dist/nestjs-cache
// 2. tsc -p tsconfig.lib.json (CommonJS, cf. package.json "type": "commonjs")
// 3. copie package.json / README.md / LICENSE dans le dist
import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(libraryRoot, '..');
const outputDirectory = resolve(workspaceRoot, 'dist/nestjs-cache');
const expectedOutputDirectory = resolve(workspaceRoot, 'dist', 'nestjs-cache');

if (outputDirectory !== expectedOutputDirectory) {
  throw new Error(`Refusing to clean unexpected output directory: ${outputDirectory}`);
}

rmSync(outputDirectory, { recursive: true, force: true });

const compilation = spawnSync(
  process.execPath,
  [resolve(workspaceRoot, 'node_modules/typescript/bin/tsc'), '--project', resolve(libraryRoot, 'tsconfig.lib.json')],
  { cwd: workspaceRoot, stdio: 'inherit' },
);

if (compilation.error) throw compilation.error;
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

for (const file of ['package.json', 'README.md', 'LICENSE']) {
  copyFileSync(resolve(libraryRoot, file), resolve(outputDirectory, file));
}

console.log(`✓ nestjs-cache built into ${outputDirectory}`);
