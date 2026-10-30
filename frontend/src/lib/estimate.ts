/**
 * Rough pre-run estimate, calibrated from observed runs: one document × one question
 * ≈ 1k tokens (mostly reasoning output), ~25s per document per worker slot.
 */
const TOKENS_PER_DOC_QUESTION = 1000
const USD_PER_MILLION_TOKENS = 8 // blended in/out for the extraction model
const SECONDS_PER_DOC = 25
const CONCURRENCY = 10

export function estimate(documents: number, questions: number) {
  const tokens = documents * questions * TOKENS_PER_DOC_QUESTION
  return {
    tokens,
    usd: (tokens / 1_000_000) * USD_PER_MILLION_TOKENS,
    seconds: Math.ceil(documents / CONCURRENCY) * SECONDS_PER_DOC,
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(5, Math.round(seconds / 5) * 5)}s`
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`
}

export function formatUsd(usd: number): string {
  return usd < 0.01 ? '<$0.01' : `$${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString()}`
}
