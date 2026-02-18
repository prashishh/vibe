function parseGuardResultLine(line) {
  const match = String(line).match(/guard\s+([A-Za-z0-9_-]+)\s*:\s*(pass|fail)/i);
  if (!match) {
    return null;
  }

  return {
    guardId: match[1],
    status: match[2].toLowerCase(),
    details: String(line).trim(),
  };
}

module.exports = {
  parseGuardResultLine,
};
