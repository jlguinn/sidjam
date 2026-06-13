// CloudFront simulator for local verification (task 483): serves www/ as the
// S3 origin (index.html at /) and routes /dbcontrol/* into the Lambda handler
// in-process. The browser sees exactly the request surface production will have.
//
//   SIDJAM_TABLE=sidjam DDB_ENDPOINT=http://localhost:8001 \
//   CATALOG_PATH=../www/catalog/sidtunes.json MAIL_MODE=local \
//   node static_server.mjs    (port 9091, WWW_ROOT to override webroot)
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { handler } from '../src/handler.mjs';

const PORT = parseInt(process.env.PORT ?? '9091');
const ROOT = process.env.WWW_ROOT ?? new URL('../../www', import.meta.url).pathname;

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.wasm': 'application/wasm', '.sid': 'application/octet-stream',
};

const server = http.createServer(async (req, res) => {
    const [rawPath, rawQueryString = ''] = req.url.split('?');

    if (rawPath.startsWith('/dbcontrol/')) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const out = await handler({
            rawPath, rawQueryString,
            headers: req.headers,
            cookies: req.headers.cookie ? req.headers.cookie.split(/;\s*/) : [],
            body: Buffer.concat(chunks).toString('utf8'),
            isBase64Encoded: false,
            requestContext: { http: { method: req.method } },
        });
        const headers = { ...out.headers };
        if (out.cookies?.length) headers['Set-Cookie'] = out.cookies;
        res.writeHead(out.statusCode ?? 200, headers);
        return res.end(out.body ?? '');
    }

    let file = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, '');
    if (file === '/' || file === '/index.php') file = '/index.html';
    const full = join(ROOT, file);
    if (!full.startsWith(ROOT) || !existsSync(full) || !statSync(full).isFile()) {
        res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(full)] ?? 'application/octet-stream' });
    createReadStream(full).pipe(res);
});

server.listen(PORT, () => console.log(`static+lambda on :${PORT} (root ${ROOT})`));
