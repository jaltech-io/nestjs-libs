import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = 'nestjs-auth-keycloak';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(libraryRoot, '..');
const outputDirectory = resolve(workspaceRoot, `dist/${LIB}`);
const expectedOutputDirectory = resolve(workspaceRoot, 'dist', LIB);

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

const appendJavaScriptExtension = (prefix, specifier, suffix) => {
  if (extname(specifier)) return `${prefix}${specifier}${suffix}`;
  return `${prefix}${specifier}.js${suffix}`;
};

const rewriteModuleSpecifiers = (content) =>
  content
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_m, prefix, specifier, suffix) =>
      appendJavaScriptExtension(prefix, specifier, suffix),
    )
    .replace(/(import\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_m, prefix, specifier, suffix) =>
      appendJavaScriptExtension(prefix, specifier, suffix),
    )
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, (_m, prefix, specifier, suffix) =>
      appendJavaScriptExtension(prefix, specifier, suffix),
    )
    .replace("createRequire(resolve(process.cwd(), 'package.json'))", 'createRequire(import.meta.url)');

const visit = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      visit(path);
      continue;
    }
    if (!path.endsWith('.js') && !path.endsWith('.d.ts')) continue;
    const content = readFileSync(path, 'utf8');
    writeFileSync(path, rewriteModuleSpecifiers(content), 'utf8');
  }
};

visit(outputDirectory);
mkdirSync(outputDirectory, { recursive: true });

for (const file of ['package.json', 'README.md', 'LICENSE']) {
  cpSync(resolve(libraryRoot, file), resolve(outputDirectory, file));
}

console.log(`✓ ${LIB} built into ${outputDirectory}`);
