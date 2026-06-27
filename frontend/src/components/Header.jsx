export function Header({ step, onBack }) {
  return (
    <header className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-100">
      <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center active:scale-90 transition"
            aria-label="Atrás"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"></path>
            </svg>
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-bold text-base leading-tight">Barber Studio</h1>
          <p className="text-xs text-stone-500">
            {step === 'service' && 'Elige tu servicio'}
            {step === 'slot' && 'Elige día y hora'}
            {step === 'form' && 'Tus datos'}
            {step === 'success' && '¡Listo!'}
          </p>
        </div>
      </div>
    </header>
  )
}
