const http = require('http');
const { Server } = require('socket.io');
const { port, corsOrigin } = require('./config');
const { initStore, getState, mutateState } = require('./data/store');
const { refreshAlerts } = require('./services/engine');
const { createApp } = require('./app');
const { setIO, emit } = require('./services/realtime');

const ALERT_REFRESH_INTERVAL_MS = 60 * 1000;

function alertsChanged(before, after) {
  if (before.length !== after.length) return true;
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function runAlertRefresh() {
  try {
    const currentState = await getState();
    const prospective = refreshAlerts(currentState);
    if (!alertsChanged(currentState.alerts || [], prospective.alerts || [])) {
      return;
    }
    await mutateState((draft) => refreshAlerts(draft));
    emit('alerts:refreshed', { at: new Date().toISOString() });
  } catch (error) {
    console.error('[alerts] refresh failed', error);
  }
}

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

  setInterval(runAlertRefresh, ALERT_REFRESH_INTERVAL_MS).unref();

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
