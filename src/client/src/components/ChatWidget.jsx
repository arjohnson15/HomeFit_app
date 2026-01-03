import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import api from '../services/api'

const ChatWidget = forwardRef(function ChatWidget({ context = 'general', onWorkoutCreated }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI fitness assistant. Ask me anything about workouts, exercises, or building your training plan! I can even create workouts for you - just ask!' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(null)
  const [checkingAi, setCheckingAi] = useState(true)
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Expose method to open chat with a question
  useImperativeHandle(ref, () => ({
    openWithQuestion: (question) => {
      setIsOpen(true)
      setPendingQuestion(question)
    }
  }))

  useEffect(() => {
    checkAiAvailability()
  }, [])

  // Handle pending question when chat opens
  useEffect(() => {
    if (isOpen && pendingQuestion && aiAvailable && !loading) {
      // Add the user message and send it
      const question = pendingQuestion
      setPendingQuestion(null)
      setMessages(prev => [...prev, { role: 'user', content: question }])
      setLoading(true)

      api.post('/ai/chat', {
        message: question,
        context,
        history: messages.slice(-10)
      }).then(response => {
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.message }])
      }).catch(error => {
        const errorMessage = error.response?.data?.message || 'Sorry, I couldn\'t process that. Please try again.'
        setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }])
      }).finally(() => {
        setLoading(false)
      })
    }
  }, [isOpen, pendingQuestion, aiAvailable, loading])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkAiAvailability = async () => {
    try {
      const response = await api.get('/ai/status')
      setAiAvailable(response.data.available)
    } catch (error) {
      setAiAvailable(false)
    } finally {
      setCheckingAi(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await api.post('/ai/chat', {
        message: userMessage,
        context,
        history: messages.slice(-10) // Send last 10 messages for context
      })

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.message }])

      // If a workout was created, notify the parent component
      if (response.data.workoutCreated && onWorkoutCreated) {
        onWorkoutCreated(response.data.workoutCreated)
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Sorry, I couldn\'t process that. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }])
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = [
    'Suggest a workout for today',
    'How do I do a proper squat?',
    'What muscles does bench press work?',
    'Help me build a weekly plan'
  ]

  const handleQuickPrompt = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  if (checkingAi) {
    return null // Don't show anything while checking
  }

  if (!aiAvailable) {
    return null // Don't show chat if AI is not available
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-gray-700 rotate-0' : 'bg-accent hover:bg-accent-hover'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-40 w-[calc(100%-2rem)] max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 'min(500px, calc(100vh - 180px))' }}
        >
          {/* Header */}
          <div className="bg-accent px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold">AI Fitness Assistant</h3>
              <p className="text-white/70 text-xs">Powered by ChatGPT</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-dark-elevated text-gray-200 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-dark-elevated text-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs bg-dark-elevated hover:bg-dark-border text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-dark-border flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about workouts, exercises..."
              className="flex-1 bg-dark-elevated text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
})

export default ChatWidget
