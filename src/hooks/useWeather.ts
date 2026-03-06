import { useState, useEffect } from 'react'

export interface DailyWeather {
  date: string
  temp_max: number
  temp_min: number
  temp_mean: number
  precip_sum: number
  sunshine_h: number
  weather_code: number
  et0: number | null
  wind_max: number | null
}

export interface Accumulation {
  temp_sum: number
  sunshine_sum: number
  precip_sum: number
  effective_temp_sum: number
  et0_sum: number
  water_balance: number
  wind_max_peak: number
  wind_max_avg: number
  strong_wind_days: number
  base_temp: number
  from: string
  to: string
  days: number
}

export interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
  precip_sum: number
  precip_prob: number
  wind_max: number
  weather_code: number
}

export interface Municipality {
  code: string
  name: string
  lat: number
  lon: number
}

export function useMunicipalities() {
  const [data, setData] = useState<Municipality[]>([])
  const [minDate, setMinDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/municipalities', { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d.municipalities); setMinDate(d.minDate); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [])

  return { data, minDate, loading, error }
}

export function useForecast(mc?: string) {
  const [data, setData] = useState<ForecastDay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mc) return
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const params = new URLSearchParams({ mc })
    fetch(`/api/weather/forecast?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [mc])

  return { data, error, loading }
}

export function useWeatherDaily(from?: string, to?: string, mc?: string) {
  const [data, setData] = useState<DailyWeather[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to || !mc) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const params = new URLSearchParams({ from, to, mc })
    fetch(`/api/weather/daily?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [from, to, mc])

  return { data, error, loading }
}

export function useWeatherLatest(mc?: string) {
  const [data, setData] = useState<DailyWeather[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mc) return
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const params = new URLSearchParams({ mc })
    fetch(`/api/weather/latest?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [mc])

  return { data, error, loading }
}

export function useAccumulation(from?: string, to?: string, mc?: string) {
  const [data, setData] = useState<Accumulation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mc) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('mc', mc)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const ac = new AbortController()
    fetch(`/api/weather/accumulation?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [from, to, mc])

  return { data, error, loading }
}

export interface NormalData {
  daily: DailyWeather[]
  accumulation: Accumulation | null
  years_used: number
}

/** 過去5年平均（前年除く）を取得 */
export function useWeatherNormal(from?: string, to?: string, mc?: string) {
  const [data, setData] = useState<NormalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to || !mc) { setData(null); setLoading(false); return }
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const params = new URLSearchParams({ from, to, mc })
    fetch(`/api/weather/normal?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [from, to, mc])

  return { data, error, loading }
}

/** daily + accumulation を1リクエストで取得 */
export function useWeatherBundle(from?: string, to?: string, mc?: string) {
  const [daily, setDaily] = useState<DailyWeather[]>([])
  const [accum, setAccum] = useState<Accumulation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to || !mc) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const params = new URLSearchParams({ from, to, mc })
    fetch(`/api/weather/bundle?${params}`, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setDaily(d.daily); setAccum(d.accumulation); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ac.abort()
  }, [from, to, mc])

  return { daily, accum, error, loading }
}
