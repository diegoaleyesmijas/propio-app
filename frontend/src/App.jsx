import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header.jsx'
import { ServiceCard } from './components/ServiceCard.jsx'
import { DaySelector } from './components/DaySelector.jsx'
import { TimeGrid } from './components/TimeGrid.jsx'
import { BookingForm } from './components/BookingForm.jsx'
import { SuccessView } from './components/SuccessView.jsx'
import {
  getServices, getAvailableSlots, createBooking
} from './api/client.js'

function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function App() {
  const [step, setStep] = useState('service') // service | slot | form | success
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingBook, setLoadingBook] = useState(false)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState(null)

  useEffect(() => {
    getServices().then(setServices).catch((e) => setError(e.message))
  }, [])

  const loadSlots = useCallback(async (serviceId, d) => {
    if (!serviceId) return
    setLoadingSlots(true)
    setError(null)
    try {
      const data = await getAvailableSlots(serviceId, d)
      setSlots(data.slots)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'slot' && selectedService) {
      loadSlots(selectedService.id, date)
    }
  }, [step, selectedService, date, loadSlots])

  const goNextAvailable = () => {
    const cur = new Date(date)
    cur.setDate(cur.getDate() + 1)
    setDate(cur.toISOString().split('T')[0])
  }

  const handleSubmit = async (form) => {
    setFormData(form)
    setLoadingBook(true)
    setError(null)
    try {
      const res = await createBooking({
        service_id: selectedService.id,
        start_time: selectedSlot,
        ...form,
      })
      setBooking(res)
      setStep('success')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingBook(false)
    }
  }

  const reset = () => {
    setStep('service')
    setSelectedService(null)
    setSelectedSlot(null)
    setBooking(null)
    setError(null)
    setFormData(null)
  }

  return (
    <div className="min-h-full">
      <Header
        step={step}
        onBack={
          step === 'slot' ? () => setStep('service') :
          step === 'form' ? () => setStep('slot') :
          step === 'success' ? null :
          null
        }
      />

      <main className="max-w-md mx-auto px-5 py-6 pb-24">
        {error && step !== 'form' && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 mb-4">
            {error}
          </div>
        )}

        {step === 'service' && (
          <section>
            <h2 className="text-2xl font-extrabold mb-1">Reserva en 30 segundos</h2>
            <p className="text-stone-500 text-sm mb-5">Elige el servicio que necesitas hoy.</p>
            <div className="space-y-3">
              {services.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  selected={selectedService?.id === s.id}
                  onClick={() => { setSelectedService(s); setStep('slot') }}
                />
              ))}
            </div>
          </section>
        )}

        {step === 'slot' && selectedService && (
          <section>
            <div className="card mb-4 bg-stone-900 text-white">
              <p className="text-xs uppercase tracking-wider text-stone-400">Servicio elegido</p>
              <p className="font-bold text-lg mt-0.5">{selectedService.name}</p>
              <p className="text-sm text-stone-300">{selectedService.duration_minutes} min · {selectedService.price}€</p>
            </div>

            <h3 className="font-bold text-sm text-stone-500 uppercase tracking-wider mb-2">Día</h3>
            <DaySelector value={date} onChange={setDate} />

            <h3 className="font-bold text-sm text-stone-500 uppercase tracking-wider mt-5 mb-1">Hora disponible</h3>
            <TimeGrid
              slots={slots}
              loading={loadingSlots}
              value={selectedSlot}
              onChange={setSelectedSlot}
              onNextAvailable={goNextAvailable}
            />

            {selectedSlot && (
              <button
                onClick={() => setStep('form')}
                className="pill-primary w-full mt-6 text-base py-4"
              >
                Continuar
              </button>
            )}
          </section>
        )}

        {step === 'form' && selectedService && selectedSlot && (
          <section>
            <BookingForm
              initial={formData}
              summary={`${selectedService.name} · ${fmtDate(selectedSlot)} ${fmtTime(selectedSlot)}`}
              loading={loadingBook}
              error={error}
              onSubmit={handleSubmit}
            />
          </section>
        )}

        {step === 'success' && booking && (
          <section>
            <SuccessView booking={booking} onReset={reset} />
          </section>
        )}
      </main>
    </div>
  )
}
