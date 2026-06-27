// Demo standalone del frontend MVP - valida el flujo real contra el backend en :8000
// Replica los componentes React de frontend/src/ pero con React vía CDN.

import React, { useState, useEffect, useCallback, useMemo } from 'https://esm.sh/react@18.3.1'
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client'
import { t, getLang, setLang, locale } from '/i18n.js'

const API = window.API_BASE || ''

// ---------- API client (mismo que frontend/src/api/client.js) ----------
async function getServices() {
  const r = await fetch(`${API}/services`)
  if (!r.ok) throw new Error(t('error.services'))
  return r.json()
}
async function getAvailableSlots(serviceId, date) {
  const r = await fetch(`${API}/available-slots?service_id=${serviceId}&date=${date}`)
  if (!r.ok) throw new Error(t('error.slots'))
  return r.json()
}
async function createBooking(payload) {
  const r = await fetch(`${API}/book`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.create'))
  return data
}
async function getBooking(token) {
  const r = await fetch(`${API}/manage/${token}`)
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.not_found'))
  return data
}
async function cancelBooking(token) {
  const r = await fetch(`${API}/manage/${token}`, { method: 'DELETE' })
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.cancel'))
  return data
}

// ---------- Helpers ----------
// Devuelve la fecha local YYYY-MM-DD a partir de un Date (evita el bug UTC de toISOString)
function localDateISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid', hourCycle: 'h23' })
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
}

// ---------- Components ----------

// ── Booking Stepper: indicador de progreso de 3 pasos ──
// Renderiza "Paso X de 3" + 3 nodos conectados por línea horizontal.
// Completado = ✓ en ámbar, Actual = número en oscuro, Futuro = número neutro.
const STEP_KEYS = ['service', 'slot', 'form']

function BookingStepper({ step }) {
  const currentIdx = STEP_KEYS.indexOf(step)

  return React.createElement('div', { className: 'mb-3' },
    React.createElement('p', { className: 'text-[10px] font-bold text-propio-500 uppercase tracking-wider mb-1.5 text-center' },
      t('booking.stepper', currentIdx + 1)
    ),
    React.createElement('div', { className: 'flex items-center justify-center px-2' },
      [0, 1, 2].map((idx) => {
        const isCompleted = idx < currentIdx
        const isCurrent = idx === currentIdx
        return React.createElement(React.Fragment, { key: STEP_KEYS[idx] },
          idx > 0 && React.createElement('div', {
            className: 'flex-1 h-[2px] rounded-full mx-1 ' + (idx <= currentIdx ? 'bg-propio-500' : 'bg-stone-200')
          }),
          React.createElement('div', { className: 'flex flex-col items-center' },
            React.createElement('div', {
              className: 'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ' +
                (isCompleted ? 'bg-propio-500 text-white' :
                 isCurrent ? 'bg-dark-500 text-white' :
                 'bg-stone-100 text-stone-400 border border-stone-200'),
              'aria-label': t('step.' + STEP_KEYS[idx]),
              'aria-current': isCurrent ? 'step' : undefined
            },
              isCompleted ? '\u2713' : String(idx + 1)
            ),
            React.createElement('span', {
              className: 'text-[8px] mt-0.5 leading-tight ' +
                (isCurrent ? 'text-stone-700 font-bold' : 'text-stone-400')
            }, t('step.' + STEP_KEYS[idx]))
          )
        )
      })
    )
  )
}

function Header({ step, onBack }) {
  const lang = getLang()
  return React.createElement('header',
    { className: 'sticky top-0 z-30 bg-ivory/95 backdrop-blur border-b border-stone-100' },
    React.createElement('div', { className: 'max-w-md mx-auto px-5 py-4 flex items-center gap-3' },
      onBack
        ? React.createElement('button',
            { onClick: onBack, className: 'w-10 h-10 rounded-full bg-white border border-dark-200 flex items-center justify-center active:scale-90 transition' },
            '‹')
        : React.createElement('img', {
            src: '/logo-web.png',
            alt: t('brand'),
            className: 'h-12 w-auto object-contain'
          }),
      React.createElement('div', { className: 'flex-1 min-w-0 flex items-center gap-1.5' },
        React.createElement('h1', { className: 'font-bold text-base leading-tight truncate' }, t('brand')),
        // Platform badge — PROPIO como marca plataforma
        React.createElement('span', { className: 'shrink-0 text-[7px] font-semibold uppercase tracking-wider text-propio-600 bg-propio-50 rounded px-1 py-0.5 leading-none' }, 'PROPIO')
      ),
      React.createElement('button', {
        onClick: () => {
          const next = lang === 'es' ? 'en' : 'es'
          setLang(next)
          window.location.reload()
        },
        className: `text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition
          ${lang === 'en' ? 'bg-dark-500 text-white border-dark-500' : 'text-stone-400 border-stone-200 hover:text-stone-600'}`,
        'aria-label': lang === 'es' ? 'Switch to English' : 'Cambiar a español'
      }, lang === 'es' ? 'Español | English' : 'English | Español')
    )
  )
}

