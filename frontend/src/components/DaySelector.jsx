import { useMemo } from 'react'

function formatDayShort(d) {
  return d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')
}
function formatDayNum(d) {
  return d.getDate()
}
function formatMonth(d) {
  return d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
}

export function DaySelector({ value, onChange, days = 14 }) {
  const dates = useMemo(() => {
    const arr = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    for (let i = 0; i < days; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [days])

  return (
    <div className="overflow-x-auto -mx-5 px-5 pb-2">
      <div className="flex gap-2">
        {dates.map((d) => {
          const iso = d.toISOString().split('T')[0]
          const isActive = value === iso
          const isToday = iso === new Date().toISOString().split('T')[0]
          return (
            <button
              key={iso}
              onClick={() => onChange(iso)}
              className={`shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                isActive
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'bg-white border border-stone-200 text-stone-700'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {isToday ? 'Hoy' : formatDayShort(d)}
              </span>
              <span className="text-xl font-bold leading-none">{formatDayNum(d)}</span>
              <span className="text-[10px] opacity-70 uppercase">
                {formatMonth(d)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
