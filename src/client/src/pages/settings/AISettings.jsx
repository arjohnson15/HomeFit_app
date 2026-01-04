import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function AISettings() {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('gpt-4o-mini')
  const [ollamaEndpoint, setOllamaEndpoint] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [ollamaApiKey, setOllamaApiKey] = useState('')
  const [ollamaModels, setOllamaModels] = useState([]) // Available models from server
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saved, setSaved] = useState(false)
  const [globalAvailable, setGlobalAvailable] = useState(false)
  const [globalProvider, setGlobalProvider] = useState(null)
  const [features, setFeatures] = useState({
    workoutSuggestions: true,
    formTips: true,
    nutritionAdvice: false,
    progressAnalysis: true
  })

  const openaiModels = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable, great for most tasks', cost: '$' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Best quality, multimodal capabilities', cost: '$$$' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Powerful with large context', cost: '$$' }
  ]

  const ollamaModelSuggestions = ['llama2', 'llama3', 'mistral', 'codellama', 'gemma', 'phi', 'neural-chat', 'starling-lm']

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await api.get('/users/ai-settings')
      const data = response.data

      // Provider
      if (data.provider) {
        setProvider(data.provider)
      }

      // OpenAI settings
      if (data.apiKey) {
        setApiKey(data.apiKey)
        setMaskedKey(data.maskedKey)
      }
      if (data.model) {
        setModel(data.model)
      }

      // Ollama settings
      if (data.ollamaEndpoint) {
        setOllamaEndpoint(data.ollamaEndpoint)
      }
      if (data.ollamaModel) {
        setOllamaModel(data.ollamaModel)
      }
      if (data.ollamaApiKey) {
        setOllamaApiKey(data.ollamaApiKey)
      }

      // Features
      if (data.features) {
        setFeatures(data.features)
      }

      // Global AI availability
      setGlobalAvailable(data.globalAvailable || false)
      setGlobalProvider(data.globalProvider || null)
    } catch (error) {
      console.error('Error loading AI settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.put('/users/ai-settings', {
        provider,
        apiKey,
        model,
        ollamaEndpoint,
        ollamaModel,
        ollamaApiKey,
        features
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Update masked key display
      if (apiKey) {
        setMaskedKey('sk-...' + apiKey.slice(-4))
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      if (provider === 'openai') {
        if (!apiKey) {
          setTestResult({ success: false, message: 'Please enter an API key first' })
          setTesting(false)
          return
        }
        // Test OpenAI API key
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        if (response.ok) {
          setTestResult({ success: true, message: 'API key is valid!' })
        } else {
          setTestResult({ success: false, message: 'Invalid API key' })
        }
      } else {
        // Test Ollama connection
        if (!ollamaEndpoint) {
          setTestResult({ success: false, message: 'Please enter an Ollama endpoint first' })
          setTesting(false)
          return
        }
        try {
          const headers = {}
          if (ollamaApiKey) {
            headers['Authorization'] = `Bearer ${ollamaApiKey}`
          }
          const response = await fetch(`${ollamaEndpoint}/api/tags`, { headers })
          if (response.ok) {
            const data = await response.json()
            const models = data.models || []
            setOllamaModels(models)
            setTestResult({
              success: true,
              message: `Connected! ${models.length} model${models.length !== 1 ? 's' : ''} available.`
            })
            // Auto-select first model if none selected
            if (!ollamaModel && models.length > 0) {
              setOllamaModel(models[0].name)
            }
          } else if (response.status === 401) {
            setTestResult({ success: false, message: 'Authentication required. Add your API key.' })
          } else {
            setTestResult({ success: false, message: 'Could not connect to Ollama' })
          }
        } catch (error) {
          setTestResult({ success: false, message: 'Connection failed. Is Ollama running?' })
        }
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection failed. Check your settings.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings" className="btn-ghost p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">AI Integration</h1>
        {saved && (
          <span className="text-success text-sm ml-auto flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Global AI Available Notice */}
      {globalAvailable && (
        <div className="card bg-green-500/10 border border-green-500/30">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-green-400 font-medium">AI Ready to Use</p>
              <p className="text-green-400/80 text-sm mt-1">
                Your admin has enabled {globalProvider === 'ollama' ? 'Ollama' : 'OpenAI'} for all users. You can start using AI features right away! Optionally configure your own provider below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">AI Provider</h3>
        <p className="text-gray-400 text-sm">Choose between OpenAI (cloud) or Ollama (self-hosted)</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setProvider('openai')}
            className={`p-4 rounded-xl text-left transition-all ${
              provider === 'openai'
                ? 'bg-accent/20 border-2 border-accent'
                : 'bg-dark-elevated border-2 border-transparent hover:border-gray-600'
            }`}
          >
            <p className="text-white font-medium">OpenAI</p>
            <p className="text-gray-400 text-sm mt-1">ChatGPT API (cloud)</p>
          </button>
          <button
            onClick={() => setProvider('ollama')}
            className={`p-4 rounded-xl text-left transition-all ${
              provider === 'ollama'
                ? 'bg-accent/20 border-2 border-accent'
                : 'bg-dark-elevated border-2 border-transparent hover:border-gray-600'
            }`}
          >
            <p className="text-white font-medium">Ollama</p>
            <p className="text-gray-400 text-sm mt-1">Self-hosted AI</p>
          </button>
        </div>
      </div>

      {/* OpenAI Configuration */}
      {provider === 'openai' && (
        <>
          {/* Info Card */}
          <div className="card bg-accent/10 border border-accent/30">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-white font-medium">{apiKey ? 'Using Your API Key' : globalAvailable && globalProvider === 'openai' ? 'Add Your Own Key (Optional)' : 'Your Own API Key'}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {apiKey
                    ? 'Your personal API key is being used. Your settings sync across all your devices.'
                    : globalAvailable && globalProvider === 'openai'
                      ? 'Add your own OpenAI key if you prefer not to use the shared one.'
                      : 'Add your OpenAI API key to enable AI features.'}
                </p>
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div className="card space-y-4">
            <h3 className="text-white font-medium">OpenAI API Key</h3>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="input w-full pr-20"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={testing}
                className="btn-secondary flex-1"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost flex items-center gap-2"
              >
                Get Key
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            {testResult && (
              <div className={`p-3 rounded-xl ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {testResult.message}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="card space-y-4">
            <h3 className="text-white font-medium">AI Model</h3>
            <p className="text-gray-400 text-sm">Choose a model based on your needs and budget</p>
            <div className="space-y-2">
              {openaiModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    model === m.id
                      ? 'bg-accent/20 border-2 border-accent'
                      : 'bg-dark-elevated border-2 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{m.name}</p>
                      <p className="text-gray-400 text-sm mt-1">{m.description}</p>
                    </div>
                    <span className={`text-sm font-medium ${
                      m.cost === '$' ? 'text-green-400' : m.cost === '$$' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {m.cost}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Ollama Configuration */}
      {provider === 'ollama' && (
        <>
          {/* Info Card */}
          <div className="card bg-purple-500/10 border border-purple-500/30">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <div>
                <p className="text-white font-medium">Self-Hosted AI</p>
                <p className="text-gray-400 text-sm mt-1">
                  Ollama runs locally on your own server. No API costs, complete privacy. Make sure Ollama is running and accessible.
                </p>
              </div>
            </div>
          </div>

          {/* Ollama Endpoint */}
          <div className="card space-y-4">
            <h3 className="text-white font-medium">Ollama Server</h3>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Endpoint URL</label>
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Model</label>
              {ollamaModels.length > 0 ? (
                <>
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select a model...</option>
                    {ollamaModels.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({(m.size / 1e9).toFixed(1)}GB)
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-2">{ollamaModels.length} models available on your server</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama2"
                    list="ollama-models"
                    className="input w-full"
                  />
                  <datalist id="ollama-models">
                    {ollamaModelSuggestions.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <p className="text-gray-500 text-xs mt-2">Test connection to see available models</p>
                </>
              )}
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">API Key (Optional)</label>
              <input
                type="password"
                value={ollamaApiKey}
                onChange={(e) => setOllamaApiKey(e.target.value)}
                placeholder="Leave empty if no auth required"
                className="input w-full"
              />
              <p className="text-gray-500 text-xs mt-2">Required only if your Ollama server uses proxy authentication</p>
            </div>
            <button
              onClick={testConnection}
              disabled={testing}
              className="btn-secondary w-full"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult && (
              <div className={`p-3 rounded-xl ${testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {testResult.message}
              </div>
            )}
          </div>
        </>
      )}

      {/* AI Features */}
      <div className="card space-y-4">
        <h3 className="text-white font-medium">AI Features</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Workout Suggestions</p>
            <p className="text-gray-500 text-sm">Get AI-powered workout recommendations</p>
          </div>
          <button
            onClick={() => setFeatures({ ...features, workoutSuggestions: !features.workoutSuggestions })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              features.workoutSuggestions ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              features.workoutSuggestions ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Form Tips</p>
            <p className="text-gray-500 text-sm">Get exercise form advice</p>
          </div>
          <button
            onClick={() => setFeatures({ ...features, formTips: !features.formTips })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              features.formTips ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              features.formTips ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">Progress Analysis</p>
            <p className="text-gray-500 text-sm">AI insights on your progress</p>
          </div>
          <button
            onClick={() => setFeatures({ ...features, progressAnalysis: !features.progressAnalysis })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              features.progressAnalysis ? 'bg-accent' : 'bg-dark-elevated'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              features.progressAnalysis ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          saved ? 'bg-success text-white' : 'btn-primary'
        }`}
      >
        {saving ? 'Saving...' : saved ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved!
          </span>
        ) : 'Save Settings'}
      </button>
    </div>
  )
}

export default AISettings
