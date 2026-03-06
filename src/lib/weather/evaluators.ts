import type { Accumulation } from '../../hooks/useWeather'

export type EvalLevel = 'high' | 'neutral' | 'low'
export type EvalResult = { text: string; level: EvalLevel } | null

function evaluate(
  curr: number,
  prev: number,
  labels: [string, string, string],
  threshold = 0.15,
): EvalResult {
  if (prev === 0) return null
  const ratio = (curr - prev) / Math.abs(prev)
  if (ratio > threshold) return { text: labels[0], level: 'high' }
  if (ratio < -threshold) return { text: labels[2], level: 'low' }
  return { text: labels[1], level: 'neutral' }
}

type AccumKey = keyof Accumulation

const EVAL_DEFS: { key: AccumKey; labels: [string, string, string] }[] = [
  { key: 'temp_sum', labels: ['高め', '並み', '低め'] },
  { key: 'effective_temp_sum', labels: ['高め', '並み', '低め'] },
  { key: 'sunshine_sum', labels: ['多め', '並み', '少なめ'] },
  { key: 'precip_sum', labels: ['多め', '並み', '少なめ'] },
  { key: 'water_balance', labels: ['湿潤', '並み', '乾燥'] },
  { key: 'strong_wind_days', labels: ['多め', '並み', '少なめ'] },
]

export function evaluateAccum(
  key: AccumKey,
  curr: Accumulation,
  prev: Accumulation,
): EvalResult {
  const def = EVAL_DEFS.find((d) => d.key === key)
  if (!def) return null
  return evaluate(Number(curr[key]), Number(prev[key]), def.labels)
}
