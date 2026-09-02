import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SpaceBackground from './components/SpaceBackground'
import SatelliteGlobe from './components/SatelliteGlobe'
import FilmOverlay from './components/FilmOverlay'
import Nav from './components/Nav'
import VoiceInput from './components/VoiceInput'
import RegionExplorer from './components/RegionExplorer'
import EarthquakeRisk from './components/EarthquakeRisk'

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

function DashCard({ title, action, className = '', children }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-medium text-slate-100">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function InsightRow({ tone, label, sub }) {
  const dot = { ok: 'bg-emerald-400', warn: 'bg-amber-400', info: 'bg-sky-400' }[tone] || 'bg-sky-400'
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-black/20 p-2.5">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-200">{label}</p>
        <p className="truncate text-[11px] text-slate-500" style={mono}>{sub}</p>
      </div>
    </div>
  )
}

function RadarWidget() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-sky-400/20 bg-black/40">
      {[1, 2, 3].map((r) => (
        <span
          key={r}
          className="absolute rounded-full border border-sky-400/15"
          style={{ width: `${r * 30}%`, height: `${r * 30}%` }}
        />
      ))}
      <motion.div
        className="absolute h-full w-full"
        style={{
          background: 'conic-gradient(from 0deg, rgba(56,189,248,0.35), transparent 35%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      <span className="relative h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_2px_rgba(56,189,248,0.8)]" />
    </div>
  )
}

