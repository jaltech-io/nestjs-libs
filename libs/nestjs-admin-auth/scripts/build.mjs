import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(libraryRoot, '../..');
const outputDirectory = resolve(workspaceRoot, 'dist/libs/nestjs-admin-auth');
const expectedOutputDirectory = resolve(workspaceRoot, 'dist', 'libs', 'nestjs-admin-auth');

if (outputDirectory !== expectedOutputDirectory) {
  throw new Error(`Refusing to clean unexpected output directory: ${outputDirectory}`);
}

rmSync(outputDirectory, { recursive: true, force: true });

const tscPath = resolve(workspaceRoot, 'node_modules/typescript/bin/tsc');
const compilation = spawnSync(process.execPath, [tscPath, '--project', resolve(libraryRoot, 'tsconfig.lib.json')], {
  cwd: workspaceRoot,
  stdio: 'inherit',
});

if (compilation.error) throw compilation.error;
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

mkdirSync(outputDirectory, { recursive: true });

for (const file of ['README.md', 'LICENSE']) {
  cpSync(resolve(libraryRoot, file), resolve(outputDirectory, file));
}

const packageJson = JSON.parse(readFileSync(resolve(libraryRoot, 'package.json'), 'utf8'));
delete packageJson.scripts;
delete packageJson.devDependencies;

writeFileSync(resolve(outputDirectory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
