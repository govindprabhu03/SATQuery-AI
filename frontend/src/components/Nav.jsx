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

        <div className="hidden items-center gap-1.5 md:flex">
          <NavIcon path="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.6 0 7.5 7.5 0 0010.6 0z" />
          <NavIcon path="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          <NavIcon path="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477" />
          <div className="h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-sky-400/40 to-amber-300/40" />
        </div>
      </div>
    </motion.header>
  )
}

function NavIcon({ path }) {
  return (
    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 backdrop-blur-md transition hover:border-sky-400/40 hover:text-sky-300">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </button>
  )
}
