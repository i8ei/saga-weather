import type { ForecastDay, Accumulation } from '../../hooks/useWeather'

export type InsightItem = { text: string; level: 'info' | 'warn' }

export function generateInsights(
  forecast: ForecastDay[],
  accum: Accumulation | null,
  prevAccum: Accumulation | null,
  normalAccum?: Accumulation | null,
): InsightItem[] {
  const items: InsightItem[] = []

  // 1. Frost risk
  const frostDay = forecast.find((d) => d.temp_min <= 3)
  if (frostDay) {
    const minTemp = Math.min(...forecast.map((d) => d.temp_min))
    items.push({ text: `今週、霜に注意（最低${minTemp}℃）`, level: 'warn' })
  }

  // 2. Strong wind risk
  const windDay = forecast.find((d) => d.wind_max >= 8)
  if (windDay) {
    const maxWind = Math.max(...forecast.map((d) => d.wind_max))
    items.push({ text: `強風の日あり（最大${maxWind} m/s）`, level: 'warn' })
  }

  // 3. Temperature trend — prefer normal (平年) over prev (前年)
  if (accum && accum.days > 0) {
    const ref = normalAccum ?? prevAccum
    const label = normalAccum ? '平年' : '前年'
    if (ref && ref.days > 0) {
      const avgDiff = accum.temp_sum / accum.days - ref.temp_sum / ref.days
      if (avgDiff > 1.5) {
        items.push({ text: `この期間は${label}より暖かめ`, level: 'info' })
      } else if (avgDiff < -1.5) {
        items.push({ text: `この期間は${label}より涼しめ`, level: 'info' })
      }
    }
  }

  // 4. Water balance trend — prefer normal over prev
  if (accum) {
    const ref = normalAccum ?? prevAccum
    const label = normalAccum ? '平年' : '前年'
    if (ref) {
      const wbDiff = accum.water_balance - ref.water_balance
      if (wbDiff > 30) {
        items.push({ text: `土壌水分は${label}よりやや多めの傾向`, level: 'info' })
      } else if (wbDiff < -30) {
        items.push({ text: '乾燥傾向', level: 'warn' })
      }
    }
  }

  // 5. Rainy week
  const rainyDays = forecast.filter((d) => d.precip_prob >= 50).length
  if (rainyDays >= 3) {
    items.push({ text: '雨がちの1週間', level: 'info' })
  }

  return items.slice(0, 3)
}
