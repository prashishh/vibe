const express = require('express');
const { readConfig, writeConfig } = require('../services/llm-config');
const { probeRunner } = require('../execution/runner');

function createLLMRouter() {
  const router = express.Router();

  router.get('/config', async (req, res) => {
    try {
      const config = await readConfig();
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
