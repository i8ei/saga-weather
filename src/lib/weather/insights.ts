import type { ForecastDay, Accumulation } from '../../hooks/useWeather'

export type InsightItem = { text: string; level: 'info' | 'warn' }

export function generateInsights(
  forecast: ForecastDay[],
  accum: Accumulation | null,
  prevAccum: Accumulation | null,
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

  // 3. Temperature trend (accum vs prevAccum)
  if (accum && prevAccum && accum.days > 0 && prevAccum.days > 0) {
    const avgDiff = accum.temp_sum / accum.days - prevAccum.temp_sum / prevAccum.days
    if (avgDiff > 1.5) {
      items.push({ text: 'この期間は前年より暖かめ', level: 'info' })
    } else if (avgDiff < -1.5) {
      items.push({ text: 'この期間は前年より涼しめ', level: 'info' })
    }
  }

  // 4. Water balance trend
  if (accum && prevAccum) {
    const wbDiff = accum.water_balance - prevAccum.water_balance
    if (wbDiff > 30) {
      items.push({ text: '土壌水分はやや多めの傾向', level: 'info' })
    } else if (wbDiff < -30) {
      items.push({ text: '乾燥傾向', level: 'warn' })
    }
  }

  // 5. Rainy week
  const rainyDays = forecast.filter((d) => d.precip_prob >= 50).length
  if (rainyDays >= 3) {
    items.push({ text: '雨がちの1週間', level: 'info' })
  }

  return items.slice(0, 3)
}
