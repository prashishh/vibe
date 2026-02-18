const express = require('express');
const fs = require('fs/promises');
const path = require('path');

/**
 * Resolve the path to .vibe/GUARDS.md
 * Uses VIBE_GUARDS_PATH env var if set, otherwise .vibe/GUARDS.md relative to project root.
 */
function resolveGuardsPath() {
  if (process.env.VIBE_GUARDS_PATH) {
    return path.resolve(process.env.VIBE_GUARDS_PATH);
  }
  const projectRoot = process.env.VIBE_PROJECT_PATH || process.cwd();
  return path.resolve(projectRoot, '.vibe/GUARDS.md');
}

function createGuardsRouter() {
  const router = express.Router();

  // GET /api/guards — read GUARDS.md content
  router.get('/', async (req, res) => {
    try {
      const filePath = resolveGuardsPath();
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch {
        // File doesn't exist yet — return empty
      }
      return res.json({ content });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/guards — write GUARDS.md content
  router.put('/', async (req, res) => {
    try {
      const content = String(req.body?.content ?? '');
      const filePath = resolveGuardsPath();

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');

      return res.json({ ok: true, path: filePath });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/guards/generate — format and append a new guard from plain text fields
  router.post('/generate', async (req, res) => {
    try {
      const { name, contract, invariants, layer, risk } = req.body || {};

      if (!name || !contract) {
        return res.status(400).json({ error: 'Guard name and contract are required.' });
      }

      const filePath = resolveGuardsPath();

      // Read existing content
      let existing = '';
      try {
        existing = await fs.readFile(filePath, 'utf8');
      } catch {
        // File doesn't exist yet
      }

      // Determine next guard ID
      const idPattern = /##\s*G-(\d+):/g;
      let maxNum = 0;
      let match;
      while ((match = idPattern.exec(existing)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
      const nextId = `G-${String(maxNum + 1).padStart(2, '0')}`;

      // Format the new guard block
      const newBlock = [
        '',
        `## ${nextId}: ${name.trim()}`,
        `- **Contract**: ${contract.trim()}`,
        `- **Invariants**: ${(invariants || 'TBD').trim()}`,
        `- **Layer**: ${(layer || 'API').trim()}`,
        `- **Risk if broken**: ${(risk || 'Medium').trim()}`,
        '',
      ].join('\n');

      // Append to existing
      let fullContent = existing || '';
      if (!fullContent.trim()) {
        fullContent = '# Guards\n';
      }
      fullContent = fullContent.trimEnd() + '\n' + newBlock;

      // Write back
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, fullContent, 'utf8');

      return res.json({
        ok: true,
        content: fullContent,
        newGuard: { id: nextId, name: name.trim() },
        path: filePath,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createGuardsRouter;
