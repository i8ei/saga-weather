# API リファレンス

ベース URL: `https://saga-weather.ichevi.workers.dev`

全エンドポイントで `mc` パラメータにより市町を指定（省略時は太良町 `41441`）。

## GET /api/municipalities

佐賀県20市町の一覧を返す。Cache-Control: 30日。

**レスポンス例**
```json
{
  "municipalities": [
    { "code": "41201", "name": "佐賀市" },
    { "code": "41441", "name": "太良町" }
  ],
  "minDate": "2021-03-07"
}
```

---

## GET /api/weather/daily

指定期間の日次気象データを返す。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| mc | string | - | 市町コード (デフォルト: 41441) |
| from | string | - | 開始日 (YYYY-MM-DD) |
| to | string | - | 終了日 (YYYY-MM-DD) |

省略時は直近30日分を返す。最大1900日。

**レスポンス例**
```json
[
  {
    "date": "2026-03-01",
    "temp_max": 17.4,
    "temp_min": 7.3,
    "temp_mean": 11.5,
    "precip_sum": 0,
    "sunshine_h": 10.03,
    "weather_code": 3,
    "et0": 2.94,
    "wind_max": 4.1
  }
]
```

---

## GET /api/weather/latest

直近7日分の気象データを返す。レスポンス形式は `/daily` と同じ。

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| mc | string | - | 市町コード |

---

## GET /api/weather/bundle

daily + accumulation を1リクエストで返す。フロントエンドが主に使用。

**パラメータ**

| 名前 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| mc | string | - | 41441 | 市町コード |
| from | string | - | 今年の1/1 | 開始日 |
| to | string | - | 今日 | 終了日 |
| base_temp | number | - | 10 | 有効積算温度の基準温度 (°C) |

**レスポンス例**
```json
{
  "daily": [ /* /daily と同形式 */ ],
  "accumulation": {
    "temp_sum": 655.7,
    "sunshine_sum": 309.6,
    "precip_sum": 165.8,
    "effective_temp_sum": 313.5,
    "et0_sum": 109.8,
    "water_balance": 56.0,
    "wind_max_peak": 10.9,
    "wind_max_avg": 5.2,
    "strong_wind_days": 12,
    "base_temp": 10,
    "from": "2026-01-01",
    "to": "2026-03-07",
    "days": 66
  }
}
```

---

## GET /api/weather/accumulation

指定期間の積算値を返す。

**パラメータ**: `bundle` と同じ。

**レスポンスフィールド**

| フィールド | 単位 | 説明 |
|---|---|---|
| temp_sum | °C | 積算温度（日平均気温の合計） |
| effective_temp_sum | °C | 有効積算温度（base_temp超過分の合計） |
| sunshine_sum | h | 積算日照時間 |
| precip_sum | mm | 積算降水量 |
| et0_sum | mm | 積算参考蒸発散量 |
| water_balance | mm | 水収支（降水 - ET0） |
| wind_max_peak | m/s | 期間中の最大風速 |
| wind_max_avg | m/s | 期間中の平均最大風速 |
| strong_wind_days | 日 | 強風日数（8 m/s以上） |

---

## GET /api/weather/normal

過去5年平均（前年除く）の日毎平均と積算を返す。SQL GROUP BY で集計。

**パラメータ**: `bundle` と同じ。

**レスポンス例**
```json
{
  "accumulation": { /* accumulation と同形式 */ },
  "daily": [ /* /daily と同形式（weather_code は常に 0） */ ],
  "years_used": 3
}
```

---

## GET /api/weather/forecast

8日間の天気予報を返す。KV で stale-while-revalidate キャッシュ。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| mc | string | - | 市町コード |

**レスポンスヘッダー**

| ヘッダー | 値 | 説明 |
|---|---|---|
| X-Forecast-Stale | true | Open-Meteo 障害時に古いデータを返している |

**レスポンス例**
```json
[
  {
    "date": "2026-03-07",
    "temp_max": 13.8,
    "temp_min": 8.5,
    "precip_sum": 19.0,
    "precip_prob": 100,
    "wind_max": 7.5,
    "weather_code": 63
  }
]
```

---

## GET /api/sekki

二十四節気・七十二候の日付データを返す。静的 JSON から配信。Cache-Control: 7日。

---

## 管理 API

全て `X-Admin-Key` ヘッダーによる認証が必要。

### POST /api/admin/ingest

Cron と同じ日次取込を手動実行。

### POST /api/admin/backfill?from=&to=

指定期間のバックフィル。最大400日。

### POST /api/admin/migrate

DBマイグレーション（インデックス作成等）を実行。
