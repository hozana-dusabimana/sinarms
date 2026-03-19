const http = require('http');
const { Server } = require('socket.io');
const { port, corsOrigin } = require('./config');
const { initStore } = require('./data/store');
const { createApp } = require('./app');
const { setIO } = require('./services/realtime');

async function startServer() {
  await initStore();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  setIO(io);

  io.on('connection', (socket) => {
    socket.emit('system:ready', { connected: true });
  });

  server.listen(port, () => {
    console.log(`SINARMS backend listening on http://localhost:${port}`);
  });

  return server;
}

if (process.argv.includes('--check')) {
  (async () => {
    try {
      await initStore();
      createApp();
      console.log('Backend configuration check passed.');
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
} else if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
