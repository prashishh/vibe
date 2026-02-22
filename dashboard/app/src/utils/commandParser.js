/**
 * commandParser.js — Parse slash commands for the interactive terminal.
 *
 * Returns a parsed command object, or null if the input is not a command.
 */

export function parseCommand(input) {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (cmd) {
    case '/new': {
      let buildType = 'vibe'
      const typeIdx = args.indexOf('--type')
      if (typeIdx !== -1 && args[typeIdx + 1]) {
        buildType = args[typeIdx + 1]
        args.splice(typeIdx, 2)
      }
      const description = args.join(' ')
      return { command: 'new', description, buildType }
    }

    case '/plan':
      return { command: 'plan', buildId: args[0] || null }

    case '/build':
      return { command: 'build', buildId: args[0] || null }

    case '/review':
      return { command: 'review', buildId: args[0] || null }

    case '/ship':
      return { command: 'ship', buildId: args[0] || null }

    case '/stall':
      return { command: 'stall', buildId: args[0] || null }

    case '/status':
      return { command: 'status', buildId: args[0] || null }

    case '/select':
      return { command: 'select', buildId: args[0] || null }

    case '/list':
      return { command: 'list', statusFilter: args[0] || null }

    case '/clear':
      return { command: 'clear' }

    case '/help':
      return { command: 'help' }

    default:
      return { command: 'unknown', raw: trimmed }
  }
}
