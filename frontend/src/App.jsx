import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SpaceBackground from './components/SpaceBackground'
import SatelliteGlobe from './components/SatelliteGlobe'
import FilmOverlay from './components/FilmOverlay'
import Nav from './components/Nav'

const serif = { fontFamily: "'Fraunces', serif" }
const mono = { fontFamily: "'JetBrains Mono', monospace" }

const CHAPTERS = {
  upload: { n: '01', label: 'THE UPLOAD', title: 'Bring the image into orbit.' },
  preview: { n: '02', label: 'THE FRAME', title: 'The frame is set.' },
  result: { n: '03', label: 'THE ANALYSIS', title: 'Ask the image.' },
}

function SceneLabel({ n, label }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 text-xs tracking-[0.3em] text-sky-300/80"
      style={mono}
    >
      SCENE {n} — {label}
    </motion.p>
  )
}

function DetectionOverlay({ imageUrl, objects, count, label }) {
  const [natural, setNatural] = useState(null)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <div
        className="relative w-full bg-black/40 aspect-video"
        style={natural ? { aspectRatio: `${natural.w} / ${natural.h}` } : undefined}
      >
        <img
          src={imageUrl}
          alt="analyzed"
          onLoad={(e) =>
            setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })
          }
          className="block h-full w-full object-cover"
        />
        {natural &&
          objects.map((obj, i) => {
            const [x1, y1, x2, y2] = obj.box
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.25 }}
                className="absolute border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                style={{
                  left: `${(x1 / natural.w) * 100}%`,
                  top: `${(y1 / natural.h) * 100}%`,
                  width: `${((x2 - x1) / natural.w) * 100}%`,
                  height: `${((y2 - y1) / natural.h) * 100}%`,
                }}
              >
                <span
                  className="absolute -top-5 left-0 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-950"
                  style={mono}
                >
                  {obj.label} {Math.round(obj.confidence * 100)}%
                </span>
              </motion.div>
            )
          })}
      </div>
      {count !== null && (
        <div
          className="border-t border-white/10 bg-black/30 px-3 py-2 text-xs text-amber-300"
          style={mono}
        >
          {count} {label}
          {count === 1 ? '' : 's'} detected
        </div>
      )}
    </div>
  )
}

function ChangeOverlay({ imageUrl, regions, changedPct, count }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <div className="relative aspect-square w-full bg-black/40">
        <img src={imageUrl} alt="after" className="block h-full w-full object-cover" />
        {regions.map((r, i) => {
          const [x1, y1, x2, y2] = r.box_percent
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.25 }}
              className="absolute border-2 border-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.5)]"
              style={{
                left: `${x1}%`,
                top: `${y1}%`,
                width: `${x2 - x1}%`,
                height: `${y2 - y1}%`,
              }}
            >
              <span
                className="absolute -top-5 left-0 whitespace-nowrap rounded bg-rose-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-950"
                style={mono}
              >
                change
              </span>
            </motion.div>
          )
        })}
      </div>
      <div
        className="border-t border-white/10 bg-black/30 px-3 py-2 text-xs text-rose-300"
        style={mono}
      >
        {count} change region{count === 1 ? '' : 's'} · {changedPct}% of area
      </div>
    </div>
  )
}

