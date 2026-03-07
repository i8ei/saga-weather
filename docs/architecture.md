# アーキテクチャ

## 全体構成

```
[ブラウザ]
    │
    ▼
[Cloudflare エッジ]
    ├── Static Assets (Vite SPA + sekki.json)
    ├── Workers (Hono API)
    │     ├── /api/weather/* → D1 クエリ
    │     ├── /api/weather/forecast → KV キャッシュ → Open-Meteo
    │     ├── /api/sekki → 静的アセット返却 (Cache-Control 7日)
    │     ├── /api/municipalities → D1 (Cache-Control 30日)
    │     └── /api/admin/* → 認証付き管理API
    ├── D1 (daily_weather + municipality テーブル)
    ├── KV (予報キャッシュ: stale-while-revalidate)
    └── Cron Triggers (毎朝 UTC 21:00 = JST 06:00)
              └── Open-Meteo → D1 upsert (20市町一括) + 1825日超削除
```

## データフロー

### リクエスト時
```
ブラウザ → GET /api/weather/daily?mc=41441&from=2026-01-01&to=2026-03-07
        → Worker (Hono) → D1 SELECT → wind_max km/h→m/s 変換 → JSON レスポンス
```

### 予報（stale-while-revalidate）
```
ブラウザ → GET /api/weather/forecast?mc=41441
        → Worker → KV.get("forecast_41441")
           ├── Fresh (< 30分) → 即返却
           ├── Stale (30-90分) → 即返却 + waitUntil で裏更新
           ├── Expired (> 90分) → 同期 fetch → KV 保存 → 返却
           └── fetch 失敗時 → 古い KV データをフォールバック返却
```

### 平年比（SQL集計）
```
ブラウザ → GET /api/weather/normal?mc=41441&from=2026-01-01&to=2026-03-07
        → Worker → D1: 過去2-5年分を GROUP BY strftime('%m-%d') で日毎平均
        → 年毎積算も SQL SUM/AVG で集計 → JSON レスポンス
```

### 日次 Cron
```
Cron Trigger (UTC 21:00)
  → Worker scheduled()
  → Open-Meteo Multi-location API (20市町一括, 過去7日)
  → D1 batch UPSERT (最大160行)
  → DELETE WHERE date < 1825日前
  → console.log サマリー出力
```

## D1 スキーマ

```sql
CREATE TABLE municipality (
  code TEXT PRIMARY KEY,       -- '41441' (佐賀県市町コード)
  name TEXT NOT NULL,          -- '太良町'
  lat  REAL NOT NULL,          -- 33.0194
  lon  REAL NOT NULL           -- 130.1790
);

CREATE TABLE daily_weather (
  municipality_code TEXT NOT NULL,  -- FK → municipality.code
  date              TEXT NOT NULL,  -- 'YYYY-MM-DD'
  temp_max          REAL,           -- 最高気温 (°C)
  temp_min          REAL,           -- 最低気温 (°C)
  temp_mean         REAL,           -- 平均気温 (°C)
  precip_sum        REAL,           -- 降水量 (mm)
  sunshine_h        REAL,           -- 日照時間 (h)
  weather_code      INTEGER,        -- WMO 天気コード
  et0               REAL,           -- 参考蒸発散量 (mm)
  wind_max          REAL,           -- 最大風速 (km/h) ※API時 m/s 変換
  fetched_at        TEXT,           -- 取得日時 (ISO 8601)
  PRIMARY KEY (municipality_code, date)
);

-- 推奨インデックス（prune/normalクエリ高速化）
CREATE INDEX idx_daily_weather_date ON daily_weather(date);
```

- **wind_max**: DB は km/h で保存、API レスポンス時に `/3.6` で m/s に変換
- **sunshine_h**: Open-Meteo は秒で返すので、取得時に `/3600` で時間に変換
- **1825日ウィンドウ**: Cron 実行時に5年超のデータを自動削除

## キャッシュ戦略

| エンドポイント | キャッシュ | TTL | 備考 |
|---|---|---|---|
| /api/sekki | ブラウザ+CDN | max-age=1日, s-maxage=7日 | 年1回更新の静的データ |
| /api/municipalities | ブラウザ | max-age=30日 | シードデータ |
| /api/weather/daily | ブラウザ+CDN | 過去期間: 1日/7日, 当日含む: 5分 | 日付で動的判定 |
| /api/weather/forecast | KV + ブラウザ | Fresh 30分 / Stale 90分 | stale-while-revalidate |

## 耐障害性

| 障害 | 対応 |
|---|---|
| Open-Meteo ダウン | 予報: KV フォールバック(X-Forecast-Stale), Cron: エラーログ+次回リトライ |
| Open-Meteo 遅延 | fetch 8秒タイムアウト + 最大2回リトライ(指数バックオフ) |
| D1 バッチ書き込み失敗 | 個別 try-catch で継続、失敗数をサマリー出力 |
| Cron 失敗 | 過去7日分を毎回 upsert するため、翌日に自動復旧 |

## Cloudflare リソース

| リソース | 名前 | ID |
|---|---|---|
| D1 | saga-weather-db | add2e324-8def-4ab9-8735-3d6e9a076926 |
| KV | FORECAST_CACHE | 1f269f5916b6450aa3807895428a7e26 |
| Workers | saga-weather | https://saga-weather.ichevi.workers.dev |

## 無料枠

| リソース | 上限 | 実際の使用量 |
|---|---|---|
| Workers | 10万リクエスト/日 | 数百程度 |
| D1 読み取り | 500万行/日 | 数千行程度 |
| D1 書き込み | 10万行/日 | ~160行/日 (20市町 x 8日) |
| D1 サイズ | 500 MB | ~5 MB (20市町 x 1825日) |
| KV 読み取り | 10万回/日 | 数百程度 |
| KV 書き込み | 1,000回/日 | 数十回/日 |
