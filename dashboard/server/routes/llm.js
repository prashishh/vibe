const express = require('express');
const { readConfig, writeConfig } = require('../services/llm-config');
const { LLMClient } = require('../llm/client');
const { probeRunner } = require('../execution/runner');

function createLLMRouter() {
  const router = express.Router();

  router.get('/config', async (req, res) => {
    try {
      const config = await readConfig({ withSecrets: false });
      res.json({ config });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/config', async (req, res) => {
    try {
      const config = req.body;
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ error: 'Invalid configuration payload' });
      }

      const saved = await writeConfig(config);
      return res.json({ config: saved });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/test', async (req, res) => {
    try {
      const profile = String(req.body?.profile || 'planning');
      const config = await readConfig({ withSecrets: true });
      const profileConfig = config.llms?.[profile];

      if (!profileConfig) {
        return res.status(404).json({ error: `Profile not found: ${profile}` });
      }

      const client = new LLMClient(profileConfig);
      const result = await client.testConnection();
      return res.json({ profile, result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/test-runner', async (req, res) => {
    try {
      const runner = String(req.body?.runner || '').trim();
      if (!runner) {
        return res.status(400).json({ error: 'Runner name is required' });
      }

      const result = await probeRunner(runner);
      return res.json({ runner, result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createLLMRouter;
