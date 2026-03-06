const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
const DAILY_PARAMS = "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,sunshine_duration,weather_code,et0_fao_evapotranspiration,wind_speed_10m_max"

/** Open-Meteo daily response fields (shared by Forecast & Archive APIs) */
interface DailyResponse {
  time: string[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  temperature_2m_mean: (number | null)[]
  precipitation_sum: (number | null)[]
  sunshine_duration: (number | null)[]
  weather_code: (number | null)[]
  et0_fao_evapotranspiration: (number | null)[]
  wind_speed_10m_max: (number | null)[]
}

interface ForecastDailyResponse {
  time: string[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  precipitation_sum: (number | null)[]
  precipitation_probability_max: (number | null)[]
  wind_speed_10m_max: (number | null)[]
  weather_code: (number | null)[]
}

interface OpenMeteoResult<D> {
  daily: D
}

export interface FetchedRow {
  date: string
  temp_max: number
  temp_min: number
  temp_mean: number
  precip_sum: number
  sunshine_h: number | null
  weather_code: number
  et0: number | null
  wind_max: number | null
}

function parseDailyData(daily: DailyResponse): FetchedRow[] {
  const rows: FetchedRow[] = []
  for (let i = 0; i < daily.time.length; i++) {
    let sunshine_h = daily.sunshine_duration[i]
    if (sunshine_h != null) sunshine_h = sunshine_h / 3600
    rows.push({
      date: daily.time[i],
      temp_max: daily.temperature_2m_max[i] ?? 0,
      temp_min: daily.temperature_2m_min[i] ?? 0,
      temp_mean: daily.temperature_2m_mean[i] ?? 0,
      precip_sum: daily.precipitation_sum[i] ?? 0,
      sunshine_h,
      weather_code: daily.weather_code[i] ?? 0,
      et0: daily.et0_fao_evapotranspiration[i],
      wind_max: daily.wind_speed_10m_max[i],
    })
  }
  return rows
}

/** Single location fetch */
export async function fetchDailyRange(lat: string, lon: string, startDate: string, endDate: string): Promise<FetchedRow[]> {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: DAILY_PARAMS,
    timezone: "Asia/Tokyo",
    start_date: startDate,
    end_date: endDate,
  })
  const resp = await fetch(`${FORECAST_URL}?${params}`)
  if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`)
  const data = await resp.json<OpenMeteoResult<DailyResponse>>()
  return parseDailyData(data.daily)
}

/** Multi-location fetch: returns FetchedRow[][] (one array per location) */
export async function fetchDailyRangeMulti(lats: string, lons: string, startDate: string, endDate: string): Promise<FetchedRow[][]> {
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    daily: DAILY_PARAMS,
    timezone: "Asia/Tokyo",
    start_date: startDate,
    end_date: endDate,
  })
  const resp = await fetch(`${FORECAST_URL}?${params}`)
  if (!resp.ok) throw new Error(`Open-Meteo multi error: ${resp.status}`)
  const data = await resp.json() as OpenMeteoResult<DailyResponse>[] | OpenMeteoResult<DailyResponse>
  if (Array.isArray(data)) {
    return data.map((d) => parseDailyData(d.daily))
  }
  return [parseDailyData(data.daily)]
}

/** Multi-location fetch from Archive API (for historical backfill) */
export async function fetchArchiveMulti(lats: string, lons: string, startDate: string, endDate: string): Promise<FetchedRow[][]> {
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    daily: DAILY_PARAMS,
    timezone: "Asia/Tokyo",
    start_date: startDate,
    end_date: endDate,
  })
  const resp = await fetch(`${ARCHIVE_URL}?${params}`)
  if (!resp.ok) throw new Error(`Open-Meteo archive error: ${resp.status}`)
  const data = await resp.json() as OpenMeteoResult<DailyResponse>[] | OpenMeteoResult<DailyResponse>
  if (Array.isArray(data)) {
    return data.map((d) => parseDailyData(d.daily))
  }
  return [parseDailyData(data.daily)]
}

const FORECAST_DAILY_PARAMS = "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code"

export interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
  precip_sum: number
  precip_prob: number
  wind_max: number
  weather_code: number
}

function parseForecastData(daily: ForecastDailyResponse): ForecastDay[] {
  const result: ForecastDay[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const windKmh = Math.max(0, daily.wind_speed_10m_max[i] ?? 0)
    result.push({
      date: daily.time[i],
      temp_max: daily.temperature_2m_max[i] ?? 0,
      temp_min: daily.temperature_2m_min[i] ?? 0,
      precip_sum: daily.precipitation_sum[i] ?? 0,
      precip_prob: daily.precipitation_probability_max[i] ?? 0,
      wind_max: Math.round(windKmh / 3.6 * 10) / 10,
      weather_code: daily.weather_code[i] ?? 0,
    })
  }
  return result
}

/** Single location forecast */
export async function fetchForecast(lat: string, lon: string): Promise<ForecastDay[]> {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: FORECAST_DAILY_PARAMS,
    timezone: "Asia/Tokyo",
    forecast_days: "8",
  })
  const resp = await fetch(`${FORECAST_URL}?${params}`)
  if (!resp.ok) throw new Error(`Open-Meteo forecast error: ${resp.status}`)
  const data = await resp.json<OpenMeteoResult<ForecastDailyResponse>>()
  return parseForecastData(data.daily)
}

/** Multi-location forecast: returns ForecastDay[][] */
export async function fetchForecastMulti(lats: string, lons: string): Promise<ForecastDay[][]> {
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    daily: FORECAST_DAILY_PARAMS,
    timezone: "Asia/Tokyo",
    forecast_days: "8",
  })
  const resp = await fetch(`${FORECAST_URL}?${params}`)
  if (!resp.ok) throw new Error(`Open-Meteo forecast multi error: ${resp.status}`)
  const data = await resp.json() as OpenMeteoResult<ForecastDailyResponse>[] | OpenMeteoResult<ForecastDailyResponse>
  if (Array.isArray(data)) {
    return data.map((d) => parseForecastData(d.daily))
  }
  return [parseForecastData(data.daily)]
}
