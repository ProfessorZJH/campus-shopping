#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
base="$project_root/.agents/skills"
dest="$base/xfg-ddd-skills"
if [[ -e "$dest" ]]; then
  echo "Skill already exists, refusing to overwrite: $dest" >&2
  exit 1
fi
command -v git >/dev/null || { echo 'Git is required' >&2; exit 1; }
mkdir -p "$base"
tmp="$(mktemp -d "$base/.xfg-ddd-skills.tmp.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
# A local file:// override exists for offline installer tests; real usage always clones upstream.
repo="${XFG_DDD_SKILL_SOURCE:-https://github.com/fuzhengwei/xfg-ddd-skills.git}"
git clone --depth 1 "$repo" "$tmp/repo"
head="$(git -C "$tmp/repo" rev-parse HEAD)"
python3 - "$tmp/repo/SKILL.md" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); src=p.read_text(encoding='utf-8')
m=re.match(r'\A---\r?\n.*?\r?\n---\r?\n',src,flags=re.S)
if not m: raise SystemExit('Invalid upstream SKILL.md')
front='---\nname: xfg-ddd-skills\ndescription: Apply XiaoFuGe DDD domain modeling, aggregates, Repository/Port, Case and Trigger conventions when building this Java Spring Boot project.\n---\n'
p.write_text(front+src[m.end():],encoding='utf-8')
PY
rm -rf "$tmp/repo/.git"
mv "$tmp/repo" "$dest"
echo "Installed to: $dest"
echo "Upstream commit: $head"
