

export function MetallicGradients() {
  return (
    <svg style={{ height: 0, width: 0, position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* Silver Gradient (Hero / Primary Data) */}
        <linearGradient id="silverGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E5E7EB" stopOpacity={1} />
          <stop offset="50%" stopColor="#F9FAFB" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#D1D5DB" stopOpacity={0.8} />
        </linearGradient>

        {/* Steel Gradient (Secondary Data) */}
        <linearGradient id="steelGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9CA3AF" stopOpacity={1} />
          <stop offset="100%" stopColor="#6B7280" stopOpacity={0.7} />
        </linearGradient>

        {/* Titanium Gradient (Tertiary / Background Data) */}
        <linearGradient id="titaniumGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4B5563" stopOpacity={1} />
          <stop offset="100%" stopColor="#1F2937" stopOpacity={0.6} />
        </linearGradient>

        {/* Chrome Shine (Accents) */}
        <linearGradient id="chromeGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.2} />
          <stop offset="50%" stopColor="#ffffff" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0.2} />
        </linearGradient>
      </defs>
    </svg>
  );
}
