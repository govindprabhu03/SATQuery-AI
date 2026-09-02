import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function VoiceInput({ onResult, disabled }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    return () => recognition.abort()
  }, [onResult])

  if (!SpeechRecognition) return null

  function toggle() {
    if (disabled) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    } else {
      recognitionRef.current?.start()
      setListening(true)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Listening… click to stop' : 'Ask by voice'}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
        listening
          ? 'border-rose-400/60 bg-rose-500/20 text-rose-300'
          : 'border-white/10 bg-white/5 text-slate-400 hover:border-sky-400/50 hover:text-sky-300'
      }`}
    >
      {listening && (
        <motion.span
          className="absolute inset-0 rounded-full bg-rose-400/30"
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <svg className="relative h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  )
}
