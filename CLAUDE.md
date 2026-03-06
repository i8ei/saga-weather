# saga-weather

佐賀県20市町の気象ダッシュボード。農家向けに気温・日照・降水・風速・水収支を可視化。

## 技術スタック

- **フロントエンド**: React 18 + Vite（SPA）
- **バックエンド**: Cloudflare Workers（Hono）
- **データ**: D1（SQLite）+ KV（予報キャッシュ）
- **気象API**: Open-Meteo（過去実績 + 予報）
- **天文計算**: astronomy-engine（24節気・72候・月相）
- **デプロイ**: `npm run build && npx wrangler deploy`

## URL

- 本番: https://saga-weather.ichevi.workers.dev/
- デフォルト市町: 太良町（41441）
- URL形式: `/{市町名}`（例: `/鹿島市`）

## ファイル構成

```
src/
  App.tsx                 メインUI（市町選択・期間切替・前年比）
  components/
    WeatherChart.tsx      SVGチャート（気温・日照・降水・水分・風）
    ForecastTable.tsx     5日予報テーブル
    SekkiHeader.tsx       節気・候・月齢ヘッダー
    Accumulation/         積算カード（温度・日照・降水・水収支・強風日数）
    AlertBar.tsx          アラートバー
  hooks/
    useWeather.ts         データフェッチhooks（daily/accumulation/forecast/municipalities）
  lib/
    astronomy.ts          太陽黄経・節気計算（astronomy-engine）
    sekki-data.ts         24節気・72候データ + 月相
    weather-icons.ts      天気コード→アイコン変換
    time.ts               時刻ユーティリティ
worker/
  index.ts                Honoルーター + cron scheduled handler
  routes/
    weather.ts            /api/weather/daily, /api/weather/latest, /api/weather/accumulation
    forecast.ts           /api/weather/forecast（KVキャッシュ付き）
    sekki.ts              /api/sekki（静的JSON配信）
    municipalities.ts     /api/municipalities（市町一覧 + minDate）
  cron/
    ingest.ts             日次取込（過去7日分upsert + 1825日超prune）
    backfill.ts           手動バックフィル
  lib/
    open-meteo.ts         Open-Meteo APIクライアント
    types.ts              型定義（Env, Municipality等）
public/
  data/sekki.json         節気事前計算データ（2025-2027）
```

## データ保持

- **保持期間**: 1825日（5年）
- **取込**: 毎日21:00 UTC cron（過去7日分をupsert）
- **バックフィル**: `POST /api/admin/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **手動取込**: `POST /api/admin/ingest`

## UI仕様

### 期間切替
- プリセット: 1ヶ月 / 3ヶ月 / 6ヶ月 / 1年
- 期間指定まとめのカード内で日付ピッカーによるカスタム期間も可

### 前年比
- 同期間の前年データと重ねて比較
- **1年超の期間では自動無効化**（ボタンがグレーアウト）

### チャートX軸ラベル
- 15ヶ月以下: 毎月表示
- 16-30ヶ月: 3ヶ月ごと
- 31ヶ月以上: 6ヶ月ごと
- 1年超: 1月ラベルに年表示（'23, '24等）

### 節気・候
- 24節気: astronomy-engineで太陽黄経から動的計算（任意の年に対応）
- 72候: 節気開始日から5日刻みで自動割当
- sekki.json: 2025-2027の事前計算キャッシュ（API配信用）

## D1データベース

主要テーブル:
- `municipality`: 佐賀県20市町（code, name, lat, lon）
- `daily_weather`: 日次気象データ（municipality_code + date でユニーク）

## 開発コマンド

```bash
npm run dev          # Vite開発サーバー
npm run build        # TypeScript + Vite ビルド
npx wrangler deploy  # Cloudflare Workersへデプロイ
```
