import http from 'node:http';
import fs from 'node:fs';

// 固定测试桩：只服务 127.0.0.1 随机端口；收全请求体后写捕获文件，再按 reply 文件回复。
const [, , replyPath, bodyPath] = process.argv;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    fs.writeFileSync(bodyPath, Buffer.concat(chunks));
    let reply = { status: 500, body: '' };
    try {
      reply = JSON.parse(fs.readFileSync(replyPath, 'utf8'));
    } catch {
      reply = { status: 500, body: '' };
    }
    const body = Buffer.from(typeof reply.body === 'string' ? reply.body : '', 'utf8');
    // SDK 的 Response.isOK() 还要求 X-Reqid 非空；固定 fake 值，不放宽生产判定。
    res.writeHead(Number(reply.status) || 500, {
      'Content-Type': 'application/json',
      'X-Reqid': 'fake-reqid',
    });
    res.end(body);
  });
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(String(server.address().port) + '\n');
});
