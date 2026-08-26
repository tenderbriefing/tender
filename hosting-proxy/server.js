/**
 * Edge proxy for Firebase Hosting → production Cloud Run (africa-south1).
 * Deploy only to a Firebase Hosting–supported region (europe-west1).
 * Scheduler and direct ops should keep using the africa-south1 URL.
 *
 * IMPORTANT: Firebase Hosting CDN honors upstream Cache-Control. Next.js static
 * pages default to s-maxage=31536000, which pins stale HTML (and deleted JS chunk
 * hashes) in the CDN after deploys → client "Application error". This proxy
 * shortens Cache-Control for HTML documents while leaving hashed assets immutable.
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const upstreamBase =
  process.env.UPSTREAM_URL || 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app';
const upstream = new URL(upstreamBase);
const port = Number(process.env.PORT || 8080);

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function isHashedStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico|map)$/i.test(pathname)
  );
}

function isHtmlLike(contentType, pathname) {
  if (contentType && /text\/html/i.test(contentType)) return true;
  if (isHashedStaticAsset(pathname)) return false;
  if (pathname.startsWith('/api/')) return false;
  // App routes / RSC navigations without an extension
  return !pathname.includes('.');
}

function proxyRequest(clientReq, clientRes) {
  const target = new URL(clientReq.url || '/', upstreamBase);
  const headers = { ...clientReq.headers, host: upstream.host };

  for (const key of hopByHop) {
    delete headers[key];
  }

  // Ask upstream for a fresh copy when possible.
  headers['cache-control'] = 'no-cache';
  headers['pragma'] = 'no-cache';

  const options = {
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port || 443,
    method: clientReq.method,
    path: `${target.pathname}${target.search}`,
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers };
    const contentType = String(resHeaders['content-type'] || '');
    const pathname = target.pathname || '/';

    if (pathname.startsWith('/api/')) {
      // Never let Firebase Hosting CDN cache API responses — authenticated 404s
      // from IDOR denials must not poison later authorized GETs to the same path.
      resHeaders['cache-control'] = 'private, no-store, no-cache, must-revalidate'
      delete resHeaders['expires']
      delete resHeaders['etag']
    } else if (isHtmlLike(contentType, pathname)) {
      // Prevent Firebase Hosting CDN from pinning HTML for a year across deploys.
      resHeaders['cache-control'] =
        'public, max-age=0, s-maxage=0, must-revalidate';
      delete resHeaders['expires'];
    } else if (pathname.startsWith('/_next/static/')) {
      resHeaders['cache-control'] = 'public, max-age=31536000, immutable';
    }

    clientRes.writeHead(proxyRes.statusCode || 502, resHeaders);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('Upstream error:', err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'content-type': 'text/plain' });
    }
    clientRes.end('Bad gateway: upstream unavailable');
  });

  clientReq.pipe(proxyReq);
}

const server = http.createServer(proxyRequest);
server.listen(port, () => {
  console.log(`Hosting proxy listening on ${port} → ${upstreamBase}`);
});
