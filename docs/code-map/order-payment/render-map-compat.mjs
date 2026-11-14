// Adapt the upstream renderer's filter check for a map of existing code.
// The check still requires one visible card, one hidden card, and restoration.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const renderer = path.join(codexHome, 'skills', 'xfg-coding-map-skills', 'scripts', 'render-map.mjs');
let source = fs.readFileSync(renderer, 'utf8');

function replaceOnce(before, after) {
  const start = source.indexOf(before);
  if (start < 0 || source.indexOf(before, start + before.length) >= 0) {
    throw new Error('Unexpected upstream renderer version; review the compatibility check.');
  }
  source = source.slice(0, start) + after + source.slice(start + before.length);
}

replaceOnce(
  `const chip=document.querySelector('.dchip[data-f]:not([data-f="all"])');`,
  `const docs=[...document.querySelectorAll('.doc')];
      const chip=[...document.querySelectorAll('.dchip[data-f]:not([data-f="all"])')]
        .find(c=>docs.some(d=>d.dataset.b===c.dataset.f)&&docs.some(d=>d.dataset.b!==c.dataset.f));`,
);
replaceOnce(
  `if(!chip)return {ok:true,skipped:true};`,
  `if(!chip)return {ok:false,reason:'No populated filter can separate the cards'};`,
);
// outerHTML serializes HTML <br> elements without closing tags, which is invalid in SVG XML.
replaceOnce('c.outerHTML', 'new XMLSerializer().serializeToString(c)');

const temporaryScript = path.join(os.tmpdir(), `code-map-render-${randomUUID()}.mjs`);
fs.writeFileSync(temporaryScript, source, {encoding: 'utf8', flag: 'wx'});
try {
  const result = spawnSync(process.execPath, [temporaryScript, ...process.argv.slice(2)], {stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.unlinkSync(temporaryScript);
}
