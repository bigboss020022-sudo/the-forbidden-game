const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const host = process.env.PREVIEW_HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 4173;
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  const isPublicAsset = filePath.startsWith(path.join(root, 'assets') + path.sep);
  const isPublicEntry = ['index.html', 'app.js', 'styles.css'].includes(relativePath);
  if (!filePath.startsWith(root + path.sep) || (!isPublicAsset && !isPublicEntry)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  });
}).listen(port, host, () => {
  process.stdout.write(`The Forbidden beta preview: http://${host}:${port}/?betaTest=1\n`);
  if (host === '0.0.0.0') {
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) {
          process.stdout.write(`Phone preview (same Wi-Fi): http://${address.address}:${port}/?betaTest=1\n`);
        }
      }
    }
  }
});

