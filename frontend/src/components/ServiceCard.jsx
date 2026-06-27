export function ServiceCard({ service, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card w-full text-left flex items-center gap-4 transition-all active:scale-[0.98] ${
        selected ? 'ring-2 ring-brand-500 border-brand-500' : ''
      }`}
    >
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2v6c0 1.1.9 2 2 2h6"></path>
          <path d="M16 13H8m8 4H8m2-8H8"></path>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-base truncate">{service.name}</h3>
        <p className="text-sm text-stone-500">{service.duration_minutes} min</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-brand-600">{service.price}€</p>
        <p className="text-[10px] uppercase tracking-wider text-stone-400">IVA inc.</p>
      </div>
    </button>
  )
}
