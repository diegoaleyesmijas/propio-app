function parseSlot(s) {
  // Backend returns ISO with +00:00 timezone. Build a Date and pull local fields.
  const d = new Date(s)
  return {
    date: d,
    hours: d.getHours().toString().padStart(2, '0'),
    minutes: d.getMinutes().toString().padStart(2, '0'),
  }
}

export function TimeGrid({ slots, loading, value, onChange, onNextAvailable }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-12 rounded-2xl bg-stone-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!slots.length) {
    return (
      <div className="mt-6 text-center py-10">
        <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <p className="text-stone-600 font-semibold">Sin huecos disponibles</p>
        <p className="text-stone-400 text-sm mt-1">Prueba con otro día</p>
        {onNextAvailable && (
          <button
            onClick={onNextAvailable}
            className="mt-5 pill-outline"
          >
            Ver próximo día libre
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {slots.map((s) => {
        const { hours, minutes } = parseSlot(s)
        const label = `${hours}:${minutes}`
        const active = value === s
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={active ? 'pill-active' : 'pill-outline'}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
