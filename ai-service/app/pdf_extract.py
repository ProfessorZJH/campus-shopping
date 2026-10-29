"""独立进程解析文本 PDF；拒绝加密/超长文件，不执行附件、脚本或 OCR。"""
import io,json,sys
try:
    import resource
    resource.setrlimit(resource.RLIMIT_AS,(384*1024*1024,384*1024*1024))
    resource.setrlimit(resource.RLIMIT_CPU,(5,5))
except ImportError:pass
from pypdf import PdfReader
try:
    raw=sys.stdin.buffer.read(2_000_001)
    if len(raw)>2_000_000:raise ValueError('文件过大')
    reader=PdfReader(io.BytesIO(raw),strict=True)
    if reader.is_encrypted or len(reader.pages)>50:raise ValueError('仅支持未加密且不超过50页的文本PDF')
    texts=[];total=0
    for page in reader.pages:
        text=page.extract_text() or '';total+=len(text)
        if total>100000:raise ValueError('提取文字超过100000字符')
        texts.append(text)
    text='\n'.join(texts).strip()
    if not text:raise ValueError('没有可提取文字，扫描件不在本版范围')
    print(json.dumps({'text':text},ensure_ascii=False))
except Exception:
    print(json.dumps({'error':'PDF无法安全解析或不符合文本PDF范围'},ensure_ascii=False));sys.exit(1)