function DashboardView({
  previewUrl,
  uploadResult,
  detection,
  compareResult,
  secondPreviewUrl,
  secondUploadResult,
  secondInputRef,
  handleSecondUpload,
  comparing,
  queryLog,
  question,
  setQuestion,
  handleAsk,
  reset,
  fileName,
  chatEndRef,
  asking,
  suggestions,
  loadingSuggestions,
}) {
  const aiResults = queryLog.filter((e) => e.role === 'ai')
  const taskCounts = aiResults.reduce((acc, r) => {
    const t = r.task_type || 'other'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})
  const maxTaskCount = Math.max(1, ...Object.values(taskCounts))

  return (
    <div style={{ transformStyle: 'preserve-3d' }} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
      {/* LEFT: Mission Insights */}
      <motion.div
        initial={{ opacity: 0, x: -20, rotateY: 10 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
        className="order-2 lg:order-1"
      >
        <DashCard title="Mission Insights" className="h-full">
          <div className="flex flex-col gap-2 p-3">
            {detection && (
              <InsightRow
                tone={detection.count > 0 ? 'ok' : 'warn'}
                label={`${detection.count} ${detection.label}${detection.count === 1 ? '' : 's'} detected`}
                sub="OBJECT DETECTION"
              />
            )}
            {compareResult && (
              <InsightRow
                tone={compareResult.count > 0 ? 'warn' : 'ok'}
                label={`${compareResult.changed_area_percent}% area changed`}
                sub="CHANGE DETECTION"
              />
            )}
            {aiResults.slice(-4).reverse().map((r, i) => (
              <InsightRow
                key={i}
                tone="info"
                label={r.text.length > 46 ? r.text.slice(0, 46) + '…' : r.text}
                sub={(TASK_LABELS[r.task_type]?.name || r.task_type || 'RESULT').toUpperCase()}
              />
            ))}
            {aiResults.length === 0 && !detection && !compareResult && (
              <p className="p-2 text-center text-xs text-slate-500">
                Ask a question to populate mission insights.
              </p>
            )}
          </div>
        </DashCard>
      </motion.div>

      {/* CENTER: image + floating voice search */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="order-1 flex flex-col gap-4 lg:order-2"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500" style={mono}>
            ANALYZING · {fileName}
          </p>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 8.25L12 3.75m0 0L7.5 8.25M12 3.75v12" />
            </svg>
            Upload new image
          </button>
        </div>

        <DashCard>
          <div className="relative">
            {detection ? (
              <DetectionOverlay
                imageUrl={previewUrl}
                objects={detection.objects}
                count={detection.count}
                label={detection.label}
              />
            ) : compareResult && secondPreviewUrl ? (
              <ChangeOverlay
                imageUrl={secondPreviewUrl}
                regions={compareResult.objects}
                changedPct={compareResult.changed_area_percent}
                count={compareResult.count}
              />
            ) : (
              <img src={previewUrl} alt="uploaded" className="max-h-[420px] w-full rounded-2xl object-contain bg-black/40" />
            )}
          </div>
        </DashCard>

        <form onSubmit={handleAsk} className="relative">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl shadow-[0_0_30px_rgba(56,189,248,0.1)]">
            <svg className="h-4 w-4 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Tell me what you want to know…"
              disabled={asking}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
            />
            <VoiceInput onResult={(text) => setQuestion(text)} disabled={asking} />
            <button
              type="submit"
              disabled={asking}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-4 py-2 text-xs font-medium text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:opacity-60"
            >
              {asking && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
              )}
              {asking ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </form>

        {(loadingSuggestions || suggestions.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-wide text-slate-500" style={mono}>
              {loadingSuggestions ? 'THINKING OF QUESTIONS…' : 'TRY ASKING'}
            </span>
            {loadingSuggestions
              ? [0, 1, 2].map((i) => (
                  <span key={i} className="h-6 w-24 animate-pulse rounded-full bg-white/5" />
                ))
              : suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={asking}
                    onClick={(e) => handleAsk(e, s)}
                    className="rounded-full border border-sky-400/20 bg-sky-500/5 px-3 py-1 text-xs text-sky-200 transition hover:border-sky-400/50 hover:bg-sky-500/15 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
          </div>
        )}

        <div className="flex h-64 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
          {queryLog.length === 0 && (
            <p className="m-auto max-w-xs text-center text-xs text-slate-500">
              Ask something like "Describe this image" or "How many ships are there?"
            </p>
          )}
          {queryLog.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                entry.role === 'user' ? 'ml-auto bg-sky-500/20 text-sky-100' : 'bg-white/5 text-slate-200'
              }`}
            >
              {entry.text}
            </motion.div>
          ))}
          {asking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex max-w-[85%] items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-sky-300"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

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
      </motion.div>

      {/* RIGHT: image info + radar */}
      <motion.div
        initial={{ opacity: 0, x: 20, rotateY: -10 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="order-3 flex flex-col gap-4"
      >
        <DashCard
          title={`Code ${(uploadResult?.image_id || '').slice(0, 6).toUpperCase()}`}
          action={
            <button onClick={reset} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-white/5">
              New
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-4 p-4 text-xs">
            <div>
              <p className="text-slate-500">File</p>
              <p className="truncate text-slate-200" style={mono}>{fileName}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="text-emerald-400">Analyzed</p>
            </div>
            <div>
              <p className="text-slate-500">Queries</p>
              <p className="text-slate-200" style={mono}>{aiResults.length}</p>
            </div>
            <div>
              <p className="text-slate-500">Compare</p>
              <p className="text-slate-200">{secondUploadResult ? 'Active' : 'None'}</p>
            </div>
          </div>
          <div className="flex justify-center pb-4">
            <RadarWidget />
          </div>
        </DashCard>

        <DashCard title="Detections by Type" className="flex-1">
          <div className="flex flex-col gap-2.5 p-4">
            {Object.keys(taskCounts).length === 0 && (
              <p className="text-xs text-slate-500">No results yet.</p>
            )}
            {Object.entries(taskCounts).map(([type, n]) => {
              const meta = TASK_LABELS[type] || { name: type }
              return (
                <div key={type}>
                  <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                    <span>{meta.name}</span>
                    <span style={mono}>{n}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(n / maxTaskCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </DashCard>
      </motion.div>

      {/* BOTTOM: full-width results/history */}
      <div className="col-span-1 lg:col-span-3">
        <ResultsSection results={aiResults} imageName={fileName} />
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
  const [consoleMode, setConsoleMode] = useState('upload') // 'upload' | 'region' | 'earthquake'
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
  const [asking, setAsking] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const inputRef = useRef(null)
  const secondInputRef = useRef(null)
  const consoleRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [queryLog, asking])

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

  async function fetchSuggestions(imageId) {
    setLoadingSuggestions(true)
    try {
      const res = await fetch(`/api/images/${imageId}/suggestions`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
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
      fetchSuggestions(data.image_id)
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

  async function handleAsk(e, textOverride) {
    e.preventDefault()
    const q = (textOverride ?? question).trim()
    if (!q || !uploadResult || asking) return
    setQueryLog((log) => [...log, { role: 'user', text: q }])
    setQuestion('')

    const isChangeQuestion = CHANGE_WORDS.some((w) => q.toLowerCase().includes(w))
    if (isChangeQuestion && secondUploadResult) {
      setAsking(true)
      try {
        await runCompare(secondUploadResult.image_id)
      } catch {
        setQueryLog((log) => [...log, { role: 'ai', text: 'Comparison failed — try again.' }])
      } finally {
        setAsking(false)
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

    setAsking(true)
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
        { role: 'ai', text: "Couldn't reach the backend — check it's running and try again." },
      ])
    } finally {
      setAsking(false)
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
    setSuggestions([])
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

        <div className={`w-full transition-[max-width] duration-500 ${step === 'result' || consoleMode !== 'upload' ? 'max-w-6xl' : 'max-w-xl'}`} style={{ perspective: 1400 }}>
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-md">
              <button
                onClick={() => setConsoleMode('upload')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  consoleMode === 'upload' ? 'bg-gradient-to-r from-sky-500 to-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload &amp; Ask
              </button>
              <button
                onClick={() => setConsoleMode('region')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  consoleMode === 'region' ? 'bg-gradient-to-r from-sky-500 to-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Explore a Region
              </button>
              <button
                onClick={() => setConsoleMode('earthquake')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  consoleMode === 'earthquake' ? 'bg-gradient-to-r from-sky-500 to-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Earthquake Risk
              </button>
            </div>
          </div>

          {consoleMode === 'region' ? (
            <RegionExplorer />
          ) : consoleMode === 'earthquake' ? (
            <EarthquakeRisk />
          ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 24, rotateX: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, rotateX: 8, scale: 0.97 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {step !== 'result' && (
                <>
                  <SceneLabel n={chapter.n} label={chapter.label} />
                  <h2
                    className="mb-8 text-3xl leading-tight text-white sm:text-4xl"
                    style={serif}
                  >
                    {chapter.title}
                  </h2>
                </>
              )}

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
                <DashboardView
                  previewUrl={previewUrl}
                  uploadResult={uploadResult}
                  detection={detection}
                  compareResult={compareResult}
                  secondPreviewUrl={secondPreviewUrl}
                  secondUploadResult={secondUploadResult}
                  secondInputRef={secondInputRef}
                  handleSecondUpload={handleSecondUpload}
                  comparing={comparing}
                  queryLog={queryLog}
                  question={question}
                  setQuestion={setQuestion}
                  handleAsk={handleAsk}
                  reset={reset}
                  fileName={file?.name || uploadResult?.filename || 'image'}
                  chatEndRef={chatEndRef}
                  asking={asking}
                  suggestions={suggestions}
                  loadingSuggestions={loadingSuggestions}
                />
              )}
            </motion.div>
          </AnimatePresence>
          )}
        </div>
      </section>
      </div>

      <Hud text={`CHAPTER ${chapter.n} — ${chapter.label}`} />
    </div>
  )
}
