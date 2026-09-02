import { motion } from 'framer-motion'

export default function Nav({ status, onEnter }) {
  const ok = status === 'ok'
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 sm:px-10"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full bg-gradient-to-br from-sky-400 to-amber-300 shadow-[0_0_14px_2px_rgba(56,189,248,0.65)]" />
        <span
          className="text-[15px] tracking-[0.14em] text-slate-200"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          SatQuery <span className="italic text-sky-300">AI</span>
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onEnter}
          className="rounded-full bg-gradient-to-r from-sky-500 to-amber-400 px-4 py-1.5 text-xs font-medium tracking-wide text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition hover:brightness-110 sm:px-5 sm:text-sm"
        >
          Enter the console
        </button>
        <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            {ok && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
          </span>
          <span className="text-[11px] tracking-wide text-slate-400">
            {ok ? 'Link established' : status}
          </span>
        </div>
      </div>
    </motion.header>
  )
}
