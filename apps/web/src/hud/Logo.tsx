/** Το σήμα της ATHENA: εξάγωνο με τα «μάτια» της κουκουβάγιας της θεάς. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="drop-shadow-[0_0_10px_rgba(255,95,184,0.55)]">
      <defs>
        <linearGradient id="athena-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5fb8" />
          <stop offset="1" stopColor="#ffa043" />
        </linearGradient>
      </defs>
      <path d="M32 7 53.6 19.5v25L32 57 10.4 44.5v-25Z" fill="rgba(12,6,20,0.6)" stroke="url(#athena-mark)" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="6.5" fill="none" stroke="#ff5fb8" strokeWidth="2.5" />
      <circle cx="40" cy="31" r="6.5" fill="none" stroke="#ffa043" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="2.2" fill="#ff5fb8" className="animate-breathe" />
      <circle cx="40" cy="31" r="2.2" fill="#ffa043" className="animate-breathe" />
      <path d="M28.5 41.5 32 45l3.5-3.5" fill="none" stroke="url(#athena-mark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
