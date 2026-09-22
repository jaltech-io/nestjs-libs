import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '..');
const npmCache = resolve(workspaceRoot, '.npm-cache');

const npmInvocation = (() => {
  const executableDirectories = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const npmCliCandidates = [
    ...new Set([
      resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
      ...executableDirectories.flatMap((directory) => [
        resolve(directory, 'node_modules/npm/bin/npm-cli.js'),
        resolve(directory, '../node_modules/npm/bin/npm-cli.js'),
        resolve(directory, '../lib/node_modules/npm/bin/npm-cli.js'),
        resolve(directory, '../share/nodejs/npm/bin/npm-cli.js'),
      ]),
    ]),
  ];
  const npmCli = npmCliCandidates.find(existsSync);
  if (npmCli) return { command: process.execPath, args: [npmCli] };
  if (process.platform !== 'win32') return { command: 'npm', args: [] };

  fail('Unable to locate npm CLI');
})();

const libraries = ['nestjs-auth', 'nestjs-admin-auth', 'nestjs-cache'];

const forbiddenContent = [
  { pattern: /@ui\//, label: 'internal @ui alias' },
  { pattern: /@\/shared\//, label: 'frontend application alias' },
  { pattern: /(?:^|["'(])node_modules\//, label: 'package-manager-internal module path' },
  { pattern: /apps[\\/]pf-admin_(?:front|api)-app[\\/]/, label: 'application source path' },
  { pattern: /[A-Za-z]:[\\/]Users[\\/]/, label: 'absolute Windows user path' },
  { pattern: /\/home\/[^/]+\//, label: 'absolute Unix home path' },
];

function fail(message) {
  throw new Error(message);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

for (const project of libraries) {
  const directory = resolve(workspaceRoot, 'dist', 'libs', project);
  const manifestPath = resolve(directory, 'package.json');

  if (!existsSync(manifestPath)) fail(`${project}: missing built package.json`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const expectedName = `@profeskills/${project}`;

  if (manifest.name !== expectedName) fail(`${project}: expected package name ${expectedName}`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    fail(`${project}: invalid semantic version ${manifest.version}`);
  }
  if (manifest.private === true) fail(`${project}: distribution package is private`);
  if (manifest.license !== 'MIT') fail(`${project}: license must be MIT`);
  if (manifest.publishConfig?.access !== 'public') fail(`${project}: npm access must be public`);
  if (manifest.publishConfig?.registry && manifest.publishConfig.registry !== 'https://registry.npmjs.org/') {
    fail(`${project}: unexpected npm registry ${manifest.publishConfig.registry}`);
  }
  if (!String(manifest.repository?.url ?? '').includes('forge.profeskills.com/jal-group/nestjs-libs')) {
    fail(`${project}: repository metadata does not point to the nestjs-libs repo`);
  }

  for (const required of ['main', 'types']) {
    if (!manifest[required]) fail(`${project}: missing ${required} entry`);
    if (!existsSync(resolve(directory, manifest[required]))) {
      fail(`${project}: ${required} target does not exist (${manifest[required]})`);
    }
  }

  for (const requiredFile of ['LICENSE', 'README.md']) {
    if (!existsSync(resolve(directory, requiredFile))) fail(`${project}: missing ${requiredFile}`);
  }

  for (const file of walk(directory)) {
    if (!/\.(?:js|cjs|mjs|d\.ts|json)$/.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    for (const forbidden of forbiddenContent) {
      if (forbidden.pattern.test(content)) {
        fail(`${project}: ${forbidden.label} leaked into ${file.slice(directory.length + 1)}`);
      }
    }
  }

  const pack = spawnSync(npmInvocation.command, [...npmInvocation.args, 'pack', '--dry-run', '--json', directory], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: npmCache },
  });

  if (pack.error) throw pack.error;
  if (pack.status !== 0) fail(`${project}: npm pack failed\n${pack.stderr}`);

  const packResult = JSON.parse(pack.stdout);
  if (packResult.length !== 1 || packResult[0].name !== expectedName || packResult[0].entryCount < 1) {
    fail(`${project}: npm pack returned an unexpected package description`);
  }

  const entryUrl = `${pathToFileURL(resolve(directory, manifest.main)).href}?verify=${Date.now()}`;
  const imported = await import(entryUrl);
  if (Object.keys(imported).length === 0) {
    fail(`${project}: runtime entry point exports nothing`);
  }

  console.log(`✓ ${expectedName}@${manifest.version} (${packResult[0].entryCount} files)`);
}
console.log('All library packages are buildable, self-contained, and packable.');
