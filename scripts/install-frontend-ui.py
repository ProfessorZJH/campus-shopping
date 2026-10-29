#!/usr/bin/env python3
"""把新版三页 Vue 3 UI 同步到 Spring Boot 同源 static。
无需 npm，方便离线预览。真实生产发布前仍应执行 API 与安全验收。
不删除原静态资源，不影响 Java 后端源码。
"""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
UI=ROOT/'frontend'
DEST=ROOT/'campus-shopping-app/src/main/resources/static'
FILES=['ui.bundle.js']
DIRS=['src','vendor','images']

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    old_entry=DEST/'index.html'
    if old_entry.exists() and not (DEST/'legacy.html').exists() and 'ui.bundle.js' not in old_entry.read_text(encoding='utf-8'):
        shutil.copy2(old_entry,DEST/'legacy.html')
    for name in FILES:shutil.copy2(UI/name,DEST/name)
    # Spring同源入口使用已预编译render，不依赖运行时unsafe-eval。
    shutil.copy2(UI/'offline.html',DEST/'index.html')
    for name in DIRS:
        out=DEST/name
        if out.exists():shutil.rmtree(out)
        shutil.copytree(UI/name,out)
    print('Vue 3 UI 已同步到:',DEST)
    print('离线预览: python -m http.server 4179 --directory '+str(DEST))
    print('浏览器访问: http://127.0.0.1:4179/?demo=1#/')
    print('正式后端模式: http://127.0.0.1:8091/#/')
if __name__=='__main__':main()
