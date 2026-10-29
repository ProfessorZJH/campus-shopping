#!/usr/bin/env python3
"""发布静态一致性检查：真实JDK语法树、内部接口、Mapper类型、DDL字段和文档链接。
这里不加载Spring/MyBatis，也不把检查结果当作完整Maven编译或数据库测试。
"""
import ast,datetime,json,re,subprocess,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
errors=[];counts={}
def need(condition,message):
    if not condition:errors.append(message)

def main():
    with tempfile.TemporaryDirectory(prefix='campus-source-index-') as temp:
        subprocess.run(['javac','--release','17','-d',temp,str(ROOT/'scripts/SourceIndex.java')],check=True)
        output=subprocess.check_output(['java','-cp',temp,'SourceIndex',str(ROOT)],text=True,encoding='utf-8')
    classes={};imports={};methods={};fields={}
    for line in output.splitlines():
        a=line.split('|')
        if a[0]=='C':classes[a[1]]={'kind':a[2],'flags':a[3],'implements':a[4].split(',') if a[4] else []}
        elif a[0]=='I':imports.setdefault(a[1],[]).append((a[2]=='true',a[3]))
        elif a[0]=='M':methods.setdefault(a[1],set()).add((a[2],int(a[3])))
        elif a[0]=='F':fields.setdefault(a[1],set()).add(a[2])
        elif a[0]=='FILES':counts['javaSyntaxFiles']=int(a[1])
    for name,values in imports.items():
        for static,imp in values:
            if not imp.startswith('cn.bugstack.ai.'):continue
            target=imp
            if target.endswith('.*'):
                target=target[:-2]
                need(target in classes or any(c.startswith(target+'.') for c in classes),name+' 引用不存在的包 '+imp)
            else:
                if static:target=target.rsplit('.',1)[0]
                need(target in classes or any(target.startswith(c+'.') for c in classes),name+' 引用不存在的类 '+imp)
            if '.domain.' in name:
                need(not any(p in imp for p in ('.infrastructure.','.trigger.','.cases.','.api.')),name+' 违反领域依赖方向 '+imp)
    def resolve(owner,raw):
        raw=re.sub(r'<.*>','',raw).strip()
        if raw in classes:return raw
        same=owner.rsplit('.',1)[0]+'.'+raw
        if same in classes:return same
        for static,imp in imports.get(owner,[]):
            if static:continue
            if imp.endswith('.'+raw):return imp
            if imp.endswith('.*') and imp[:-1]+raw in classes:return imp[:-1]+raw
        return None
    implemented=set();checked=0
    for name,info in classes.items():
        if info['kind']=='INTERFACE' or 'abstract' in info['flags']:continue
        for raw in info['implements']:
            target=resolve(name,raw)
            if target not in classes:continue
            implemented.add(target)
            required={x for x in methods.get(target,set()) if x[0]!='<init>'}
            need(required<=methods.get(name,set()),name+' 缺少接口方法 '+str(required-methods.get(name,set())))
            checked+=1
    counts['internalInterfaceImplementations']=checked
    for name in classes:
        if name.startswith('cn.bugstack.ai.api.I') and name.endswith('Api'):need(name in implemented,name+' 没有Trigger实现')
    schema=(ROOT/'campus-shopping-app/src/main/resources/schema.sql').read_text()
    tables={}
    for name,body in re.findall(r'CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\((.*?)\)\s*ENGINE',schema,re.S|re.I):
        parts=[];level=0;start=0
        for i,char in enumerate(body):
            if char=='(':level+=1
            elif char==')':level-=1
            elif char==',' and level==0:parts.append(body[start:i]);start=i+1
        parts.append(body[start:]);columns=set()
        for part in parts:
            match=re.match(r'\s*`?(\w+)`?\s+',part)
            if match and match.group(1).upper() not in {'PRIMARY','UNIQUE','KEY','INDEX','CONSTRAINT','CHECK','FOREIGN'}:columns.add(match.group(1))
        tables[name]=columns
    counts['schemaTables']=len(tables)
    mappers=list(ROOT.glob('campus-shopping-app/src/main/resources/mybatis/mapper/*.xml'));counts['mybatisMapperFiles']=len(mappers)
    for path in mappers:
        root=ET.parse(path).getroot();namespace=root.get('namespace');need(namespace in classes,str(path)+' 无对应DAO '+str(namespace))
        ids={n.get('id') for n in root if n.tag in {'select','insert','update','delete'}}
        declared={n for n,a in methods.get(namespace,set()) if n!='<init>'}
        need(ids==declared,str(path)+' DAO/XML方法不一致 '+str(ids^declared))
        for el in root.iter():
            for key in ('type','resultType','parameterType'):
                value=el.get(key)
                if value and value.startswith('cn.bugstack.'):need(value in classes,str(path)+' 无对应Java类型 '+value)
            if el.tag=='resultMap':
                for field in el:
                    if field.get('property'):need(field.get('property') in fields.get(el.get('type'),set()),str(path)+' 错误结果映射 '+field.get('property'))
        for el in root:
            sql=' '.join(el.itertext());need('${' not in sql,str(path)+' 含原始SQL字符串插值')
            for table,columns in re.findall(r'INSERT(?:\s+IGNORE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)',sql,re.I):
                need(table in tables,str(path)+' 插入未知表 '+table)
                for col in columns.split(','):need(col.strip().strip('`') in tables.get(table,set()),str(path)+' 插入未知列 '+table+'.'+col)
            table_sql=re.sub(r'ON\s+DUPLICATE\s+KEY\s+UPDATE.*','',sql,flags=re.I|re.S)
            for table in re.findall(r'(?:FROM|JOIN|UPDATE|INTO)\s+([a-z][a-z_0-9]+)',table_sql,re.I):
                if table.lower() in {'set','select','user_id','id','status','application_id','code'}:continue
                # recent 是消息子查询别名，不是实体表。
                if table=='recent':continue
                need(table in tables,str(path)+' 引用未知数据表 '+table)
    poms=list(ROOT.glob('**/pom.xml'));counts['mavenPomFiles']=len(poms)
    for p in poms:ET.parse(p)
    for p in ROOT.rglob('*.py'):
        if 'target' not in p.parts and '__pycache__' not in p.parts:ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
    for p in ROOT.rglob('*.md'):
        if 'target' in p.parts or '.git' in p.parts:continue
        text=p.read_text(encoding='utf-8')
        need(sum(1 for line in text.splitlines() if line.startswith('```'))%2==0,str(p)+' 代码围栏不配对')
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            if link.startswith(('https:','http:','mailto:','#','file:')):continue
            dest=link.split('#')[0]
            if dest:need((p.parent/dest).exists(),str(p)+' 文档链接缺失 '+dest)
    need(not list(ROOT.glob('**/GlobalExceptionHandler.java')),'意外新增全局业务异常处理器')
    need(not list(ROOT.glob('**/IPasswordHasherPort.java')),'密码本地处理被错误定义为远程Port')
    report={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'type':'STATIC_SOURCE_AND_CONTRACT_ONLY','status':'PASS' if not errors else 'FAIL','counts':counts,'errors':errors,'mavenCompiled':False,'springMySqlTested':False}
    out=ROOT/'docs/testing/evidence/static-release.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if errors:raise SystemExit(1)

if __name__=='__main__':main()