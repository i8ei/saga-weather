import type { Accumulation } from '../../hooks/useWeather'

export type EvalResult = { text: string; color: string } | null

function evaluate(
  curr: number,
  prev: number,
  labels: [string, string, string],
  threshold = 0.15,
  invert = false,
): EvalResult {
  if (prev === 0) return null
  const ratio = (curr - prev) / Math.abs(prev)
  if (ratio > threshold) {
    return { text: labels[0], color: invert ? 'var(--warn)' : 'var(--accent)' }
  }
  if (ratio < -threshold) {
    return { text: labels[2], color: invert ? 'var(--accent)' : 'var(--accent)' }
  }
  return { text: labels[1], color: 'var(--text-sub)' }
}

type AccumKey = keyof Accumulation

interface EvalDef {
  key: AccumKey
  labels: [string, string, string]
  invert?: boolean
}

const EVAL_DEFS: EvalDef[] = [
  { key: 'temp_sum', labels: ['高め', '並み', '低め'] },
  { key: 'effective_temp_sum', labels: ['高め', '並み', '低め'] },
  { key: 'sunshine_sum', labels: ['多め', '並み', '少なめ'] },
  { key: 'precip_sum', labels: ['多め', '並み', '少なめ'] },
  { key: 'water_balance', labels: ['湿潤', '並み', '乾燥'] },
  { key: 'strong_wind_days', labels: ['多め', '並み', '少なめ'], invert: true },
]

export function evaluateAccum(
  key: AccumKey,
  curr: Accumulation,
  prev: Accumulation,
): EvalResult {
  const def = EVAL_DEFS.find((d) => d.key === key)
  if (!def) return null
  return evaluate(
    Number(curr[key]),
    Number(prev[key]),
    def.labels,
    0.15,
    def.invert,
  )
}
