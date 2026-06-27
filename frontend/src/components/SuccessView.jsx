export function SuccessView({ booking, onReset }) {
  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const dateLabel = start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = `${start.getHours().toString().padStart(2,'0')}:${start.getMinutes().toString().padStart(2,'0')} – ${end.getHours().toString().padStart(2,'0')}:${end.getMinutes().toString().padStart(2,'0')}`

  // Build ics file content (iCalendar)
  const buildIcs = () => {
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barber Studio//Booking//ES',
      'BEGIN:VEVENT',
      `UID:${booking.token_uuid}@barber.studio`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Cita - ${booking.service_name}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
  }

  const downloadIcs = () => {
    const blob = new Blob([buildIcs()], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cita.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="text-center pt-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5 animate-[pulse_0.4s_ease-out]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 className="text-2xl font-extrabold">¡Reserva confirmada!</h2>
      <p className="text-stone-500 mt-2 px-4">
        Te hemos enviado un email con el enlace para gestionar o cancelar tu cita.
      </p>

      <div className="card mt-8 text-left">
        <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Resumen</p>
        <p className="text-lg font-bold capitalize mt-1">{dateLabel}</p>
        <p className="text-brand-600 font-bold text-xl mt-0.5">{timeLabel}</p>
        <div className="h-px bg-stone-100 my-3" />
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Servicio</span>
          <span className="font-semibold">{booking.service_name}</span>
        </div>
      </div>

      <button onClick={downloadIcs} className="pill-outline w-full mt-6">
        Añadir a calendario
      </button>
      <button onClick={onReset} className="text-stone-500 text-sm font-semibold mt-6 py-3 px-4">
        Hacer otra reserva
      </button>
    </div>
  )
}
