const fs = require('fs');
const path = require('path');

function resolveBuildsRoot() {
  const projectRoot = process.env.VIBE_PROJECT_PATH || process.cwd();
  return path.join(projectRoot, '.vibe', 'builds');
}

class EventBus {
  constructor() {
    this.clients = new Set();
    this.nextId = 1;
  }

  addClient(buildId, res) {
    const client = {
      id: this.nextId,
      buildId,
      res,
    };

    this.nextId += 1;
    this.clients.add(client);
    console.log(`[EventBus] Client #${client.id} connected for build=${buildId} (total clients: ${this.clients.size})`);
    return client;
  }

  removeClient(client) {
    this.clients.delete(client);
    console.log(`[EventBus] Client #${client.id} disconnected for build=${client.buildId} (total clients: ${this.clients.size})`);
  }

  broadcast(buildId, event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

    let matched = 0;
    for (const client of this.clients) {
      if (client.buildId === buildId) {
        client.res.write(message);
        matched++;
      }
    }

    if (event === 'execution-log') {
      const snippet = String(payload?.message || '').slice(0, 80);
      console.log(`[EventBus] broadcast build=${buildId} event=${event} clients=${matched}/${this.clients.size} msg="${snippet}"`);
    }

    // Persist execution-log events to disk for resilience across page refreshes
    if (event === 'execution-log' && buildId && payload?.message) {
      this._appendLog(buildId, payload);
    }
  }

  heartbeat() {
    const message = 'event: heartbeat\ndata: {}\n\n';
    for (const client of this.clients) {
      client.res.write(message);
    }
  }

  /**
   * Append a log entry to .vibe/builds/<buildId>/LOG.jsonl
   * Uses JSONL (one JSON object per line) for easy parsing.
   * Non-blocking — errors are silently ignored to avoid disrupting SSE.
   */
  _appendLog(buildId, payload) {
    try {
      const dir = path.join(resolveBuildsRoot(), buildId);
      const logFile = path.join(dir, 'LOG.jsonl');
      const entry = {
        ts: payload.timestamp || new Date().toISOString(),
        stream: payload.stream || 'log',
        taskId: payload.taskId || null,
        message: String(payload.message || '').trimEnd(),
      };
      // Non-blocking append
      fs.appendFile(logFile, JSON.stringify(entry) + '\n', 'utf8', () => {});
    } catch {
      // Silently ignore — log persistence is best-effort
    }
  }
}

module.exports = new EventBus();
