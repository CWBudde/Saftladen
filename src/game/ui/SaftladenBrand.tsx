/** Code-native fruit-stall wordmark: readable before artwork loads or offline. */
export function SaftladenBrand() {
  return (
    <header className="menu-brand">
      <p className="brand-eyebrow">Fresh fruit. Sharp moves.</p>
      <h1 className="menu-logo">
        <svg className="brand-citrus" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path d="M36 10Q39 1 52 5Q48 15 36 10" fill="var(--color-leaf)" />
          <circle cx="30" cy="35" r="24" fill="var(--color-citrus)" stroke="var(--color-cream)" strokeWidth="3" />
          <circle cx="30" cy="35" r="17" fill="none" stroke="var(--color-cream)" strokeWidth="2" />
          <path d="M30 18V52M13 35H47M18 23L42 47M18 47L42 23" stroke="var(--color-cream)" strokeWidth="2" />
          <path d="M4 56L58 15" stroke="var(--color-ink)" strokeWidth="7" />
          <path d="M4 56L58 15" stroke="var(--color-cream)" strokeWidth="3" />
        </svg>
        <span>Saftladen<span className="brand-dot">.</span></span>
      </h1>
      <p className="brand-tagline">Your daily dose of juicy chaos.</p>
    </header>
  )
}
