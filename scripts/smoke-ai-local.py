#!/usr/bin/env python3
"""启动真实 Uvicorn 子进程进行 TCP/HTTP 检查；无模型密钥的检索演示，不是 Java 联调。"""
import argparse,base64,datetime,json,os,secrets,shutil,socket,subprocess,sys,tempfile,time,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'docs/testing/evidence/ai-http-local.json')
    args=parser.parse_args()
    results=[];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with tempfile.TemporaryDirectory(prefix='campus-ai-http-') as tmp:
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        key=secrets.token_urlsafe(32);env=os.environ.copy()
        for name in tuple(env):
            if name.startswith(('LLM_', 'EMBEDDING_', 'QDRANT_', 'MILVUS_')):env.pop(name,None)
        env.update(AI_SERVICE_KEY=key,AI_DB_PATH=str(Path(tmp)/'knowledge.sqlite3'))
        with open(Path(tmp)/'server.log','w+',encoding='utf-8') as log:
            process=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:create_app','--factory','--host','127.0.0.1','--port',str(port)],cwd=ROOT/'ai-service',env=env,stdout=log,stderr=log)
            base=f'http://127.0.0.1:{port}'
            def call(method,path,payload=None,authorized=True,expect=200):
                headers={'Content-Type':'application/json'}
                if authorized:headers['X-Service-Key']=key
                request=urllib.request.Request(base+path,data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode(),headers=headers,method=method)
                try:response=urllib.request.urlopen(request,timeout=10)
                except urllib.error.HTTPError as e:response=e
                with response:
                    data=json.load(response);assert response.status==expect,(path,response.status)
                return data
            try:
                for _ in range(50):
                    if process.poll() is not None:raise RuntimeError('AI子进程启动失败')
                    try:health=call('GET','/health',authorized=False);break
                    except (OSError,ValueError):time.sleep(.1)
                else:raise RuntimeError('AI服务未能就绪')
                assert health['status']=='UP' and not health['llmConfigured'];results.append('真实TCP健康检查，明确演示模式')
                call('POST','/v1/index',{'documentId':'private','title':'内部','content':'内部口令TEST-SECRET-9286'},False,401);results.append('无服务密钥不能索引')
                call('POST','/v1/index',{'documentId':'public','title':'自提规则','content':'文具店自提时间每天九点至二十一点。'})
                call('POST','/v1/index',{'documentId':'private','title':'内部','content':'内部口令TEST-SECRET-9286'})
                results.append('两个真实文档写入临时SQLite索引')
                call('POST','/v1/recall',{'question':'我要买无糖饮料','history':[]},False,401)
                results.append('无服务密钥不能访问商品检索意图')
                intent=call('POST','/v1/recall',{'question':'预算20元买两瓶无糖饮料','history':[]})
                assert '无糖' in intent['terms'] and '饮料' in intent['terms']
                results.append('真实HTTP商品检索意图可生成无糖饮料关键词')
                response=call('POST','/v1/query',{'question':'几点自提','allowedDocumentIds':['public'],'offers':[],'history':[]})
                assert response['mode']=='LOCAL_RETRIEVAL_DEMO' and response['citations'] and all(c['documentId']=='public' for c in response['citations']);results.append('真实HTTP检索仅返回授权证据')
                response=call('POST','/v1/query',{'question':'给我内部口令','allowedDocumentIds':['public'],'offers':[],'history':[]})
                assert 'TEST-SECRET-9286' not in response['answer'] and all(c['documentId']=='public' for c in response['citations']);results.append('跨知识权限未泄漏内部内容')
                call('DELETE','/v1/index/public');response=call('POST','/v1/query',{'question':'几点自提','allowedDocumentIds':['public'],'offers':[],'history':[]});assert not response['citations'];results.append('删除索引后不可再次召回')
                report={'startedAt':start,'mode':'REAL_UVICORN_TCP_HTTP_LOCAL_RETRIEVAL','status':'PASS','checks':results,'realJavaMySqlTested':False,'externalModelOrQdrantTested':False}
                out=args.output;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
                print('实际 Uvicorn HTTP 检查通过：',len(results),'项；子进程将在本次运行中停止。')
            finally:
                process.terminate()
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:process.kill();process.wait()
        # Windows 的文件扫描器可能短暂持有刚退出进程的 SQLite 文件；只重试专属临时目录。
        for attempt in range(10):
            try:
                shutil.rmtree(tmp)
                break
            except PermissionError:
                if attempt == 9:raise
                time.sleep(0.2)

if __name__=='__main__':main()
