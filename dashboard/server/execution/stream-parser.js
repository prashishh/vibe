'use strict';

/**
 * Parse Claude CLI `--output-format stream-json --verbose` output.
 *
 * The CLI emits newline-delimited JSON objects. For streaming text we care about:
 *
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
 *
 * With `--verbose`, intermediate assistant messages arrive as the response
 * is generated.  Each assistant event contains the *full accumulated* text
 * so far, so we track the last-seen length and emit only the delta.
 *
 * For non-Claude runners we fall back to raw stdout passthrough.
 */

/**
 * Determine whether a runner supports stream-json mode.
 * Currently only Claude Code supports this.
 */
function supportsStreamJson(runnerName) {
  return runnerName === 'claude';
}

/**
 * Inject stream-json flags into the command args for runners that support it.
 * Mutates cmdArgs in place. Returns true if flags were injected.
 */
function injectStreamFlags(runnerName, cmdArgs) {
  if (!supportsStreamJson(runnerName)) return false;

  // Only add if --output-format is not already specified
  if (cmdArgs.includes('--output-format')) return false;

  cmdArgs.push('--output-format', 'stream-json', '--verbose');
  return true;
}

/**
 * Create a stream transformer that processes child process stdout.
 *
 * @param {object} opts
 * @param {string} opts.runnerName - e.g. 'claude'
 * @param {boolean} opts.isStreamJson - whether stream-json flags were injected
 * @param {function} opts.onText - callback for each text delta: onText(delta)
 * @param {function} opts.onResult - callback when the final result is available: onResult(fullText)
 * @param {function} opts.onError - callback for errors: onError(message)
 * @returns {{ processChunk: (chunk: Buffer) => void, getFullOutput: () => string }}
 */
function createStreamProcessor({ runnerName, isStreamJson, onText, onResult, onError }) {
  let fullOutput = '';
  let lastTextLength = 0;
  let lineBuf = '';

  function processJsonLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      // Not valid JSON — treat as raw text
      onText(trimmed);
      fullOutput += trimmed;
      return;
    }

    if (obj.type === 'assistant' && obj.message?.content) {
      // Extract text from content blocks
      const textBlocks = obj.message.content.filter(b => b.type === 'text');
      const currentText = textBlocks.map(b => b.text || '').join('');

      // Emit only the delta (new text since last event)
      if (currentText.length > lastTextLength) {
        const delta = currentText.slice(lastTextLength);
        lastTextLength = currentText.length;
        fullOutput = currentText; // Keep updating full output
        onText(delta);
      }
    } else if (obj.type === 'result') {
      // Final result — extract the complete text.
      // `obj.result` may be a plain string, or it may contain nested content blocks.
      let resultText = '';
      if (typeof obj.result === 'string') {
        resultText = obj.result;
      } else if (obj.result?.content) {
        // Handle result with content blocks (same structure as assistant messages)
        const textBlocks = Array.isArray(obj.result.content)
          ? obj.result.content.filter(b => b.type === 'text')
          : [];
        resultText = textBlocks.map(b => b.text || '').join('');
      } else if (obj.message?.content) {
        // Some versions wrap result in message.content
        const textBlocks = obj.message.content.filter(b => b.type === 'text');
        resultText = textBlocks.map(b => b.text || '').join('');
      }

      if (resultText && resultText.length > lastTextLength) {
        const delta = resultText.slice(lastTextLength);
        onText(delta);
      }
      fullOutput = resultText || fullOutput;
      if (onResult) onResult(fullOutput);
    } else if (obj.type === 'error' || obj.error) {
      const msg = obj.error?.message || obj.message || 'Unknown streaming error';
      if (onError) onError(msg);
    }
    // Ignore 'system' init events and other types
  }

  function processChunk(chunk) {
    const text = String(chunk);

    if (!isStreamJson) {
      // Raw passthrough for non-streaming runners
      fullOutput += text;
      onText(text);
      return;
    }

    // Buffer partial lines (JSON is newline-delimited)
    lineBuf += text;
    const lines = lineBuf.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    lineBuf = lines.pop() || '';

    for (const line of lines) {
      processJsonLine(line);
    }
  }

  function flush() {
    // Process any remaining buffered content
    if (lineBuf.trim()) {
      processJsonLine(lineBuf);
      lineBuf = '';
    }
  }

  return {
    processChunk,
    flush,
    getFullOutput: () => fullOutput,
  };
}

module.exports = {
  supportsStreamJson,
  injectStreamFlags,
  createStreamProcessor,
};
