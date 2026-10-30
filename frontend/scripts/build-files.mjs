import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, relative, resolve, sep } from 'node:path';

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// Git 文本检出可能仍带 CRLF；构建输入与输出都采用 LF，图片等二进制保持原字节。
export function canonicalFileBytes(file, content) {
  if (
    !textExtensions.has(extname(file).toLowerCase()) &&
    basename(file).toUpperCase() !== 'LICENSE'
  )
    return content;
  return Buffer.from(utf8.decode(content).replace(/\r\n?/g, '\n'), 'utf8');
}

export async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : [resolve(directory, entry.name)],
      ),
    )
  ).flat();
}

export async function sourceFingerprint(root, inputs) {
  const entries = inputs.map((file) => ({
    file,
    name: relative(root, file).split(sep).join('/'),
  }));
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const hash = createHash('sha256');
  for (const { file, name } of entries) {
    hash
      .update(name)
      .update('\0')
      .update(canonicalFileBytes(file, await readFile(file)))
      .update('\0');
  }
  return hash.digest('hex');
}

export async function normalizeGeneratedText(directory) {
  for (const file of await files(directory)) {
    const original = await readFile(file);
    const normalized = canonicalFileBytes(file, original);
    if (!original.equals(normalized)) await writeFile(file, normalized);
  }
}
