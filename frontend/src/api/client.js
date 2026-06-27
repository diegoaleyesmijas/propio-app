const API = ''  // relative, uses vite proxy

export async function getServices() {
  const r = await fetch(`${API}/services`)
  if (!r.ok) throw new Error('No se pudieron cargar los servicios')
  return r.json()
}

export async function getAvailableSlots(serviceId, date) {
  const r = await fetch(`${API}/available-slots?service_id=${serviceId}&date=${date}`)
  if (!r.ok) throw new Error('No se pudieron cargar los horarios')
  return r.json()
}

export async function createBooking(payload) {
  const r = await fetch(`${API}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await r.json()
  if (!r.ok) {
    throw new Error(data.detail || 'Error al crear la reserva')
  }
  return data
}

export async function getBooking(token) {
  const r = await fetch(`${API}/manage/${token}`)
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Reserva no encontrada')
  return data
}

export async function cancelBooking(token) {
  const r = await fetch(`${API}/manage/${token}`, { method: 'DELETE' })
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'No se pudo cancelar')
  return data
}

export async function getAdminSummary(date) {
  const r = await fetch(`${API}/admin/summary?date=${date}`)
  return r.json()
}
