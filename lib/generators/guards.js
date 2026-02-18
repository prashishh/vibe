function generateGuards(answers) {
  const { projectType, coreFlows } = answers;

  let guards = `# Guards\n\nGuards are permanent, append-only contracts that must never regress across builds.\n\n`;

  // Generate guards based on user's core flows
  coreFlows.forEach((flow, index) => {
    const guardNum = String(index + 1).padStart(2, '0');
    guards += generateGuard(guardNum, flow, projectType);
  });

  // Add footer
  guards += `\n---\n\n## Guard Evolution\n\nGuards are **append-only**. To modify:\n`;
  guards += `- ✅ Add new guards (G-${String(coreFlows.length + 1).padStart(2, '0')}, G-${String(coreFlows.length + 2).padStart(2, '0')}, etc.)\n`;
  guards += `- ✅ Add invariants to existing guards\n`;
  guards += `- ✅ Make contracts more specific\n`;
  guards += `- ❌ Remove guards\n`;
  guards += `- ❌ Remove invariants\n`;
  guards += `- ❌ Weaken contracts\n\n`;
  guards += `## Running Guards\n\n`;
  guards += `\`\`\`bash\n`;
  guards += `# Run all guard verifications\n`;
  guards += `/check\n\n`;
  guards += `# Or manually run tests\n`;
  guards += `npm run test\n`;
  guards += `npm run test:e2e\n`;
  guards += `\`\`\`\n`;

  return guards;
}

function generateGuard(num, flow, projectType) {
  // Normalize flow text for matching common patterns
  const flowLower = flow.toLowerCase();

  // Try to intelligently detect what kind of guard this is
  let guardTemplate = null;

  if (flowLower.includes('auth') || flowLower.includes('login') || flowLower.includes('signin') || flowLower.includes('sign in')) {
    guardTemplate = {
      contract: `${flow} works correctly and securely`,
      invariants: [
        'Unauthenticated access is properly rejected',
        'Valid credentials allow access',
        'Invalid credentials are rejected with clear errors',
        'Session/token management works correctly'
      ],
      layer: 'Contract + Integration',
      risk: 'Critical'
    };
  } else if (flowLower.includes('payment') || flowLower.includes('checkout') || flowLower.includes('billing')) {
    guardTemplate = {
      contract: `${flow} processes transactions correctly and securely`,
      invariants: [
        'Transactions are processed accurately',
        'Payment data is handled securely',
        'Failed transactions are handled gracefully',
        'Transaction state is always consistent'
      ],
      layer: 'Integration + Contract',
      risk: 'Critical'
    };
  } else if (flowLower.includes('data') || flowLower.includes('database') || flowLower.includes('storage')) {
    guardTemplate = {
      contract: `${flow} maintains data integrity and consistency`,
      invariants: [
        'Data writes are durable',
        'Data reads return correct values',
        'Concurrent access is handled safely',
        'Data validation prevents corruption'
      ],
      layer: 'Contract + Integration',
      risk: 'Critical'
    };
  } else if (flowLower.includes('api') || flowLower.includes('endpoint') || flowLower.includes('integration')) {
    guardTemplate = {
      contract: `${flow} functions correctly and reliably`,
      invariants: [
        'API responses are consistent and correct',
        'Error handling works as expected',
        'Request validation prevents invalid input',
        'Rate limiting and auth are enforced'
      ],
      layer: 'Contract + Integration',
      risk: 'High'
    };
  } else if (flowLower.includes('upload') || flowLower.includes('file')) {
    guardTemplate = {
      contract: `${flow} handles files securely and correctly`,
      invariants: [
        'File type validation works',
        'File size limits are enforced',
        'Malicious files are rejected',
        'File storage is reliable'
      ],
      layer: 'Contract + Integration',
      risk: 'High'
    };
  } else {
    // Generic template for any flow
    guardTemplate = {
      contract: `${flow} works correctly and reliably`,
      invariants: [
        'Core functionality works end-to-end',
        'Error cases are handled gracefully',
        'Data integrity is maintained',
        'Performance is acceptable'
      ],
      layer: 'Contract + Integration',
      risk: 'High'
    };
  }

  let guard = `## G-${num}: ${flow}\n`;
  guard += `- **Contract**: ${guardTemplate.contract}\n`;
  guard += `- **Invariants**:\n`;
  guardTemplate.invariants.forEach(inv => {
    guard += `  - ${inv}\n`;
  });
  guard += `- **Layer**: ${guardTemplate.layer}\n`;
  guard += `- **Risk if broken**: ${guardTemplate.risk}\n`;
  guard += `- **How to verify**:\n`;
  guard += `  - Write automated tests covering the invariants above\n`;
  guard += `  - Test both happy path and error cases\n`;
  guard += `  - Verify behavior under load/stress if applicable\n`;
  guard += `\n`;

  return guard;
}

module.exports = { generateGuards };
