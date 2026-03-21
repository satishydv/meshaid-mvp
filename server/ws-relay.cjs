const http = require('http');
const { WebSocketServer } = require('ws');

const HOST = process.env.MESH_RELAY_HOST || '0.0.0.0';
const PORT = Number(process.env.MESH_RELAY_PORT || 3001);
const PATH = '/mesh-relay';

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MeshAid relay is running.');
});

const wss = new WebSocketServer({ server, path: PATH });

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(raw.toString());
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[meshaid-relay] ws://${HOST}:${PORT}${PATH}`);
});
