function setupSSE(app, eventBus) {
  app.get('/api/execution/stream/:buildId', (req, res) => {
    const { buildId } = req.params;
    const lastEventId = req.get('Last-Event-ID') || req.query?.lastEventId || '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client = eventBus.addClient(buildId, res);
    eventBus.sendToClient(client, 'connected', { buildId, ok: true }, null);
    const replay = eventBus.replayForClient(client, { lastEventId });
    eventBus.sendToClient(client, 'stream-state', {
      buildId,
      replayedEvents: replay.replayedEvents || 0,
      replayedLogs: replay.replayedLogs || 0,
      lastEventId: eventBus.getLastEventId(buildId),
      serverTime: new Date().toISOString(),
    }, null);

    const heartbeat = setInterval(() => {
      eventBus.sendToClient(client, 'heartbeat', {
        buildId,
        lastEventId: eventBus.getLastEventId(buildId),
        serverTime: new Date().toISOString(),
      }, null);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      eventBus.removeClient(client);
      res.end();
    });
  });
}

module.exports = {
  setupSSE,
};
