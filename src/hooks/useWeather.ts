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

  useEffect(() => {
    fetch('/api/municipalities')
      .then((r) => r.json())
      .then((d) => { setData(d.municipalities); setMinDate(d.minDate); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { data, minDate, loading }
}

export function useForecast(mc?: string) {
  const [data, setData] = useState<ForecastDay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mc) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ mc })
    fetch(`/api/weather/forecast?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
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
    const params = new URLSearchParams({ from, to, mc })
    fetch(`/api/weather/daily?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [from, to, mc])

  return { data, error, loading }
}

export function useWeatherLatest(mc?: string) {
  const [data, setData] = useState<DailyWeather[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mc) return
    const params = new URLSearchParams({ mc })
    fetch(`/api/weather/latest?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
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
    fetch(`/api/weather/accumulation?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [from, to, mc])

  return { data, error, loading }
}
