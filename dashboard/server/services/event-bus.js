const fs = require('fs');
const path = require('path');
const { resolveBuildsRoot } = require('./tasks-store');

const MAX_RECENT_EVENTS_PER_BUILD = 2000;
const MAX_REPLAY_LOG_LINES = 20000;

class EventBus {
  constructor() {
    this.clients = new Set();
    this.nextId = 1;
    this.eventSeqByBuild = new Map();
    this.recentByBuild = new Map();
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

  sendToClient(client, event, payload, eventId = null) {
    if (!client || !client.res) return false;

    const message = this._formatSseMessage(event, payload, eventId);
    try {
      client.res.write(message);
      return true;
    } catch {
      this.removeClient(client);
      return false;
    }
  }

  replayForClient(client, { lastEventId } = {}) {
    if (!client) return { replayedEvents: 0, replayedLogs: 0 };

    const buildId = client.buildId;
    const parsedLastEventId = this._parseEventId(lastEventId);
    const recent = this.recentByBuild.get(buildId) || [];
    let replayedEvents = 0;
    let replayedLogs = 0;

    if (parsedLastEventId !== null) {
      for (const item of recent) {
        if (item.id <= parsedLastEventId) continue;
        if (this.sendToClient(client, item.event, item.payload, item.id)) {
          replayedEvents += 1;
        }
      }
      return { replayedEvents, replayedLogs };
    }

    replayedLogs = this._replayPersistedLogs(client);

    if (replayedLogs === 0) {
      for (const item of recent) {
        if (this.sendToClient(client, item.event, item.payload, item.id)) {
          replayedEvents += 1;
        }
      }
      return { replayedEvents, replayedLogs };
    }

    // Logs were loaded from disk; replay non-log events from memory so UI can catch state changes.
    for (const item of recent) {
      if (item.event === 'execution-log') continue;
      if (this.sendToClient(client, item.event, item.payload, item.id)) {
        replayedEvents += 1;
      }
    }
    return { replayedEvents, replayedLogs };
  }

  removeClient(client) {
    this.clients.delete(client);
    console.log(`[EventBus] Client #${client.id} disconnected for build=${client.buildId} (total clients: ${this.clients.size})`);
  }

  broadcast(buildId, event, payload) {
    const eventId = this._nextEventId(buildId);
    this._storeRecent(buildId, {
      id: eventId,
      event,
      payload,
    });

    let matched = 0;
    for (const client of this.clients) {
      if (client.buildId === buildId) {
        if (this.sendToClient(client, event, payload, eventId)) {
          matched++;
        }
      }
    }

    if (event === 'execution-log') {
      const snippet = String(payload?.message || '').slice(0, 80);
      console.log(`[EventBus] broadcast build=${buildId} event=${event} clients=${matched}/${this.clients.size} msg="${snippet}"`);
    }

    // Persist execution-log events to disk for resilience across page refreshes
    if (event === 'execution-log' && buildId && payload && payload.message !== undefined && payload.message !== null) {
      this._appendLog(buildId, payload);
    }
  }

  heartbeat() {
    const message = 'event: heartbeat\ndata: {}\n\n';
    for (const client of this.clients) {
      try {
        client.res.write(message);
      } catch {
        this.removeClient(client);
      }
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
      fs.mkdirSync(dir, { recursive: true });
      const logFile = path.join(dir, 'LOG.jsonl');
      const entry = {
        ts: payload.timestamp || new Date().toISOString(),
        stream: payload.stream || 'log',
        taskId: payload.taskId || null,
        message: String(payload.message || ''),
      };
      // Non-blocking append
      fs.appendFile(logFile, JSON.stringify(entry) + '\n', 'utf8', () => {});
    } catch {
      // Silently ignore — log persistence is best-effort
    }
  }

  _nextEventId(buildId) {
    const current = this.eventSeqByBuild.get(buildId) || 0;
    const next = current + 1;
    this.eventSeqByBuild.set(buildId, next);
    return next;
  }

  _storeRecent(buildId, item) {
    const recent = this.recentByBuild.get(buildId) || [];
    recent.push(item);

    if (recent.length > MAX_RECENT_EVENTS_PER_BUILD) {
      recent.splice(0, recent.length - MAX_RECENT_EVENTS_PER_BUILD);
    }

    this.recentByBuild.set(buildId, recent);
  }

  _parseEventId(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  _formatSseMessage(event, payload, eventId = null) {
    const parts = [];
    if (eventId !== null && eventId !== undefined) {
      parts.push(`id: ${eventId}`);
    }
    parts.push(`event: ${event}`);
    parts.push(`data: ${JSON.stringify(payload)}`);
    parts.push('');
    return `${parts.join('\n')}\n`;
  }

  _replayPersistedLogs(client) {
    try {
      const logFile = path.join(resolveBuildsRoot(), client.buildId, 'LOG.jsonl');
      if (!fs.existsSync(logFile)) return 0;

      const raw = fs.readFileSync(logFile, 'utf8');
      if (!raw.trim()) return 0;

      const lines = raw.split('\n').filter(Boolean);
      const tail = lines.slice(-MAX_REPLAY_LOG_LINES);
      let sent = 0;

      for (const line of tail) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        const payload = {
          buildId: client.buildId,
          taskId: entry.taskId || null,
          stream: entry.stream || 'log',
          message: String(entry.message || ''),
          timestamp: entry.ts || new Date().toISOString(),
        };

        if (this.sendToClient(client, 'execution-log', payload, null)) {
          sent += 1;
        }
      }

      return sent;
    } catch {
      return 0;
    }
  }
}

module.exports = new EventBus();
