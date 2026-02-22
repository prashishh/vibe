import { useEffect, useState } from 'react'
import {
  fetchLLMConfig,
  saveLLMConfig,
  testRunnerConfig,
} from '../hooks/useTaskAPI.js'

const RUNNERS = ['claude', 'codex', 'gemini']

const RUNNER_LABELS = {
  claude: 'Claude Code',
  codex: 'OpenAI Codex',
  gemini: 'Google Gemini',
}

const MODEL_PREFS = [
  { key: 'planning',  label: 'Planning & Code',    desc: 'Planning builds, writing code, running skills' },
  { key: 'execution', label: 'Task Execution',     desc: 'Model injected via --model when executing tasks' },
  { key: 'feedback',  label: 'Chat / Feedback',    desc: 'Chat, updating plans, modifying tasks' },
  { key: 'guards',    label: 'Guard Verification', desc: 'Guard checks and guard-related operations' },
]

const COMMON_MODELS = {
  claude: ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  codex: ['gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.2', 'gpt-5.1-codex-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
}

const RUNNER_DEFAULTS = {
  claude: { planning: 'claude-opus-4-6', execution: 'claude-sonnet-4-5-20250929', feedback: 'claude-sonnet-4-5-20250929', guards: 'claude-haiku-4-5-20251001' },
  codex: { planning: 'gpt-5.2', execution: 'gpt-5.1-codex-mini', feedback: 'gpt-5.2', guards: 'gpt-5.1-codex-mini' },
  gemini: { planning: 'gemini-2.5-pro', execution: 'gemini-2.5-flash', feedback: 'gemini-2.5-pro', guards: 'gemini-2.5-flash' },
}

function Settings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingRunner, setTestingRunner] = useState('')
  const [runnerResults, setRunnerResults] = useState({})
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchLLMConfig()
        setConfig(data)
      } catch (err) {
        setMessage({ type: 'error', text: err.message })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const updateExecution = (key, value) => {
    setConfig(prev => ({
      ...prev,
      execution: { ...(prev.execution || {}), [key]: value },
    }))
  }

  const updateRunner = (name, key, value) => {
    setConfig(prev => ({
      ...prev,
      execution: {
        ...(prev.execution || {}),
        runners: {
          ...(prev.execution?.runners || {}),
          [name]: {
            ...(prev.execution?.runners?.[name] || {}),
            [key]: value,
          },
        },
      },
    }))
  }

  const updateModelPref = (phase, runner, value) => {
    setConfig(prev => ({
      ...prev,
      modelPreferences: {
        ...(prev.modelPreferences || {}),
        [phase]: {
          ...(typeof prev.modelPreferences?.[phase] === 'object' ? prev.modelPreferences[phase] : {}),
          [runner]: value,
        },
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const saved = await saveLLMConfig(config)
      setConfig(saved)
      setMessage({ type: 'success', text: 'Settings saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTestRunner = async (name) => {
    setTestingRunner(name)
    setRunnerResults(prev => ({ ...prev, [name]: null }))
    try {
      const result = await testRunnerConfig(name)
      setRunnerResults(prev => ({ ...prev, [name]: result }))
    } catch (err) {
      setRunnerResults(prev => ({ ...prev, [name]: { ok: false, message: err.message } }))
    } finally {
      setTestingRunner('')
    }
  }

  if (loading) {
    return <p className="text-text-muted py-8">Loading settings...</p>
  }

  if (!config) {
    return <p className="text-danger py-8">Unable to load configuration.</p>
  }

  const exec = config.execution || {}
  const runners = exec.runners || {}

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-6 py-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">Settings</h2>
        <p className="text-sm text-text-secondary mt-1">
          Runners and model preferences. Saved to <code className="text-xs bg-surface-alt px-1.5 py-0.5 rounded text-accent">.vibe/llm-config.json</code>
        </p>
      </div>

      {/* Toast message */}
      {message.text && (
        <div className={`rounded-lg border-2 px-4 py-2.5 text-sm ${
          message.type === 'error'
            ? 'border-danger/40 bg-danger/5 text-danger'
            : 'border-success/40 bg-success/5 text-success'
        }`}>
          {message.text}
        </div>
      )}

      {/* ─── RUNNERS ─── */}
      <section className="rounded-xl border-2 border-border bg-surface p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-text-primary">CLI Runners</h3>
          <p className="text-xs text-text-secondary mt-1">
            Turn on the CLI tools you have installed.
          </p>
        </div>

        {/* Mode + preferred runner + permission mode */}
        <div className="flex items-center gap-6 flex-wrap">
          <label className="text-xs text-text-secondary space-y-1">
            <span className="font-medium">Execution Mode</span>
            <select
              value={exec.mode || 'auto_run'}
              onChange={(e) => updateExecution('mode', e.target.value)}
              className="block w-44 bg-surface-alt border-2 border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="auto_run">Auto Run</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label className="text-xs text-text-secondary space-y-1">
            <span className="font-medium">Preferred Runner</span>
            <select
              value={exec.preferredRunner || 'claude'}
              onChange={(e) => updateExecution('preferredRunner', e.target.value)}
              className="block w-44 bg-surface-alt border-2 border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              {RUNNERS.map(r => (
                <option key={r} value={r}>{RUNNER_LABELS[r] || r}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-secondary space-y-1">
            <span className="font-medium">Permission Mode</span>
            <select
              value={exec.permissionMode || 'bypassPermissions'}
              onChange={(e) => updateExecution('permissionMode', e.target.value)}
              className="block w-52 bg-surface-alt border-2 border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="bypassPermissions">Bypass All Permissions</option>
              <option value="acceptEdits">Auto-Accept Edits</option>
              <option value="default">Default (prompt each)</option>
            </select>
          </label>
        </div>

        <p className="text-[10px] text-text-muted -mt-2 leading-snug">
          <em>Bypass All</em> skips all prompts (Claude: --dangerously-skip-permissions, Codex: --full-auto, Gemini: --yolo).
          {' '}<em>Auto-Accept Edits</em> lets file changes through but may still prompt for other things.
          {' '}<em>Default</em> uses the CLI&apos;s own permission flow.
        </p>

        {/* Runner cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RUNNERS.map(name => {
            const runner = runners[name] || {}
            const isEnabled = runner.enabled === true
            const testResult = runnerResults[name]
            const isTesting = testingRunner === name

            return (
              <div
                key={name}
                className={`rounded-lg border-2 p-4 space-y-3 transition-colors ${
                  isEnabled
                    ? 'border-success/40 bg-success/5'
                    : 'border-border bg-surface-alt'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold text-text-primary">{RUNNER_LABELS[name] || name}</h4>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isEnabled
                        ? 'bg-success/15 text-success'
                        : 'bg-text-muted/10 text-text-muted'
                    }`}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => updateRunner(name, 'enabled', !isEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-success' : 'bg-border'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Command template */}
                <label className="block text-xs text-text-muted space-y-1">
                  <span className="font-medium">Command Template</span>
                  <input
                    value={runner.commandTemplate || ''}
                    onChange={(e) => updateRunner(name, 'commandTemplate', e.target.value)}
                    placeholder={name === 'claude' ? 'claude --print "{{handoffPrompt}}"' : name === 'codex' ? 'codex exec - "{{handoffPrompt}}"' : 'gemini -p "{{handoffPrompt}}"'}
                    className="w-full bg-surface border-2 border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </label>

                {/* Test button + result */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestRunner(name)}
                    disabled={isTesting}
                    className="px-3 py-1 rounded-lg text-xs font-medium border-2 border-info/40 text-info hover:bg-info/10 disabled:opacity-50"
                  >
                    {isTesting ? 'Testing...' : 'Test Runner'}
                  </button>

                  {testResult && (
                    <span className={`text-xs font-medium ${testResult.ok ? 'text-success' : 'text-danger'}`}>
                      {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── MODEL PREFERENCES ─── */}
      <section className="rounded-xl border-2 border-border bg-surface p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-text-primary">Model Preferences</h3>
          <p className="text-xs text-text-secondary mt-1">
            Pick which model each runner uses per phase. The right <code className="text-xs bg-surface-alt px-1 py-0.5 rounded text-accent">--model</code> flag gets added automatically.
          </p>
        </div>

        <div className="space-y-4">
          {MODEL_PREFS.map(({ key, label, desc }) => (
            <div key={key} className="rounded-lg border-2 border-border bg-surface-alt p-4 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">{label}</h4>
                <p className="text-[10px] text-text-muted leading-snug mt-0.5">{desc}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {RUNNERS.map(runner => {
                  const phaseVal = config.modelPreferences?.[key]
                  const currentValue = typeof phaseVal === 'object'
                    ? (phaseVal[runner] || '')
                    : (runner === 'claude' && typeof phaseVal === 'string' ? phaseVal : (RUNNER_DEFAULTS[runner]?.[key] || ''))
                  return (
                    <label key={runner} className="block text-xs text-text-muted space-y-1">
                      <span className="font-medium">{RUNNER_LABELS[runner] || runner}</span>
                      <input
                        list={`model-suggestions-${key}-${runner}`}
                        value={currentValue}
                        onChange={(e) => updateModelPref(key, runner, e.target.value)}
                        placeholder={RUNNER_DEFAULTS[runner]?.[key] || ''}
                        className="w-full bg-surface border-2 border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      />
                      <datalist id={`model-suggestions-${key}-${runner}`}>
                        {(COMMON_MODELS[runner] || []).map(m => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center justify-between">
        <img src="/mascot/sleep.png" alt="" className="w-10 h-10 object-contain opacity-50" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

export default Settings
