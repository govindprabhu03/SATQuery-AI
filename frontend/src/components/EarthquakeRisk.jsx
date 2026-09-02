import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const mono = { fontFamily: "'JetBrains Mono', monospace" }
const serif = { fontFamily: "'Fraunces', serif" }

const LEVEL_STYLE = {
  'Very Low': { text: 'text-emerald-300', ring: '#34d399', bg: 'bg-emerald-500/10 border-emerald-400/30' },
  Low: { text: 'text-emerald-300', ring: '#6ee7b7', bg: 'bg-emerald-500/10 border-emerald-400/30' },
  Moderate: { text: 'text-amber-300', ring: '#fbbf24', bg: 'bg-amber-500/10 border-amber-400/30' },
  High: { text: 'text-orange-300', ring: '#fb923c', bg: 'bg-orange-500/10 border-orange-400/30' },
  'Very High': { text: 'text-rose-300', ring: '#fb7185', bg: 'bg-rose-500/10 border-rose-400/30' },
}

function RiskGauge({ score, level }) {
  const style = LEVEL_STYLE[level] || LEVEL_STYLE.Moderate
  const circumference = 2 * Math.PI * 54
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={style.ring}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-medium text-white" style={mono}>{score}</span>
        <span className={`text-[11px] tracking-wide ${style.text}`} style={mono}>{level.toUpperCase()}</span>
      </div>
    </div>
  )
}

const MAP_LAYERS = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    label: 'Map',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    label: 'Satellite',
  },
}

function QuakeMap({ result }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileLayerRef = useRef(null)
  const [mapStyle, setMapStyle] = useState('dark')

  // Create the map + markers once per result (fresh place/quakes).
  useEffect(() => {
    if (!containerRef.current || !result) return
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
    mapRef.current = map
    tileLayerRef.current = L.tileLayer(MAP_LAYERS[mapStyle].url, {
      maxZoom: MAP_LAYERS[mapStyle].maxZoom,
      attribution: 'Esri',
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    L.circleMarker([result.latitude, result.longitude], {
      radius: 8,
      color: '#38bdf8',
      fillColor: '#38bdf8',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindTooltip(result.place)
      .addTo(layer)

    result.quakes.forEach((q) => {
      L.circleMarker([q.lat, q.lon], {
        radius: Math.max(3, q.mag * 2),
        color: '#fb7185',
        fillColor: '#fb7185',
        fillOpacity: 0.45,
        weight: 1,
      })
        .bindTooltip(`M${q.mag} · ${q.place} · ${q.time}`)
        .addTo(layer)
    })

    const bounds = L.latLngBounds([[result.latitude, result.longitude], ...result.quakes.map((q) => [q.lat, q.lon])])
    map.fitBounds(bounds.isValid() ? bounds.pad(0.15) : [[result.latitude - 1, result.longitude - 1], [result.latitude + 1, result.longitude + 1]])

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // Swap just the base tile layer when the style toggle changes, without
  // rebuilding the map (keeps current pan/zoom and markers intact).
  useEffect(() => {
    if (!mapRef.current) return
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(MAP_LAYERS[mapStyle].url, {
      maxZoom: MAP_LAYERS[mapStyle].maxZoom,
      attribution: 'Esri',
    }).addTo(mapRef.current)
    tileLayerRef.current.bringToBack()
  }, [mapStyle])

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border border-white/10">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-full border border-white/10 bg-slate-950/80 backdrop-blur-md">
        {Object.entries(MAP_LAYERS).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapStyle(key)}
            className={`px-3 py-1.5 text-[11px] font-medium transition ${
              mapStyle === key ? 'bg-gradient-to-r from-sky-500 to-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
            style={mono}
          >
            {cfg.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EarthquakeRisk() {
  const [place, setPlace] = useState('')
  const [years, setYears] = useState(30)
  const [radius, setRadius] = useState(200)
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
      const params = new URLSearchParams({ place: place.trim(), years, radius_km: radius })
      const res = await fetch(`/api/earthquake-risk?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Analysis failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-xs tracking-[0.3em] text-sky-300/80" style={mono}>
          REAL USGS SEISMIC DATA — NO API KEY
        </p>
        <h2 className="mb-2 text-3xl leading-tight text-white sm:text-4xl" style={serif}>
          Know your earthquake risk.
        </h2>
        <p className="max-w-xl text-sm text-slate-400">
          Name any place — SatQuery pulls real historical earthquakes from the USGS
          catalog, checks distance to major fault systems, and scores the seismic
          risk in plain language with a tailored preparedness checklist.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>PLACE</label>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Tokyo, Japan"
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>YEARS BACK</label>
          <input
            type="number"
            value={years}
            min={1}
            max={100}
            onChange={(e) => setYears(e.target.value)}
            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-500" style={mono}>RADIUS (KM)</label>
          <input
            type="number"
            value={radius}
            min={10}
            max={1000}
            onChange={(e) => setRadius(e.target.value)}
            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-5 py-2.5 text-xs font-medium text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />}
          {loading ? 'Checking USGS catalog…' : 'Analyze'}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <RiskGauge score={result.score} level={result.level} />
              <p className="text-center text-xs text-slate-400" style={mono}>{result.place}</p>
            </div>
            <QuakeMap result={result} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'QUAKES FOUND', value: result.quake_count },
              { label: 'NEAREST FAULT', value: `${result.fault_distance_km} km`, sub: result.fault_name },
              { label: 'LARGEST QUAKE', value: result.largest_quake ? `M${result.largest_quake.mag}` : '—', sub: result.largest_quake?.place },
              { label: 'LOOKBACK WINDOW', value: `${result.years} yrs · ${result.radius_km} km` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] text-slate-500" style={mono}>{s.label}</p>
                <p className="mt-1 text-lg font-medium text-slate-100" style={mono}>{s.value}</p>
                {s.sub && <p className="mt-0.5 truncate text-[10px] text-slate-500">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className={`rounded-xl border p-4 ${(LEVEL_STYLE[result.level] || LEVEL_STYLE.Moderate).bg}`}>
            <p className="mb-2 text-[10px] tracking-wide text-slate-300" style={mono}>PREPAREDNESS CHECKLIST</p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm text-slate-200 sm:grid-cols-2">
              {result.checklist.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-slate-500">
            Risk scores are educational estimates, not an official seismic-hazard assessment. For
            authoritative hazard data consult your national geological survey.
          </p>
        </motion.div>
      )}
    </div>
  )
}
