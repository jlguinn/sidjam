// Local dev wrapper: serves the Lambda handler on :9090, translating plain
// HTTP to/from the Function URL v2.0 event shape so the handler under test is
// byte-identical to what deploys.
//
//   SIDJAM_TABLE=sidjam DDB_ENDPOINT=http://localhost:8001 \
//   CATALOG_PATH=../www/catalog/sidtunes.json MAIL_MODE=local \
//   node local_server.mjs
import http from 'node:http';
import { handler } from './src/handler.mjs';

const PORT = parseInt(process.env.PORT ?? '9090');

const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');
    const [rawPath, rawQueryString = ''] = req.url.split('?');

    const event = {
        rawPath,
        rawQueryString,
        headers: req.headers,
        cookies: req.headers.cookie ? req.headers.cookie.split(/;\s*/) : [],
        body,
        isBase64Encoded: false,
        requestContext: { http: { method: req.method } },
    };

    try {
        const out = await handler(event);
        const headers = { ...out.headers };
        if (out.cookies?.length) headers['Set-Cookie'] = out.cookies;
        res.writeHead(out.statusCode ?? 200, headers);
        res.end(out.body ?? '');
    } catch (e) {
        console.error(e);
        res.writeHead(500).end('local server error');
    }
});

server.listen(PORT, () => console.log(`sidjam lambda local on :${PORT}`));
