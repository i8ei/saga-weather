/**
 * WMO Weather Code → emoji/label mapping
 * https://open-meteo.com/en/docs
 */
export function wmoToIcon(code: number): string {
  if (code === 0) return "☀️"
  if (code === 1) return "🌤"
  if (code === 2) return "⛅"
  if (code === 3) return "☁️"
  if (code <= 49) return "🌫"
  if (code <= 59) return "🌦"
  if (code <= 69) return "🌧"
  if (code <= 79) return "🌨"
  if (code <= 82) return "🌧"
  if (code <= 86) return "🌨"
  if (code <= 99) return "⛈"
  return "❓"
}

export function wmoToLabel(code: number): string {
  if (code === 0) return "快晴"
  if (code === 1) return "晴れ"
  if (code === 2) return "曇りがち"
  if (code === 3) return "曇り"
  if (code <= 49) return "霧"
  if (code <= 59) return "霧雨"
  if (code <= 69) return "雨"
  if (code <= 79) return "雪"
  if (code <= 82) return "にわか雨"
  if (code <= 86) return "にわか雪"
  if (code <= 99) return "雷雨"
  return "不明"
}
