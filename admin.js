// Panel interno del barbero - consume los endpoints /admin/* del backend real.
// Misma estetica mobile-first que el frontend publico, optimizado para uso interno.
// Funcionalidades: Agenda (dia/semana/mes), Proximas, Clientes (CRM),
// Notificaciones con polling, Creacion de reservas.

import React, { useState, useEffect, useCallback, useMemo, useRef, createElement as h } from 'https://esm.sh/react@18.3.1'
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client'
import { t, getLang, setLang, locale } from '/i18n.js'
// Eye/EyeOff SVG components (inline, sin dependencia CDN)
function EyeSvg({ size }) {
  const s = size || 24
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', width: s, height: s },
    h('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
    h('circle', { cx: '12', cy: '12', r: '3' })
  )
}
function EyeOffSvg({ size }) {
  const s = size || 24
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', width: s, height: s },
    h('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' }),
    h('path', { d: 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' }),
    h('line', { x1: '1', y1: '1', x2: '23', y2: '23' })
  )
}

const API = window.API_BASE || ''

// ── ErrorBoundary (evita que un error en un componente tumbe toda la app) ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return h('div', { className: 'p-6 text-center space-y-2' },
        h('p', { className: 'text-sm font-bold text-red-600' }, 'Error en el panel'),
        h('p', { className: 'text-xs text-stone-400' }, this.state.error?.message || 'Error desconocido'),
        h('button', {
          onClick: () => this.setState({ hasError: false, error: null }),
          className: 'text-xs font-semibold text-propio-500 hover:underline mt-2 cursor-pointer'
        }, 'Reintentar')
      )
    }
    return this.props.children
  }
}

// ── Admin auth (JWT via Authorization: Bearer) ──
function _getToken() { return sessionStorage.getItem('barber_admin_token') }
function _setToken(t) { sessionStorage.setItem('barber_admin_token', t) }
function _clearToken() { sessionStorage.removeItem('barber_admin_token') }

function _adminHeaders(extra = {}) {
  const token = _getToken()
  return { ...extra, ...(token ? { 'Authorization': 'Bearer ' + token } : {}) }
}

function _handleUnauthorized() {
  _clearToken()
  // Dispatch a custom event so the React app can react
  window.dispatchEvent(new CustomEvent('unauthorized'))
}

// ── API functions ────────────────────────────────────────────────────