const TASK_LABELS = {
  caption: { name: 'Caption', color: 'text-sky-300 bg-sky-500/10 border-sky-400/30' },
  vqa: { name: 'Visual Q&A', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' },
  grounding: { name: 'Object Detection', color: 'text-amber-300 bg-amber-500/10 border-amber-400/30' },
  change_detection: { name: 'Change Detection', color: 'text-rose-300 bg-rose-500/10 border-rose-400/30' },
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportResultsJSON(results, imageName) {
  const payload = {
    image: imageName,
    exported_at: new Date().toISOString(),
    results: results.map((r) => ({
      task_type: r.task_type || 'unknown',
      question: r.question || null,
      answer: r.text,
      count: r.count ?? null,
      objects: r.objects || [],
      timestamp: r.timestamp || null,
    })),
  }
  downloadBlob(JSON.stringify(payload, null, 2), 'satquery-results.json', 'application/json')
}

function exportResultsCSV(results) {
  const header = ['task_type', 'question', 'answer', 'count', 'objects', 'timestamp']
  const rows = results.map((r) => [
    r.task_type || '',
    (r.question || '').replace(/"/g, '""'),
    (r.text || '').replace(/"/g, '""'),
    r.count ?? '',
    (r.objects || []).map((o) => o.label).join('; '),
    r.timestamp || '',
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')
  downloadBlob(csv, 'satquery-results.csv', 'text/csv')
}

function ResultsSection({ results, imageName }) {
  if (results.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">Analysis Results</h3>
          <p className="text-xs text-slate-500" style={mono}>
            {results.length} result{results.length === 1 ? '' : 's'} · {imageName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportResultsJSON(results, imageName)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportResultsCSV(results)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto p-4">
        {results.map((r, i) => {
          const meta = TASK_LABELS[r.task_type] || {
            name: r.task_type || 'Result',
            color: 'text-slate-300 bg-white/5 border-white/20',
          }
          return (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${meta.color}`}
                  style={mono}
                >
                  {meta.name.toUpperCase()}
                </span>
                {r.timestamp && (
                  <span className="text-[10px] text-slate-500" style={mono}>
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {r.question && (
                <p className="mb-1 text-xs text-slate-400">"{r.question}"</p>
              )}
              <p className="text-sm text-slate-100">{r.text}</p>
              {r.objects && r.objects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.objects.map((o, j) => (
                    <span
                      key={j}
                      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                      style={mono}
                    >
                      {o.label}
                      {o.confidence != null ? ` ${Math.round(o.confidence * 100)}%` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Hud({ text }) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-6 z-40 flex items-center gap-2 text-[11px] tracking-wider text-slate-400/80"
      style={mono}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
      {text}
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState('checking...')
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [error, setError] = useState(null)
  const [question, setQuestion] = useState('')
  const [queryLog, setQueryLog] = useState([])
  const [detection, setDetection] = useState(null)
  const [secondPreviewUrl, setSecondPreviewUrl] = useState(null)
  const [secondUploadResult, setSecondUploadResult] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [compareResult, setCompareResult] = useState(null)
  const inputRef = useRef(null)
  const secondInputRef = useRef(null)
  const consoleRef = useRef(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  function scrollToConsole() {
    consoleRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function pickFile(f) {
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setError(null)
    setStep('preview')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Upload failed')
      }
      const data = await res.json()
      setUploadResult(data)
      setStep('result')
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const CHANGE_WORDS = ['change', 'changed', 'changes', 'differ', 'different', 'compare', 'new since', 'disappeared', 'appeared']

  async function handleSecondUpload(f) {
    if (!f) return
    setSecondPreviewUrl(URL.createObjectURL(f))
    setComparing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', f)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setSecondUploadResult(data)
      await runCompare(data.image_id)
    } catch (e) {
      setError(e.message)
    } finally {
      setComparing(false)
    }
  }

  async function runCompare(secondImageId) {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ before_id: uploadResult.image_id, after_id: secondImageId }),
    })
    if (!res.ok) throw new Error('Compare failed')
    const data = await res.json()
    setCompareResult(data)
    setQueryLog((log) => [
      ...log,
      {
        role: 'ai',
        text: data.answer,
        task_type: data.task_type,
        objects: data.objects,
        count: data.count,
        timestamp: new Date().toISOString(),
      },
    ])
    return data
  }

  async function handleAsk(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q || !uploadResult) return
    setQueryLog((log) => [...log, { role: 'user', text: q }])
    setQuestion('')

    const isChangeQuestion = CHANGE_WORDS.some((w) => q.toLowerCase().includes(w))
    if (isChangeQuestion && secondUploadResult) {
      try {
        await runCompare(secondUploadResult.image_id)
      } catch {
        setQueryLog((log) => [...log, { role: 'ai', text: 'Comparison failed — try again.' }])
      }
      return
    }
    if (isChangeQuestion && !secondUploadResult) {
      setQueryLog((log) => [
        ...log,
        { role: 'ai', text: 'Upload a second image (a different date) using "Compare with another date" below, then ask again.' },
      ])
      return
    }

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: uploadResult.image_id, question: q }),
      })
      if (!res.ok) throw new Error('offline')
      const data = await res.json()
      setQueryLog((log) => [
        ...log,
        {
          role: 'ai',
          text: data.answer,
          question: q,
          task_type: data.task_type,
          objects: data.objects,
          count: data.count,
          timestamp: new Date().toISOString(),
        },
      ])
      if (data.task_type === 'grounding') {
        setDetection({
          objects: data.objects,
          count: data.count,
          label: data.objects[0]?.label || 'object',
        })
      }
    } catch {
      setQueryLog((log) => [
        ...log,
        { role: 'ai', text: 'Query engine comes online in Phase 3 — stand by.' },
      ])
    }
  }

  function reset() {
    setFile(null)
    setPreviewUrl(null)
    setUploadResult(null)
    setQueryLog([])
    setDetection(null)
    setSecondPreviewUrl(null)
    setSecondUploadResult(null)
    setCompareResult(null)
    setError(null)
    setStep('upload')
  }

  const chapter = CHAPTERS[step]
  const usesImageScene = (step === 'preview' || step === 'result') && previewUrl

  return (
    <div className="relative text-slate-100">
      <SpaceBackground />
      <FilmOverlay />
      <Nav status={status} onEnter={scrollToConsole} />

      <div className="h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth">
      {/* HERO */}
      <section className="relative flex h-screen snap-start flex-col items-center justify-center px-6 sm:px-10">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 text-xs tracking-[0.35em] text-sky-300/80"
          style={mono}
        >
          SCENE 00 — MISSION CONSOLE
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="max-w-3xl text-center text-4xl leading-[1.1] text-white sm:text-6xl"
          style={serif}
        >
          Ask your satellite imagery <span className="italic text-sky-300">anything.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5 max-w-lg text-center text-sm text-slate-400 sm:text-base"
        >
          One image, held in orbit — and a whole world of detail waiting to be asked
          about. Step inside, and let the console begin.
        </motion.p>
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={scrollToConsole}
          className="mt-9 rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-7 py-3 text-sm font-medium text-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.35)] transition hover:brightness-110"
        >
          Enter the console ▾
        </motion.button>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="pointer-events-none absolute -right-16 top-1/2 hidden h-[32rem] w-[32rem] -translate-y-1/2 opacity-80 lg:block"
        >
          <SatelliteGlobe className="h-full w-full" />
        </motion.div>
      </section>

      {/* CONSOLE */}
      <section
        ref={consoleRef}
        className="relative flex min-h-screen snap-start items-center justify-center overflow-hidden px-6 py-28 sm:px-10"
      >
        {/* scene backdrop */}
        <div className="absolute inset-0 -z-10">
          <AnimatePresence mode="wait">
            {usesImageScene ? (
              <motion.div
                key={previewUrl}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                <img
                  src={previewUrl}
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-30 blur-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/70 to-slate-950" />
              </motion.div>
            ) : (
              <motion.div
                key="upload-scene"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,rgba(14,116,144,0.25),transparent)]"
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <SceneLabel n={chapter.n} label={chapter.label} />
              <h2
                className="mb-8 text-3xl leading-tight text-white sm:text-4xl"
                style={serif}
              >
                {chapter.title}
              </h2>

              {step === 'upload' && (
                <div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-16 text-center backdrop-blur-md transition-colors ${
                      dragActive
                        ? 'border-sky-400 bg-sky-400/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-sky-400/50 hover:bg-white/[0.05]'
                    }`}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15"
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/20" />
                      <svg
                        className="relative h-7 w-7 text-sky-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 8.25L12 3.75m0 0L7.5 8.25M12 3.75v12"
                        />
                      </svg>
                    </motion.div>
                    <div>
                      <p className="font-medium text-slate-100">
                        Drop a satellite image, or click to browse
                      </p>
                      <p className="mt-1 text-xs text-slate-500">PNG, JPG, or TIFF</p>
                    </div>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,.tif,.tiff"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </div>
              )}

              {step === 'preview' && (
                <div className="flex flex-col gap-5">
                  <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="max-h-96 w-full object-contain bg-black/40"
                    />
                  </div>
                  <p className="truncate text-xs text-slate-500" style={mono}>
                    {file?.name}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={reset}
                      className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
                    >
                      Choose different image
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:opacity-50"
                    >
                      {uploading ? 'Transmitting…' : 'Launch to orbit'}
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
              )}

              {step === 'result' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
                    <img
                      src={previewUrl}
                      alt="uploaded"
                      className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm text-emerald-400">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        Uploaded successfully
                      </p>
                      <p className="truncate text-xs text-slate-500" style={mono}>
                        id: {uploadResult?.image_id}
                      </p>
                    </div>
                    <button
                      onClick={reset}
                      className="ml-auto shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      New image
                    </button>
                  </div>

                  {detection && (
                    <DetectionOverlay
                      imageUrl={previewUrl}
                      objects={detection.objects}
                      count={detection.count}
                      label={detection.label}
                    />
                  )}

                  {compareResult && secondPreviewUrl && (
                    <ChangeOverlay
                      imageUrl={secondPreviewUrl}
                      regions={compareResult.objects}
                      changedPct={compareResult.changed_area_percent}
                      count={compareResult.count}
                    />
                  )}

                  {!secondUploadResult && (
                    <div>
                      <button
                        onClick={() => secondInputRef.current?.click()}
                        disabled={comparing}
                        className="w-full rounded-full border border-dashed border-white/15 px-4 py-2.5 text-xs text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-50"
                      >
                        {comparing ? 'Comparing…' : '+ Compare with another date'}
                      </button>
                      <input
                        ref={secondInputRef}
                        type="file"
                        accept="image/*,.tif,.tiff"
                        className="hidden"
                        onChange={(e) => handleSecondUpload(e.target.files?.[0])}
                      />
                    </div>
                  )}

                  <ResultsSection
                    results={queryLog.filter((e) => e.role === 'ai')}
                    imageName={file?.name || uploadResult?.filename || 'image'}
                  />

                  <div className="flex h-52 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
                    {queryLog.length === 0 && (
                      <p className="m-auto max-w-xs text-center text-xs text-slate-500">
                        Ask something like "Describe this image" or "How many ships are
                        there?"
                      </p>
                    )}
                    {queryLog.map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          entry.role === 'user'
                            ? 'ml-auto bg-sky-500/20 text-sky-100'
                            : 'bg-white/5 text-slate-200'
                        }`}
                      >
                        {entry.text}
                      </motion.div>
                    ))}
                  </div>

                  <form onSubmit={handleAsk} className="flex gap-2">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question about this image…"
                      className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-md focus:border-sky-400/60 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-5 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110"
                    >
                      Ask
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      </div>

      <Hud text={`CHAPTER ${chapter.n} — ${chapter.label}`} />
    </div>
  )
}
