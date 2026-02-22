'use strict';

/**
 * Parse CLI runner output into streaming deltas for the live output terminal.
 *
 * ## Claude Code (`--output-format stream-json --verbose`)
 *
 * The CLI emits newline-delimited JSON objects covering the full lifecycle:
 *
 *   system           → init (model, tools, session info)
 *   assistant        → message.content[] with text, tool_use, thinking blocks
 *   user             → tool_result (output from tool calls)
 *   tool_use_summary → one-line summary after a tool-use round
 *   result           → final result text + usage/cost
 *   error            → error events
 *
 * We emit EVERY event type as readable text, using the appropriate stream
 * type (stdout, system, log, etc.) so the frontend terminal renders each
 * with distinct colors and formatting — matching what Claude Code shows
 * in its own terminal.
 *
 * ## Codex / Gemini / other runners
 *
 * Raw stdout passthrough — every byte is forwarded as-is.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Runner detection
// ─────────────────────────────────────────────────────────────────────────────

function supportsStreamJson(runnerName) {
  return runnerName === 'claude';
}

function injectStreamFlags(runnerName, cmdArgs) {
  if (!supportsStreamJson(runnerName)) return false;
  if (cmdArgs.includes('--output-format')) return false;

  cmdArgs.push('--output-format', 'stream-json', '--verbose');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a stream transformer that processes child process stdout.
 *
 * Callbacks:
 *   onChunk(text, stream)  — emits text with a stream type for the terminal.
 *                            stream is one of: stdout, stderr, system, log, error, warning, success.
 *   onText(delta)          — LEGACY: still called for backwards compat (always 'stdout').
 *   onResult(fullText)     — called once with the final result text.
 *   onError(message)       — called for error events.
 *
 * If the caller provides `onChunk`, it gets rich stream-type info.
 * If only `onText` is provided, everything goes through it as before.
 */
