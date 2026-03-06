/** JST (UTC+9) の今日の日付を YYYY-MM-DD で返す */
export function todayJST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** JST で N日前の日付を YYYY-MM-DD で返す */
export function daysAgoJST(n: number): string {
  return new Date(Date.now() + 9 * 3600_000 - n * 86400_000).toISOString().slice(0, 10)
}

/** YYYY-MM-DD 形式かどうか検証 */
export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

/** 2つの日付間の日数を返す */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400_000)
}
