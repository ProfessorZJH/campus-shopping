import { build } from 'vite';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { files, normalizeGeneratedText, sourceFingerprint } from './build-files.mjs';
import { precompileTemplates } from './template-plugin.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const option = process.argv.find((arg) => arg.startsWith('--out='));
const out = resolve(option ? option.slice(6) : resolve(root, 'dist'));
const project = resolve(root, '..');
const within = (base, path) => {
  const rel = relative(base, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
const managed = [
  resolve(root, 'dist'),
  resolve(project, 'campus-shopping-app/target/generated-ui'),
];
const isManaged = managed.some((directory) => relative(directory, out) === '');
if (within(out, project) || (within(project, out) && !isManaged)) {
  throw new Error('UI output must be a generated directory, outside project sources');
}
const existing = await readdir(out).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
if (!isManaged && existing.length && !existing.includes('ui-build.json')) {
  throw new Error('Refusing to empty an unmanaged non-empty output directory');
}
await build({
  configFile: false,
  root,
  plugins: [precompileTemplates()],
  build: {
    outDir: out,
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: resolve(root, 'src/main.js'),
      name: 'CampusUI',
      formats: ['iife'],
      fileName: () => 'ui.bundle.js',
    },
  },
});
// 快照兼容离线浏览器验收；Spring 构建直接读取 out，源码仅在 frontend/src 编辑。
await cp(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
await writeFile(resolve(out, 'index.html'), await readFile(resolve(root, 'offline.html')));
await normalizeGeneratedText(out);
const inputs = [
  resolve(root, 'package.json'),
  resolve(root, 'package-lock.json'),
  resolve(root, 'offline.html'),
  ...(await files(resolve(root, 'src'))),
  ...(await files(resolve(root, 'scripts'))),
  ...(await files(resolve(root, 'public'))),
];
const sourceSha256 = await sourceFingerprint(root, inputs);
await mkdir(out, { recursive: true });
await writeFile(
  resolve(out, 'ui-build.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      sourceSha256,
      nodeMajor: Number(process.versions.node.split('.')[0]),
    },
    null,
    2,
  ) + '\n',
);