function ServiceCard({ service, selected, onClick }) {
  return React.createElement('button',
    {
      onClick,
      className: `card w-full text-left flex items-center gap-4 transition-all active:scale-[0.98] ${selected ? 'ring-2 ring-propio-500 border-propio-500' : ''}`
    },
    React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-6 h-6' },
      React.createElement('circle', { cx: '6', cy: '6', r: '3' }),
      React.createElement('path', { d: 'M8.12 8.12 12 12' }),
      React.createElement('path', { d: 'M20 4 8.12 15.88' }),
      React.createElement('circle', { cx: '6', cy: '18', r: '3' }),
      React.createElement('path', { d: 'M14.8 14.8 20 20' })
    ),
    React.createElement('div', { className: 'flex-1 min-w-0' },
      React.createElement('h3', { className: 'font-bold text-base truncate' }, service.name),
      React.createElement('p', { className: 'text-sm text-stone-500' }, t('template.duration_min', service.duration_minutes))
    ),
    React.createElement('div', { className: 'text-right' },
      React.createElement('p', { className: 'text-lg font-bold text-propio-700' }, `${service.price}€`),
      React.createElement('p', { className: 'text-[10px] uppercase tracking-wider text-stone-400' }, t('booking.iva_incl'))
    )
  )
}

function DaySelector({ value, onChange, days = 14 }) {
  const dates = useMemo(() => {
    const arr = []
    const now = new Date(); now.setHours(0,0,0,0)
    for (let i=0; i<days; i++) {
      const d = new Date(now); d.setDate(d.getDate()+i); arr.push(d)
    }
    return arr
  }, [days])
  return React.createElement('div', { className: 'overflow-x-auto -mx-5 px-5 pb-2' },
    React.createElement('div', { className: 'flex gap-2' },
      dates.map(d => {
        const iso = localDateISO(d)
        const active = value === iso
        const today = iso === localDateISO(new Date())
        const dayName = d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')
        return React.createElement('button', {
          key: iso, onClick: () => onChange(iso),
          className: `shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-0.5 transition-all active:scale-[0.98] ${active ? 'bg-propio-500 text-white shadow-md' : 'bg-white border border-stone-200 text-stone-700'}`
        },
          React.createElement('span', { className: 'text-[10px] font-semibold uppercase tracking-wider opacity-80' }, today ? t('booking.today') : dayName),
          React.createElement('span', { className: 'text-xl font-bold leading-none' }, d.getDate()),
          React.createElement('span', { className: 'text-[10px] opacity-70 uppercase' }, d.toLocaleDateString(locale(), { month: 'short' }).replace('.', ''))
        )
      })
    )
  )
}

function TimeGrid({ slots, loading, value, onChange, onNextAvailable }) {
  if (loading) {
    return React.createElement('div', { className: 'grid grid-cols-3 gap-2 mt-4' },
      Array.from({length:9}).map((_,i) => React.createElement('div', { key:i, className: 'h-12 rounded-2xl bg-stone-100 animate-pulse' }))
    )
  }
  if (!slots.length) {
    return React.createElement('div', { className: 'mt-6 text-center py-10' },
      React.createElement('div', { className: 'w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3 text-2xl' }, '⏰'),
      React.createElement('p', { className: 'text-stone-600 font-semibold' }, t('booking.no_slots')),
      React.createElement('p', { className: 'text-stone-400 text-sm mt-1' }, t('booking.try_other')),
      onNextAvailable && React.createElement('button', { onClick: onNextAvailable, className: 'pill-outline mt-5' }, t('booking.next_available'))
    )
  }
  return React.createElement('div', { className: 'grid grid-cols-3 gap-2 mt-4' },
    slots.map(s => {
      const label = fmtTime(s)
      const active = value === s
      return React.createElement('button', {
        key: s, onClick: () => onChange(s),
        className: active ? 'pill-active' : 'pill-outline'
      }, label)
    })
  )
}

