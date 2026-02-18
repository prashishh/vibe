function setupSSE(app, eventBus) {
  app.get('/api/execution/stream/:buildId', (req, res) => {
    const { buildId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client = eventBus.addClient(buildId, res);

    res.write(`event: connected\ndata: ${JSON.stringify({ buildId, ok: true })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
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
