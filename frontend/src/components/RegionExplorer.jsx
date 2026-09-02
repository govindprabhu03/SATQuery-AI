import { useState } from 'react'
import { motion } from 'framer-motion'

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const serif = { fontFamily: "'Fraunces', serif" }

const CURRENT_YEAR = new Date().getFullYear()

function ResultImage({ label, url, tone }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <img src={url} alt={label} className="block w-full object-cover" />
      <div className={`border-t border-white/10 px-3 py-1.5 text-[10px] tracking-wide ${tone}`} style={mono}>
        {label}
      </div>
    </div>
  )
}

export default function RegionExplorer() {
  const [place, setPlace] = useState('')
  const [yearBefore, setYearBefore] = useState(CURRENT_YEAR - 5)
  const [yearAfter, setYearAfter] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!place.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/analyze-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place: place.trim(),
          year_before: Number(yearBefore),
          year_after: Number(yearAfter),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Analysis failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const changeDirection = result && result.mean_ndvi_change < 0 ? 'down' : 'up'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-xs tracking-[0.3em] text-sky-300/80" style={mono}>
          NO UPLOAD NEEDED — REAL SATELLITE DATA
        </p>
        <h2 className="mb-2 text-3xl leading-tight text-white sm:text-4xl" style={serif}>
          Ask about any place on Earth.
        </h2>
        <p className="max-w-xl text-sm text-slate-400">
          Name a place and two years — SatQuery pulls real Sentinel-2 satellite scenes
          from Microsoft's Planetary Computer archive and measures how vegetation cover
          actually changed, cloud-masked and bias-corrected.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>PLACE</label>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Panaji, Goa, India"
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>FROM YEAR</label>
          <input
            type="number"
            value={yearBefore}
            min={2015}
            max={CURRENT_YEAR}
            onChange={(e) => setYearBefore(e.target.value)}
            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>TO YEAR</label>
          <input
            type="number"
            value={yearAfter}
            min={2015}
            max={CURRENT_YEAR}
            onChange={(e) => setYearAfter(e.target.value)}
            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-5 py-2.5 text-xs font-medium text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />}
          {loading ? 'Fetching satellite data…' : 'Analyze'}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-xs text-slate-500" style={mono}>
          Geocoding place → searching Sentinel-2 archive → cloud-masking → computing NDVI mosaics… usually 10-15s
          for a new place/date range (real satellite data, fetched live). Repeating the same query is instant.
        </p>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          {result.cached && (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300" style={mono}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Served instantly from a previous analysis of this exact place and date range
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultImage label={`VEGETATION · ${result.period_before.slice(0, 4)}`} url={result.before_image_url} tone="text-emerald-300" />
            <ResultImage label={`VEGETATION · ${result.period_after.slice(0, 4)}`} url={result.after_image_url} tone="text-emerald-300" />
            <ResultImage label="CHANGE MAP · RED = LOSS · GREEN = GAIN" url={result.diff_image_url} tone="text-amber-300" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: `${result.period_before.slice(0, 4)} VEGETATED`, value: `${result.vegetated_pct_before}%` },
              { label: `${result.period_after.slice(0, 4)} VEGETATED`, value: `${result.vegetated_pct_after}%` },
              {
                label: 'MEAN NDVI CHANGE',
                value: `${result.mean_ndvi_change > 0 ? '+' : ''}${result.mean_ndvi_change}`,
                tone: changeDirection === 'down' ? 'text-rose-300' : 'text-emerald-300',
              },
              { label: 'SCENES USED', value: `${result.scenes_used_before} + ${result.scenes_used_after}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] text-slate-500" style={mono}>{s.label}</p>
                <p className={`mt-1 text-lg font-medium ${s.tone || 'text-slate-100'}`} style={mono}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-1.5 text-[10px] tracking-wide text-sky-300/80" style={mono}>ANALYST SUMMARY</p>
            <p className="text-sm leading-relaxed text-slate-200">{result.narrative}</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
