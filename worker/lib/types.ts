export interface Env {
  DB: D1Database
  FORECAST_CACHE: KVNamespace
  ASSETS: Fetcher
}

export interface Municipality {
  code: string
  name: string
  lat: number
  lon: number
}

export interface DailyWeatherRow {
  municipality_code: string
  date: string
  temp_max: number
  temp_min: number
  temp_mean: number
  precip_sum: number
  sunshine_h: number
  weather_code: number
  et0: number | null
  wind_max: number | null
  fetched_at: string
}