async function getSummary(date) {
  const r = await fetch(`${API}/admin/summary?date=${date}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.agenda'))
  return r.json()
}

async function getClients(q = '') {
  const url = q ? `${API}/admin/clients?q=${encodeURIComponent(q)}` : `${API}/admin/clients`
  const r = await fetch(url, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.clients'))
  return r.json()
}

async function getServices() {
  const r = await fetch(`${API}/services`)
  if (!r.ok) throw new Error(t('error.services'))
  return r.json()
}

async function getBlocks(date) {
  const r = await fetch(`${API}/admin/blocks?date=${date}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.blocks'))
  return r.json()
}

async function getAvailableSlots(serviceId, date) {
  const r = await fetch(`${API}/available-slots?service_id=${serviceId}&date=${date}`)
  if (!r.ok) throw new Error(t('error.slots'))
  return r.json()
}

async function adminCreateBooking(payload) {
  const r = await fetch(`${API}/admin/appointments`, {
    method: 'POST', headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.create'))
  return data
}

async function getUpcoming() {
  const r = await fetch(`${API}/admin/upcoming`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.upcoming'))
  return r.json()
}

async function updateStatus(id, status) {
  const r = await fetch(`${API}/admin/appointments/${id}/status`, {
    method: 'PATCH',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status })
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.update'))
  return data
}

async function getWeeklyAgenda(date) {
  const r = await fetch(`${API}/admin/agenda/weekly?date=${date}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.agenda'))
  return r.json()
}

async function getMonthlyAgenda(date) {
  const r = await fetch(`${API}/admin/agenda/monthly?date=${date}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.agenda'))
  return r.json()
}

async function getClientDetail(id) {
  const r = await fetch(`${API}/admin/clients/${id}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.client_detail'))
  return r.json()
}

async function updateClient(id, payload) {
  const r = await fetch(`${API}/admin/clients/${id}`, {
    method: 'PATCH',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || t('error.update'))
  return data
}

async function dismissNotification(appointmentId) {
  const r = await fetch(`${API}/admin/notifications/${appointmentId}/dismiss`, {
    method: 'DELETE',
    headers: _adminHeaders()
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Failed to dismiss notification')
  return r.json()
}

async function getRecentBookings(since) {
  const url = since
    ? `${API}/admin/notifications/recent?since=${encodeURIComponent(since)}`
    : `${API}/admin/notifications/recent`
  const r = await fetch(url, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.notifications'))
  return r.json()
}
async function getNewClientStats(month) {
  const r = await fetch(`${API}/admin/stats/new-clients?month=${month}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error(t('error.clients'))
  return r.json()
}

async function getDashboard() {
  const r = await fetch(`${API}/admin/dashboard`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
  if (!r.ok) throw new Error('Error loading dashboard')
  return r.json()
}

async function deleteClient(id) {
  const r = await fetch(`${API}/admin/clients/${id}`, {
    method: 'DELETE', headers: _adminHeaders()
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('API Key requerida') }
      let data = {}
      try { data = await r.json() } catch (_) { /* 204 No Content = OK */ }
      if (!r.ok) throw new Error(data.detail || 'Error al eliminar cliente')
      return data
}

// ── Reset Demo API ────────────────────────────────────────────────────

async function resetDemoData() {
  const r = await fetch(`${API}/admin/reset-demo`, {
    method: 'POST',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ confirm: true })
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error resetting demo data')
  return data
}

// ── Settings API ──────────────────────────────────────────────────────

async function getHolidays(token, year) {
  const r = await fetch(`${API}/admin/holidays?year=${year}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error loading holidays')
  return r.json()
}

async function createHoliday(token, payload) {
  const r = await fetch(`${API}/admin/holidays`, {
    method: 'POST',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error creating holiday')
  return data
}

async function deleteHoliday(token, id) {
  const r = await fetch(`${API}/admin/holidays/${id}`, { method: 'DELETE', headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error deleting holiday')
  return r.json()
}

async function getSeasons(token) {
  const r = await fetch(`${API}/admin/seasons`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error loading seasons')
  return r.json()
}

async function createSeason(token, payload) {
  const r = await fetch(`${API}/admin/seasons`, {
    method: 'POST',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error creating season')
  return data
}

async function updateSeason(token, id, payload) {
  const r = await fetch(`${API}/admin/seasons/${id}`, {
    method: 'PATCH',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error updating season')
  return data
}

async function deleteSeason(token, id) {
  const r = await fetch(`${API}/admin/seasons/${id}`, { method: 'DELETE', headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error deleting season')
  return r.json()
}

async function getAdminBlocks(token, date) {
  const r = await fetch(`${API}/admin/blocks?date=${date}`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error loading blocks')
  return r.json()
}

async function createBlock(token, payload) {
  const r = await fetch(`${API}/admin/blocks`, {
    method: 'POST',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error creating block')
  return data
}

async function deleteBlock(token, id) {
  const r = await fetch(`${API}/admin/blocks/${id}`, { method: 'DELETE', headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error deleting block')
  return r.json()
}

async function getAdminSettings(token) {
  const r = await fetch(`${API}/admin/settings`, { headers: _adminHeaders() })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  if (!r.ok) throw new Error('Error loading settings')
  return r.json()
}

async function updateAdminSettings(token, payload) {
  const r = await fetch(`${API}/admin/settings`, {
    method: 'PATCH',
    headers: _adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (r.status === 401) { _handleUnauthorized(); throw new Error('Unauthorized') }
  const data = await r.json()
  if (!r.ok) throw new Error(data.detail || 'Error updating settings')
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────

// Devuelve la fecha local YYYY-MM-DD a partir de un Date (evita el bug UTC de toISOString)
function localDateISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid', hourCycle: 'h23' })
}

function fmtDate(iso) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
}

function fmtRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.round((d - now) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return t('relative.today')
  if (diffDays === 1) return t('relative.tomorrow')
  if (diffDays < 7) return t('relative.in_days', diffDays)
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return localDateISO(date)
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.2)
  } catch (e) { /* no audio available */ }
}

function todayISO() {
  return localDateISO(new Date())
}

// ── DayView timeline constants ──
const BUSINESS_START = 9    // 09:00 — primera hora visible
const BUSINESS_END = 20     // 20:00 — última hora visible
const TIME_COL_WIDTH = 48   // ancho de la columna de horas en px

// Density: 'compact' = 66px/hora, 'comfortable' = 90px/hora (default)
function getHourHeight() {
  try {
    const stored = localStorage.getItem('admin_agenda_density')
    return stored === 'compact' ? 66 : 90
  } catch {
    return 90
  }
}

function getApptTop(startTime, hourHeight) {
  const d = new Date(startTime)
  return ((d.getHours() + d.getMinutes() / 60) - BUSINESS_START) * hourHeight
}
function getApptHeight(startTime, endTime, hourHeight) {
  const min = (new Date(endTime) - new Date(startTime)) / 60000
  return Math.max(42, (min / 60) * hourHeight)  // mínimo 42px para legibilidad incluso en citas cortas
}

// ── Booksy-inspired card visual constants ──
const APPT_GAP = 4           // px de separación vertical entre citas (arriba y abajo)
const APPT_BORDER_LEFT = 4   // px del ancho de la barra de color izquierda (Booksy usa 4-5px)
const APPT_RADIUS = 8        // rounded-lg ~8px (coincide con Booksy)
const COMPACT_THRESHOLD = 72 // altura mínima para layout normal (vs compacto una sola línea)

function monthDays(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function monthFirstDow(year, month) {
  // Returns 0=Monday .. 6=Sunday
  const d = new Date(year, month, 1)
  return (d.getDay() + 6) % 7
}

const STATUS_CLS = {
  booked:    'text-blue-600',
  completed: 'text-emerald-600',
  cancelled: 'text-stone-400',
}

// ── Service color helpers (Booksy-inspired pastel palette) ──
const FALLBACK_COLOR = '#C29B70' // warm tan — evita el gris en servicios sin color
function hexToRgba(hex, alpha) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return undefined
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
function serviceAccent(color) {
  const c = color || FALLBACK_COLOR
  return {
    borderLeft: `4px solid ${c}`,
    backgroundColor: hexToRgba(c, 0.06),
  }
}
function serviceBgPastel(color) {
  const c = color || FALLBACK_COLOR
  return {
    backgroundColor: hexToRgba(c, 0.12),
    borderColor: hexToRgba(c, 0.25),
  }
}
// Colores para DayView: fondo suave + barra izquierda más visible
function apptCardBg(color) { return hexToRgba(color || FALLBACK_COLOR, 0.07) }
function apptCardBorder(color) { return hexToRgba(color || FALLBACK_COLOR, 0.45) }
function apptPastBg() { return '#fafaf9' }      // stone-50 (más claro, menos gris)
function apptPastBorder() { return '#e7e5e4' }   // stone-200 (más claro)

// ── SVG Icon components ───────────────────────────────────────────────

function SvgCalendar() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
    h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    h('line', { x1: '3', y1: '10', x2: '21', y2: '10' })
  )
}

function SvgList() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('line', { x1: '8', y1: '6', x2: '21', y2: '6' }),
    h('line', { x1: '8', y1: '12', x2: '21', y2: '12' }),
    h('line', { x1: '8', y1: '18', x2: '21', y2: '18' }),
    h('line', { x1: '3', y1: '6', x2: '3.01', y2: '6' }),
    h('line', { x1: '3', y1: '12', x2: '3.01', y2: '12' }),
    h('line', { x1: '3', y1: '18', x2: '3.01', y2: '18' })
  )
}

function SvgUsers() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
    h('circle', { cx: '9', cy: '7', r: '4' }),
    h('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }),
    h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' })
  )
}

function SvgDashboard() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('rect', { x: '3', y: '3', width: '7', height: '7' }),
    h('rect', { x: '14', y: '3', width: '7', height: '4' }),
    h('rect', { x: '14', y: '10', width: '7', height: '11' }),
    h('rect', { x: '3', y: '14', width: '7', height: '7' })
  )
}

function SvgSettings() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('circle', { cx: '12', cy: '12', r: '3' }),
    h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })
  )
}

function SvgLogout() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
    h('polyline', { points: '16 17 21 12 16 7' }),
    h('line', { x1: '21', y1: '12', x2: '9', y2: '12' })
  )
}

function SvgBell() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
    h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
  )
}

function SvgCheck() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('polyline', { points: '20 6 9 17 4 12' })
  )
}

function SvgPlus({ className }) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: className || 'w-6 h-6' },
    h('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
    h('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
  )
}

function SvgArrowLeft() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('polyline', { points: '15 18 9 12 15 6' })
  )
}

function SvgArrowRight() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
    h('polyline', { points: '9 18 15 12 9 6' })
  )
}

function SvgWhatsApp({ className }) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', className: className || 'w-5 h-5' },
    h('path', {
      d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'
    })
  )
}

function SvgClose() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
  )
}

function SvgRefresh() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('polyline', { points: '23 4 23 10 17 10' }),
    h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
  )
}

function SvgSoundOn() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
    h('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' }),
    h('path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' })
  )
}

function SvgSoundOff() {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
    h('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
    h('line', { x1: '23', y1: '9', x2: '17', y2: '15' }),
    h('line', { x1: '17', y1: '9', x2: '23', y2: '15' })
  )
}

// ── Shared UI Components ─────────────────────────────────────────────

const StatusPill = React.memo(function StatusPill({ status }) {
  const label = t('status.' + status) || status
  const cls = STATUS_CLS[status] || 'text-stone-400'
  return h('span', {
    className: 'text-[9px] font-medium uppercase tracking-wider ' + cls
  }, '\u25CF ' + label)
})

function normalizeName(name) {
  if (!name) return ''
  return name.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\bde\b|\bdel\b|\bla\b|\blos\b|\blas\b|\by\b/gi, m => m.toLowerCase())
}

function cleanPhone(phone) {
  if (!phone) return ''
  return phone.replace(/[\s\-\+\(\)]/g, '').replace(/^00/, '')
}

// ── Web Push helper ──
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)))
}

const AppointmentCard = React.memo(function AppointmentCard({ appt, onComplete, onCancel, busy, compact }) {
  const isPast = appt.status === 'completed' || appt.status === 'cancelled'

  if (compact) {
    return h('div', {
      className: 'bg-white rounded-xl p-2 border border-stone-200 text-xs space-y-1'
    },
      h('div', { className: 'flex items-center justify-between gap-1' },
        h('span', { className: 'font-bold text-stone-800' }, fmtTime(appt.start_time)),
        h(StatusPill, { status: appt.status })
      ),
      h('p', { className: 'font-semibold text-stone-800 truncate', title: appt.customer_name }, normalizeName(appt.customer_name)),
      h('p', { className: 'text-[10px] text-stone-500 truncate' }, appt.service_name),
      !isPast && appt.status === 'booked' && h('div', { className: 'flex gap-1 mt-1' },
        h('button', {
          onClick: (e) => { e.stopPropagation(); onComplete(appt.id) },
          disabled: busy,
          className: 'flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition disabled:opacity-50 cursor-pointer'
        }, busy ? '…' : '\u2713'),
        h('button', {
          onClick: (e) => { e.stopPropagation(); onCancel(appt.id) },
          disabled: busy,
          className: 'flex-1 text-[10px] font-bold py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white active:scale-[0.98] transition disabled:opacity-50 cursor-pointer'
        }, busy ? '…' : '\u2717')
      )
    )
  }

  return h('div', {
    className: 'rounded-2xl border border-stone-200 shadow-sm overflow-hidden',
    style: serviceAccent(appt.service_color),
  },
    h('div', { className: 'flex items-stretch' },
      // Time column (lighter)
      h('div', { className: 'w-16 shrink-0 flex flex-col items-center justify-center bg-stone-50/80 py-2' },
        h('p', { className: 'text-base font-bold text-stone-900 leading-tight' }, fmtTime(appt.start_time)),
        appt.end_time && h('p', { className: 'text-[8px] text-stone-400 uppercase tracking-wider mt-0.5' }, fmtTime(appt.end_time))
      ),
      // Content column (row 1: name+NUEVO, row 2: StatusPill+service·price)
      h('div', { className: 'flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-0.5' },
        h('div', { className: 'flex items-center gap-1.5' },
          h('p', { className: 'font-semibold text-sm text-stone-800 truncate' }, normalizeName(appt.customer_name)),
          appt.is_first_booking && h('span', { className: 'text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0' }, t('admin.client_new'))
        ),
        h('div', { className: 'flex items-center gap-1.5 text-xs text-stone-500' },
          h(StatusPill, { status: appt.status }),
          h('span', { className: 'text-stone-300' }, '\u00B7'),
          h('span', { className: 'truncate' }, appt.service_name),
          appt.service_price != null && h('span', { className: 'text-stone-400' }, appt.service_price + '\u20AC')
        )
      ),
      // Action column (icon buttons only)
      h('div', { className: 'shrink-0 flex flex-col items-center justify-center gap-1 pr-2 py-2' },
        !isPast && appt.status === 'booked' && h('div', { className: 'flex gap-1' },
          h('button', {
            onClick: (e) => { e.stopPropagation(); onComplete(appt.id) },
            disabled: busy,
            className: 'w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-emerald-700',
            title: t('admin.complete')
          }, busy ? '…' : '\u2713'),
          h('button', {
            onClick: (e) => { e.stopPropagation(); onCancel(appt.id) },
            disabled: busy,
            className: 'w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center text-xs active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-red-600',
            title: t('admin.cancel')
          }, busy ? '…' : '\u2717')
        )
      )
    )
  )
})

// ── Appointment Detail Modal ──────────────────────────────────────────
const DetailModal = React.memo(function DetailModal({ appt, onClose, onComplete, onCancel, busyId }) {
  const [clientData, setClientData] = useState(null)
  const [clientLoading, setClientLoading] = useState(false)
  const [clientError, setClientError] = useState(false)

  useEffect(() => {
    if (!appt || !appt.client_id) {
      setClientData(null)
      setClientLoading(false)
      setClientError(false)
      return
    }
    setClientLoading(true)
    setClientError(false)
    getClientDetail(appt.client_id)
      .then(data => { setClientData(data); setClientLoading(false) })
      .catch(() => { setClientError(true); setClientLoading(false) })
  }, [appt?.client_id])

  if (!appt) return null

  const isPast = appt.status === 'completed' || appt.status === 'cancelled'

  return h('div', {
    className: 'fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4',
    onClick: (e) => { if (e.target === e.currentTarget) onClose() }
  },
    // Backdrop
    h('div', { className: 'absolute inset-0 bg-black/40' }),
    // Modal card
    h('div', {
      className: 'relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden'
    },
      // Header
      h('div', { className: 'flex items-center justify-between px-4 py-3 border-b border-stone-100' },
        h('h3', { className: 'font-bold text-base text-stone-800 truncate' }, t('crm.title')),
        h('button', {
          onClick: onClose,
          className: 'w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-400 cursor-pointer transition-colors'
        }, h(SvgClose))
      ),
      // Body
      h('div', { className: 'px-4 py-3 space-y-3' },
        // Customer info
        h('div', { className: 'space-y-1' },
          h('p', { className: 'font-bold text-lg text-stone-900' }, normalizeName(appt.customer_name)),
          appt.customer_phone && h('p', { className: 'text-sm text-stone-500' }, appt.customer_phone),
          appt.customer_email && h('p', { className: 'text-sm text-stone-500 truncate' }, appt.customer_email)
        ),
        // Divider
        h('div', { className: 'border-t border-stone-100' }),
        // Service details
        h('div', { className: 'space-y-1.5' },
          h('div', { className: 'flex items-center gap-2' },
            h('span', { className: 'font-bold text-sm text-stone-800' }, appt.service_name),
            appt.service_price != null && h('span', { className: 'text-xs text-stone-400 font-medium' }, appt.service_price + '\u20AC')
          ),
          h('div', { className: 'flex items-center gap-2 text-sm text-stone-600' },
            h('span', null, fmtTime(appt.start_time)),
            h('span', { className: 'text-stone-300' }, '\u2014'),
            h('span', null, fmtTime(appt.end_time))
          ),
          h(StatusPill, { status: appt.status })
        ),
        // Client stats (if available)
        clientLoading && h('div', { className: 'flex items-center gap-2 text-xs text-stone-400 py-2' },
          h('div', { className: 'w-3 h-3 rounded-full border-2 border-stone-300 border-t-transparent animate-spin' }),
          h('span', null, t('admin.loading'))
        ),
        clientError && h('p', { className: 'text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2' },
          t('error.client_detail')
        ),
        clientData && !clientLoading && h('div', { className: 'space-y-2' },
          h('div', { className: 'border-t border-stone-100' }),
          h('div', { className: 'grid grid-cols-2 gap-2' },
            h('div', { className: 'bg-stone-50 rounded-lg p-2.5' },
              h('p', { className: 'text-[9px] font-bold text-stone-500 uppercase tracking-wider' }, t('crm.total_visits')),
              h('p', { className: 'text-lg font-bold text-stone-800 mt-0.5' }, clientData.stats?.total_appointments ?? '—')
            ),
            h('div', { className: 'bg-stone-50 rounded-lg p-2.5' },
              h('p', { className: 'text-[9px] font-bold text-stone-500 uppercase tracking-wider' }, t('crm.total_spent')),
              h('p', { className: 'text-lg font-bold text-stone-800 mt-0.5' },
                (clientData.stats?.total_spent ?? 0).toFixed(2) + '\u20AC'
              )
            )
          ),
          clientData.created_at && h('div', { className: 'bg-stone-50 rounded-lg p-2.5' },
            h('p', { className: 'text-[9px] font-bold text-stone-500 uppercase tracking-wider' }, t('crm.member_since')),
            h('p', { className: 'text-sm font-semibold text-stone-800 mt-0.5' }, fmtDate(clientData.created_at))
          ),
          clientData.stats?.completed_visits > 0 && clientData.visits && clientData.visits.length > 0 && h('div', { className: 'bg-stone-50 rounded-lg p-2.5' },
            h('p', { className: 'text-[9px] font-bold text-stone-500 uppercase tracking-wider' }, t('crm.last_visit')),
            h('p', { className: 'text-sm font-semibold text-stone-800 mt-0.5' }, fmtDateShort(clientData.visits[0].start_time))
          )
        )
      ),
      // Actions
      !isPast && appt.status === 'booked' && h('div', { className: 'px-4 py-3 border-t border-stone-100 flex gap-2' },
        h('button', {
          onClick: (e) => { e.stopPropagation(); onComplete(appt.id); onClose() },
          disabled: busyId === appt.id,
          className: 'flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] transition disabled:opacity-50 cursor-pointer hover:bg-emerald-700'
        }, busyId === appt.id ? '…' : '\u2713 ' + t('admin.complete')),
        h('button', {
          onClick: (e) => { e.stopPropagation(); onCancel(appt.id); onClose() },
          disabled: busyId === appt.id,
          className: 'flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-[0.98] transition disabled:opacity-50 cursor-pointer hover:bg-red-600'
        }, busyId === appt.id ? '…' : '\u2717 ' + t('admin.cancel'))
      ),
      // Close link
      h('div', { className: 'px-4 py-2.5 border-t border-stone-100 text-center' },
        h('button', {
          onClick: onClose,
          className: 'text-xs font-semibold text-stone-500 hover:text-stone-700 transition cursor-pointer'
        }, t('admin.close'))
      )
    )
  )
})

function StatCard({ label, value, sub }) {
  return h('div', { className: 'rounded-2xl p-[1.5px] bg-stone-100/80' },
    h('div', { className: 'bg-white rounded-[calc(2rem-1.5px)] p-3 border border-stone-200/60 shadow-sm' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500' }, label),
      h('p', { className: 'text-2xl font-extrabold text-stone-900 mt-0.5' }, value),
      sub && h('p', { className: 'text-[11px] text-stone-400 mt-0.5' }, sub)
    )
  )
}

// ── KPI Card ──
function KpiCard({ label, value, unit, trend, color, action, actionLabel, icon, onCardClick }) {
  const colorMap = {
    propio: { accent: 'bg-propio-500', text: 'text-propio-700', soft: 'bg-propio-50', ring: 'ring-propio-100' },
    amber: { accent: 'bg-propio-500', text: 'text-propio-700', soft: 'bg-propio-50', ring: 'ring-amber-100' },
    emerald: { accent: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', ring: 'ring-emerald-100' },
    violet: { accent: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50', ring: 'ring-violet-100' },
    red: { accent: 'bg-red-500', text: 'text-red-700', soft: 'bg-red-50', ring: 'ring-red-100' },
    stone: { accent: 'bg-stone-500', text: 'text-stone-900', soft: 'bg-stone-50', ring: 'ring-stone-100' },
  }
  const c = colorMap[color] || colorMap.stone

  return h('div', {
    className: 'rounded-[1.75rem] p-[1.5px] ' + (onCardClick ? 'cursor-pointer' : ''),
    onClick: onCardClick,
    role: onCardClick ? 'button' : undefined,
    tabIndex: onCardClick ? 0 : undefined,
    onKeyDown: onCardClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick() } } : undefined
  },
    h('div', {
      className: 'bg-white rounded-[calc(1.75rem-1.5px)] border border-stone-200/60 shadow-sm p-3 sm:p-4 min-h-[116px] flex flex-col justify-between ' +
        (onCardClick ? 'hover:border-stone-300 hover:shadow-md transition-all' : ''),
    },
    h('div', { className: 'flex items-start justify-between gap-3' },
      h('div', { className: 'min-w-0' },
        h('p', { className: 'text-[10px] font-bold text-stone-500 uppercase tracking-wider truncate' }, label),
        h('div', { className: 'flex items-baseline gap-1.5 mt-2' },
          h('span', { className: `text-2xl sm:text-3xl font-extrabold tracking-tight ${c.text}` }, value),
          unit && h('span', { className: 'text-xs sm:text-sm text-stone-400 font-semibold truncate' }, unit)
        )
      ),
      h('div', { className: `w-9 h-9 rounded-lg ${c.soft} ${c.text} ring-1 ${c.ring} flex items-center justify-center shrink-0` },
        icon || h('span', { className: `w-2.5 h-2.5 rounded-full ${c.accent}` })
      )
    ),
    h('div', { className: 'flex items-center justify-between gap-2 mt-3' },
      trend && h('p', { className: `text-xs font-semibold ${trend.direction === 'up' ? 'text-emerald-600' : 'text-red-500'}` },
        (trend.direction === 'up' ? '\u25B2' : '\u25BC') + ' ' + trend.value + '%'
      ),
      !trend && h('span', null),
      action && h('button', {
        onClick: (e) => { e.stopPropagation(); action() },
        className: `text-xs font-bold ${c.text} hover:underline underline-offset-4 transition`
      }, actionLabel)
    )
  )
  )
}

// ── Quick Action ──
function QuickAction({ icon, label, onClick, bgColor }) {
  return h('button', {
    onClick,
    className: 'flex items-center gap-3 bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-sm transition-shadow text-left'
  },
    h('div', { className: `w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center text-white text-lg font-bold shrink-0` },
      typeof icon === 'string' ? icon : h(icon)
    ),
    h('span', { className: 'text-sm font-semibold text-stone-800' }, label),
  )
}

function EmptyState({ title, sub }) {
  return h('div', { className: 'text-center py-12 px-4' },
    h('p', { className: 'font-bold text-stone-700' }, title),
    h('p', { className: 'text-sm text-stone-400 mt-1' }, sub)
  )
}

function TabButton({ active, onClick, icon, label, collapsed }) {
  return h('button', {
    onClick,
    className: 'flex-1 md:flex-none md:w-full flex flex-col md:flex-row items-center md:justify-start gap-1 md:gap-3 py-2.5 md:px-4 md:py-3 md:rounded-xl transition cursor-pointer ' + (active ? 'text-propio-500 bg-propio-50 md:bg-propio-50 rounded-xl' : 'text-stone-400 md:text-stone-500 md:hover:bg-stone-100 md:hover:text-stone-700')
  },
    icon,
    h('span', { className: 'text-[10px] md:text-xs font-bold uppercase tracking-wider ' + (collapsed ? 'hidden' : '') }, label)
  )
}

function ViewToggle({ view, onChange }) {
  const views = ['day', 'week', 'month']
  return h('div', { className: 'inline-flex gap-0.5 bg-stone-100 rounded-lg p-0.5' },
    views.map(v => h('button', {
      key: v,
      onClick: () => onChange(v),
      className: 'text-[11px] font-semibold py-1.5 px-3 rounded-md transition-all duration-200 cursor-pointer ' + (view === v ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80' : 'text-stone-500 hover:text-stone-700')
    }, t('agenda.' + v)))
  )
}

function LoadingSkeleton({ count = 6 }) {
  return h('div', { className: 'space-y-2' },
    Array.from({ length: count }).map((_, i) => h('div', {
      key: i,
      className: 'h-16 rounded-2xl bg-stone-100 animate-pulse'
    }))
  )
}

// ── NotificationBell ─────────────────────────────────────────────────

function NotificationBell({ notifications, newCount, soundEnabled, onToggleSound, onTogglePanel, open, onDismiss }) {
  return h('div', { className: 'relative' },
    h('button', {
      onClick: onTogglePanel,
      className: 'relative w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 cursor-pointer',
      title: t('notif.title')
    },
      h(SvgBell),
      newCount > 0 && h('span', {
        className: 'absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow'
      }, newCount > 99 ? '99+' : String(newCount))
    ),
    open && h('div', {
      className: 'absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 max-h-96 overflow-y-auto'
    },
      h('div', { className: 'flex items-center justify-between px-4 pt-3 pb-2 border-b border-stone-100' },
        h('p', { className: 'font-bold text-sm text-stone-800' }, t('notif.title')),
        h('button', {
          onClick: onToggleSound,
          className: 'p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer',
          title: soundEnabled ? t('notif.sound_on') : t('notif.sound_off')
        }, soundEnabled ? h(SvgSoundOn) : h(SvgSoundOff))
      ),
      notifications.length === 0
        ? h('p', { className: 'text-sm text-stone-400 text-center py-8' }, t('notif.empty'))
        : h('div', { className: 'py-1' },
            notifications.map((n, i) => h('div', {
              key: n.id || i,
              className: 'px-4 py-3 hover:bg-stone-50 border-b border-stone-50 last:border-0 flex items-start gap-2'
            },
              h('div', { className: 'flex-1 min-w-0' },
                h('p', { className: 'text-sm font-semibold text-stone-800' },
                  t('notif.new_booking', n.customer_name)),
                h('p', { className: 'text-xs text-stone-500 mt-0.5' }, t('notif.new_booking_detail', n.service_name || '', fmtTime(n.start_time)))
              ),
              h('button', {
                onClick: (e) => { e.stopPropagation(); onDismiss(n.id) },
                className: 'shrink-0 mt-0.5 w-6 h-6 rounded-full hover:bg-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-600 transition cursor-pointer',
                title: t('notif.dismiss')
              },
                h(SvgClose)
              )
            ))
          )
    )
  )
}

// ── WeekView ──────────────────────────────────────────────────────────

function WeekView({ weeklyData, onComplete, onCancel, busyId, loading, onToast, density, onSelectDay }) {
  if (loading) return h(LoadingSkeleton)
  if (!weeklyData) return h(EmptyState, { title: t('admin.agenda_empty'), sub: t('admin.agenda_empty_sub') })

  const days = weeklyData.days || {}
  const dayKeys = Object.keys(days).sort()
  const isCompact = density === 'compact'

  return h('div', { className: 'overflow-x-auto -mx-4 px-4 pb-2' },
    h('div', { className: 'flex gap-2.5', style: { minWidth: '700px' } },
      dayKeys.map(dayKey => {
        const appts = days[dayKey] || []
        const d = new Date(dayKey + 'T12:00:00')
        const dayName = t('agenda.day_short_' + ((d.getDay() + 6) % 7))
        const isToday = dayKey === todayISO()
        const busyLevel = appts.length === 0 ? 'empty' : appts.length <= 2 ? 'light' : 'busy'
        return h('div', {
          key: dayKey,
          onClick: () => onSelectDay(dayKey),
          className: 'flex-1 min-w-[110px] rounded-2xl cursor-pointer hover:shadow-md transition-shadow ' + (isToday ? 'bg-propio-50 ring-2 ring-propio-200' : 'bg-white border border-stone-200')
        },
          // Day header
          h('div', {
            className: 'text-center px-2 py-2 ' + (isToday ? '' : 'border-b border-stone-100')
          },
            h('p', { className: 'text-[11px] font-bold uppercase tracking-wider ' + (isToday ? 'text-propio-700' : 'text-stone-500') }, dayName),
            h('p', { className: 'text-xl font-extrabold leading-tight ' + (isToday ? 'text-propio-800' : 'text-stone-800') }, d.getDate()),
            h('p', { className: 'text-[9px] text-stone-400 uppercase' }, d.toLocaleDateString(locale(), { month: 'short' }).replace('.', '')),
            // Busy indicator
            h('div', { className: 'flex justify-center gap-0.5 mt-1.5' },
              appts.length === 0
                ? h('span', { className: 'text-[8px] text-stone-300 font-bold uppercase tracking-wider' }, '-')
                : Array.from({ length: Math.min(appts.length, 5) }).map((_, i) =>
                    h('span', { key: i, className: 'w-1.5 h-1.5 rounded-full ' + (i < appts.length ? 'bg-propio-500' : 'bg-stone-200') })
                  )
            )
          ),
          // Appointments
          h('div', { className: 'p-1.5 space-y-1' },
            appts.length === 0
              ? h('p', { className: 'text-[9px] text-stone-200 text-center py-2 font-bold uppercase tracking-wider' }, t('agenda.no_data'))
              : appts.map(a => {
                  const isPast = a.status === 'completed' || a.status === 'cancelled'
                  const apptPadding = isCompact ? 'px-1.5 py-0.5' : 'px-1.5 py-1'
                  const apptTextSize = isCompact ? 'text-[9px]' : 'text-xs'
                  return h('div', {
                    key: a.id,
                    className: 'rounded-lg overflow-hidden ' + apptPadding + ' ' + (isPast ? 'bg-stone-100' : 'border'),
                    style: !isPast ? serviceBgPastel(a.service_color) : {},
                  },
                    h('div', { className: 'flex items-center justify-between gap-1' },
                      h('span', { className: (isCompact ? 'text-[9px]' : 'text-[10px]') + ' font-bold ' + (isPast ? 'text-stone-500' : 'text-propio-800') }, fmtTime(a.start_time)),
                      a.status === 'completed'
                        ? h('span', { className: 'text-[8px] font-bold text-emerald-600 uppercase' }, t('status.completed'))
                        : a.status === 'cancelled'
                          ? h('span', { className: 'text-[8px] font-bold text-red-400 uppercase' }, t('status.cancelled'))
                           : h('div', { className: 'flex gap-0.5' },
                                h('button', {
                                  onClick: (e) => { e.stopPropagation(); onComplete(a.id); onToast && onToast({ id: a.id, type: 'complete' }) },
                                  disabled: busyId === a.id,
                                  className: (isCompact ? 'text-[7px] py-0.5 px-1' : 'text-[8px] py-1 px-1.5') + ' font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition disabled:opacity-50 cursor-pointer'
                                }, busyId === a.id ? '…' : '\u2713'),
                                h('button', {
                                  onClick: (e) => { e.stopPropagation(); onCancel(a.id); onToast && onToast({ id: a.id, type: 'cancel' }) },
                                  disabled: busyId === a.id,
                                  className: (isCompact ? 'text-[7px] py-0.5 px-1' : 'text-[8px] py-1 px-1.5') + ' font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white active:scale-[0.98] transition disabled:opacity-50 cursor-pointer'
                                }, busyId === a.id ? '…' : '\u2717')
                              )
                     ),
                     h('p', { className: (isCompact ? 'text-[9px]' : 'text-xs') + ' font-bold truncate ' + (isPast ? 'text-stone-500' : 'text-stone-800'), title: a.customer_name }, normalizeName(a.customer_name)),
                     h('p', { className: 'text-[8px] text-stone-400 truncate', title: a.service_name }, a.service_name)
                   )
                })
          )
        )
    })
  )
  )
}

// ── DayView (time grid) ──
function DayView({ appointments, blocks = [], date, onComplete, onCancel, busyId, density, onAppointmentClick }) {
  const scrollRef = React.useRef(null)
  const [now, setNow] = React.useState(new Date())
  const isToday = date === todayISO()
  const hourHeight = getHourHeight()

  // Update current time every 60 seconds
  React.useEffect(() => {
    if (!isToday) return
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [isToday])

  // Auto-scroll on mount / date change
  React.useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    if (isToday) {
      const currentHour = now.getHours() + now.getMinutes() / 60
      const scrollTo = Math.max(0, (currentHour - BUSINESS_START - 2.5) * hourHeight)
      el.scrollTo({ top: scrollTo, behavior: 'smooth' })
    } else {
      el.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [date, hourHeight])

  // ── Regla de negocio: estados que representan "ocupación real" del calendario ──
  // booked → cita confirmada que ocupa el slot
  // completed → cita que ya se atendió, el slot ya pasó
  // Cualquier estado futuro que represente ocupación efectiva debe añadirse aquí.
  const OCCUPIED_STATUSES = ['booked', 'completed']

  // ── Regla de negocio: canceladas cuyo slot fue reutilizado no se muestran en la grilla ──
  // Si una cita cancelada solapa (parcial o totalmente) con otra cuyo estado está
  // en OCCUPIED_STATUSES, significa que ese hueco fue re-ocupado después de la cancelación.
  // La cancelada se oculta porque la grilla debe reflejar ocupación operativa real,
  // no el historial de cancelaciones.
  const visibleAppointments = React.useMemo(() => {
    const active = appointments.filter(a => OCCUPIED_STATUSES.includes(a.status))
    if (active.length === 0) return appointments
    const cancelled = appointments.filter(a => a.status === 'cancelled')
    if (cancelled.length === 0) return appointments

    const hiddenIds = new Set()
    for (const c of cancelled) {
      const cStart = new Date(c.start_time).getTime()
      const cEnd = new Date(c.end_time).getTime()
      for (const a of active) {
        const aStart = new Date(a.start_time).getTime()
        const aEnd = new Date(a.end_time).getTime()
        if (aStart < cEnd && aEnd > cStart) { // solapan total o parcialmente
          hiddenIds.add(c.id)
          break
        }
      }
    }
    return appointments.filter(a => !hiddenIds.has(a.id))
  }, [appointments])

  // Build hour slots array
  const hours = []
  for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
    hours.push(hour)
  }

  const totalHeight = (BUSINESS_END - BUSINESS_START) * hourHeight

  return h('div', { className: 'rounded-xl border border-stone-200/50 bg-white shadow-sm overflow-hidden' },
    h('div', {
      ref: scrollRef,
      className: 'overflow-y-auto no-scrollbar',
      style: { maxHeight: 'calc(100vh - 150px)' }
    },
      h('div', { className: 'relative', style: { minHeight: totalHeight + 'px' } },

        // ── Background grid: hour rows + time labels ──
        hours.map(hour =>
          h('div', {
            key: 'h-' + hour,
            className: 'flex',
            style: { height: hourHeight + 'px' }
          },
            // Time label (left column) — clean, legible
            h('div', {
              className: 'shrink-0 text-right pr-3 pt-0 text-[10px] font-semibold text-stone-400 select-none',
              style: { width: TIME_COL_WIDTH + 'px', lineHeight: '1' }
            }, String(hour).padStart(2, '0') + ':00'),
            // Hour separator line — barely visible
            h('div', { className: 'flex-1 border-t border-stone-50' })
          )
        ),

        // ── 15-min tick marks with time labels ──
        hours.map(hour =>
          [0.25, 0.5, 0.75].map(fraction => {
            const mins = Math.round(fraction * 60)
            const label = String(hour).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
            const isHalf = fraction === 0.5
            return h('div', {
              key: 'tm-' + hour + '-' + fraction,
              className: 'absolute pointer-events-none',
              style: {
                top: ((hour - BUSINESS_START) + fraction) * hourHeight + 'px',
                left: '0',
                right: '16px',
                height: '0',
              }
            },
              // Label (en la columna horaria, muy pequeño)
              h('span', {
                className: 'absolute select-none ' + (
                  isHalf
                    ? 'text-[8px] font-semibold text-stone-400'
                    : 'text-[7px] font-medium text-stone-300'
                ),
                style: {
                  left: '0',
                  top: '-5px',
                  width: (TIME_COL_WIDTH - 4) + 'px',
                  textAlign: 'right',
                  paddingRight: '4px'
                }
              }, label),
              // Línea discontinua
              h('div', {
                className: 'absolute',
                style: {
                  left: TIME_COL_WIDTH + 'px',
                  right: '0',
                  height: '0',
                  borderTop: isHalf
                    ? '1px dashed rgba(120,113,108,0.10)'
                    : '1px dashed rgba(120,113,108,0.06)'
                }
              })
            )
          })
        ).flat(),

        // ── Time blocks (horarios bloqueados: franjas rayadas) ──
        blocks.filter(b => b.block_type === 'time_range').map(b => {
          const [hS, mS] = b.start_time.split(':').map(Number)
          const [hE, mE] = b.end_time.split(':').map(Number)
          const blockTop = ((hS + mS / 60) - BUSINESS_START) * hourHeight
          const blockH = ((hE + mE / 60) - (hS + mS / 60)) * hourHeight
          return h('div', {
            key: 'block-' + b.id,
            className: 'absolute pointer-events-none overflow-hidden',
            style: {
              left: (TIME_COL_WIDTH + 14) + 'px',
              right: '14px',
              top: blockTop + 'px',
              height: Math.max(blockH - 1, 4) + 'px',
              borderRadius: '8px',
              zIndex: 5,
            }
          },
            // Fondo rayado (stripes diagonales sutiles)
            h('div', { className: 'absolute inset-0', style: {
              background: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.04) 0px, rgba(239,68,68,0.04) 6px, rgba(239,68,68,0.09) 6px, rgba(239,68,68,0.09) 12px)',
              borderRadius: 'inherit'
            }}),
            // Label
            h('div', { className: 'absolute inset-0 flex items-center px-3' },
              h('div', { className: 'flex items-center gap-1.5' },
                h('span', { className: 'text-[9px] font-bold text-red-400 uppercase tracking-wider' }, '\u26A0'),
                h('span', { className: 'text-[10px] font-semibold text-red-400 truncate' }, b.reason || (getLang() === 'en' ? 'Blocked' : 'Bloqueado'))
              )
            )
          )
        }),

        // ── Full-day block ──
        blocks.some(b => b.block_type === 'full_day') && h('div', {
          className: 'absolute inset-0 pointer-events-none',
          style: {
            left: TIME_COL_WIDTH + 'px',
            right: '0',
            top: '0',
            height: '100%',
            zIndex: 4
          }
        },
          h('div', { className: 'absolute inset-0', style: {
            background: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.03) 0px, rgba(239,68,68,0.03) 8px, rgba(239,68,68,0.07) 8px, rgba(239,68,68,0.07) 16px)',
          }}),
          h('div', { className: 'absolute inset-0 flex items-start justify-center pt-8' },
            h('span', { className: 'text-xs font-bold text-red-300 uppercase tracking-widest' },
              blocks.find(b => b.block_type === 'full_day')?.reason || (getLang() === 'en' ? 'Day blocked' : 'Día bloqueado')
            )
          )
        ),

        // ── Appointment blocks (Booksy-inspired: clean blocks, strong color accent, clear separation) ──
        visibleAppointments.map(a => {
          const top = getApptTop(a.start_time, hourHeight)
          const height = getApptHeight(a.start_time, a.end_time, hourHeight)
          const isPast = a.status === 'completed' || a.status === 'cancelled'
          const color = a.service_color || FALLBACK_COLOR

          // Colores más presentes: fondo suave (0.07) + barra izquierda visible (0.45)
          const cardBg = isPast ? apptPastBg() : apptCardBg(color)
          const cardBorder = isPast ? apptPastBorder() : apptCardBorder(color)

          // Layout compact (≤COMPACT_THRESHOLD: una línea) vs normal (dos líneas)
          const isCompact = height <= COMPACT_THRESHOLD

          return h('div', {
            key: a.id,
            onClick: () => onAppointmentClick && onAppointmentClick(a),
            className: 'absolute rounded-lg cursor-pointer transition-all duration-150 hover:shadow-md active:scale-[0.98] overflow-hidden',
            style: {
              left: (TIME_COL_WIDTH + 14) + 'px',
              right: '14px',
              // APPT_GAP px arriba y abajo para separar claramente citas consecutivas
              top: (top + APPT_GAP) + 'px',
              height: (height - APPT_GAP * 2) + 'px',
              background: cardBg,
              borderLeft: `${APPT_BORDER_LEFT}px solid ${cardBorder}`,
              boxShadow: isPast ? 'none' : '0 1.5px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)',
              opacity: isPast ? 0.75 : 1,
            }
          },
            // ── Compact layout: hora-fin · nombre ● estado + botón ──
            isCompact
              ? h('div', { className: 'flex items-center h-full px-3 gap-1.5 overflow-hidden box-border' },
                  h('span', { className: 'text-[9px] font-bold shrink-0 ' + (isPast ? 'text-stone-400' : 'text-stone-500') },
                    fmtTime(a.start_time) + '\u2013' + fmtTime(a.end_time)
                  ),
                  h('span', { className: 'text-[11px] font-bold truncate ' + (isPast ? 'text-stone-500' : 'text-stone-800') }, normalizeName(a.customer_name)),
                  h('span', { className: 'text-[7px] shrink-0 ' + STATUS_CLS[a.status] }, '\u25CF'),
                  !isPast && a.status === 'booked' && h('button', {
                    onClick: (e) => { e.stopPropagation(); onCancel(a.id) },
                    disabled: busyId === a.id,
                    className: 'ml-auto text-[8px] py-0.5 px-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 active:scale-[0.98] transition disabled:opacity-50 cursor-pointer shrink-0 leading-none'
                  }, busyId === a.id ? '…' : '\u2717')
                )
              // ── Layout normal: hora-fin + StatusPill (fila 1) · nombre + NUEVO (fila 2) · servicio + precio (fila 3) ──
              : h('div', { className: 'flex flex-col h-full px-3.5 py-2 gap-0.5 box-border' },
                  h('div', { className: 'flex items-center gap-1.5 min-w-0' },
                    h('span', { className: 'text-[10px] font-bold shrink-0 ' + (isPast ? 'text-stone-400' : 'text-stone-500') },
                      fmtTime(a.start_time) + '\u2013' + fmtTime(a.end_time)
                    ),
                    h(StatusPill, { status: a.status }),
                    !isPast && a.status === 'booked' && h('div', { className: 'flex gap-1 shrink-0 ml-auto' },
                      h('button', {
                        onClick: (e) => { e.stopPropagation(); onComplete(a.id) },
                        disabled: busyId === a.id,
                        className: 'w-6 h-6 flex items-center justify-center rounded-md bg-emerald-500 text-white text-[9px] font-bold active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-emerald-600'
                      }, busyId === a.id ? '…' : '\u2713'),
                      h('button', {
                        onClick: (e) => { e.stopPropagation(); onCancel(a.id) },
                        disabled: busyId === a.id,
                        className: 'w-6 h-6 flex items-center justify-center rounded-md bg-red-400 text-white text-[9px] font-bold active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-red-500'
                      }, busyId === a.id ? '…' : '\u2717')
                    )
                  ),
                  h('div', { className: 'flex items-center gap-1.5 min-w-0' },
                    h('span', { className: 'text-sm font-bold truncate ' + (isPast ? 'text-stone-500' : 'text-stone-900') }, normalizeName(a.customer_name)),
                    a.is_first_booking && !isPast && h('span', { className: 'text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0' }, t('admin.client_new'))
                  ),
                  h('div', { className: 'flex items-center gap-1.5 text-[10px]' },
                    h('span', { className: 'text-stone-500 truncate' },
                      a.service_name + (a.service_price != null ? ' \u00B7 ' + a.service_price + '\u20AC' : '')
                    )
                  )
                )
          )
        }),

        // ── Current time line (solo hoy) — refined ──
        isToday && (() => {
          const currentHour = now.getHours() + now.getMinutes() / 60
          const lineTop = (currentHour - BUSINESS_START) * hourHeight
          return h('div', {
            className: 'absolute left-0 right-0 pointer-events-none',
            style: { top: lineTop + 'px', zIndex: 30, left: TIME_COL_WIDTH + 'px' }
          },
            h('div', { className: 'absolute -left-[4px] w-2 h-2 rounded-full bg-red-500 -translate-y-1/2 shadow-[0_0_8px_rgba(239,68,68,0.25)] z-10' }),
            h('div', { className: 'w-full h-[1.5px] bg-red-400/70 shadow-[0_0_6px_rgba(239,68,68,0.12)]' })
          )
        })(),

        // ── Empty state ──
        visibleAppointments.length === 0 && h('div', {
          className: 'absolute flex items-center justify-center',
          style: {
            top: '0', left: TIME_COL_WIDTH + 'px', right: '0',
            height: (BUSINESS_END - BUSINESS_START) * hourHeight + 'px'
          }
        },
          h('div', { className: 'text-center px-6' },
            h('p', { className: 'text-sm text-stone-400 font-medium' }, t('admin.agenda_empty')),
            h('p', { className: 'text-xs text-stone-300 mt-1' }, t('admin.agenda_empty_sub'))
          )
        ),
      )
    )
  )
}

// ── MonthView ─────────────────────────────────────────────────────────

function MonthView({ monthlyData, monthStr, onSelectDay, selectedDay, selectedAppts, onComplete, onCancel, busyId, loading, onToast }) {
  if (loading) return h(LoadingSkeleton)
  if (!monthlyData) return h(EmptyState, { title: t('admin.agenda_empty'), sub: t('admin.agenda_empty_sub') })

  const [year, month] = monthStr.split('-').map(Number)
  const daysInMonth = monthDays(year, month - 1)
  const startOffset = monthFirstDow(year, month - 1)

  const cells = []
  for (let i = 0; i < startOffset; i++) {
    cells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
  }
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1
  const todayDay = today.getDate()

  // ── Dynamic heatmap calculation ──
  const allCounts = Object.values(monthlyData.days || {}).map(d => d.count || 0)
  const maxCount = Math.max(...allCounts, 1)

  // Dynamic heatLevel with 5 levels scaled to maxCount
  const heatLevel = (count) => {
    if (!count || count === 0) return ''
    if (maxCount <= 4) {
      // Original fixed scale when max <= 4
      if (count === 1) return 'bg-amber-100 text-amber-900'
      if (count === 2) return 'bg-amber-200 text-amber-900'
      if (count === 3) return 'bg-amber-300 text-amber-900'
      return 'bg-amber-400 text-white'
    }
    // Dynamic 5-level scale based on maxCount
    const thresholds = [
      Math.max(1, Math.ceil(maxCount * 0.2)),
      Math.max(2, Math.ceil(maxCount * 0.4)),
      Math.max(3, Math.ceil(maxCount * 0.6)),
      Math.max(4, Math.ceil(maxCount * 0.8)),
    ]
    if (count <= thresholds[0]) return 'bg-amber-100 text-amber-900'
    if (count <= thresholds[1]) return 'bg-amber-200 text-amber-900'
    if (count <= thresholds[2]) return 'bg-amber-300 text-amber-900'
    if (count <= thresholds[3]) return 'bg-amber-400 text-white'
    return 'bg-amber-500 text-white'
  }

  // Legend label generator
  const getLegendLabel = (level) => {
    if (level === 0) return '0'
    if (maxCount <= 4) return level === 4 ? '4+' : String(level)
    const thresholds = [
      Math.max(1, Math.ceil(maxCount * 0.2)),
      Math.max(2, Math.ceil(maxCount * 0.4)),
      Math.max(3, Math.ceil(maxCount * 0.6)),
      Math.max(4, Math.ceil(maxCount * 0.8)),
    ]
    if (level === 1) return `1-${thresholds[0]}`
    if (level === 2) return `${thresholds[0] + 1}-${thresholds[1]}`
    if (level === 3) return `${thresholds[1] + 1}-${thresholds[2]}`
    if (level === 4) return `${thresholds[2] + 1}-${thresholds[3]}`
    return `${thresholds[3] + 1}+`
  }

  // Thresholds for legend color mapping (level 1-4 map to threshold values)
  const legendThresholds = maxCount <= 4
    ? [1, 2, 3, 4]
    : [
        Math.max(1, Math.ceil(maxCount * 0.2)),
        Math.max(2, Math.ceil(maxCount * 0.4)),
        Math.max(3, Math.ceil(maxCount * 0.6)),
        Math.max(4, Math.ceil(maxCount * 0.8)),
      ]

  return h('div', null,
    // Calendar grid
    h('div', { className: 'grid grid-cols-7 gap-1' },
      // Day headers
      Array.from({ length: 7 }).map((_, i) => h('div', {
        key: 'h' + i,
        className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 py-1.5 text-center'
      }, t('agenda.day_short_' + i))),
      // Day cells
      cells.map((day, idx) => {
        if (day === null) return h('div', { key: 'e' + idx })
        const dayStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
        const dayData = monthlyData.days ? monthlyData.days[dayStr] : null
        const isSel = selectedDay === dayStr
        const isToday = isCurrentMonth && day === todayDay
        const count = dayData ? dayData.count : 0

        return h('button', {
          key: dayStr,
          onClick: () => onSelectDay(dayStr),
          className: 'relative flex flex-col items-center justify-center rounded-xl py-2.5 transition active:scale-[0.98] cursor-pointer ' +
            (isSel
              ? 'ring-2 ring-propio-500 shadow-md ' + heatLevel(count)
              : count > 0 ? heatLevel(count) + ' hover:brightness-95'
              : isToday ? 'bg-ivory-dark text-dark-500'
              : 'hover:bg-stone-50 text-stone-500')
        },
          h('span', { className: 'text-sm font-semibold' }, String(day)),
          count > 0 && h('span', {
            className: 'text-[9px] font-bold mt-0.5 ' + (count >= 4 ? 'text-white/80' : 'text-stone-500')
          }, String(count))
        )
      })
    ),

    // Legend
    h('div', { className: 'flex justify-center gap-3 mt-3 text-[9px] text-stone-400' },
      [0, 1, 2, 3, 4].map(n => h('div', { key: n, className: 'flex items-center gap-1' },
        h('span', {
          className: 'w-2.5 h-2.5 rounded-sm ' +
            (n === 0
              ? 'bg-white border border-stone-200'
              : heatLevel(legendThresholds[n - 1]) + ' text-transparent')
        }),
        h('span', null, getLegendLabel(n))
      ))
    ),

    // Selected day appointments
    selectedDay && h('div', { className: 'mt-4 pt-4 border-t border-stone-200' },
      h('p', { className: 'font-bold text-sm text-stone-700 mb-2' }, fmtDateShort(selectedDay)),
      selectedAppts === null
        ? h('p', { className: 'text-sm text-stone-400 text-center py-4' }, t('admin.loading'))
        : selectedAppts && selectedAppts.length === 0
          ? h('p', { className: 'text-sm text-stone-400 text-center py-4' }, t('agenda.no_data'))
          : h('div', { className: 'space-y-2' },
              selectedAppts.map(a => h(AppointmentCard, {
                key: a.id,
                appt: a,
                onComplete,
                busy: busyId === a.id
              }))
            )
    )
  )
}

// ── CreateBookingModal ────────────────────────────────────────────────

function CreateBookingModal({ services, onClose, onSuccess }) {
  const [step, setStep] = useState('service')
  const [selService, setSelService] = useState(null)
  const [date, setDate] = useState(() => todayISO())
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selSlot, setSelSlot] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [isNewClient, setIsNewClient] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (step !== 'slot' || !selService) return
    setLoadingSlots(true); setError(null); setSelSlot(null)
    getAvailableSlots(selService.id, date)
      .then(d => setSlots(d.slots || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingSlots(false))
  }, [step, selService, date])

  const handleSubmit = async () => {
    setBusy(true); setError(null)
    try {
      await adminCreateBooking({
        service_id: selService.id,
        customer_name: normalizeName(name),
        customer_phone: phone,
        customer_email: email || null,
        start_time: selSlot,
        is_first_time: isNewClient,
      })
      onSuccess()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const days = useMemo(() => {
    const arr = []
    const now = new Date(); now.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i); arr.push(d)
    }
    return arr
  }, [])

  return h('div', {
    className: 'fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center',
    onClick: (e) => { if (e.target === e.currentTarget) onClose() }
  },
    h('div', { className: 'bg-stone-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 relative' },
      h('button', {
        onClick: onClose,
        className: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 active:scale-[0.98] cursor-pointer'
      }, h(SvgClose)),

      step === 'service' && h('div', null,
        h('h3', { className: 'font-bold text-base text-stone-800 mb-1' }, t('modal.title')),
        h('p', { className: 'text-sm text-stone-500 mb-4' }, t('modal.step1')),
        h('div', { className: 'space-y-2' },
          services.map(s => h('button', {
            key: s.id, onClick: () => { setSelService(s); setStep('slot') },
            className: 'w-full bg-white rounded-2xl p-4 border border-stone-200 text-left flex items-center gap-3 active:scale-[0.98] transition cursor-pointer'
          },
            h('div', { className: 'flex-1' },
              h('p', { className: 'font-bold text-sm' }, s.name),
              h('p', { className: 'text-xs text-stone-500' }, t('template.duration_min', s.duration_minutes))
            ),
            h('p', { className: 'text-base font-bold text-propio-700' }, s.price + '\u20AC')
          ))
        )
      ),

      step === 'slot' && h('div', null,
        h('h3', { className: 'font-bold text-base text-stone-800 mb-1' }, selService?.name || ''),
        h('p', { className: 'text-sm text-stone-500 mb-4' }, t('modal.step2')),
        h('div', { className: 'overflow-x-auto -mx-5 px-5 pb-2' },
          h('div', { className: 'flex gap-2' },
            days.map(d => {
              const iso = localDateISO(d)
              const active = date === iso
              const isToday = iso === todayISO()
              return h('button', {
                key: iso, onClick: () => { setDate(iso); setSelSlot(null) },
                className: 'shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-0.5 transition-all active:scale-[0.98] cursor-pointer ' + (active ? 'bg-propio-500 hover:bg-propio-600 text-white shadow-lg' : 'bg-white border border-stone-200 text-stone-700')
              },
                h('span', { className: 'text-[10px] font-semibold uppercase tracking-wider opacity-80' }, isToday ? t('booking.today') : d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')),
                h('span', { className: 'text-xl font-bold leading-none' }, d.getDate()),
                h('span', { className: 'text-[10px] opacity-70 uppercase' }, d.toLocaleDateString(locale(), { month: 'short' }).replace('.', ''))
              )
            })
          )
        ),
        loadingSlots
          ? h('div', { className: 'grid grid-cols-3 gap-2 mt-4' },
              Array.from({ length: 9 }).map((_, i) => h('div', { key: i, className: 'h-12 rounded-2xl bg-stone-100 animate-pulse' }))
            )
          : slots.length === 0
            ? h('p', { className: 'text-center text-stone-500 py-6 text-sm' }, t('modal.no_slots'))
            : h('div', { className: 'grid grid-cols-3 gap-2 mt-4' },
                slots.map(s => h('button', {
                  key: s, onClick: () => setSelSlot(s),
                  className: 'py-3 rounded-2xl text-sm font-bold transition active:scale-[0.98] cursor-pointer ' +
                    (selSlot === s
                      ? 'bg-propio-500 hover:bg-propio-600 text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-700 hover:border-propio-300')
                }, fmtTime(s)))
              ),
        selSlot && h('button', {
          onClick: () => setStep('form'),
          disabled: slots.length === 0,
          className: 'w-full mt-5 text-base py-3 rounded-2xl bg-propio-500 hover:bg-propio-600 text-white font-bold shadow-lg active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
        }, t('modal.continue'))
      ),

      step === 'form' && h('div', null,
        h('h3', { className: 'font-bold text-base text-stone-800 mb-1' }, t('modal.step3')),
        h('p', { className: 'text-sm text-stone-500 mb-4' },
          t('template.summary', selService?.name || '', fmtDate(selSlot), fmtTime(selSlot))
        ),
        h('div', { className: 'space-y-3' },
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('modal.name')),
            h('input', {
              type: 'text', required: true, value: name,
              onChange: e => setName(e.target.value),
              placeholder: t('form.name_ph'),
              autoComplete: 'name',
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          ),
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('modal.phone')),
            h('input', {
              type: 'tel', inputMode: 'tel', required: true, value: phone,
              onChange: e => setPhone(e.target.value),
              placeholder: t('form.phone_ph'),
              autoComplete: 'tel',
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          ),
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('modal.email')),
            h('input', {
              type: 'email', inputMode: 'email', value: email,
              onChange: e => setEmail(e.target.value),
              placeholder: t('modal.email_ph'),
              autoComplete: 'email',
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          ),
          // First-time toggle (always visible)
          h('div', null,
            h('p', { className: 'text-xs font-semibold text-stone-500 ml-1 mb-2' }, t('modal.is_first')),
            h('div', { className: 'flex gap-2' },
              h('button', {
                type: 'button',
                onClick: () => setIsNewClient(true),
                className: 'flex-1 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer ' +
                  (isNewClient === true ? 'bg-propio-500 hover:bg-propio-600 text-white shadow-lg' : 'bg-white border border-stone-200 text-stone-600')
              }, t('modal.first_yes')),
              h('button', {
                type: 'button',
                onClick: () => setIsNewClient(false),
                className: 'flex-1 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer ' +
                  (isNewClient === false ? 'bg-stone-900 text-white shadow-lg' : 'bg-white border border-stone-200 text-stone-600')
              }, t('modal.first_no'))
            )
          ),
          error && h('div', {
            className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3'
          }, error),
          h('button', {
            onClick: handleSubmit, disabled: busy || !name.trim() || !phone.trim(),
            className: 'w-full text-base py-3 rounded-2xl bg-propio-500 hover:bg-propio-600 text-white font-bold shadow-lg active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2'
          }, busy ? t('modal.loading') : t('modal.submit'))
        )
      )
    )
  )
}

// ── ClientCRM ─────────────────────────────────────────────────────────

function ClientCRM({ client, onBack, onUpdate }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [successMsg, setSuccessMsg] = useState(null)
  const [notesSuccessMsg, setNotesSuccessMsg] = useState(null)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setLoading(true); setError(null); setSuccessMsg(null); setNotesSuccessMsg(null)
    getClientDetail(client.id)
      .then(data => {
        setDetail(data)
        setEditName(data.name || '')
        setEditPhone(data.phone || '')
        setEditEmail(data.email || '')
        setEditNotes(data.notes || '')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [client.id])

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccessMsg(null)
    try {
      const updated = await updateClient(client.id, {
        name: normalizeName(editName),
        phone: editPhone,
        email: editEmail || null,
      })
      setDetail(prev => prev ? { ...prev, name: updated.name, phone: updated.phone, email: updated.email } : null)
      setSuccessMsg(t('crm.edit_success'))
      setTimeout(() => setSuccessMsg(null), 2500)
      if (onUpdate) onUpdate(updated)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleNotesSave = async () => {
    setSavingNotes(true); setNotesSuccessMsg(null)
    try {
      const updated = await updateClient(client.id, { notes: editNotes || null })
      setDetail(prev => prev ? { ...prev, notes: updated.notes } : null)
      setNotesSuccessMsg(t('crm.notes_saved'))
      setTimeout(() => setNotesSuccessMsg(null), 2500)
    } catch (e) { setError(e.message) }
    finally { setSavingNotes(false) }
  }

  const handleDelete = async () => {
    setDeleting(true); setError(null)
    try {
      await deleteClient(client.id)
      onBack()
    } catch (e) { setError(e.message) }
    finally { setDeleting(false); setShowDeleteConfirm(false) }
  }

  if (loading) return h('div', { className: 'py-8 text-center text-stone-400' }, t('admin.loading'))
  if (error) return h('div', { className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 mb-4' }, error)
  if (!detail) return h(EmptyState, { title: t('error.client_detail'), sub: '' })

  const stats = detail.stats || {}
  const breakdown = detail.service_breakdown || []
  const visits = detail.visits || []
  const createdDate = detail.created_at ? new Date(detail.created_at).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return h('div', null,
    // Back button
    h('button', {
      onClick: onBack,
      className: 'flex items-center gap-1.5 text-sm font-semibold text-stone-600 mb-4 active:scale-[0.98] transition cursor-pointer'
    },
      h(SvgArrowLeft),
      h('span', null, t('crm.back'))
    ),

    // ── Datos del cliente (modo lectura / edición) ──
    h('div', { className: 'bg-white rounded-2xl p-4 border border-stone-200 shadow-sm mb-4' },
      h('div', { className: 'flex items-center justify-between mb-3' },
        h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500' }, t('crm.info')),
        !isEditing && h('button', {
          onClick: () => setIsEditing(true),
          className: 'w-8 h-8 rounded-xl hover:bg-stone-100 flex items-center justify-center transition cursor-pointer shrink-0 text-stone-400 hover:text-propio-500',
          title: t('crm.edit')
        },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
            h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
            h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
          )
        )
      ),
      isEditing
        ? h('div', { className: 'space-y-3' },
            h('div', null,
              h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('form.name')),
              h('input', { value: editName, onChange: e => setEditName(e.target.value), className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1', autoComplete: 'name' })
            ),
            h('div', null,
              h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('form.phone')),
              h('input', { value: editPhone, onChange: e => setEditPhone(e.target.value), type: 'tel', inputMode: 'tel', className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1', autoComplete: 'tel' })
            ),
            h('div', null,
              h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('form.email')),
              h('input', { value: editEmail, onChange: e => setEditEmail(e.target.value), type: 'email', inputMode: 'email', className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1', autoComplete: 'email' })
            ),
            successMsg && h('p', { className: 'text-xs text-emerald-600 font-semibold' }, successMsg),
            h('div', { className: 'flex items-center gap-2 pt-1' },
              h('button', {
                onClick: handleSave, disabled: saving,
                className: 'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-propio-500 hover:bg-propio-600 text-white font-bold text-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
              }, saving ? t('crm.saving') : h('span', { className: 'flex items-center gap-1.5' },
                  h(SvgCheck, null),
                  t('crm.save')
              )),
              h('button', {
                onClick: () => { setIsEditing(false); setEditName(detail.name || ''); setEditPhone(detail.phone || ''); setEditEmail(detail.email || '') },
                className: 'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 active:scale-[0.98] transition cursor-pointer'
              }, t('admin.cancel'))
            )
          )
        : h('div', { className: 'space-y-2' },
            h('div', { className: 'flex items-center gap-2' },
              h('span', { className: 'text-xs text-stone-500 w-16 shrink-0' }, t('form.name')),
              h('span', { className: 'text-sm font-medium text-stone-800' }, editName)
            ),
            h('div', { className: 'flex items-center gap-2' },
              h('span', { className: 'text-xs text-stone-500 w-16 shrink-0' }, t('form.phone')),
              h('span', { className: 'text-sm text-stone-800' }, editPhone || '—')
            ),
            h('div', { className: 'flex items-center gap-2' },
              h('span', { className: 'text-xs text-stone-500 w-16 shrink-0' }, t('form.email')),
              h('span', { className: 'text-sm text-stone-800 truncate' }, editEmail || '—')
            ),
            detail && detail.created_at && h('div', { className: 'flex items-center gap-2 mt-1' },
              h('span', { className: 'text-[10px] text-stone-400' }, t('crm.client_since') + ':'),
              h('span', { className: 'text-[10px] font-medium text-stone-600' }, new Date(detail.created_at).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }))
            )
          )
    ),

    // ── Notas internas ──
      h('div', { className: 'bg-stone-50 rounded-2xl p-4 border border-stone-200 shadow-sm mb-5' },
        h('div', { className: 'flex items-center justify-between mb-3' },
          h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500' }, t('crm.notes_section')),
          detail && detail.created_at && h('p', { className: 'text-[9px] text-stone-400' },
            t('crm.client_since') + ' ' + new Date(detail.created_at).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
          )
        ),
        h('textarea', {
          value: editNotes, onChange: e => setEditNotes(e.target.value),
          rows: 3,
          placeholder: t('crm.notes_placeholder'),
          className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 resize-none'
        }),
        h('div', { className: 'flex items-center justify-between mt-2' },
          h('div', { className: 'flex-1 min-w-0' },
            notesSuccessMsg && h('p', { className: 'text-xs text-emerald-600 font-semibold truncate' }, notesSuccessMsg),
            !notesSuccessMsg && h('span')
          ),
          h('button', {
            onClick: handleNotesSave, disabled: savingNotes,
            className: 'text-[10px] font-bold py-1.5 px-3 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 shrink-0'
          }, savingNotes ? t('crm.saving') : t('crm.save_notes'))
        )
      ),

    // Stats section
    h('div', { className: 'bg-white rounded-2xl p-4 border border-stone-200 shadow-sm mb-4' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('crm.stats')),
      h('div', { className: 'grid grid-cols-2 gap-3' },
        h(StatCard, { label: t('crm.total_visits'), value: stats.total_appointments || 0 }),
        h(StatCard, { label: t('crm.total_spent'), value: (stats.total_spent || 0).toFixed(2) + '\u20AC' })
      ),
      h('div', { className: 'flex gap-4 mt-3 text-xs text-stone-600' },
        h('span', null, t('crm.completed_visits') + ': ' + (stats.completed_visits || 0)),
        h('span', null, t('crm.cancelled_visits') + ': ' + (stats.cancelled_visits || 0))
      ),
      createdDate && h('p', { className: 'text-xs text-stone-400 mt-2' },
        t('crm.member_since') + ': ' + createdDate
      )
    ),

    // Service breakdown
    h('div', { className: 'bg-white rounded-2xl p-4 border border-stone-200 shadow-sm mb-4' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('crm.service_breakdown')),
      breakdown.length > 0
        ? h('div', { className: 'space-y-2' },
            breakdown.map((s, i) => h('div', {
              key: i,
              className: 'flex items-center justify-between text-sm'
            },
              h('div', { className: 'flex items-center gap-2' },
                h('span', { className: 'font-semibold text-stone-800' }, s.service),
                h('span', { className: 'text-stone-400' }, 'x' + s.count)
              ),
              h('span', { className: 'font-bold text-propio-700' }, s.total.toFixed(2) + '\u20AC')
            ))
          )
        : h('p', { className: 'text-sm text-stone-400 text-center py-4' }, getLang() === 'en' ? 'No services recorded' : 'Sin servicios registrados')
    ),

    // Visit history
    h('div', { className: 'bg-white rounded-2xl p-4 border border-stone-200 shadow-sm' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('crm.history')),
      visits.length === 0
        ? h('p', { className: 'text-sm text-stone-400 text-center py-4' }, t('crm.no_history'))
        : h('div', { className: 'space-y-1' },
            visits.map(v => h('div', {
              key: v.id,
              className: 'flex items-center gap-3 py-2 text-sm border-b border-stone-50 last:border-0'
            },
              h('div', { className: 'shrink-0 w-2 h-2 rounded-full ' + (v.status === 'completed' ? 'bg-emerald-500' : v.status === 'cancelled' ? 'bg-red-300' : 'bg-propio-500') }),
              h('div', { className: 'w-14 shrink-0' },
                h('p', { className: 'text-xs font-bold text-stone-700' }, fmtDate(v.start_time)),
                h('p', { className: 'text-[10px] text-stone-400' }, fmtTime(v.start_time))
              ),
              h('div', { className: 'flex-1 min-w-0' },
                h('p', { className: 'text-xs font-semibold text-stone-800 truncate' }, v.service_name)
              ),
              h(StatusPill, { status: v.status })
            ))
          )
    ),

    // ── Delete client ──
    h('div', { className: 'mt-8 pt-4 border-t border-red-100' },
      h('button', {
        onClick: () => setShowDeleteConfirm(true),
        className: 'w-full py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 active:scale-[0.98] transition cursor-pointer'
      }, t('admin.delete_client'))
    ),

    // Delete confirmation overlay
    showDeleteConfirm && h('div', {
      className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4'
    },
      h('div', {
        className: 'bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fadeIn',
        onClick: (e) => e.stopPropagation()
      },
        h('p', { className: 'font-bold text-lg text-stone-900' }, t('admin.delete_client')),
        h('div', { className: 'text-sm text-stone-500 mt-1 mb-5' },
          h('p', null, t('admin.delete_warning')),
          h('p', { className: 'text-xs text-red-400 mt-2 font-semibold' }, t('admin.delete_warning_action'))
        ),
        h('div', { className: 'flex gap-3' },
          h('button', {
            onClick: () => setShowDeleteConfirm(false),
            disabled: deleting,
            className: 'flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-sm hover:bg-stone-50 active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
          }, t('admin.delete_cancel')),
          h('button', {
            onClick: handleDelete,
            disabled: deleting,
            className: 'flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
          }, deleting ? t('admin.loading') : t('admin.delete_confirm'))
        )
      )
    )
  )
}

// ── Login Form ──────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(t('admin.login_error'))
      _setToken(data.access_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasError = error !== null

  return h('div', { className: 'min-h-screen bg-gradient-to-br from-ivory via-white to-propio-50/30 flex flex-col items-center justify-center p-4 sm:p-6 relative' },
    h('form', {
      onSubmit: handleSubmit,
      noValidate: true,
      className: 'w-full max-w-sm bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] border border-stone-200 p-8 space-y-8 animate-fadeInUp'
    },
      // Brand block
      h('div', { className: 'text-center' },
          h('img', {
            src: '/logo-web.png',
            alt: t('brand'),
            className: 'h-20 w-auto mx-auto mb-4 object-contain'
          }),
          h('h1', { className: 'text-[1.5rem] font-extrabold text-stone-900 tracking-tight leading-tight' }, t('brand')),
        h('p', { className: 'text-sm text-stone-400 mt-2 font-medium' }, t('admin.login_title'))
      ),

      // Fields
      h('div', { className: 'space-y-5' },
          // Username
          h('div', null,
            h('label', {
              htmlFor: 'login-username',
              className: 'block text-sm font-semibold text-stone-600 mb-2.5'
            }, t('admin.username')),
            h('input', {
              id: 'login-username',
              type: 'text', value: username,
              onChange: e => setUsername(e.target.value),
              autoComplete: 'username',
              required: true,
              autoFocus: true,
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border ' +
                (hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-stone-200 focus:border-propio-500 focus:ring-propio-500/20') +
                ' text-sm focus:outline-none focus:ring-2 transition-colors placeholder:text-stone-400'
            })
          ),
          // Password
          h('div', null,
            h('label', {
              htmlFor: 'login-password',
              className: 'block text-sm font-semibold text-stone-600 mb-2.5'
            }, t('admin.password')),
            h('div', { className: 'relative' },
              h('input', {
                id: 'login-password',
                type: showPw ? 'text' : 'password', value: password,
                onChange: e => setPassword(e.target.value),
                placeholder: '••••••••',
                autoComplete: 'current-password',
                required: true,
                className: 'w-full px-3 py-2.5 rounded-xl bg-white border pr-11 ' +
                  (hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-stone-200 focus:border-propio-500 focus:ring-propio-500/20') +
                  ' text-sm focus:outline-none focus:ring-2 transition-colors placeholder:text-stone-400'
              }),
            h('button', {
              type: 'button',
              onClick: () => setShowPw(v => !v),
              className: 'absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer',
              tabIndex: -1,
              'aria-label': showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }, showPw
              ? h(EyeOffSvg, { size: 18 })
              : h(EyeSvg, { size: 18 })
            )
          )
        )
      ),

      // Error (between fields and button, with shake animation)
      error
        ? h('div', { key: error, className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5 animate-shake -mt-2' },
            error
          )
        : null,

      // Submit
      h('button', {
        type: 'submit', disabled: loading || !username.trim() || !password.trim(),
        className: 'w-full py-3 rounded-xl font-bold text-[0.9375rem] shadow-[0_4px_14px_rgba(32,178,156,0.25)] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ' +
          (loading ? 'animate-pulse ' : '') +
          'bg-propio-500 text-white hover:bg-propio-600 active:bg-propio-700 active:scale-[0.98] hover:shadow-[0_6px_20px_rgba(32,178,156,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-propio-500/50'
      }, loading
        ? h('span', { className: 'flex items-center justify-center gap-2.5' },
            h('svg', { className: 'animate-spin w-[18px] h-[18px]', viewBox: '0 0 24 24', fill: 'none' },
              h('circle', { cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4', className: 'opacity-25' }),
              h('path', { d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z', fill: 'currentColor', className: 'opacity-75' })
            ),
            t('admin.loading')
          )
        : t('admin.login_btn')
      ),
      // ── Subtle support link ──
      h('div', { className: 'text-center pt-2' },
        h('a', {
          href: '#',
          onClick: (e) => { e.preventDefault(); alert(t('admin.login_help')) },
          className: 'text-[11px] text-stone-400 hover:text-propio-500 transition cursor-pointer'
        }, t('admin.login_help'))
      )
    ),
    // ── Startup branding footer (sutil, fuera del form) ──
    h('div', { className: 'mt-5 text-center flex items-center justify-center gap-1.5 text-[10px] text-stone-300' },
      h('span', null, t('footer.powered')),
      h('img', { src: '/propio-logo.svg', alt: '', className: 'h-3.5 w-auto inline-block opacity-40' })
    )
  )
}

// ── Dashboard Component ─────────────────────────────────────────────

function Dashboard({ data, onNavigate, showRevenue, maskRevenue, onToggleRevenue }) {
  const lang = getLang()
  const [revPeriod, setRevPeriod] = useState('daily')
  const [revMonth, setRevMonth] = useState(data?.month || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })())
  const [dailyData, setDailyData] = useState(null)
  const [nextAppt, setNextAppt] = useState(null)

  // M4: Revenue chart multi-month
  const [revRange, setRevRange] = useState('3m') // '3m', '6m', '12m'
  const [historicalData, setHistoricalData] = useState(null)

  // ── Drill-down detail panel ──
  const [detailPanel, setDetailPanel] = useState(null)
  const [todayAppts, setTodayAppts] = useState(null)
  const [newClientsData, setNewClientsData] = useState(null)
  const handleCloseDetail = useCallback(() => {
    setDetailPanel(null)
    setTodayAppts(null)
    setNewClientsData(null)
  }, [])

  // Fetch data when detail panel opens
  useEffect(() => {
    if (detailPanel === 'cancelled_today' || detailPanel === 'completed_today') {
      getSummary(todayISO()).then(d => setTodayAppts(d.appointments || [])).catch(() => {})
    } else if (detailPanel === 'new_clients') {
      getClients().then(all => setNewClientsData(all.filter(c => c.is_new))).catch(() => {})
    }
  }, [detailPanel])

  useEffect(() => {
    if (!data?.month) return
    setRevMonth(data.month)
  }, [data?.month])

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/admin/agenda/monthly?date=${revMonth}`, { headers: _adminHeaders() })
        if (r.ok) setDailyData(await r.json())
      } catch {}
    })()
  }, [revMonth])

  // M4: Fetch historical data when revRange or revMonth changes
  useEffect(() => {
    const fetchHistory = async () => {
      const months = revRange === '3m' ? 3 : revRange === '6m' ? 6 : 12
      const data = []
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const monthStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        try {
          const r = await fetch(`${API}/admin/agenda/monthly?date=${monthStr}`, { headers: _adminHeaders() })
          if (r.ok) {
            const m = await r.json()
            data.push({ month: monthStr, revenue: m.revenue || 0, count: m.count || 0 })
          }
        } catch {}
      }
      setHistoricalData(data)
    }
    fetchHistory()
  }, [revRange, revMonth])

  useEffect(() => {
    (async () => {
      try {
        const rows = await getUpcoming()
        setNextAppt(rows?.[0] || null)
      } catch {
        setNextAppt(null)
      }
    })()
  }, [])

  if (!data) return h('div', { className: 'p-6 text-center text-stone-400 text-sm' }, t('admin.loading'))

  const diff = data.revenue - data.prev_month_revenue
  const diffPct = data.prev_month_revenue > 0 ? Math.round((diff / data.prev_month_revenue) * 100) : 0
  const isUp = diff >= 0

  const todayBooked = data.bookings_today || 0
  const reactivateClients = data.reactivate_clients || []
  const reactivateCount = reactivateClients.length

  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const monthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const monthNames = lang === 'en' ? monthsEn : months
  const todayLabel = new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })

  const goPrevMonth = () => {
    const [y, m] = revMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setRevMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
  }
  const goNextMonth = () => {
    const [y, m] = revMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setRevMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
  }

  const summaryCards = [
    {
      label: t('admin.day_revenue'),
      value: maskRevenue((data.revenue_today || 0).toFixed(0) + '\u20AC'),
      unit: '',
      color: 'propio',
      icon: h('span', { className: 'text-base font-extrabold' }, '€'),
      detailKey: 'revenue'
    },
    {
      label: t('admin.day_completed'),
      value: data.completed_today || 0,
      unit: t('admin.day_unit_completed'),
      color: 'emerald',
      icon: h(SvgCheck),
      detailKey: 'completed_today'
    },
    {
      label: t('admin.day_cancelled'),
      value: data.cancelled_today || 0,
      unit: t('admin.day_unit_cancelled'),
      color: 'red',
      icon: h(SvgClose),
      detailKey: 'cancelled_today'
    },
    {
      label: t('admin.kpi_new_clients'),
      value: data.new_clients || 0,
      unit: t('admin.this_month'),
      color: 'violet',
      icon: h(SvgUsers),
      detailKey: 'new_clients'
    },
  ]

  return h('div', { className: 'space-y-4 md:space-y-5' },

    // ── Header compacto ──
    h('div', { className: 'flex items-center justify-between gap-3' },
      h('div', { className: 'flex items-center gap-2' },
        h('h2', { className: 'font-semibold text-lg text-stone-800' }, t('admin.dashboard_title')),
        // Revenue visibility toggle (eye icon)
        h('button', {
          onClick: onToggleRevenue,
          className: 'w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ' +
            (showRevenue ? 'text-propio-500 bg-propio-50 hover:bg-propio-100' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'),
          'aria-label': showRevenue ? 'Ocultar ingresos' : 'Mostrar ingresos',
          title: showRevenue ? 'Ocultar ingresos' : 'Mostrar ingresos'
        }, showRevenue ? h(EyeOffSvg, { size: 16 }) : h(EyeSvg, { size: 16 }))
      ),
      h('button', {
        onClick: () => onNavigate('new_booking'),
        className: 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-propio-500 text-white px-3.5 py-2.5 text-xs font-bold shadow-sm hover:bg-propio-600 active:scale-[0.98] transition cursor-pointer shrink-0'
      },
        h(SvgPlus, { className: 'w-4 h-4' }),
        t('admin.new_booking')
      )
    ),

    // ── Operational top row ──
    h('div', { className: 'grid lg:grid-cols-[1.15fr_1fr] gap-3' },
      h('div', { className: 'bg-dark-500 text-white rounded-2xl border border-dark-600 overflow-hidden shadow-md' },
        h('div', { className: 'p-3 sm:p-4 flex items-start justify-between gap-3' },
          h('div', { className: 'min-w-0' },
            h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-propio-200' }, t('admin.next_appointment')),
            nextAppt
              ? h('div', { className: 'mt-2' },
                  h('div', { className: 'flex items-baseline gap-2' },
                    h('span', { className: 'text-2xl sm:text-3xl font-extrabold tracking-tight' }, fmtTime(nextAppt.start_time)),
                    h('span', { className: 'text-xs text-stone-400' }, fmtRelative(nextAppt.start_time))
                  ),
                  h('p', { className: 'text-base sm:text-lg font-bold mt-1.5 truncate text-stone-50' }, normalizeName(nextAppt.customer_name)),
                  h('p', { className: 'text-xs sm:text-sm text-stone-400 mt-0.5 truncate' },
                    nextAppt.service_name + (nextAppt.service_price != null ? ' · ' + nextAppt.service_price + '\u20AC' : '')
                  )
                )
              : h('div', { className: 'mt-2' },
                  h('p', { className: 'text-xl sm:text-2xl font-extrabold text-stone-50' }, t('admin.no_next_appointment')),
                  h('p', { className: 'text-xs sm:text-sm text-stone-400 mt-0.5' }, t('admin.no_next_appointment_sub'))
                )
          ),
          h('div', { className: 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/[0.07] text-stone-200 flex items-center justify-center shrink-0' }, h(SvgCalendar))
        ),
        h('div', { className: 'px-3 sm:px-4 pb-3 sm:pb-4 flex flex-wrap gap-1.5' },
          h('button', {
            onClick: () => onNavigate('agenda'),
            className: 'rounded-lg bg-white/[0.1] text-white px-2.5 py-1.5 text-[10px] sm:text-xs font-bold hover:bg-white/[0.15] transition cursor-pointer'
          }, t('admin.kpi_view_agenda')),
          nextAppt?.customer_phone && h('a', {
            href: 'https://wa.me/' + cleanPhone(nextAppt.customer_phone) + '?text=' + encodeURIComponent(t('crm.whatsapp_msg', normalizeName(nextAppt.customer_name))),
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'rounded-lg bg-emerald-500/15 text-emerald-200 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold hover:bg-emerald-500/25 transition'
          }, t('crm.whatsapp'))
        )
      ),

      h('div', { className: 'grid grid-cols-2 gap-3' },
        h(KpiCard, {
          label: t('admin.kpi_bookings_today'),
          value: todayBooked,
          unit: todayBooked === 1 ? t('admin.booking') : t('admin.bookings'),
          color: 'propio',
          action: () => onNavigate('agenda'),
          actionLabel: t('admin.kpi_view_agenda'),
          icon: h(SvgCalendar),
          onCardClick: () => onNavigate('agenda')
        }),
        h(KpiCard, {
          label: t('admin.kpi_monthly_revenue'),
          value: maskRevenue((data.revenue || 0).toFixed(0) + '\u20AC'),
          unit: '',
          trend: { value: Math.abs(diffPct), direction: isUp ? 'up' : 'down' },
          color: 'stone',
          icon: h('span', { className: 'text-base font-extrabold' }, '€'),
          onCardClick: () => setDetailPanel('revenue')
        }),
        h(KpiCard, {
          label: t('admin.kpi_reactivate'),
          value: reactivateCount,
          unit: t('admin.kpi_clients_30d'),
          color: 'violet',
          action: () => onNavigate('clients'),
          actionLabel: t('admin.kpi_see_list'),
          icon: h(SvgUsers),
          onCardClick: () => setDetailPanel('reactivate')
        }),
        h(KpiCard, {
          label: t('admin.dashboard_avg_ticket'),
          value: maskRevenue((data.avg_ticket || 0).toFixed(0) + '\u20AC'),
          unit: '',
          color: 'emerald',
          icon: h(SvgCheck),
          onCardClick: () => setDetailPanel('avg_ticket')
        })
      )
    ),

    // ── Today summary ──
    h('div', { className: 'grid grid-cols-2 lg:grid-cols-4 gap-2.5' },
      summaryCards.map(card => h(KpiCard, {
        key: card.label,
        label: card.label,
        value: card.value,
        unit: card.unit,
        color: card.color,
        icon: card.icon,
        onCardClick: () => setDetailPanel(card.detailKey)
      }))
    ),

    h('div', { className: 'grid lg:grid-cols-[1.45fr_0.9fr] gap-4' },
      // ── Revenue Detail Chart ──
      h('div', { className: 'bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-5' },
        // Header with navigation
        h('div', { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4' },
          h('div', null,
            h('p', { className: 'text-xs font-bold text-stone-500 uppercase tracking-wider' }, t('admin.revenue_detail_title')),
            h('div', { className: 'flex items-center gap-1 mt-1' },
              h('button', {
                onClick: goPrevMonth,
                className: 'w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-colors active:scale-[0.98] cursor-pointer'
              }, h(SvgArrowLeft)),
              h('span', { className: 'text-sm font-extrabold text-stone-800 min-w-[132px] text-center capitalize' },
                (() => {
                  const [y, m] = revMonth.split('-').map(Number)
                  return monthNames[m - 1] + ' ' + y
                })()
              ),
              h('button', {
                onClick: goNextMonth,
                className: 'w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-colors active:scale-[0.98] cursor-pointer'
              }, h(SvgArrowRight))
            )
          ),
          // Period toggle (M4: 3m/6m/12m for historical chart)
          h('div', { className: 'flex bg-stone-100 rounded-xl p-0.5 self-start sm:self-auto' },
            ['3m', '6m', '12m'].map(p =>
              h('button', {
                key: p,
                onClick: () => setRevRange(p),
                className: 'px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ' +
                  (revRange === p ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
              }, t('admin.revenue_range_' + p))
            )
          ),
        ),

        revPeriod !== 'daily' && revRange === '3m' && renderHistoricalBars(historicalData, showRevenue, maskRevenue),
        revPeriod !== 'daily' && revRange === '6m' && renderHistoricalBars(historicalData, showRevenue, maskRevenue),
        revPeriod !== 'daily' && revRange === '12m' && renderHistoricalBars(historicalData, showRevenue, maskRevenue),
        revPeriod === 'daily' && renderDailyBars(dailyData, showRevenue, maskRevenue),
        revPeriod === 'weekly' && renderWeeklyBars(dailyData, showRevenue, maskRevenue),
        revPeriod === 'monthly' && renderMonthlyCompare(data, showRevenue, maskRevenue),
      ),

      // ── Status Distribution Donut ──
      h('div', { className: 'bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-5' },
        h('p', { className: 'text-xs font-bold text-stone-500 uppercase tracking-wider mb-4' }, t('admin.status_distribution')),
        h('div', { className: 'flex items-center gap-4' },
          (() => {
            const b = data.booked || 0
            const c = data.completed || 0
            const cancelled = Math.max(0, (data.total_appointments || 0) - b - c)
            const sum = b + c + cancelled
            const bDeg = sum > 0 ? (b / sum) * 360 : 0
            const cDeg = sum > 0 ? (c / sum) * 360 : 0
            const bg = sum > 0
              ? `conic-gradient(#20B29C 0deg ${bDeg}deg, #10b981 ${bDeg}deg ${bDeg + cDeg}deg, #ef4444 ${bDeg + cDeg}deg 360deg)`
              : '#e5e7eb'
            const bPct = sum > 0 ? Math.round((b / sum) * 100) : 0
            const cPct = sum > 0 ? Math.round((c / sum) * 100) : 0
            const aPct = sum > 0 ? Math.round((cancelled / sum) * 100) : 0

            return h('div', { className: 'flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 w-full' },
              h('div', { className: 'w-24 h-24 rounded-full shrink-0 relative mx-auto sm:mx-0 lg:mx-auto xl:mx-0', style: { background: bg } },
                h('div', { className: 'absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center' },
                  h('span', { className: 'text-xl font-extrabold text-stone-900 leading-none' }, (data.total_appointments || 0)),
                  h('span', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mt-1' }, t('admin.bookings'))
                )
              ),
              h('div', { className: 'flex-1 space-y-2 text-sm min-w-0' },
                [
                  [t('status.booked'), b, bPct, 'bg-propio-500'],
                  [t('status.completed'), c, cPct, 'bg-emerald-500'],
                  [t('status.cancelled'), cancelled, aPct, 'bg-red-500'],
                ].map(row => h('div', { key: row[0], className: 'flex items-center justify-between gap-3' },
                  h('span', { className: 'flex items-center gap-2 text-stone-600 min-w-0' },
                    h('span', { className: 'w-2.5 h-2.5 rounded-full inline-block shrink-0 ' + row[3] }),
                    h('span', { className: 'truncate' }, row[0])
                  ),
                  h('span', { className: 'font-extrabold text-stone-800 shrink-0' }, row[1] + ' (' + row[2] + '%)')
                ))
              ),
            )
          })(),
        ),
      )
    ),

    // ── Reactivate Clients Block ──
    reactivateCount > 0 && h('div', { className: 'bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-5' },
      h('p', { className: 'text-xs font-bold text-stone-500 uppercase tracking-wider mb-3' },
        t('admin.kpi_reactivate')),
      h('div', { className: 'space-y-2' },
        reactivateClients.map(c =>
          h('div', { key: c.name, className: 'flex items-center justify-between py-2 border-b border-stone-50 last:border-0' },
            h('div', { className: 'flex items-center gap-2' },
              h('div', { className: 'w-2 h-2 rounded-full bg-amber-400' }),
              h('span', { className: 'text-sm font-medium text-stone-800' }, c.name)
            ),
            h('div', { className: 'text-right' },
              h('p', { className: 'text-xs text-stone-400' }, c.days_since + ' ' + t('admin.days')),
              c.total_spent > 0 && h('p', { className: 'text-[10px] font-bold text-stone-500' }, c.total_spent.toFixed(0) + ' €')
            )
          )
        )
      ),
      h('button', {
        onClick: () => onNavigate('clients'),
        className: 'mt-3 w-full text-xs font-semibold text-propio-500 bg-propio-50 rounded-xl py-2 hover:bg-propio-100 transition-colors cursor-pointer'
      }, t('admin.kpi_see_all_clients'))
    ),

    // ── Empty state for reactivate ──
    reactivateCount === 0 && h('div', { className: 'bg-white rounded-2xl border border-stone-200 shadow-sm p-4 sm:p-5' },
      h('p', { className: 'text-xs font-bold text-stone-500 uppercase tracking-wider mb-1' },
        t('admin.kpi_reactivate')),
      h('p', { className: 'text-sm text-stone-400' }, t('admin.kpi_no_reactivate'))
    ),

    // ── Drill-down detail panel ──
    detailPanel && h(DashboardDetail, {
      type: detailPanel,
      data,
      todayAppts,
      newClientsData,
      reactivateClients,
      showRevenue,
      maskRevenue,
      onToggleRevenue,
      onClose: handleCloseDetail,
      onNavigate
    })

  )
}

// ── DashboardDetail component (drill-down slide-over) ──
function DashboardDetail({ type, data, todayAppts, newClientsData, reactivateClients, showRevenue, maskRevenue, onToggleRevenue, onClose, onNavigate }) {
  const lang = getLang()

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const titles = {
    revenue: lang === 'en' ? 'Revenue Details' : 'Detalle de ingresos',
    completed_today: lang === 'en' ? 'Completed Today' : 'Completadas hoy',
    cancelled_today: lang === 'en' ? 'Cancelled Today' : 'Canceladas hoy',
    new_clients: lang === 'en' ? 'New Clients' : 'Clientes nuevos',
    reactivate: lang === 'en' ? 'Clients to Reactivate' : 'Clientes por reactivar',
    avg_ticket: lang === 'en' ? 'Average Ticket' : 'Ticket promedio',
  }

  const renderBody = () => {
    switch (type) {
      case 'revenue':
        return h('div', { className: 'space-y-3' },
          h('div', { className: 'flex items-center justify-between py-2 border-b border-stone-100' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Today' : 'Hoy'),
            h('span', { className: 'font-bold text-stone-800' }, maskRevenue((data?.revenue_today || 0).toFixed(0) + ' \u20AC'))
          ),
          h('div', { className: 'flex items-center justify-between py-2 border-b border-stone-100' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'This Month' : 'Este mes'),
            h('span', { className: 'font-bold text-stone-800' }, maskRevenue((data?.revenue || 0).toFixed(0) + ' \u20AC'))
          ),
          data?.avg_ticket != null && h('div', { className: 'flex items-center justify-between py-2 border-b border-stone-100' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Avg. Ticket' : 'Ticket promedio'),
            h('span', { className: 'font-bold text-stone-800' }, maskRevenue((data.avg_ticket || 0).toFixed(0) + ' \u20AC'))
          ),
          data?.completed_today != null && h('div', { className: 'flex items-center justify-between py-2' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Completed Today' : 'Completadas hoy'),
            h('span', { className: 'font-bold text-stone-800' }, String(data.completed_today))
          ),
          h('button', {
            onClick: () => { onClose(); onNavigate('agenda') },
            className: 'mt-4 w-full text-xs font-semibold text-propio-500 bg-propio-50 rounded-xl py-2 hover:bg-propio-100 transition-colors'
          }, lang === 'en' ? 'View Agenda' : 'Ver agenda')
        )

      case 'completed_today':
        if (!todayAppts || todayAppts.length === 0) {
          return h('p', { className: 'text-sm text-stone-400' }, lang === 'en' ? 'No completed appointments today.' : 'No hay citas completadas hoy.')
        }
        return h('div', { className: 'space-y-2' },
          todayAppts.filter(a => a.status === 'completed').map(a =>
            h('div', { key: a.id, className: 'flex items-center justify-between py-2 border-b border-stone-50 last:border-0' },
              h('div', null,
                h('p', { className: 'text-sm font-medium text-stone-800' }, a.customer_name),
                h('p', { className: 'text-xs text-stone-400' }, a.service_name + ' · ' + a.time)
              ),
              h('span', { className: 'text-sm font-bold text-emerald-600' }, (a.price || 0).toFixed(0) + ' €')
            )
          )
        )

      case 'cancelled_today':
        if (!todayAppts || todayAppts.length === 0) {
          return h('p', { className: 'text-sm text-stone-400' }, lang === 'en' ? 'No cancelled appointments today.' : 'No hay citas canceladas hoy.')
        }
        return h('div', { className: 'space-y-2' },
          todayAppts.filter(a => a.status === 'cancelled').map(a =>
            h('div', { key: a.id, className: 'flex items-center justify-between py-2 border-b border-stone-50 last:border-0' },
              h('div', null,
                h('p', { className: 'text-sm font-medium text-stone-800' }, a.customer_name),
                h('p', { className: 'text-xs text-stone-400' }, a.service_name + ' · ' + a.time)
              ),
              h('span', { className: 'text-xs text-red-500' }, lang === 'en' ? 'Cancelled' : 'Cancelada')
            )
          )
        )

      case 'new_clients':
        if (!newClientsData || newClientsData.length === 0) {
          return h('p', { className: 'text-sm text-stone-400' }, lang === 'en' ? 'No new clients this month.' : 'No hay clientes nuevos este mes.')
        }
        return h('div', { className: 'space-y-2' },
          newClientsData.map(c =>
            h('div', { key: c.id, className: 'flex items-center justify-between py-2 border-b border-stone-50 last:border-0' },
              h('div', null,
                h('p', { className: 'text-sm font-medium text-stone-800' }, c.name),
                h('p', { className: 'text-xs text-stone-400' }, c.phone || '')
              ),
              c.total_spent > 0 && h('span', { className: 'text-sm font-bold text-stone-500' }, c.total_spent.toFixed(0) + ' €')
            )
          ),
          h('button', {
            onClick: () => { onClose(); onNavigate('clients') },
            className: 'mt-3 w-full text-xs font-semibold text-violet-700 bg-violet-50 rounded-xl py-2 hover:bg-violet-100 transition-colors'
          }, lang === 'en' ? 'See All Clients' : 'Ver todos los clientes')
        )

      case 'reactivate':
        if (!reactivateClients || reactivateClients.length === 0) {
          return h('p', { className: 'text-sm text-stone-400' }, lang === 'en' ? 'No clients to reactivate.' : 'No hay clientes por reactivar.')
        }
        return h('div', { className: 'space-y-2' },
          reactivateClients.map(c =>
            h('div', { key: c.name + c.days_since, className: 'flex items-center justify-between py-2 border-b border-stone-50 last:border-0' },
              h('div', null,
                h('p', { className: 'text-sm font-medium text-stone-800' }, c.name),
                h('p', { className: 'text-xs text-stone-400' }, c.days_since + ' ' + (lang === 'en' ? 'days' : 'días'))
              ),
              h('div', { className: 'flex items-center gap-2' },
                c.total_spent > 0 && h('span', { className: 'text-xs font-bold text-stone-500' }, c.total_spent.toFixed(0) + ' €'),
                c.phone && h('a', {
                  href: 'https://wa.me/' + cleanPhone(c.phone),
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'text-emerald-500 hover:text-emerald-600 transition-colors',
                  title: lang === 'en' ? 'Send WhatsApp' : 'Enviar WhatsApp'
                }, h(SvgWhatsApp, { className: 'w-3.5 h-3.5' }))
              )
            )
          ),
          h('button', {
            onClick: () => { onClose(); onNavigate('clients') },
            className: 'mt-3 w-full text-xs font-semibold text-violet-700 bg-violet-50 rounded-xl py-2 hover:bg-violet-100 transition-colors'
          }, lang === 'en' ? 'See All Clients' : 'Ver todos los clientes')
        )

      case 'avg_ticket':
        return h('div', { className: 'space-y-3' },
          h('div', { className: 'flex items-center justify-between py-2 border-b border-stone-100' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Average Ticket' : 'Ticket promedio'),
            h('span', { className: 'font-bold text-stone-800' }, maskRevenue((data?.avg_ticket || 0).toFixed(0) + ' \u20AC'))
          ),
          h('div', { className: 'flex items-center justify-between py-2 border-b border-stone-100' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Today\'s Revenue' : 'Ingresos hoy'),
            h('span', { className: 'font-bold text-stone-800' }, maskRevenue((data?.revenue_today || 0).toFixed(0) + ' \u20AC'))
          ),
          h('div', { className: 'flex items-center justify-between py-2' },
            h('span', { className: 'text-sm text-stone-600' }, lang === 'en' ? 'Completed Today' : 'Completadas hoy'),
            h('span', { className: 'font-bold text-stone-800' }, String(data?.completed_today || 0))
          )
        )

      default:
        return h('p', { className: 'text-sm text-stone-400' }, lang === 'en' ? 'No details available.' : 'No hay detalles disponibles.')
    }
  }

  return h('div', {
    className: 'fixed inset-0 z-50 flex justify-end',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': titles[type] || 'Detail'
  },
    // Backdrop
    h('div', {
      className: 'absolute inset-0 bg-black/30 backdrop-blur-sm',
      onClick: onClose
    }),
    // Panel
    h('div', {
      className: 'relative w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl animate-slide-in'
    },
      // Header
      h('div', { className: 'sticky top-0 bg-white border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10' },
        h('div', { className: 'flex items-center gap-2' },
          h('h2', { className: 'font-semibold text-lg text-stone-800' }, titles[type] || ''),
          (type === 'revenue' || type === 'avg_ticket') && h('button', {
            onClick: onToggleRevenue,
            className: 'w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ' +
              (showRevenue ? 'text-propio-500 bg-propio-50 hover:bg-propio-100' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'),
            'aria-label': showRevenue ? 'Ocultar ingresos' : 'Mostrar ingresos',
            title: showRevenue ? 'Ocultar ingresos' : 'Mostrar ingresos'
          }, showRevenue ? h(EyeOffSvg, { size: 14 }) : h(EyeSvg, { size: 14 }))
        ),
        h('button', {
          onClick: onClose,
          className: 'w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-500 cursor-pointer',
          'aria-label': lang === 'en' ? 'Close' : 'Cerrar'
        }, h(SvgClose))
      ),
      // Body
      h('div', { className: 'p-4' }, renderBody())
    )
  )
}

// ── Dashboard helper render functions ──

function renderDailyBars(dailyData, showRevenue, maskRevenue) {
  if (!dailyData || !dailyData.days || Object.keys(dailyData.days).length === 0) {
    return h('div', { className: 'py-8 text-center text-xs text-stone-400' }, t('admin.revenue_no_data'))
  }

  const days = dailyData.days
  const dayKeys = Object.keys(days).sort()
  const maxRevenue = Math.max(...dayKeys.map(k => days[k].revenue || 0), 1)
  const totalRevenue = dayKeys.reduce((s, k) => s + (days[k].revenue || 0), 0)
  const avgDaily = totalRevenue / dayKeys.length
  let bestDay = '', bestRev = 0
  dayKeys.forEach(k => { if ((days[k].revenue || 0) > bestRev) { bestRev = days[k].revenue; bestDay = k } })

  return h('div', null,
    // Bar chart
    h('div', { className: 'flex items-end gap-[3px] h-24 mb-2 overflow-x-auto pb-1' },
      dayKeys.map(k => {
        const rev = days[k].revenue || 0
        const pct = maxRevenue > 0 ? (rev / maxRevenue) * 100 : 0
        const dayNum = k.split('-')[2]
        return h('div', {
          key: k,
          className: 'flex flex-col items-center gap-0.5 min-w-[18px] flex-1'
        },
          h('div', {
            className: 'w-full rounded-sm transition-all duration-300 ' + (rev > 0 ? 'bg-propio-500' : 'bg-stone-100'),
            style: { height: Math.max(pct > 0 ? 2 : 0, (pct / 100) * 80) + 'px' },
            title: dayNum + ': ' + maskRevenue(rev.toFixed(0) + ' \u20AC')
          }),
          h('span', { className: 'text-[9px] text-stone-400 font-medium' }, parseInt(dayNum))
        )
      })
    ),
    // Stats row
    h('div', { className: 'flex justify-between text-xs pt-2 border-t border-stone-100' },
      h('span', null,
        h('span', { className: 'font-bold text-stone-700' }, maskRevenue(totalRevenue.toFixed(0) + ' \u20AC')),
        h('span', { className: 'text-stone-400 ml-1' }, t('admin.revenue_total_month'))
      ),
      h('span', null,
        h('span', { className: 'font-bold text-stone-700' }, maskRevenue(avgDaily.toFixed(0) + ' \u20AC')),
        h('span', { className: 'text-stone-400 ml-1' }, t('admin.revenue_avg_daily'))
      ),
      bestDay && h('span', null,
        h('span', { className: 'font-bold text-propio-500' }, maskRevenue(bestRev.toFixed(0) + ' \u20AC')),
        h('span', { className: 'text-stone-400 ml-1' }, t('admin.revenue_best_day'))
      ),
    ),
  )
}

function renderWeeklyBars(dailyData, showRevenue, maskRevenue) {
  if (!dailyData || !dailyData.days || Object.keys(dailyData.days).length === 0) {
    return h('div', { className: 'py-8 text-center text-xs text-stone-400' }, t('admin.revenue_no_data'))
  }

  const days = dailyData.days
  const dayKeys = Object.keys(days).sort()

  // Group into ISO weeks
  const weeks = {}
  dayKeys.forEach(k => {
    const d = new Date(k + 'T12:00:00')
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay() + 1)
    const wk = localDateISO(weekStart)
    if (!weeks[wk]) weeks[wk] = { revenue: 0, count: 0 }
    weeks[wk].revenue += days[k].revenue || 0
    weeks[wk].count += days[k].count || 0
  })

  const weekKeys = Object.keys(weeks).sort()
  const maxRev = Math.max(...weekKeys.map(k => weeks[k].revenue || 0), 1)

  return h('div', { className: 'space-y-2' },
    weekKeys.map((wk, i) => {
      const rev = weeks[wk].revenue
      const pct = maxRev > 0 ? (rev / maxRev) * 100 : 0
      return h('div', { key: wk, className: 'flex items-center gap-3' },
        h('span', { className: 'text-[10px] font-semibold text-stone-500 w-16 shrink-0' }, t('admin.revenue_week_label', i + 1)),
        h('div', { className: 'flex-1 h-5 bg-stone-100 rounded-full overflow-hidden' },
          h('div', {
            className: 'h-full rounded-full bg-propio-500 transition-all',
            style: { width: pct + '%' }
          })
        ),
        h('span', { className: 'text-xs font-bold text-stone-700 w-16 text-right' }, maskRevenue(rev.toFixed(0) + ' \u20AC')),
      )
    }),
  )
}

function renderMonthlyCompare(data, showRevenue, maskRevenue) {
  if (!data) return null
  const diff = data.revenue - data.prev_month_revenue
  const diffPct = data.prev_month_revenue > 0 ? Math.round((diff / data.prev_month_revenue) * 100) : 0
  const isUp = diff >= 0

  return h('div', { className: 'space-y-2' },
    h('div', null,
      h('div', { className: 'flex justify-between text-xs mb-1' },
        h('span', { className: 'font-semibold text-stone-700' }, t('admin.dashboard_current_month')),
        h('span', { className: 'font-bold text-propio-700' }, maskRevenue((data.revenue || 0).toFixed(0) + ' \u20AC'))
      ),
      h('div', { className: 'w-full bg-stone-100 rounded-full h-3 overflow-hidden' },
        h('div', {
          className: 'h-full rounded-full bg-propio-600 transition-all',
          style: { width: Math.min(100, ((data.revenue || 0) / Math.max(data.revenue || 0, data.prev_month_revenue || 0, 1)) * 100) + '%' }
        })
      )
    ),
    h('div', null,
      h('div', { className: 'flex justify-between text-xs mb-1' },
        h('span', { className: 'font-semibold text-stone-500' }, t('admin.dashboard_prev_month')),
        h('span', { className: 'font-bold text-stone-600' }, maskRevenue((data.prev_month_revenue || 0).toFixed(0) + ' \u20AC'))
      ),
      h('div', { className: 'w-full bg-stone-100 rounded-full h-3 overflow-hidden' },
        h('div', {
          className: 'h-full rounded-full bg-stone-400 transition-all',
          style: { width: Math.min(100, ((data.prev_month_revenue || 0) / Math.max(data.revenue || 0, data.prev_month_revenue || 0, 1)) * 100) + '%' }
        })
      )
    ),
    h('div', { className: 'flex items-center justify-center gap-1 pt-1' },
      h('span', { className: 'text-xs ' + (isUp ? 'text-emerald-600' : 'text-red-500') },
        (isUp ? '\u25B2' : '\u25BC') + ' ' + Math.abs(diffPct) + '%'
      ),
      h('span', { className: 'text-[10px] text-stone-400' }, t('admin.dashboard_vs_prev'))
    ),
  )
}

// M4: Historical revenue bars (3m/6m/12m)
function renderHistoricalBars(data, showRevenue, maskRevenue) {
  if (!data || data.length === 0) return h('div', { className: 'py-8 text-center text-xs text-stone-400' }, t('admin.revenue_no_data'))
  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  const months = data.map(d => {
    const [y, m] = d.month.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString(locale(), { month: 'short' })
  })
  return h('div', { className: 'space-y-2' },
    data.map((d, i) => h('div', { key: d.month, className: 'flex items-center gap-3' },
      h('span', { className: 'text-[10px] font-semibold text-stone-500 w-14 shrink-0' }, months[i]),
      h('div', { className: 'flex-1 h-5 bg-stone-100 rounded-full overflow-hidden' },
        h('div', {
          className: 'h-full rounded-full bg-propio-500 transition-all',
          style: { width: (d.revenue / maxRev) * 100 + '%' }
        })
      ),
      h('span', { className: 'text-xs font-bold text-stone-700 w-16 text-right' }, maskRevenue(d.revenue.toFixed(0) + ' \u20AC'))
    ))
  )
}

// ── ResetDemoSection ──────────────────────────────────────────────────

function ResetDemoSection() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState(null)

  const handleReset = async () => {
    setResetting(true)
    setResult(null)
    try {
      const data = await resetDemoData()
      setResult({ type: 'success', text: t('settings.reset_demo_success', data.deleted_appointments, data.deleted_clients) })
      setShowConfirm(false)
      // Refresh the page after a short delay so user sees the result
      setTimeout(() => window.location.reload(), 3000)
    } catch (e) {
      setResult({ type: 'error', text: t('settings.reset_demo_error') + ': ' + e.message })
    } finally {
      setResetting(false)
    }
  }

  return h('div', { className: 'bg-white rounded-2xl border border-stone-200 p-4' },
    h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('settings.reset_demo')),
    h('p', { className: 'text-xs text-stone-500 mb-3' }, t('settings.reset_demo_desc')),

    result && h('p', {
      className: 'text-xs font-bold mb-3 ' + (result.type === 'success' ? 'text-emerald-600' : 'text-red-600')
    }, result.text),

    !showConfirm
      ? h('button', {
          onClick: () => setShowConfirm(true),
          disabled: resetting,
          className: 'px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm shadow active:scale-[0.98] transition cursor-pointer disabled:opacity-50 hover:bg-red-600'
        }, resetting ? '...' : t('settings.reset_demo'))
      : h('div', { className: 'flex flex-col gap-2' },
          h('p', { className: 'text-xs font-bold text-red-600' }, t('settings.reset_demo_confirm')),
          h('div', { className: 'flex gap-2' },
            h('button', {
              onClick: handleReset,
              disabled: resetting,
              className: 'flex-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
            }, resetting ? '...' : t('settings.reset_demo_btn')),
            h('button', {
              onClick: () => { setShowConfirm(false); setResult(null) },
              disabled: resetting,
              className: 'flex-1 px-3 py-2 rounded-xl bg-stone-200 text-stone-700 font-bold text-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
            }, t('settings.reset_demo_cancel'))
          )
        )
  )
}

// ── SettingsPanel ─────────────────────────────────────────────────────

function SettingsPanel({ settingsSubTab, onSubTabChange, token, onToast }) {
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [googleSaved, setGoogleSaved] = useState(false)
  const [savingGoogle, setSavingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState(null)
  // Push subscription state
  const [pushStatus, setPushStatus] = useState('loading') // 'loading' | 'unsupported' | 'denied' | 'inactive' | 'active' | 'error'
  const [pushSub, setPushSub] = useState(null)
  const [pushError, setPushError] = useState(null)

  useEffect(() => {
    getAdminSettings(token)
      .then(data => { if (data.google_place_id) setGooglePlaceId(data.google_place_id) })
      .catch(() => {})
  }, [token])

  // ── Check push subscription status on mount ──
  useEffect(() => {
    checkPushStatus()
  }, [])

  const checkPushStatus = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('unsupported')
        return
      }
      // Check permission
      if (Notification.permission === 'denied') {
        setPushStatus('denied')
        return
      }
      // Check if already subscribed
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        setPushSub(sub)
        setPushStatus('active')
      } else {
        setPushStatus('inactive')
      }
    } catch (e) {
      console.warn('[Push] Status check failed:', e)
      setPushStatus('error')
      setPushError(e.message)
    }
  }

  const handlePushSubscribe = async () => {
    setPushError(null)
    try {
      // 1. Obtener VAPID public key
      const r = await fetch(`${API}/admin/settings`, { headers: _adminHeaders() })
      if (!r.ok) throw new Error('Failed to load settings')
      const settings = await r.json()
      if (!settings.vapid_public_key) {
        setPushError(t('settings.push_error'))
        return
      }

      // 2. Request permission (must be from user gesture)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus('denied')
        return
      }

      // 3. Subscribe
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(settings.vapid_public_key),
      })

      // 4. Send subscription to backend
      const subData = {
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
        user_agent: navigator.userAgent || '',
      }

      const res = await fetch(`${API}/admin/push/register`, {
        method: 'POST',
        headers: _adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(subData),
      })
      if (!res.ok) throw new Error('Failed to register subscription')

      setPushSub(sub)
      setPushStatus('active')
    } catch (e) {
      console.error('[Push] Subscribe failed:', e)
      setPushError(t('settings.push_error') + ': ' + e.message)
    }
  }

  const handlePushUnsubscribe = async () => {
    try {
      if (pushSub) {
        const endpoint = pushSub.endpoint
        await pushSub.unsubscribe()
        // Notify backend
        await fetch(`${API}/admin/push/unregister?endpoint=${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          headers: _adminHeaders(),
        })
      }
      setPushSub(null)
      setPushStatus('inactive')
    } catch (e) {
      console.error('[Push] Unsubscribe failed:', e)
    }
  }

  const handleSaveGoogle = async () => {
    setSavingGoogle(true); setGoogleError(null)
    try {
      await updateAdminSettings(token, { google_place_id: googlePlaceId || null })
      setGoogleSaved(true)
      setTimeout(() => setGoogleSaved(false), 2500)
    } catch (e) {
      setGoogleError(e.message)
    } finally {
      setSavingGoogle(false)
    }
  }

  return h('div', { className: 'pt-1 px-4 space-y-4 pb-24' },
    // Sub-tab navigation
    h('div', { className: 'flex gap-1 bg-stone-100 rounded-xl p-0.5' },
      ['seasons', 'holidays', 'blocks'].map(sub => h('button', {
          key: sub,
          onClick: () => onSubTabChange(sub),
          className: 'flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer ' +
            (settingsSubTab === sub ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
        }, t('settings.' + (sub === 'seasons' ? 'horarios' : sub === 'holidays' ? 'festivos' : 'bloques')))
    )),

    // Sub-tab content
    settingsSubTab === 'seasons' && h(SeasonsView, { token, onToast }),
    settingsSubTab === 'holidays' && h(HolidaysView, { token, onToast }),
    settingsSubTab === 'blocks'    && h(BlocksView, { token, onToast }),

    // Google Reviews section
    h('div', { className: 'bg-white rounded-2xl border border-stone-200 p-4' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('settings.google_reviews')),
      h('div', { className: 'flex gap-2' },
        h('input', {
          type: 'text', value: googlePlaceId,
          onChange: e => setGooglePlaceId(e.target.value),
          placeholder: t('settings.google_ph'),
          className: 'min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500'
        }),
        h('button', {
          onClick: handleSaveGoogle, disabled: savingGoogle,
          className: 'shrink-0 px-3 py-2 rounded-xl bg-propio-500 hover:bg-propio-600 text-white font-bold text-xs shadow active:scale-[0.98] transition cursor-pointer disabled:opacity-50 whitespace-nowrap'
        }, googleSaved ? t('settings.google_saved') : t('crm.save'))
      ),
      googleError && h('p', { className: 'text-xs text-red-600 mt-1' }, googleError),
      googlePlaceId && h('a', {
        href: 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(googlePlaceId),
        target: '_blank', rel: 'noopener noreferrer',
        className: 'inline-block mt-2 text-xs font-bold text-propio-500 hover:text-propio-600 transition'
      }, t('settings.view_reviews'))
    ),

    // ── Push Notifications section ──
    h('div', { className: 'bg-white rounded-2xl border border-stone-200 p-4' },
      h('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3' }, t('settings.push_title')),
      h('p', { className: 'text-xs text-stone-500 mb-3' }, t('settings.push_desc')),
      pushStatus === 'unsupported' && h('p', { className: 'text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2' }, t('settings.push_not_supported')),
      pushStatus === 'denied' && h('div', null,
        h('p', { className: 'text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2' }, t('settings.push_denied')),
        /iPhone|iPad|iPod/i.test(navigator.userAgent) && h('p', { className: 'text-xs text-stone-400 mt-2' }, t('settings.push_ios_guide'))
      ),
      pushStatus === 'loading' && h('p', { className: 'text-xs text-stone-400' }, '...'),
      pushStatus === 'error' && pushError && h('p', { className: 'text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2' }, pushError),
      pushStatus === 'active'
        ? h('button', {
            onClick: handlePushUnsubscribe,
            className: 'px-4 py-2.5 rounded-xl bg-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-300 active:scale-[0.98] transition cursor-pointer'
          }, t('settings.push_deactivate'))
        : null,
      (pushStatus === 'inactive' || pushStatus === 'denied' || pushStatus === 'error') && h('button', {
        onClick: handlePushSubscribe,
        className: 'px-4 py-2.5 rounded-xl bg-propio-500 hover:bg-propio-600 text-white font-bold text-sm shadow active:scale-[0.98] transition cursor-pointer'
      }, t('settings.push_activate')),
      pushStatus === 'active' && h('p', { className: 'text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1.5' },
        h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' },
          h('polyline', { points: '20 6 9 17 4 12' })
        ),
        t('settings.push_activated')
      ),
      /iPhone|iPad|iPod/i.test(navigator.userAgent) && pushStatus !== 'active' && h('p', { className: 'text-[10px] text-stone-400 mt-2' }, t('settings.push_ios_guide'))
    ),

    // Reset Demo Data section
    h(ResetDemoSection, null)
  )
}

// ── SeasonsView ───────────────────────────────────────────────────────

function SeasonsView({ token, onToast }) {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editSeason, setEditSeason] = useState(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const dayInit = { morningOpen: '', morningClose: '', afternoonOpen: '', afternoonClose: '', closed: false }
  const [formHours, setFormHours] = useState(() => Array.from({ length: 7 }, () => ({ ...dayInit })))

  const resetForm = () => {
    setFormName(''); setFormStart(''); setFormEnd('')
    setFormHours(Array.from({ length: 7 }, () => ({ ...dayInit })))
    setEditSeason(null); setFeedback(null)
  }

  const loadSeasons = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSeasons(token)
      setSeasons(data || [])
    } catch (e) {
      setFeedback({ type: 'error', text: e.message })
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  const openEdit = (season) => {
    setEditSeason(season)
    setFormName(season.name)
    setFormStart(season.season_start ? season.season_start.split('T')[0] : '')
    setFormEnd(season.season_end ? season.season_end.split('T')[0] : '')
    const hours = Array.from({ length: 7 }, () => ({ ...dayInit }))
    try {
      const parsed = typeof season.business_hours === 'string' ? JSON.parse(season.business_hours) : (season.business_hours || {})
      Object.keys(parsed).forEach(di => {
        const slots = parsed[di]
        const idx = parseInt(di)
        if (!slots || slots.length === 0) { hours[idx].closed = true; return }
        hours[idx].closed = false
        if (slots[0]) { hours[idx].morningOpen = slots[0][0] || ''; hours[idx].morningClose = slots[0][1] || '' }
        if (slots[1]) { hours[idx].afternoonOpen = slots[1][0] || ''; hours[idx].afternoonClose = slots[1][1] || '' }
      })
    } catch (e) { /* ignore parse errors */ }
    setFormHours(hours)
    setShowModal(true); setFeedback(null)
  }

  const handleSave = async () => {
    setSaving(true); setFeedback(null)
    try {
      const hoursObj = {}
      formHours.forEach((day, idx) => {
        if (day.closed) { hoursObj[idx] = []; return }
        const slots = []
        if (day.morningOpen && day.morningClose) slots.push([day.morningOpen, day.morningClose])
        if (day.afternoonOpen && day.afternoonClose) slots.push([day.afternoonOpen, day.afternoonClose])
        hoursObj[idx] = slots
      })
      const payload = { name: formName, season_start: formStart, season_end: formEnd, business_hours: JSON.stringify(hoursObj) }
      if (editSeason) await updateSeason(token, editSeason.id, payload)
      else await createSeason(token, payload)
      setFeedback({ type: 'success', text: t('settings.season_saved') })
      setShowModal(false); resetForm(); loadSeasons()
    } catch (e) { setFeedback({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('settings.delete_season_confirm'))) return
    try { await deleteSeason(token, id); loadSeasons() }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
  }

  const handleToggleActive = async (season) => {
    try { await updateSeason(token, season.id, { is_active: !season.is_active }); loadSeasons() }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
  }

  if (loading) return h(LoadingSkeleton)

  return h('div', null,
    feedback && feedback.type === 'success' && h('p', { className: 'text-xs text-emerald-600 font-semibold mb-2' }, feedback.text),
    feedback && feedback.type === 'error' && h('p', { className: 'text-xs text-red-600 font-semibold mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2' }, feedback.text),

    h('div', { className: 'flex items-center justify-between mb-3' },
      h('h3', { className: 'font-bold text-sm text-stone-700' }, t('settings.horarios')),
      h('button', {
        onClick: () => { resetForm(); setShowModal(true) },
        className: 'text-xs font-bold py-2.5 px-3 rounded-xl bg-propio-500 hover:bg-propio-600 text-white shadow active:scale-[0.98] transition cursor-pointer'
      }, t('settings.add_season'))
    ),

    seasons.length === 0
      ? h(EmptyState, { title: t('settings.seasons_empty'), sub: t('settings.seasons_empty_sub') })
      : h('div', { className: 'space-y-2' },
          seasons.map(s => h('div', {
            key: s.id, className: 'bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3'
          },
            h('button', {
              onClick: () => handleToggleActive(s),
              className: 'shrink-0 w-10 h-6 rounded-full transition cursor-pointer ' + (s.is_active ? 'bg-propio-500' : 'bg-stone-200'),
              title: s.is_active ? t('settings.season_active') : t('settings.season_inactive')
            },
              h('div', { className: 'w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ' + (s.is_active ? 'ml-5' : 'ml-1') })
            ),
            h('div', { className: 'flex-1 min-w-0' },
              h('p', { className: 'font-bold text-sm truncate' }, s.name),
              h('p', { className: 'text-xs text-stone-400' },
                s.season_start ? new Date(s.season_start).toLocaleDateString(locale()) : '—',
                ' → ', s.season_end ? new Date(s.season_end).toLocaleDateString(locale()) : '—'
              )
            ),
            h('button', {
              onClick: () => openEdit(s),
              className: 'text-[10px] font-bold py-1.5 px-2.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 active:scale-[0.98] transition cursor-pointer'
            }, t('settings.edit_season')),
            h('button', {
              onClick: () => handleDelete(s.id),
              className: 'text-[10px] font-bold py-1.5 px-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition cursor-pointer'
            }, t('settings.delete_season'))
          ))
        ),

    // Season modal
    showModal && h('div', {
      className: 'fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center',
      onClick: (e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm() } }
    },
      h('div', { className: 'bg-stone-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 relative' },
        h('button', {
          onClick: () => { setShowModal(false); resetForm() },
          className: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 active:scale-[0.98] cursor-pointer'
        }, h(SvgClose)),

        h('h3', { className: 'font-bold text-base text-stone-800 mb-4' }, editSeason ? t('settings.edit_season') : t('settings.add_season')),

        h('div', { className: 'mb-3' },
          h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('settings.season_name')),
          h('input', {
            type: 'text', value: formName, onChange: e => setFormName(e.target.value),
            placeholder: t('settings.season_name_ph'),
            className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
          })
        ),

        h('div', { className: 'grid grid-cols-2 gap-3 mb-3' },
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('settings.season_start')),
            h('input', {
              type: 'date', value: formStart, onChange: e => setFormStart(e.target.value),
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          ),
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500 ml-1' }, t('settings.season_end')),
            h('input', {
              type: 'date', value: formEnd, onChange: e => setFormEnd(e.target.value),
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          )
        ),

        h('p', { className: 'text-xs font-bold text-stone-500 mb-2' }, t('settings.season_hours')),
        h('div', { className: 'space-y-2 max-h-64 overflow-y-auto' },
          [0,1,2,3,4,5,6].map(d => {
            const day = formHours[d]
            const dayLabel = t('agenda.day_short_' + d)
            return h('div', { key: d, className: 'bg-white rounded-xl p-2.5 border border-stone-200' },
              h('div', { className: 'flex items-center justify-between mb-1.5' },
                h('span', { className: 'font-bold text-xs text-stone-700' }, dayLabel),
                h('label', { className: 'flex items-center gap-1.5 text-[10px] text-stone-500 cursor-pointer' },
                  h('input', {
                    type: 'checkbox', checked: day.closed,
                    onChange: () => {
                      const hh = [...formHours]; hh[d] = { ...hh[d], closed: !hh[d].closed }; setFormHours(hh)
                    },
                    className: 'w-3.5 h-3.5 rounded border-stone-300 text-propio-500 focus:ring-propio-500'
                  }),
                  t('agenda.no_data')
                )
              ),
              !day.closed && h('div', { className: 'grid grid-cols-2 gap-2' },
                h('div', null,
                  h('p', { className: 'text-[9px] font-semibold text-stone-400 mb-0.5' }, t('settings.season_morning')),
                  h('div', { className: 'flex gap-1' },
                    h('input', {
                      type: 'time', value: day.morningOpen,
                      onChange: e => { const hh = [...formHours]; hh[d] = { ...hh[d], morningOpen: e.target.value }; setFormHours(hh) },
                      className: 'w-full px-2 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-propio-500'
                    }),
                    h('input', {
                      type: 'time', value: day.morningClose,
                      onChange: e => { const hh = [...formHours]; hh[d] = { ...hh[d], morningClose: e.target.value }; setFormHours(hh) },
                      className: 'w-full px-2 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-propio-500'
                    })
                  )
                ),
                h('div', null,
                  h('p', { className: 'text-[9px] font-semibold text-stone-400 mb-0.5' }, t('settings.season_afternoon')),
                  h('div', { className: 'flex gap-1' },
                    h('input', {
                      type: 'time', value: day.afternoonOpen,
                      onChange: e => { const hh = [...formHours]; hh[d] = { ...hh[d], afternoonOpen: e.target.value }; setFormHours(hh) },
                      className: 'w-full px-2 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-propio-500'
                    }),
                    h('input', {
                      type: 'time', value: day.afternoonClose,
                      onChange: e => { const hh = [...formHours]; hh[d] = { ...hh[d], afternoonClose: e.target.value }; setFormHours(hh) },
                      className: 'w-full px-2 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-propio-500'
                    })
                  )
                )
              )
            )
          })
        ),

        h('button', {
          onClick: handleSave, disabled: saving || !formName.trim(),
          className: 'w-full mt-4 py-3 rounded-2xl bg-propio-500 hover:bg-propio-600 text-white font-bold shadow-lg active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2'
        }, saving ? t('settings.saving') : t('settings.save_season'))
      )
    )
  )
}

// ── HolidaysView ──────────────────────────────────────────────────────

function HolidaysView({ token, onToast }) {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [formDate, setFormDate] = useState('')
  const [formNameEs, setFormNameEs] = useState('')
  const [formNameEn, setFormNameEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const loadHolidays = useCallback(async () => {
    setLoading(true)
    try { const data = await getHolidays(token, year); setHolidays(data || []) }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
    finally { setLoading(false) }
  }, [token, year])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  const handleAdd = async () => {
    if (!formDate || !formNameEs.trim()) return
    setSaving(true); setFeedback(null)
    try {
      const payload = { holiday_date: formDate, name_es: formNameEs }
      if (formNameEn.trim()) payload.name_en = formNameEn
      await createHoliday(token, payload)
      setFormDate(''); setFormNameEs(''); setFormNameEn('')
      setFeedback({ type: 'success', text: t('settings.holiday_saved') })
      loadHolidays()
    } catch (e) { setFeedback({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('settings.delete_holiday_confirm'))) return
    try { await deleteHoliday(token, id); loadHolidays() }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
  }

  const years = useMemo(() => {
    const cy = new Date().getFullYear()
    return [cy - 1, cy, cy + 1, cy + 2]
  }, [])

  if (loading) return h(LoadingSkeleton)

  return h('div', null,
    feedback && feedback.type === 'success' && h('p', { className: 'text-xs text-emerald-600 font-semibold mb-2' }, feedback.text),
    feedback && feedback.type === 'error' && h('p', { className: 'text-xs text-red-600 font-semibold mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2' }, feedback.text),

    h('div', { className: 'flex items-center justify-between mb-3' },
      h('h3', { className: 'font-bold text-sm text-stone-700' }, t('settings.festivos')),
      h('div', { className: 'flex gap-1 bg-stone-100 rounded-xl p-0.5' },
        years.map(y => h('button', {
          key: y, onClick: () => setYear(y),
          className: 'text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer ' +
            (year === y ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
        }, String(y)))
      )
    ),

    h('div', { className: 'bg-white rounded-2xl border border-stone-200 p-3 mb-3 space-y-2' },
      h('div', { className: 'grid grid-cols-2 gap-2' },
        h('input', {
          type: 'date', value: formDate, onChange: e => setFormDate(e.target.value),
          className: 'px-3 py-2 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500'
        }),
        h('input', {
          type: 'text', value: formNameEs, onChange: e => setFormNameEs(e.target.value),
          placeholder: t('settings.holiday_name_es'),
          className: 'px-3 py-2 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500'
        })
      ),
      h('div', { className: 'flex gap-2' },
        h('input', {
          type: 'text', value: formNameEn, onChange: e => setFormNameEn(e.target.value),
          placeholder: t('settings.holiday_name_en'),
          className: 'flex-1 px-3 py-2 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500'
        }),
        h('button', {
          onClick: handleAdd, disabled: saving || !formDate || !formNameEs.trim(),
          className: 'shrink-0 px-4 py-2 rounded-xl bg-propio-500 hover:bg-propio-600 text-white font-bold text-sm shadow active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
        }, saving ? t('settings.saving') : t('settings.add_holiday'))
      )
    ),

    holidays.length === 0
      ? h(EmptyState, { title: t('settings.holiday_empty'), sub: t('settings.holiday_empty_sub') })
      : h('div', { className: 'space-y-1' },
          holidays.map(hol => h('div', {
            key: hol.id, className: 'bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3'
          },
            h('div', { className: 'w-10 h-10 rounded-xl bg-propio-50 flex items-center justify-center shrink-0' },
              h('span', { className: 'text-xs font-bold text-propio-500' }, new Date(hol.holiday_date).getDate())
            ),
            h('div', { className: 'flex-1 min-w-0' },
              h('p', { className: 'font-bold text-sm truncate' }, hol.name_es || hol.name_en || ''),
              h('p', { className: 'text-xs text-stone-400' },
                new Date(hol.holiday_date).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              )
            ),
            h('button', {
              onClick: () => handleDelete(hol.id),
              className: 'text-[10px] font-bold py-1.5 px-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition cursor-pointer'
            }, t('settings.delete_holiday'))
          ))
        )
  )
}

// ── BlocksView ────────────────────────────────────────────────────────

function BlocksView({ token, onToast }) {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => todayISO())
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Form
  const [formDate, setFormDate] = useState('')
  const [formType, setFormType] = useState('full_day')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formReason, setFormReason] = useState('')

  const loadBlocks = useCallback(async () => {
    setLoading(true)
    try { const data = await getAdminBlocks(token, date); setBlocks(data || []) }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
    finally { setLoading(false) }
  }, [token, date])

  useEffect(() => { loadBlocks() }, [loadBlocks])

  const resetForm = () => {
    setFormDate(date); setFormType('full_day'); setFormStart(''); setFormEnd(''); setFormReason('')
  }

  const handleAdd = async () => {
    setSaving(true); setFeedback(null)
    try {
      const payload = { block_date: formDate, block_type: formType, reason: formReason || null }
      if (formType === 'time_range') { payload.start_time = formStart; payload.end_time = formEnd }
      await createBlock(token, payload)
      setFeedback({ type: 'success', text: t('settings.block_saved') })
      setShowModal(false); resetForm(); loadBlocks()
    } catch (e) { setFeedback({ type: 'error', text: e.message }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('settings.delete_block_confirm'))) return
    try { await deleteBlock(token, id); loadBlocks() }
    catch (e) { setFeedback({ type: 'error', text: e.message }) }
  }

  if (loading) return h(LoadingSkeleton)

  return h('div', null,
    feedback && feedback.type === 'success' && h('p', { className: 'text-xs text-emerald-600 font-semibold mb-2' }, feedback.text),
    feedback && feedback.type === 'error' && h('p', { className: 'text-xs text-red-600 font-semibold mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2' }, feedback.text),

    h('div', { className: 'flex items-center justify-between mb-3' },
      h('div', { className: 'flex items-center gap-2' },
        h('h3', { className: 'font-bold text-sm text-stone-700' }, t('settings.bloques')),
        h('input', {
          type: 'date', value: date, onChange: e => setDate(e.target.value),
          className: 'px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs focus:outline-none focus:border-propio-500'
        })
      ),
      h('button', {
        onClick: () => { resetForm(); setShowModal(true) },
        className: 'text-xs font-bold py-2.5 px-3 rounded-xl bg-propio-500 hover:bg-propio-600 text-white shadow active:scale-[0.98] transition cursor-pointer'
      }, t('settings.add_block'))
    ),

    blocks.length === 0
      ? h(EmptyState, { title: t('settings.block_empty'), sub: t('settings.block_empty_sub') })
      : h('div', { className: 'space-y-1' },
          blocks.map(b => h('div', {
            key: b.id, className: 'bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3'
          },
            h('div', { className: 'w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0' },
              h('span', { className: 'text-xs font-bold text-stone-600' }, b.block_type === 'full_day' ? 'D' : '\u23F1')
            ),
            h('div', { className: 'flex-1 min-w-0' },
              h('p', { className: 'font-bold text-sm' },
                b.block_type === 'full_day' ? t('settings.block_full_day') : (b.start_time + ' - ' + b.end_time)
              ),
              b.reason && h('p', { className: 'text-xs text-stone-400 truncate' }, b.reason)
            ),
            h('button', {
              onClick: () => handleDelete(b.id),
              className: 'text-[10px] font-bold py-1.5 px-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition cursor-pointer'
            }, t('settings.delete_block'))
          ))
        ),

    // Block modal
    showModal && h('div', {
      className: 'fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center',
      onClick: (e) => { if (e.target === e.currentTarget) setShowModal(false) }
    },
      h('div', { className: 'bg-stone-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 relative' },
        h('button', {
          onClick: () => setShowModal(false),
          className: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-500 active:scale-[0.98] cursor-pointer'
        }, h(SvgClose)),

        h('h3', { className: 'font-bold text-base text-stone-800 mb-4' }, t('settings.add_block')),

        h('div', { className: 'mb-3' },
          h('label', { className: 'text-xs font-semibold text-stone-500' }, t('settings.block_date')),
          h('input', {
            type: 'date', value: formDate, onChange: e => setFormDate(e.target.value),
            className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
          })
        ),

        h('div', { className: 'mb-3' },
          h('p', { className: 'text-xs font-semibold text-stone-500 mb-1.5' }, t('settings.block_type')),
          h('div', { className: 'flex gap-2' },
            h('button', {
              onClick: () => setFormType('full_day'),
              className: 'flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer ' +
                (formType === 'full_day' ? 'bg-propio-500 hover:bg-propio-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
            }, t('settings.block_full_day')),
            h('button', {
              onClick: () => setFormType('time_range'),
              className: 'flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer ' +
                (formType === 'time_range' ? 'bg-propio-500 hover:bg-propio-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
            }, t('settings.block_time_range'))
          )
        ),

        formType === 'time_range' && h('div', { className: 'grid grid-cols-2 gap-3 mb-3' },
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500' }, t('settings.block_start')),
            h('input', {
              type: 'time', value: formStart, onChange: e => setFormStart(e.target.value),
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          ),
          h('div', null,
            h('label', { className: 'text-xs font-semibold text-stone-500' }, t('settings.block_end')),
            h('input', {
              type: 'time', value: formEnd, onChange: e => setFormEnd(e.target.value),
              className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
            })
          )
        ),

        h('div', { className: 'mb-4' },
          h('label', { className: 'text-xs font-semibold text-stone-500' }, t('settings.block_reason')),
          h('input', {
            type: 'text', value: formReason, onChange: e => setFormReason(e.target.value),
            placeholder: t('settings.block_reason_ph'),
            className: 'w-full px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 mt-1'
          })
        ),

        h('button', {
          onClick: handleAdd, disabled: saving || !formDate,
          className: 'w-full py-3 rounded-2xl bg-propio-500 hover:bg-propio-600 text-white font-bold shadow-lg active:scale-[0.98] transition cursor-pointer disabled:opacity-50'
        }, saving ? t('settings.saving') : t('settings.save_season'))
      )
    )
  )
}

// ── ClientRow (memoized) ────────────────────────────────────────────────

const ClientRow = React.memo(function ClientRow({ client, onClick, showInactiveHeader }) {
  const isInactive = client.days_since_last_visit !== null && client.days_since_last_visit >= 30
  return h('div', null,
    showInactiveHeader && h('p', {
      className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 pt-3 pb-1.5'
    }, t('admin.inactive_clients')),
    h('button', {
      onClick: () => onClick(client),
      className: 'w-full bg-white rounded-2xl p-3 border text-left active:scale-[0.98] transition cursor-pointer ' +
        (client.is_new
          ? 'border-emerald-200 hover:border-emerald-400'
          : isInactive
            ? 'border-stone-200 hover:border-propio-300'
            : 'border-stone-200 hover:border-propio-300')
    },
      h('div', { className: 'flex items-start justify-between gap-2' },
        h('div', { className: 'min-w-0' },
          h('p', { className: 'font-bold text-sm truncate', title: client.name },
            normalizeName(client.name),
            client.is_new
              ? h('span', { className: 'ml-1.5 inline-block text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0' }, t('admin.client_new'))
              : null
          ),
          h('div', { className: 'flex items-center gap-1.5' },
            h('p', { className: 'text-xs text-stone-500 truncate' }, client.phone),
            client.phone && h('a', {
              href: 'https://wa.me/' + cleanPhone(client.phone),
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'shrink-0 text-emerald-600 hover:text-emerald-700 transition',
              title: 'Abrir WhatsApp',
              onClick: (e) => e.stopPropagation()
            }, h(SvgWhatsApp, { className: 'w-3.5 h-3.5' }))
          ),
          client.email && h('p', { className: 'text-xs text-stone-400 truncate' }, client.email),
          client.days_since_last_visit !== null && (
            client.days_since_last_visit >= 30
              ? h('p', { className: 'text-[10px] font-bold text-red-500 mt-0.5' },
                  client.days_since_last_visit + ' ' + t('admin.days_ago'))
              : client.days_since_last_visit >= 25
                ? h('p', { className: 'text-[10px] font-bold text-amber-600 mt-0.5' },
                    client.days_since_last_visit + ' ' + t('admin.days_ago'))
                : null
          )
        ),
        h('div', { className: 'text-right shrink-0' },
          h('p', { className: 'text-lg font-extrabold ' + (client.is_new ? 'text-emerald-700' : 'text-propio-700') }, client.total_visits),
          h('p', { className: 'text-[10px] uppercase tracking-wider text-stone-500 font-bold' },
            client.total_visits === 1 ? t('visit.singular') : t('visit.plural'))
        )
      )
    )
  )
})

// ── Main App ──────────────────────────────────────────────────────────

function App() {
  const [authenticated, setAuthenticated] = useState(() => !!_getToken())

  // Listen for unauthorized events (401 from API)
  useEffect(() => {
    const handler = () => setAuthenticated(false)
    window.addEventListener('unauthorized', handler)
    return () => window.removeEventListener('unauthorized', handler)
  }, [])

  // If not authenticated, show login
  if (!authenticated) return h(LoginForm, { onLogin: () => setAuthenticated(true) })

  return h(AdminPanel)
}

function AdminPanel() {
  const lang = getLang()
  const params = new URLSearchParams(window.location.search)
  const initialTab = params.get('tab') || 'agenda'
  const [tab, setTab] = useState(['agenda', 'upcoming', 'clients', 'dashboard', 'settings'].includes(initialTab) ? initialTab : 'agenda')
  const [settingsSubTab, setSettingsSubTab] = useState('seasons')

  // Agenda sub-views
  const [agendaView, setAgendaView] = useState('day')
  const [date, setDate] = useState(() => params.get('date') || todayISO())
  // monthStr se deriva de date para mantener una única fuente de verdad
  const monthStr = useMemo(() => {
    const d = new Date(date + 'T12:00:00')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [date])

  // Agenda density (compact/comfortable) - persisted in localStorage
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('admin_agenda_density') || 'comfortable' } catch { return 'comfortable' }
  })
  React.useEffect(() => {
    try { localStorage.setItem('admin_agenda_density', density) } catch {}
  }, [density])

  // Sidebar collapse state (persisted)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { const v = localStorage.getItem('admin_sidebar_open'); return v !== null ? v === 'true' : false } catch { return false }
  })
  React.useEffect(() => {
    try { localStorage.setItem('admin_sidebar_open', String(sidebarOpen)) } catch {}
  }, [sidebarOpen])

  // Data
  const [appointments, setAppointments] = useState([])
  const [blocks, setBlocks] = useState([])
  const [weeklyData, setWeeklyData] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])

  // CRM
  const [selectedClient, setSelectedClient] = useState(null)

  // Month view day selection
  const [monthSelectedDay, setMonthSelectedDay] = useState(null)
  const [monthSelectedAppts, setMonthSelectedAppts] = useState(null)

  // New clients stats
  const [newClientStats, setNewClientStats] = useState(null)

  // Dashboard
  const [dashboardData, setDashboardData] = useState(null)
  const [showRevenue, setShowRevenue] = useState(false)
  const maskRevenue = (value) => showRevenue ? value : '\u2022\u2022\u2022\u2022'

  // Toast notification
  const [toast, setToast] = useState(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [upcomingFilter, setUpcomingFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [detailModalAppt, setDetailModalAppt] = useState(null)

  // Notifications
  const [notifications, setNotifications] = useState([])
  const [newNotifCount, setNewNotifCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const notifSinceRef = useRef('')
  const soundRef = useRef(true)
  const prevNotifCountRef = useRef(0)

  // ── Effects: load data ──

  // Load services once
  useEffect(() => {
    getServices().then(setServices).catch(e => setError(e.message))
  }, [])

  // Load agenda data
  useEffect(() => {
    if (tab !== 'agenda') return
    setLoading(true); setError(null)
    setMonthSelectedDay(null)
    setMonthSelectedAppts(null)

    if (agendaView === 'day') {
      // Also load new client stats for the current month
      const now = new Date()
      const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
      getNewClientStats(month).then(setNewClientStats).catch(() => {})
      getSummary(date)
        .then(d => setAppointments(d.appointments || []))
        .catch(e => setError(e.message))
      getBlocks(date)
        .then(setBlocks)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (agendaView === 'week') {
      const monday = getMonday(date)
      getWeeklyAgenda(monday)
        .then(d => setWeeklyData(d))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    } else if (agendaView === 'month') {
      const d = new Date(date + 'T12:00:00')
      const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      getMonthlyAgenda(ms)
        .then(d => setMonthlyData(d))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [tab, agendaView, date])

  // Load upcoming
  useEffect(() => {
    if (tab !== 'upcoming') return
    setUpcomingFilter('all')
    setLoading(true); setError(null)
    getUpcoming()
      .then(setUpcoming)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tab])

  // Load clients (when tab changes to clients and no client selected)
  useEffect(() => {
    if (tab === 'clients' && !selectedClient) {
      setClientFilter('all')
      setLoading(true); setError(null)
      getClients(filter)
        .then(setClients)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [tab, selectedClient, filter])

  // Load dashboard
  useEffect(() => {
    if (tab !== 'dashboard') return
    setLoading(true); setError(null)
    getDashboard()
      .then(setDashboardData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tab])

  // Debounce search query for clients
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── Auto-refresh: reload active view data ──
  const refreshCurrentView = useCallback(async () => {
    try {
      if (tab === 'upcoming') {
        const data = await getUpcoming()
        setUpcoming(data)
      } else if (tab === 'clients' && !selectedClient) {
        const data = await getClients(filter)
        setClients(data)
      } else if (tab === 'agenda') {
        if (agendaView === 'month') {
          const d = new Date(date + 'T12:00:00')
          const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const data = await getMonthlyAgenda(ms)
          setMonthlyData(data)
        } else {
          const data = await getSummary(date)
          setAppointments(data.appointments || [])
          if (agendaView === 'day') {
            getBlocks(date).then(setBlocks).catch(() => {})
          }
        }
      } else if (tab === 'dashboard') {
        const data = await getDashboard()
        setDashboardData(data)
      }
    } catch (e) { /* silent */ }
  }, [tab, agendaView, date, selectedClient])

  // ── Notification polling ──
  useEffect(() => {
    soundRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getRecentBookings(notifSinceRef.current)
        if (data.bookings && data.bookings.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id))
            const newOnes = data.bookings.filter(n => !existingIds.has(n.id))
            // Show toast for each new booking
            if (newOnes.length > 0) {
              const latest = newOnes[0]
              setToast({
                id: latest.id,
                name: latest.customer_name,
                service: latest.service_name,
                time: latest.start_time,
                isNew: latest.is_first_booking,
              })
              setTimeout(() => setToast(null), 6000)
            }
            return [...newOnes, ...prev].slice(0, 50)
          })
          setNewNotifCount(prev => prev + data.bookings.length)
          if (soundRef.current) {
            playNotificationSound()
          }
          // Auto-refresh only agenda/upcoming/dashboard, NOT clients
          if (tab === 'agenda' || tab === 'upcoming' || tab === 'dashboard') {
            refreshCurrentView()
          }
        }
        if (data.since) {
          notifSinceRef.current = data.since
        }
      } catch (e) {
        // Silent fail for notification polling
      }
    }

    // Initial fetch
    poll()

    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [refreshCurrentView])

  // ── Handlers ──

  const handleComplete = async (id) => {
    setBusyId(id)
    try {
      await updateStatus(id, 'completed')
      // Refresh current view
      if (tab === 'agenda') {
        if (agendaView === 'day') {
          const d = await getSummary(date)
          setAppointments(d.appointments || [])
        } else if (agendaView === 'week') {
          const monday = getMonday(date)
          const d = await getWeeklyAgenda(monday)
          setWeeklyData(d)
        } else if (agendaView === 'month') {
          const d = await getMonthlyAgenda(monthStr)
          setMonthlyData(d)
          if (monthSelectedDay) {
            const sd = await getSummary(monthSelectedDay)
            setMonthSelectedAppts(sd.appointments || [])
          }
        }
      } else if (tab === 'upcoming') {
        const u = await getUpcoming()
        setUpcoming(u)
      }
    } catch (e) { setError(e.message) }
    finally { setBusyId(null) }
  }

  const handleCancel = async (id) => {
    if (!confirm(t('admin.cancel_confirm'))) return
    setBusyId(id)
    try {
      await updateStatus(id, 'cancelled')
      // Refresh current view
      if (tab === 'agenda') {
        if (agendaView === 'day') {
          const d = await getSummary(date)
          setAppointments(d.appointments || [])
        } else if (agendaView === 'week') {
          const monday = getMonday(date)
          const d = await getWeeklyAgenda(monday)
          setWeeklyData(d)
        } else if (agendaView === 'month') {
          const d = await getMonthlyAgenda(monthStr)
          setMonthlyData(d)
          if (monthSelectedDay) {
            const sd = await getSummary(monthSelectedDay)
            setMonthSelectedAppts(sd.appointments || [])
          }
        }
      } else if (tab === 'upcoming') {
        const u = await getUpcoming()
        setUpcoming(u)
      }
    } catch (e) { setError(e.message) }
    finally { setBusyId(null) }
  }

  const shiftLeft = () => {
    if (agendaView === 'day') {
      const d = new Date(date + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      setDate(localDateISO(d))
    } else if (agendaView === 'week') {
      const d = new Date(date + 'T12:00:00')
      d.setDate(d.getDate() - 7)
      setDate(getMonday(d))
    } else {
      // month: avanzar date 1 mes atrás (estabilizado al día 1)
      const d = new Date(date + 'T12:00:00')
      d.setDate(1) // estabilizar para evitar saltos de mes con días cortos
      d.setMonth(d.getMonth() - 1)
      setDate(localDateISO(d))
    }
  }

  const shiftRight = () => {
    if (agendaView === 'day') {
      const d = new Date(date + 'T12:00:00')
      d.setDate(d.getDate() + 1)
      setDate(localDateISO(d))
    } else if (agendaView === 'week') {
      const d = new Date(date + 'T12:00:00')
      d.setDate(d.getDate() + 7)
      setDate(getMonday(d))
    } else {
      // month: avanzar date 1 mes (estabilizado al día 1)
      const d = new Date(date + 'T12:00:00')
      d.setDate(1) // estabilizar para evitar saltos de mes
      d.setMonth(d.getMonth() + 1)
      setDate(localDateISO(d))
    }
  }

  const goToday = () => {
    // date es la única fuente de verdad — todas las vistas derivan su periodo de ella
    setDate(todayISO())
  }

  const handleMonthDaySelect = async (dayStr) => {
    setDate(dayStr) // sincroniza date para que DayView/WeekView muestren el día seleccionado
    setMonthSelectedDay(dayStr)
    setMonthSelectedAppts(null)
    try {
      const d = await getSummary(dayStr)
      setMonthSelectedAppts(d.appointments || [])
    } catch (e) {
      setMonthSelectedAppts([])
    }
  }

  const handleWeekDaySelect = (dayStr) => {
    setDate(dayStr)
    setAgendaView('day')
  }

  const handleClientClick = (client) => {
    setSelectedClient(client)
  }

  const handleClientBack = () => {
    setSelectedClient(null)
    // Refresh clients list
    getClients().then(setClients).catch(() => {})
  }

  const handleClientUpdate = (updated) => {
    setClients(prev => prev.map(c => c.id === updated.id ? { ...c, name: updated.name, phone: updated.phone, email: updated.email } : c))
  }

  const handleNotifToggle = () => {
    if (showNotifPanel) {
      setShowNotifPanel(false)
      setNewNotifCount(0)
    } else {
      setShowNotifPanel(true)
      setNewNotifCount(0)
    }
  }

  const handleDismissNotification = useCallback(async (appointmentId) => {
    try {
      await dismissNotification(appointmentId)
      setNotifications(prev => prev.filter(n => n.id !== appointmentId))
    } catch (e) {
      console.error('Failed to dismiss notification:', e)
    }
  }, [])

  // ── Derived state ──
  const stats = useMemo(() => {
    const booked = appointments.filter(a => a.status === 'booked').length
    const completed = appointments.filter(a => a.status === 'completed').length
    const revenue = appointments
      .filter(a => a.status !== 'cancelled')
      .reduce((sum, a) => sum + (a.service_price || 0), 0)
    return { booked, completed, revenue, total: appointments.length }
  }, [appointments])

  const agendaTitle = useMemo(() => {
    if (agendaView === 'day') return fmtDate(date)
    if (agendaView === 'week') {
      const monday = getMonday(date)
      return t('agenda.weekly_title', fmtDateShort(monday))
    }
    const d = new Date(date + 'T12:00:00')
    return d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
  }, [agendaView, date])

  const handleCreateSuccess = () => {
    setShowModal(false)
    // Refresh current view
    if (tab === 'agenda') {
      if (agendaView === 'day') {
        getSummary(date).then(d => setAppointments(d.appointments || [])).catch(() => {})
      } else if (agendaView === 'week') {
        getWeeklyAgenda(getMonday(date)).then(setWeeklyData).catch(() => {})
      } else {
        const d = new Date(date + 'T12:00:00')
        const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        getMonthlyAgenda(ms).then(setMonthlyData).catch(() => {})
      }
    }
  }

  // ── Render ──
  return h('div', { className: 'min-h-screen flex flex-col bg-ivory-dark' },

    // ── Header ──
    h('header', { className: 'bg-dark-500 text-white px-4 sticky top-0 z-30 shadow-md' },
      h('div', { className: 'max-w-6xl mx-auto flex items-center md:grid md:grid-cols-3' },
        // Left: logo + brand (hidden brand text on mobile)
        h('div', { className: 'flex items-center gap-3 py-2 min-w-0 md:col-span-1' },
          // Hamburger toggle (desktop only)
          h('button', {
            onClick: () => setSidebarOpen(v => !v),
            className: 'hidden md:flex w-8 h-8 rounded-xl hover:bg-dark-600 items-center justify-center text-stone-400 hover:text-white transition shrink-0 cursor-pointer',
            'aria-label': sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar',
            title: sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'
          },
            h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' },
              sidebarOpen
                ? h('polyline', { points: '15 18 9 12 15 6' })
                : h('polyline', { points: '9 18 15 12 9 6' })
            )
          ),
          h('img', {
            src: '/logo-web.png',
            alt: t('brand'),
            className: 'h-9 w-auto object-contain shrink-0 brightness-0 invert'
          }),
          h('div', { className: 'min-w-0 hidden md:block' },
            h('h1', { className: 'font-extrabold text-sm leading-tight truncate' }, t('brand')),
            h('p', { className: 'text-[10px] text-stone-400 leading-tight mt-0.5' }, t('admin.title'))
          )
        ),
        // Center: logo icon (centrado en móvil y desktop)
        h('div', { className: 'flex-1 flex items-center justify-center py-2 md:col-span-1' },
          h('img', { src: '/propio-icon.svg', alt: '', className: 'h-7 w-auto brightness-0 invert opacity-70' })
        ),
        // Right: bell + lang
        h('div', { className: 'flex items-center gap-1 shrink-0 py-2 md:col-span-1 md:justify-end' },
          h(NotificationBell, {
            notifications,
            newCount: showNotifPanel ? 0 : newNotifCount,
            soundEnabled,
            onToggleSound: () => setSoundEnabled(v => !v),
            onTogglePanel: handleNotifToggle,
            open: showNotifPanel,
            onDismiss: handleDismissNotification
          }),
          h('button', {
            onClick: () => {
              const next = getLang() === 'es' ? 'en' : 'es'
              setLang(next)
              window.location.reload()
            },
            className: 'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition cursor-pointer shrink-0 ' +
              (getLang() === 'en' ? 'bg-propio-500 hover:bg-propio-600 text-white border-propio-500' : 'text-stone-400 border-stone-200 hover:text-stone-600'),
            'aria-label': getLang() === 'es' ? 'Switch to English' : 'Cambiar a espanol'
          }, getLang() === 'en' ? 'ES' : 'EN'),
          h('button', {
            onClick: () => { _clearToken(); window.location.reload() },
            className: 'w-8 h-8 rounded-xl hover:bg-dark-600 flex items-center justify-center text-stone-400 hover:text-red-400 transition cursor-pointer',
            title: t('admin.logout'),
            'aria-label': t('admin.logout')
          }, h(SvgLogout))
        )
      )
    ),

    // ── Toast notification ──
    toast && h('div', {
      key: toast.id,
      className: 'fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-md border border-stone-200 animate-slideDown overflow-hidden'
    },
      h('div', { className: 'flex items-stretch' },
        h('div', { className: 'w-1.5 shrink-0 bg-propio-500' }),
        h('div', { className: 'flex-1 py-2.5 pl-3 pr-2' },
          h('div', { className: 'flex items-center justify-between' },
            h('p', { className: 'text-xs font-bold text-propio-500 uppercase tracking-wider' }, t('notif.toast_title')),
            h('button', {
              onClick: () => setToast(null),
              className: 'w-5 h-5 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-500 transition cursor-pointer -mr-1'
            }, h(SvgClose))
          ),
          h('p', { className: 'text-sm font-bold text-stone-900 mt-1' },
            toast.name,
            toast.isNew ? h('span', { className: 'ml-1.5 text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0' }, t('admin.client_new')) : null
          ),
          h('p', { className: 'text-xs text-stone-500 mt-0.5' },
            toast.service + ' · ' + fmtTime(toast.time)
          )
        )
      )
    ),

    // ── Body wrapper: NAV first (left on desktop), then MAIN ──
    h('div', { className: 'flex-1 flex flex-col md:flex-row min-h-0' },

    // ── Nav sidebar (mobile: bottom bar, desktop: left sidebar) ──
    h('nav', { className: 'fixed bottom-0 left-0 right-0 md:static sidebar-transition flex-shrink-0 ' + (sidebarOpen ? 'md:w-56' : 'md:w-16') + ' bg-white border-t md:border-t-0 md:border-r border-stone-200 z-30 md:z-0 safe-bottom' },
      h('div', { className: 'max-w-2xl md:max-w-none mx-auto md:mx-0 flex md:flex-col ' + (sidebarOpen ? 'md:gap-1 md:p-3' : 'md:gap-0 md:p-2 md:items-center') },
        h(TabButton, {
          active: tab === 'agenda',
          onClick: () => setTab('agenda'),
          icon: h(SvgCalendar),
          label: t('admin.tab.agenda'),
          collapsed: !sidebarOpen
        }),
        h(TabButton, {
          active: tab === 'upcoming',
          onClick: () => setTab('upcoming'),
          icon: h(SvgList),
          label: t('admin.tab.upcoming'),
          collapsed: !sidebarOpen
        }),
        h(TabButton, {
          active: tab === 'clients',
          onClick: () => setTab('clients'),
          icon: h(SvgUsers),
          label: t('admin.tab.clients'),
          collapsed: !sidebarOpen
        }),
        h(TabButton, {
          active: tab === 'dashboard',
          onClick: () => setTab('dashboard'),
          icon: h(SvgDashboard),
          label: t('admin.tab.dashboard'),
          collapsed: !sidebarOpen
        }),
        h(TabButton, {
          active: tab === 'settings',
          onClick: () => setTab('settings'),
          icon: h(SvgSettings),
          label: t('settings.title'),
          collapsed: !sidebarOpen
        })
      )
    ),

    // ── Main content ──
    h('main', { className: 'flex-1 min-w-0 w-full px-3 md:px-5 lg:px-6 pt-3 md:pt-4 pb-24 md:pb-8 md:overflow-y-auto' },

      error && h('div', {
        className: 'bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 mb-4 flex items-center justify-between'
      },
        h('span', null, error),
        h('button', {
          onClick: () => setError(null),
          className: 'ml-2 text-red-400 hover:text-red-600 cursor-pointer transition-colors'
        }, h(SvgClose))
      ),

      // ── TAB: Agenda ──
      tab === 'agenda' && h('section', null,

        // Navigation: date nav + view toggle (stacked on mobile, inline on desktop)
        h('div', { className: 'flex flex-col sm:flex-row sm:items-center gap-1.5 mb-3' },
          // Row 1 (mobile): arrows + date + hoy
          h('div', { className: 'flex items-center gap-1.5 sm:flex-1' },
            h('button', {
              onClick: shiftLeft,
              className: 'w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center active:scale-[0.98] transition cursor-pointer shrink-0 text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }, h(SvgArrowLeft)),
            h('div', { className: 'flex-1 text-center min-w-0' },
              h('p', { className: 'font-bold text-sm text-stone-900 truncate px-1' }, agendaTitle)
            ),
            h('button', {
              onClick: shiftRight,
              className: 'w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center active:scale-[0.98] transition cursor-pointer shrink-0 text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }, h(SvgArrowRight)),
            h('button', {
              onClick: goToday,
              className: 'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-propio-50 text-propio-500 hover:bg-propio-100 active:scale-[0.98] transition cursor-pointer shrink-0 border border-propio-200/50'
            }, t('agenda.today'))
          ),
          // Row 2 (mobile): view toggle
          h('div', { className: 'flex justify-center sm:justify-end' },
            h(ViewToggle, { view: agendaView, onChange: setAgendaView })
          )
        ),

        // Day view (timeline profesional)
        agendaView === 'day' && h('div', null,
          // KPIs — compactos en móvil (grid 4 cols), expandidos en desktop (flex row)
          h('div', { className: 'grid grid-cols-4 gap-1 mb-3 px-0.5 md:flex md:items-center md:gap-5' },
            h('div', { className: 'flex items-center gap-1.5' },
              h('span', { className: 'text-[9px] font-medium text-stone-400 uppercase tracking-wider' }, t('admin.booked')),
              h('span', { className: 'text-sm font-bold text-stone-800' }, stats.booked)
            ),
            h('div', { className: 'flex items-center gap-1.5' },
              h('span', { className: 'text-[9px] font-medium text-stone-400 uppercase tracking-wider' }, t('admin.completed')),
              h('span', { className: 'text-sm font-bold text-stone-800' }, stats.completed)
            ),
            h('div', { className: 'flex items-center gap-1.5' },
              h('span', { className: 'text-[9px] font-medium text-stone-400 uppercase tracking-wider' }, t('admin.revenue')),
              h('span', { className: 'text-sm font-bold text-stone-800' }, stats.revenue + '\u20AC')
            ),
            h('div', { className: 'flex items-center gap-1.5' },
              h('span', { className: 'text-[9px] font-medium text-stone-400 uppercase tracking-wider' }, t('admin.new_month')),
              h('span', { className: 'text-sm font-bold text-stone-800' }, newClientStats ? newClientStats.new_clients : '…')
            )
          ),
          loading
            ? h(LoadingSkeleton)
            : h(DayView, {
                appointments,
                blocks,
                date,
                onComplete: handleComplete,
                onCancel: handleCancel,
                busyId,
                density,
                onAppointmentClick: setDetailModalAppt,
              })
        ),

        // Week view
        agendaView === 'week' && h(WeekView, {
          weeklyData,
          onComplete: handleComplete,
          onCancel: handleCancel,
          busyId,
          loading,
          onToast: setToast,
          density,
          onSelectDay: handleWeekDaySelect,
        }),

        // Month view
        agendaView === 'month' && h(MonthView, {
          monthlyData,
          monthStr,
          onSelectDay: handleMonthDaySelect,
          selectedDay: monthSelectedDay,
          selectedAppts: monthSelectedAppts,
          onComplete: handleComplete,
          onCancel: handleCancel,
          busyId,
          loading,
          onToast: setToast
        })
      ),

      // ── TAB: Upcoming ──
      tab === 'upcoming' && h('section', null,
        h('div', { className: 'flex items-center justify-between gap-2 mb-3' },
          h('div', null,
            h('h2', { className: 'font-semibold text-lg text-stone-800' }, t('admin.upcoming_title')),
            h('p', { className: 'text-xs text-stone-500 mt-0.5' }, t('admin.upcoming_sub'))
          ),
          h('div', { className: 'flex gap-2' },
            h('span', { className: 'text-[10px] font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full' },
              upcoming.filter(a => a.status === 'booked').length + ' ' + (lang === 'en' ? 'active' : 'activas')
            ),
            upcoming.filter(a => a.status === 'cancelled').length > 0 && h('span', { className: 'text-[10px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full' },
              '+' + upcoming.filter(a => a.status === 'cancelled').length
            )
          )
        ),

        // ── Filter pills ──
        h('div', { className: 'flex gap-1.5 mb-3 overflow-x-auto no-scrollbar' },
          ['all', 'today', 'tomorrow', 'week'].map(key => {
            const labels = {
              all: lang === 'en' ? 'All' : 'Todas',
              today: lang === 'en' ? 'Today' : 'Hoy',
              tomorrow: lang === 'en' ? 'Tomorrow' : 'Mañana',
              week: lang === 'en' ? 'This week' : 'Esta semana'
            }
            return h('button', {
              key,
              onClick: () => setUpcomingFilter(key),
              className: 'text-[11px] font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ' +
                (upcomingFilter === key
                  ? 'bg-dark-500 text-white shadow-sm'
                  : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-300 hover:text-stone-700')
            }, labels[key])
          })
        ),

        loading
          ? h(LoadingSkeleton)
          : upcoming.length === 0
            ? h(EmptyState, { title: t('admin.upcoming_empty'), sub: t('admin.upcoming_empty_sub') })
            : h('div', { className: 'space-y-2' },
                (() => {
                  const filtered = upcoming.filter(a => {
                    if (upcomingFilter === 'all') return true
                    const d = new Date(a.start_time)
                    const today = new Date(); today.setHours(0,0,0,0)
                    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    if (upcomingFilter === 'today') return diff === 0
                    if (upcomingFilter === 'tomorrow') return diff === 1
                    if (upcomingFilter === 'week') return diff >= 0 && diff <= 6
                    return true
                  })
                  // Build array with day headers inserted between groups
                  let currentDay = null
                  const items = []
                  filtered.forEach(a => {
                    const dayKey = a.start_time.split('T')[0]
                    if (dayKey !== currentDay) {
                      currentDay = dayKey
                      const todayStr = todayISO()
                      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
                      const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0')
                      let label
                      if (dayKey === todayStr) label = t('admin.today')
                      else if (dayKey === tomorrowStr) label = t('admin.tomorrow')
                      else label = new Date(dayKey + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' })
                      items.push({ _isHeader: true, label, key: 'h-' + dayKey })
                    }
                    items.push(a)
                  })
                  return items.map(item => {
                    if (item._isHeader) return h('p', { key: item.key, className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 pt-3 pb-1' }, item.label)
                    const a = item
                    return h('div', {
                      key: a.id,
                      className: 'bg-white rounded-xl border shadow-sm overflow-hidden ' +
                        (a.status === 'cancelled' ? 'border-red-200/60 opacity-75' : 'border-stone-200')
                    },
                      // ── Card body ──
                      h('div', { className: 'flex items-center' },
                        // Time column — compact
                        h('div', {
                          className: 'w-12 shrink-0 self-stretch flex flex-col items-center justify-center ' +
                            (a.status === 'cancelled' ? 'bg-red-50/50' : 'bg-stone-50/80')
                        },
                          h('p', { className: 'text-[10px] font-extrabold text-stone-900 leading-tight' }, fmtTime(a.start_time)),
                          h('p', { className: 'text-[8px] text-stone-400 uppercase tracking-wider mt-0.5' }, fmtRelative(a.start_time))
                        ),
                        // Info column
                        h('div', { className: 'flex-1 min-w-0 px-2 py-1 flex flex-col justify-center gap-0.5' },
                          h('div', { className: 'flex items-center gap-1' },
                            h('p', { className: 'text-xs font-semibold text-stone-800 truncate' }, normalizeName(a.customer_name)),
                            a.is_first_booking && h('span', { className: 'text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded-full uppercase tracking-wider shrink-0' }, t('admin.client_new')),
                            a.status !== 'booked' && h(StatusPill, { status: a.status })
                          ),
                          h('div', { className: 'flex items-center gap-1 text-[10px] text-stone-500' },
                            h('span', { className: 'truncate' }, a.service_name),
                            a.service_price != null && h('span', { className: 'text-stone-400 font-medium' }, a.service_price + '\u20AC')
                          ),
                          a.customer_phone && h('p', { className: 'text-[9px] text-stone-400 truncate' }, a.customer_phone)
                        ),
                        // Actions row (horizontal)
                        h('div', { className: 'flex items-center gap-0.5 pr-1.5 shrink-0' },
                          a.customer_phone && h('a', {
                            href: 'https://wa.me/' + cleanPhone(a.customer_phone) + '?text=' + encodeURIComponent(t('crm.whatsapp_msg', normalizeName(a.customer_name))),
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center active:scale-[0.98] transition hover:bg-emerald-200 cursor-pointer shrink-0',
                            title: t('crm.whatsapp')
                          }, h(SvgWhatsApp)),
                          a.status === 'booked' && h('button', {
                            onClick: (e) => { e.stopPropagation(); handleComplete(a.id) },
                            disabled: busyId === a.id,
                            className: 'w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-emerald-700 shrink-0',
                            title: t('admin.complete')
                          }, busyId === a.id ? '…' : '✓'),
                          a.status === 'booked' && h('button', {
                            onClick: (e) => { e.stopPropagation(); handleCancel(a.id) },
                            disabled: busyId === a.id,
                            className: 'w-10 h-10 sm:w-7 sm:h-7 rounded-lg bg-red-500 text-white flex items-center justify-center text-xs active:scale-[0.98] transition disabled:opacity-40 cursor-pointer hover:bg-red-600 shrink-0',
                            title: t('admin.cancel')
                          }, busyId === a.id ? '…' : '✗')
                        )
                      )
                    )
                }
              )
            })()
          )
      ),

      // ── TAB: Clients ──
      tab === 'clients' && h('section', null,
        selectedClient
          ? h(ClientCRM, {
              client: selectedClient,
              onBack: handleClientBack,
              onUpdate: handleClientUpdate
            })
          : h('div', null,
              h('div', { className: 'flex items-center justify-between mb-0.5' },
                h('h2', { className: 'font-semibold text-lg text-stone-800' }, t('admin.clients_title')),
                h('div', { className: 'flex gap-2 items-center' },
                  h('span', { className: 'text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-full' }, t('admin.total') + ': ' + clients.length),
                  h('span', { className: 'text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full' }, t('admin.new_count') + ': ' + clients.filter(c => c.is_new).length)
                )
              ),
              h('div', { className: 'flex items-center justify-between' },
                h('p', { className: 'text-xs sm:text-sm text-stone-500 mb-2' }, t('admin.registered', clients.length)),
                h('a', {
                  href: `${API}/admin/clients/export`,
                  download: 'clientes.csv',
                  className: 'text-xs font-bold text-propio-500 bg-propio-50 px-3 py-1.5 rounded-full hover:bg-propio-100 transition mb-3',
                  onClick: (e) => {
                    e.preventDefault()
                    fetch(`${API}/admin/clients/export`, { headers: _adminHeaders() })
                      .then(r => r.blob())
                      .then(blob => {
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url; a.download = 'clientes.csv'
                        document.body.appendChild(a); a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      })
                  }
                }, t('admin.export_clients'))
              ),

              // ── Filter pills ──
              h('div', { className: 'flex gap-1.5 mb-2.5 overflow-x-auto no-scrollbar' },
                ['all', 'new', 'regular', 'reactivate'].map(key => {
                  const labels = {
                    all: lang === 'en' ? 'All' : 'Todos',
                    new: lang === 'en' ? 'New' : 'Nuevos',
                    regular: lang === 'en' ? 'Regular' : 'Habituales',
                    reactivate: lang === 'en' ? 'Reactivate' : 'Por reactivar'
                  }
                  const counts = {
                    all: '',
                    new: clients.filter(c => c.is_new).length,
                    regular: clients.filter(c => !c.is_new && (c.days_since_last_visit === null || c.days_since_last_visit < 30)).length,
                    reactivate: clients.filter(c => c.days_since_last_visit !== null && c.days_since_last_visit >= 30).length
                  }
                  return h('button', {
                    key,
                    onClick: () => setClientFilter(key),
                    className: 'text-[11px] font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ' +
                      (clientFilter === key
                        ? 'bg-dark-500 text-white shadow-sm'
                        : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-300 hover:text-stone-700')
                  }, labels[key] + (counts[key] !== '' ? ' (' + counts[key] + ')' : ''))
                })
              ),

              // ── Search ──
              h('div', { className: 'relative mb-2.5' },
                h('input', {
                  type: 'search',
                  placeholder: t('admin.clients_search'),
                  value: searchQuery,
                  onChange: e => setSearchQuery(e.target.value),
                  autoComplete: 'off',
                  className: 'w-full px-3.5 py-2.5 pl-9 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-propio-500 focus:ring-1 focus:ring-propio-500/20 transition'
                }),
                h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, className: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none' },
                  h('circle', { cx: 11, cy: 11, r: 8 }),
                  h('path', { d: 'm21 21-4.3-4.3' })
                )
              ),

              loading
                  ? h(LoadingSkeleton, { count: 6 })
                  : clients.length === 0
                    ? h(EmptyState, {
                        title: filter ? t('admin.clients_filter_empty') : t('admin.clients_empty'),
                        sub: filter ? t('admin.clients_filter_sub') : t('admin.clients_empty_sub')
                      })
                    : h('div', { className: 'space-y-1.5' },
                        clients
                          .filter(c => {
                            if (clientFilter === 'all') return true
                            if (clientFilter === 'new') return c.is_new
                            if (clientFilter === 'regular') return !c.is_new && (c.days_since_last_visit === null || c.days_since_last_visit < 30)
                            if (clientFilter === 'reactivate') return c.days_since_last_visit !== null && c.days_since_last_visit >= 30
                            return true
                          })
                          .map((c, idx, filtered) => {
                            const isInactive = c.days_since_last_visit !== null && c.days_since_last_visit >= 30
                            const prevInactive = idx > 0
                              ? (filtered[idx-1].days_since_last_visit !== null && filtered[idx-1].days_since_last_visit >= 30)
                              : false
                            const showInactiveHeader = isInactive && !prevInactive

                            // Compute status label
                            let statusLabel, statusColor
                            if (c.is_new) {
                              statusLabel = lang === 'en' ? 'New' : 'Nuevo'
                              statusColor = 'bg-emerald-50 text-emerald-700'
                            } else if (isInactive) {
                              statusLabel = lang === 'en' ? 'Reactivate' : 'Por reactivar'
                              statusColor = 'bg-amber-50 text-amber-700'
                            } else {
                              statusLabel = lang === 'en' ? 'Regular' : 'Habitual'
                              statusColor = 'bg-blue-50 text-blue-700'
                            }

                            return h('div', { key: c.id },
                              showInactiveHeader && h('p', {
                                className: 'text-[10px] font-bold uppercase tracking-wider text-stone-500 pt-2 pb-1'
                              }, lang === 'en' ? 'Inactive clients' : 'Clientes inactivos'),
                              h('button', {
                                onClick: () => handleClientClick(c),
                                className: 'w-full bg-white rounded-2xl border shadow-sm p-3.5 text-left active:scale-[0.98] transition cursor-pointer hover:shadow-md ' +
                                  (c.is_new
                                    ? 'border-emerald-200/70 hover:border-emerald-400'
                                    : isInactive
                                      ? 'border-stone-200 hover:border-propio-300'
                                      : 'border-stone-200 hover:border-propio-300')
                              },
                                h('div', { className: 'flex items-start justify-between gap-2' },
                                  h('div', { className: 'min-w-0 flex-1' },
                                    h('div', { className: 'flex items-center gap-1.5' },
                                      h('p', { className: 'font-semibold text-sm text-stone-800 truncate' }, normalizeName(c.name)),
                                      h('span', { className: 'text-[9px] font-bold px-1.5 py-0.5 rounded-full ' + statusColor }, statusLabel)
                                    ),
                                    h('div', { className: 'flex items-center gap-2 mt-1' },
                                      c.phone && h('div', { className: 'flex items-center gap-1' },
                                        h('span', { className: 'text-xs text-stone-500' }, c.phone),
                                        h('a', {
                                          href: 'https://wa.me/' + cleanPhone(c.phone),
                                          target: '_blank',
                                          rel: 'noopener noreferrer',
                                          className: 'text-emerald-500 hover:text-emerald-600 transition',
                                          onClick: (e) => e.stopPropagation(),
                                          title: lang === 'en' ? 'Send WhatsApp' : 'Enviar WhatsApp'
                                        }, h(SvgWhatsApp, { className: 'w-3.5 h-3.5' }))
                                      ),
                                      c.email && h('span', { className: 'text-xs text-stone-400' }, c.email)
                                    ),
                                    h('div', { className: 'flex items-center gap-2 mt-1.5' },
                                      c.days_since_last_visit !== null
                                        ? h('span', { className: 'text-[10px] ' + (
                                            isInactive ? 'font-bold text-red-500' :
                                            c.days_since_last_visit >= 25 ? 'font-bold text-amber-600' :
                                            'text-stone-400'
                                          )},
                                          (lang === 'en' ? 'Last visit ' : 'Última visita ') + c.days_since_last_visit + ' ' +
                                            (c.days_since_last_visit === 1
                                              ? (lang === 'en' ? 'day ago' : 'día')
                                              : (lang === 'en' ? 'days ago' : 'días'))
                                        )
                                        : h('span', { className: 'text-[10px] text-stone-400' },
                                            lang === 'en' ? 'No visits yet' : 'Sin visitas'),
                                      c.notes && h('span', { className: 'text-[10px] text-stone-400 truncate max-w-[120px]' }, '· ' + c.notes)
                                    )
                                  ),
                                  h('div', { className: 'text-right shrink-0 ml-2' },
                                    h('p', { className: 'text-xl font-extrabold ' + (
                                      c.is_new ? 'text-emerald-700' :
                                      isInactive ? 'text-amber-700' :
                                      'text-propio-700'
                                    )}, c.total_visits),
                                    h('p', { className: 'text-[10px] uppercase tracking-wider text-stone-500 font-bold' },
                                      c.total_visits === 1 ? t('visit.singular') : t('visit.plural'))
                                  )
                                )
                              )
                            )
                          })
                      )
            )
      )
    ,

    // ── Dashboard ──
    tab === 'dashboard' && h('section', null,
      h(ErrorBoundary, null,
        h(Dashboard, {
        data: dashboardData,
        showRevenue,
        maskRevenue,
        onToggleRevenue: () => setShowRevenue(v => !v),
        onNavigate: (target) => {
          if (target === 'agenda') setTab('agenda')
          else if (target === 'clients') setTab('clients')
          else if (target === 'settings') setTab('settings')
          else if (target === 'new_booking') {
            setTab('agenda')
            setShowModal(true)
          }
        }
      })
      )
    ),

    // ── TAB: Settings ──
    tab === 'settings' && h(SettingsPanel, {
      settingsSubTab,
      onSubTabChange: setSettingsSubTab,
      token: _getToken(),
      onToast: setToast
    }),

    ),  // close main
    ),  // close wrapper

    // ── Footer: startup logo (sutil, fondo del panel) ──
    h('div', { className: 'text-center py-3 hidden md:block' },
      h('div', { className: 'flex items-center justify-center gap-1.5 text-[9px] text-stone-300' },
        h('img', { src: '/propio-logo.svg', alt: '', className: 'h-3 w-auto inline-block opacity-30' })
      )
    ),

    // ── FAB: Create booking (hidden on settings/dashboard) ──
    tab !== 'settings' && tab !== 'dashboard' && h('button', {
      onClick: () => setShowModal(true),
      className: 'fixed bottom-28 right-4 md:bottom-8 md:right-8 w-10 h-10 rounded-full bg-propio-500/80 text-white flex items-center justify-center active:scale-[0.98] z-40 transition hover:bg-propio-600 shadow-md cursor-pointer'
    }, h(SvgPlus)),

    // ── Create booking modal ──
    showModal && h(CreateBookingModal, {
      services,
      onClose: () => setShowModal(false),
      onSuccess: handleCreateSuccess
    }),

    // ── Appointment detail modal ──
    detailModalAppt && h(DetailModal, {
      appt: detailModalAppt,
      onClose: () => setDetailModalAppt(null),
      onComplete: handleComplete,
      onCancel: handleCancel,
      busyId,
    })
  )
}

// ── Mount ──
const rootEl = document.getElementById('root')
if (rootEl) createRoot(rootEl).render(h(App))
else console.error('Root element not found')