function BookingForm({ initial, summary, loading, error, onSubmit }) {
  const [isNew, setIsNew] = useState(null)
  return React.createElement('form', {
    onSubmit: (e) => {
      e.preventDefault()
      const data = new FormData(e.currentTarget)
      onSubmit({
        customer_name: (data.get('name')?.toString().trim() || '').replace(/\b\w/g, l => l.toUpperCase()).replace(/\bde\b|\bdel\b|\bla\b|\blos\b|\blas\b|\by\b/gi, m => m.toLowerCase()),
        customer_email: data.get('email')?.toString().trim() || null,
        customer_phone: data.get('phone')?.toString().trim(),
        is_first_time: isNew,
      })
    },
    className: 'space-y-4'
  },
    React.createElement('div', { className: 'card bg-propio-50 border-propio-100' },
      React.createElement('p', { className: 'text-xs uppercase tracking-wider text-propio-800 font-semibold' }, t('form.summary')),
      React.createElement('p', { className: 'text-base font-bold text-dark-500 mt-1' }, summary)
    ),
    field(t('form.name'), 'name', 'text', t('form.name_ph'), initial?.customer_name, true),
    field(t('form.phone'), 'phone', 'tel', t('form.phone_ph'), initial?.customer_phone, true),
    field(t('form.email'), 'email', 'email', t('form.email_ph'), initial?.customer_email, false),
    // First-time toggle
    React.createElement('div', null,
      React.createElement('p', { className: 'text-xs font-semibold text-stone-500 ml-1 mb-2' }, t('form.is_first')),
      React.createElement('div', { className: 'flex gap-2' },
        React.createElement('button', {
          type: 'button',
          onClick: () => setIsNew(true),
          className: `flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${
            isNew === true
              ? 'bg-propio-500 text-white shadow-sm'
              : 'bg-white border border-stone-200 text-stone-600'
          }`
        }, t('form.first_yes')),
        React.createElement('button', {
          type: 'button',
          onClick: () => setIsNew(false),
          className: `flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${
            isNew === false
              ? 'bg-dark-500 text-white shadow-sm'
              : 'bg-white border border-stone-200 text-stone-600'
          }`
        }, t('form.first_no'))
      )
    ),
    error && React.createElement('div', { className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3' }, error),
    React.createElement('button', { type: 'submit', disabled: loading, className: 'pill-primary w-full text-base py-4 disabled:opacity-50' },
      loading ? t('form.loading') : t('form.submit')),
    React.createElement('p', { className: 'text-center text-xs text-stone-400' }, t('form.disclaimer'))
  )
}

function field(label, name, type, placeholder, def, required) {
  return React.createElement('div', null,
    React.createElement('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, label),
    React.createElement('input', {
      name, type: type === 'tel' ? 'tel' : type,
      required: !!required, defaultValue: def, placeholder,
      autoComplete: { text: 'name', tel: 'tel', email: 'email' }[type],
      className: 'input-el mt-1'
    })
  )
}

function SuccessView({ booking, onReset }) {
  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const dateLabel = start.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
  const timeLabel = `${fmtTime(start.toISOString())} – ${fmtTime(end.toISOString())}`

  const buildIcs = () => {
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barber Studio//Booking//ES',
      'BEGIN:VEVENT', `UID:${booking.token_uuid}@barber.studio`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:Cita - ${booking.service_name}`, 'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n')
  }
  const downloadIcs = () => {
    const blob = new Blob([buildIcs()], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'cita.ics'; a.click()
    URL.revokeObjectURL(url)
  }

  const isNew = booking.is_first_booking

  return React.createElement('div', { className: 'text-center pt-6' },
    React.createElement('div', { className: 'w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5 text-4xl' }, '✓'),
    React.createElement('h2', { className: 'text-2xl font-extrabold' }, t('success.heading')),
    isNew && React.createElement('p', { className: 'text-propio-500 font-bold text-sm mt-1' }, t('success.welcome')),
    React.createElement('p', { className: 'text-stone-500 mt-2 px-4' }, t('success.message')),
    React.createElement('div', { className: 'card mt-8 text-left' },
      React.createElement('p', { className: 'text-xs uppercase tracking-wider text-stone-500 font-semibold' }, t('success.summary')),
      React.createElement('p', { className: 'text-lg font-bold capitalize mt-1' }, dateLabel),
      React.createElement('p', { className: 'text-propio-700 font-bold text-xl mt-0.5' }, timeLabel),
      React.createElement('div', { className: 'h-px bg-stone-100 my-3' }),
      React.createElement('div', { className: 'flex justify-between text-sm' },
        React.createElement('span', { className: 'text-stone-500' }, t('success.service')),
        React.createElement('span', { className: 'font-semibold' }, booking.service_name)
      )
    ),
    React.createElement('button', { onClick: downloadIcs, className: 'pill-outline w-full mt-6' }, t('success.add_calendar')),
    React.createElement('button', { onClick: onReset, className: 'text-stone-500 text-sm font-semibold mt-6 py-3 px-4' }, t('success.new_booking'))
  )
}

function ManageView({ booking, onCancel }) {
  return React.createElement('div', { className: 'space-y-4' },
    React.createElement('div', { className: 'card' },
      React.createElement('p', { className: 'text-xs uppercase tracking-wider text-stone-500 font-semibold' }, t('manage.heading')),
      React.createElement('p', { className: 'text-lg font-bold capitalize mt-1' },
        new Date(booking.start_time).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })),
      React.createElement('p', { className: 'text-propio-700 font-bold text-xl mt-0.5' },
        `${fmtTime(booking.start_time)} – ${fmtTime(booking.end_time)}`),
      React.createElement('div', { className: 'h-px bg-stone-100 my-3' }),
      React.createElement('div', { className: 'flex justify-between text-sm' },
        React.createElement('span', { className: 'text-stone-500' }, t('manage.service')),
        React.createElement('span', { className: 'font-semibold' }, booking.service_name)),
      React.createElement('div', { className: 'flex justify-between text-sm mt-1' },
        React.createElement('span', { className: 'text-stone-500' }, t('manage.status')),
        React.createElement('span', { className: 'font-semibold capitalize' }, booking.status))
    ),
    booking.status === 'booked' &&
      React.createElement('button', { onClick: onCancel, className: 'pill-outline w-full text-red-700 border-red-200' }, t('manage.cancel'))
  )
}

// ---------- App ----------
function App() {
  const [step, setStep] = useState('service')
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [date, setDate] = useState(() => localDateISO(new Date()))
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingBook, setLoadingBook] = useState(false)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState(null)
  const [manageToken, setManageToken] = useState(null)

  useEffect(() => { getServices().then(setServices).catch(e => setError(e.message)) }, [])

  // Check URL for manage token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setManageToken(token)
      getBooking(token).then(setBooking).catch(e => setError(e.message))
      setStep('manage')
    }
  }, [])

  const loadSlots = useCallback(async (serviceId, d) => {
    if (!serviceId) return
    setLoadingSlots(true); setError(null)
    try {
      const data = await getAvailableSlots(serviceId, d)
      setSlots(data.slots)
    } catch (e) { setError(e.message) }
    finally { setLoadingSlots(false) }
  }, [])

  useEffect(() => {
    if (step === 'slot' && selectedService) loadSlots(selectedService.id, date)
  }, [step, selectedService, date, loadSlots])

  const goNextAvailable = () => {
    const cur = new Date(date + 'T12:00:00'); cur.setDate(cur.getDate()+1); setDate(localDateISO(cur))
  }

  const handleSubmit = async (form) => {
    setFormData(form); setLoadingBook(true); setError(null)
    try {
      const res = await createBooking({ service_id: selectedService.id, start_time: selectedSlot, ...form })
      setBooking(res); setStep('success')
    } catch (e) { setError(e.message) }
    finally { setLoadingBook(false) }
  }

  const reset = () => {
    setStep('service'); setSelectedService(null); setSelectedSlot(null)
    setBooking(null); setError(null); setFormData(null)
  }

  const handleCancel = async () => {
    if (!manageToken) return
    try {
      await cancelBooking(manageToken)
      const updated = await getBooking(manageToken)
      setBooking(updated)
    } catch (e) { setError(e.message) }
  }

  return React.createElement('div', { className: 'min-h-full' },
    React.createElement(Header, {
      step,
      onBack:
        step === 'slot' ? () => setStep('service') :
        step === 'form' ? () => setStep('slot') :
        null
    }),
    React.createElement('main', { className: 'max-w-md mx-auto px-5 py-6 pb-24' },
      error && step !== 'form' && React.createElement('div',
        { className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4' }, error),

      (step === 'service' || step === 'slot' || step === 'form') && React.createElement(BookingStepper, { step }),

      step === 'service' && React.createElement('section', null,
        React.createElement('h2', { className: 'text-2xl font-extrabold mb-1' }, t('booking.title')),
        React.createElement('p', { className: 'text-stone-500 text-sm mb-5' }, t('booking.subtitle')),
        React.createElement('div', { className: 'space-y-3' },
          services.map(s => React.createElement(ServiceCard, {
            key: s.id, service: s,
            selected: selectedService?.id === s.id,
            onClick: () => { setSelectedService(s); setStep('slot') }
          }))
        )
      ),

      step === 'slot' && selectedService && React.createElement('section', null,
        React.createElement('div', { className: 'card mb-4 bg-dark-500 text-white' },
          React.createElement('p', { className: 'text-xs uppercase tracking-wider text-stone-400' }, t('booking.service_selected')),
          React.createElement('p', { className: 'font-bold text-lg mt-0.5' }, selectedService.name),
          React.createElement('p', { className: 'text-sm text-stone-300' }, t('template.duration_price', selectedService.duration_minutes, selectedService.price))),
        React.createElement('h3', { className: 'font-bold text-sm text-stone-500 uppercase tracking-wider mb-2' }, t('booking.day')),
        React.createElement(DaySelector, { value: date, onChange: setDate }),
        React.createElement('h3', { className: 'font-bold text-sm text-stone-500 uppercase tracking-wider mt-5 mb-1' }, t('booking.available_time')),
        React.createElement(TimeGrid, { slots, loading: loadingSlots, value: selectedSlot, onChange: setSelectedSlot, onNextAvailable: goNextAvailable })
      ),

      step === 'form' && selectedService && selectedSlot && React.createElement('section', null,
        React.createElement(BookingForm, {
          initial: formData,
          summary: t('template.summary', selectedService.name, fmtDate(selectedSlot), fmtTime(selectedSlot)),
          loading: loadingBook, error, onSubmit: handleSubmit
        })
      ),

      step === 'success' && booking && React.createElement('section', null,
        React.createElement(SuccessView, { booking, onReset: reset })
      ),

      step === 'manage' && booking && React.createElement('section', null,
        React.createElement(ManageView, { booking, onCancel: handleCancel })
      ),

      // Google Reviews link (solo al confirmar reserva)
      step === 'success' && React.createElement('div', { className: 'mt-6 text-center' },
        React.createElement('a', {
          href: 'https://search.google.com/local/reviews?placeid=PLACEHOLDER_PLACE_ID',
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-xs text-stone-400 hover:text-propio-500 underline transition'
        }, t('settings.view_reviews'))
      ),

      // ── Footer: "Powered by PROPIO" (solo en pasos de reserva, no en manage) ──
      step !== 'manage' && React.createElement('div', { className: 'mt-6 mb-4 text-center' },
        React.createElement('span', {
          className: 'inline-flex items-center gap-2 text-stone-300 text-[10px] font-medium tracking-wide'
        },
          React.createElement('img', {
            src: '/propio-icon.svg',
            alt: '',
            className: 'h-5 w-auto inline-block'
          }),
          'Powered by PROPIO'
        )
      )
    ),

    // ── Sticky CTA (solo paso slot, cuando hay horario seleccionado) ──
    step === 'slot' && selectedSlot && React.createElement('div', {
      className: 'fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-stone-200 safe-bottom'
    },
      React.createElement('div', { className: 'max-w-md mx-auto px-5 py-3' },
        React.createElement('button', {
          onClick: () => setStep('form'),
          className: 'w-full py-3 rounded-xl bg-propio-500 hover:bg-propio-600 text-white text-base font-bold active:scale-[0.98] transition shadow-lg cursor-pointer'
        }, t('booking.continue'))
      )
    )
  )
}

createRoot(document.getElementById('root')).render(React.createElement(App))
