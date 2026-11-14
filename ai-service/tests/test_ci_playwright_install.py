"""CI 安装失败时必须保留真实浏览器就绪门禁。"""
import os
from pathlib import Path
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/install-playwright-ci.sh"


def bash_path():
    if os.name == "nt":
        git = shutil.which("git")
        if git:
            candidate = Path(git).resolve().parent.parent / "bin" / "bash.exe"
            if candidate.exists():
                return str(candidate)
    return shutil.which("bash")


@pytest.mark.parametrize("deps_exit,download_exit,smoke_exit,expected,attempts,smoke_calls", [
    (0, 0, 0, 0, 1, 1),
    (1, 0, 0, 0, 2, 1),
    (1, 0, 1, 1, 2, 1),
    (0, 1, 0, 1, 0, 0),
])
def test_installer_preserves_browser_readiness_gate(tmp_path, deps_exit, download_exit, smoke_exit,
                                                    expected, attempts, smoke_calls):
    bash = bash_path()
    if not bash:
        pytest.skip("bash unavailable")
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_python = fake_bin / "python"
    fake_python.write_text("""#!/usr/bin/env bash
printf '%s\\n' "$*" >> calls.log
if [[ "$1" == -m && "$3" == install ]]; then exit "$DOWNLOAD_EXIT"; fi
if [[ "$1" == -m && "$3" == install-deps ]]; then exit "$DEPS_EXIT"; fi
if [[ "$1" == - ]]; then cat >/dev/null; exit "$SMOKE_EXIT"; fi
exit 42
""", encoding="utf-8", newline="\n")
    fake_timeout = fake_bin / "timeout"
    fake_timeout.write_text("#!/usr/bin/env bash\nshift 2\nexec \"$@\"\n", encoding="utf-8", newline="\n")
    fake_python.chmod(0o755)
    fake_timeout.chmod(0o755)
    env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ["PATH"],
               DEPS_EXIT=str(deps_exit), DOWNLOAD_EXIT=str(download_exit), SMOKE_EXIT=str(smoke_exit))
    result = subprocess.run([bash, str(SCRIPT)], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=20)
    assert result.returncode == expected, result.stdout + result.stderr
    calls = (tmp_path / "calls.log").read_text(encoding="utf-8").splitlines()
    assert sum("install-deps" in line for line in calls) == attempts
    assert sum(line == "-" for line in calls) == smoke_calls