function createStreamProcessor({ runnerName, isStreamJson, onText, onChunk, onResult, onError }) {
  let fullOutput = '';
  let resultText = '';
  let lastTextLength = 0;
  let lineBuf = '';
  let lastAssistantMsgId = null;

  // Use onChunk if available, otherwise fall back to onText for everything.
  const emit = onChunk
    ? (text, stream) => { fullOutput += text; onChunk(text, stream); }
    : (text, _stream) => { fullOutput += text; onText(text); };

  // ── Formatting helpers ──────────────────────────────────────────────────

  function formatToolUse(block) {
    const name = block.name || 'unknown';
    const input = block.input || {};
    const lines = [`── ${name} ──`];

    if (input.file_path) lines.push(`  ${input.file_path}`);
    if (input.command) lines.push(`  $ ${input.command}`);
    if (input.pattern) lines.push(`  pattern: ${input.pattern}`);
    if (input.query) lines.push(`  query: ${input.query}`);
    if (input.path && !input.file_path) lines.push(`  path: ${input.path}`);
    if (input.url) lines.push(`  url: ${input.url}`);
    if (input.old_string !== undefined && input.new_string !== undefined) {
      lines.push(`  replacing ${input.old_string.length} chars → ${input.new_string.length} chars`);
    } else if (input.old_string !== undefined) {
      lines.push(`  matching: ${input.old_string.slice(0, 100)}${input.old_string.length > 100 ? '…' : ''}`);
    }
    if (input.content && typeof input.content === 'string') {
      const preview = input.content.length > 300
        ? input.content.slice(0, 300) + '…'
        : input.content;
      lines.push(`  ${preview}`);
    }
    if (input.description) lines.push(`  ${input.description}`);
    if (input.prompt && typeof input.prompt === 'string') {
      const preview = input.prompt.length > 300
        ? input.prompt.slice(0, 300) + '…'
        : input.prompt;
      lines.push(`  ${preview}`);
    }
    if (input.todos && Array.isArray(input.todos)) {
      for (const todo of input.todos) {
        const icon = todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○';
        lines.push(`  ${icon} ${todo.content || ''}`);
      }
    }

    return lines.join('\n');
  }

  function extractToolResultText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map(c => {
          if (typeof c === 'string') return c;
          if (c.type === 'text') return c.text || '';
          if (c.type === 'tool_result') return extractToolResultText(c.content);
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    if (content && typeof content === 'object') {
      if (content.type === 'text') return content.text || '';
    }
    return '';
  }

  // ── JSON line processor ─────────────────────────────────────────────────

  function processJsonLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      emit(trimmed + '\n', 'stdout');
      return;
    }

    // ── system ────────────────────────────────────────────────────────────
    if (obj.type === 'system') {
      if (obj.subtype === 'init') {
        const parts = [];
        if (obj.model) parts.push(obj.model);
        if (obj.permissionMode && obj.permissionMode !== 'default') parts.push(obj.permissionMode);
        if (obj.claude_code_version) parts.push('v' + obj.claude_code_version);
        if (parts.length) {
          emit(parts.join(' · ') + '\n', 'system');
        }
      }
      return;
    }

    // ── assistant ─────────────────────────────────────────────────────────
    if (obj.type === 'assistant' && obj.message?.content) {
      const msgId = obj.message?.id || null;

      if (msgId && msgId !== lastAssistantMsgId) {
        lastAssistantMsgId = msgId;
        lastTextLength = 0;
      }

      const contentBlocks = obj.message.content;

      // Emit non-text blocks (tool_use, thinking) with their own stream types
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          emit('\n' + formatToolUse(block) + '\n', 'system');
        } else if (block.type === 'thinking') {
          const thinking = block.thinking || block.text || '';
          if (thinking) {
            emit(thinking + '\n', 'log');
          }
        }
      }

      // Emit text deltas — Claude CLI sends the full accumulated text each time
      const textBlocks = contentBlocks.filter(b => b.type === 'text');
      const currentText = textBlocks.map(b => b.text || '').join('');
      if (currentText.length > lastTextLength) {
        const delta = currentText.slice(lastTextLength);
        lastTextLength = currentText.length;
        resultText = currentText;
        emit(delta, 'stdout');
      }
      return;
    }

    // ── user (tool results) ───────────────────────────────────────────────
    if (obj.type === 'user') {
      const content = obj.message?.content;
      if (!content) return;
      const entries = Array.isArray(content) ? content : [content];

      for (const entry of entries) {
        if (entry.type === 'tool_result') {
          const raw = extractToolResultText(entry.content);
          if (raw) {
            emit(raw + '\n', 'log');
          }
        }
      }
      return;
    }

    // ── tool_use_summary ──────────────────────────────────────────────────
    if (obj.type === 'tool_use_summary') {
      const summary = obj.summary || '';
      if (summary) {
        emit(summary + '\n', 'system');
      }
      return;
    }

    // ── result ────────────────────────────────────────────────────────────
    if (obj.type === 'result') {
      let finalText = '';
      if (typeof obj.result === 'string') {
        finalText = obj.result;
      } else if (obj.result?.content) {
        const textBlocks = Array.isArray(obj.result.content)
          ? obj.result.content.filter(b => b.type === 'text')
          : [];
        finalText = textBlocks.map(b => b.text || '').join('');
      } else if (obj.message?.content) {
        const textBlocks = obj.message.content.filter(b => b.type === 'text');
        finalText = textBlocks.map(b => b.text || '').join('');
      }

      // Emit any remaining text not yet emitted
      if (finalText && finalText.length > lastTextLength) {
        const delta = finalText.slice(lastTextLength);
        emit(delta, 'stdout');
      }
      resultText = finalText || resultText;

      // Emit completion info
      const cost = obj.total_cost_usd;
      const turns = obj.num_turns;
      const duration = obj.duration_ms;
      if (cost != null || turns != null) {
        const info = [
          cost != null && `$${Number(cost).toFixed(4)}`,
          turns != null && `${turns} turn${turns === 1 ? '' : 's'}`,
          duration != null && `${(duration / 1000).toFixed(1)}s`,
        ].filter(Boolean).join(' · ');
        emit('\n' + info + '\n', 'success');
      }

      if (onResult) onResult(resultText);
      return;
    }

    // ── error ─────────────────────────────────────────────────────────────
    if (obj.type === 'error' || obj.error) {
      const msg = obj.error?.message || obj.message || 'Unknown streaming error';
      if (onError) onError(msg);
      return;
    }

    // ── catch-all: emit any unrecognized event type ───────────────────────
    emit(`[${obj.type || 'event'}] ${JSON.stringify(obj).slice(0, 500)}\n`, 'log');
  }

  // ── Public API ──────────────────────────────────────────────────────────

  function processChunk(chunk) {
    const text = String(chunk);

    if (!isStreamJson) {
      fullOutput += text;
      onText(text);
      return;
    }

    lineBuf += text;
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop() || '';

    for (const line of lines) {
      processJsonLine(line);
    }
  }

  function flush() {
    if (lineBuf.trim()) {
      processJsonLine(lineBuf);
      lineBuf = '';
    }
  }

  return {
    processChunk,
    flush,
    getFullOutput: () => resultText || fullOutput,
  };
}

module.exports = {
  supportsStreamJson,
  injectStreamFlags,
  createStreamProcessor,
};
