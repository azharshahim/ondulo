// Petit serveur statique de dev pour les tests navigateur.
// Sert `dist/` sous le préfixe demandé (ex. /ondulo).
// Usage : tsx tools/serve-dist.ts <prefix> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const prefix = (process.argv[2] ?? '/ondulo').replace(/\/$/, '');
const port = Number(process.argv[3] ?? 4173);
const root = join(process.cwd(), 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (!path.startsWith(prefix)) {
      // Hors préfixe : 404 explicite (on ne veut pas de faux positif).
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found (outside baseUrl prefix)');
      return;
    }
    path = path.slice(prefix.length) || '/';
    if (path === '/') path = '/index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`error: ${(e as Error).message}`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`dist servi sur http://localhost:${port}${prefix}/`);
});
