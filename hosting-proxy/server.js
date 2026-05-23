/**
 * Edge proxy for Firebase Hosting → production Cloud Run (africa-south1).
 * Deploy only to a Firebase Hosting–supported region (europe-west1).
 * Scheduler and direct ops should keep using the africa-south1 URL.
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

function proxyRequest(clientReq, clientRes) {
  const target = new URL(clientReq.url || '/', upstreamBase);
  const headers = { ...clientReq.headers, host: upstream.host };

  for (const key of hopByHop) {
    delete headers[key];
  }

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
