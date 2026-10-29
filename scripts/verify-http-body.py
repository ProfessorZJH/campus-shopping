#!/usr/bin/env python3
"""编译原始生产 HTTP 响应订阅器，使用真实 JDK 本地 HTTP 检查大小和完整响应超时。"""
from pathlib import Path
import subprocess,tempfile,json
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/gateway/BoundedHttpBodySubscriber.java'
with tempfile.TemporaryDirectory(prefix='campus-http-check-') as out:
    subprocess.run(['javac','--release','17','--add-modules','jdk.httpserver','-encoding','UTF-8','-d',out,str(source),str(ROOT/'scripts/verification/HttpBodyCheck.java')],check=True)
    result=subprocess.run(['java','-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','--add-modules','jdk.httpserver','-cp',out,'HttpBodyCheck'],capture_output=True,text=True,encoding='utf-8',check=True,timeout=15)
    print(result.stdout)
    checks=[line[5:] for line in result.stdout.splitlines() if line.startswith('PASS ')]
    path=ROOT/'docs/testing/evidence/java-http-body.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({'timestamp':datetime.now(timezone.utc).isoformat(),'status':'PASS','checks':checks,'productionSubscriberCompiledUnchanged':True,'realLoopbackHttp':True,'fullSpringGatewayTested':False},ensure_ascii=False,indent=2),encoding='utf-8')