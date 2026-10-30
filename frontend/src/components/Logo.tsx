export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
        <rect x="1" y="1" width="18" height="18" rx="4" className="fill-ink" />
        <path d="M5.5 7h9M5.5 10h9M5.5 13h5.5" className="stroke-background" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="14.2" cy="13" r="1.3" className="fill-brand" />
      </svg>
      <span className="font-heading text-[15px] font-semibold tracking-tight text-ink">Arca Reviewer</span>
    </span>
  )
}
