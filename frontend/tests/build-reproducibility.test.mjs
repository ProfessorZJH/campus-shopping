import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import {
  canonicalFileBytes,
  normalizeGeneratedText,
  sourceFingerprint,
} from '../scripts/build-files.mjs';

async function temporaryDirectory(t) {
  const base = resolve(tmpdir());
  const directory = await mkdtemp(join(base, 'campus-build-files-test-'));
  t.after(async () => {
    assert.equal(dirname(directory), base);
    assert.ok(basename(directory).startsWith('campus-build-files-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('text fingerprints use LF and normalized relative path order', async (t) => {
  const root = await temporaryDirectory(t);
  await mkdir(join(root, 'src'));
  const first = join(root, 'package.json');
  const second = join(root, 'src', 'page.js');
  await writeFile(first, '{"name":"test"}\r\n');
  await writeFile(second, 'export const title = "校园";\r\n');
  const crlf = await sourceFingerprint(root, [second, first]);
  await writeFile(first, '{"name":"test"}\n');
  await writeFile(second, 'export const title = "校园";\n');
  assert.equal(await sourceFingerprint(root, [first, second]), crlf);
  const expected = createHash('sha256')
    .update('package.json\0{"name":"test"}\n\0')
    .update('src/page.js\0export const title = "校园";\n\0')
    .digest('hex');
  assert.equal(crlf, expected);
});

test('binary bytes are preserved and any byte change alters the fingerprint', async (t) => {
  const root = await temporaryDirectory(t);
  const image = join(root, 'product.webp');
  const bytes = Buffer.from([0xff, 0x00, 0x0d, 0x0a, 0x42]);
  assert.deepEqual(canonicalFileBytes(image, bytes), bytes);
  await writeFile(image, bytes);
  const original = await sourceFingerprint(root, [image]);
  await writeFile(image, Buffer.from([0xff, 0x00, 0x0a, 0x42]));
  assert.notEqual(await sourceFingerprint(root, [image]), original);
});

test('generated files normalize text bytes and preserve binary assets', async (t) => {
  const root = await temporaryDirectory(t);
  await mkdir(join(root, 'assets'));
  const css = join(root, 'assets', 'app.css');
  const license = join(root, 'LICENSE');
  const licenseText = join(root, 'LICENSE.txt');
  const image = join(root, 'assets', 'product.webp');
  const binary = Buffer.from([0x00, 0x0d, 0x0a, 0xff]);
  await writeFile(css, 'body {\r\n  color: red;\r\n}\r\n');
  await writeFile(license, 'MIT License\r\n');
  await writeFile(licenseText, 'MIT License\r\n');
  await writeFile(image, binary);
  await normalizeGeneratedText(root);
  assert.equal(await readFile(css, 'utf8'), 'body {\n  color: red;\n}\n');
  assert.equal(await readFile(license, 'utf8'), 'MIT License\n');
  assert.equal(await readFile(licenseText, 'utf8'), 'MIT License\n');
  assert.deepEqual(await readFile(image), binary);
  await normalizeGeneratedText(root);
  assert.equal(await readFile(css, 'utf8'), 'body {\n  color: red;\n}\n');
});
