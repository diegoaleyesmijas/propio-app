export function BookingForm({ initial, summary, loading, error, onSubmit }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        onSubmit({
          customer_name: data.get('name')?.toString().trim(),
          customer_email: data.get('email')?.toString().trim() || null,
          customer_phone: data.get('phone')?.toString().trim(),
        })
      }}
      className="space-y-4"
    >
      <div className="card bg-brand-50 border-brand-100">
        <p className="text-xs uppercase tracking-wider text-brand-700 font-semibold">Tu reserva</p>
        <p className="text-base font-bold text-brand-900 mt-1">{summary}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-stone-500 ml-1">Nombre completo</label>
        <input
          name="name"
          required
          defaultValue={initial?.customer_name}
          autoComplete="name"
          placeholder="Juan Pérez"
          className="input mt-1"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-stone-500 ml-1">Teléfono</label>
        <input
          name="phone"
          type="tel"
          required
          defaultValue={initial?.customer_phone}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+34 600 000 000"
          className="input mt-1"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-stone-500 ml-1">
          Email <span className="text-stone-400 font-normal">(opcional, para confirmación)</span>
        </label>
        <input
          name="email"
          type="email"
          defaultValue={initial?.customer_email}
          autoComplete="email"
          inputMode="email"
          placeholder="tu@email.com"
          className="input mt-1"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="pill-primary w-full text-base py-4 disabled:opacity-50">
        {loading ? 'Reservando…' : 'Confirmar reserva'}
      </button>

      <p className="text-center text-xs text-stone-400">
        Sin pagos por adelantado · Cancela hasta 24h antes
      </p>
    </form>
  )
}
