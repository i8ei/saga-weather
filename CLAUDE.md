# saga-weather

佐賀県20市町の気象ダッシュボード。農家向けに気温・日照・降水・風速・水収支を可視化。

## 技術スタック

- **フロントエンド**: React 18 + Vite（SPA、インラインスタイル）
- **バックエンド**: Cloudflare Workers（Hono）
- **データ**: D1（SQLite）+ KV（予報キャッシュ: stale-while-revalidate）
- **気象API**: Open-Meteo（過去実績 + 予報、タイムアウト8s + リトライ2回）
- **天文計算**: astronomy-engine（24節気・72候・月相、バンドル分離済み）
- **デプロイ**: `npm run build && npx wrangler deploy`

## URL

- 本番: https://saga-weather.ichevi.workers.dev/
- デフォルト市町: 太良町（41441）
- URL形式: `/{市町名}`（例: `/鹿島市`）

## ファイル構成

```
src/
  App.tsx                 メインUI（市町選択・期間切替・前年比・平年比）
  components/
    WeatherChart.tsx      SVGチャート（タップ詳細ツールチップ付き）
    ForecastTable.tsx     5日予報テーブル（候の変わり目表示）
    SekkiHeader.tsx       節気・候・月齢ヘッダー
    Accumulation/         積算カード（前年比+平年比差分表示）
    AlertBar.tsx          アラートバー（霜・強風）
  hooks/
    useWeather.ts         データフェッチhooks（daily/accumulation/forecast/municipalities/normal）
  lib/
    astronomy.ts          太陽黄経・節気計算（astronomy-engine）
    sekki-data.ts         24節気・72候データ + 月相
    weather-icons.ts      天気コード→アイコン変換
    time.ts               時刻ユーティリティ
worker/
  index.ts                Honoルーター + cron scheduled handler + admin API
  routes/
    weather.ts            /daily, /latest, /accumulation, /bundle, /normal
    forecast.ts           /forecast（KV stale-while-revalidate + 障害フォールバック）
    sekki.ts              /sekki（静的JSON、Cache-Control 7日）
    municipalities.ts     /municipalities（Cache-Control 30日）
  cron/
    ingest.ts             日次取込（20市町一括、エラーハンドリング付き）
    backfill.ts           手動バックフィル
  lib/
    open-meteo.ts         Open-Meteo APIクライアント（タイムアウト+リトライ）
    types.ts              型定義（Env, Municipality, DailyWeatherRow）
    date.ts               日付ユーティリティ
public/
  data/sekki.json         節気事前計算データ（2025-2036）
docs/
  architecture.md         アーキテクチャ・データフロー・スキーマ
  api.md                  API リファレンス
  operations.md           運用ガイド・トラブルシューティング
  design.md               設計思想・UI設計・技術判断
```

## データ保持

- **保持期間**: 1825日（5年）
- **取込**: 毎日21:00 UTC cron（20市町の過去7日分をupsert）
- **バックフィル**: `POST /api/admin/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **手動取込**: `POST /api/admin/ingest`
- **マイグレーション**: `POST /api/admin/migrate`

## API

- `GET /api/municipalities` — 佐賀県20市町一覧
- `GET /api/weather/latest?mc=` — 直近7日
- `GET /api/weather/daily?mc=&from=&to=` — 期間指定
- `GET /api/weather/bundle?mc=&from=&to=` — daily + accumulation 一括
- `GET /api/weather/accumulation?mc=&from=&to=` — 積算値
- `GET /api/weather/normal?mc=&from=&to=` — 過去5年平均（SQL集計）
- `GET /api/weather/forecast?mc=` — 8日間予報（KV stale-while-revalidate）
- `GET /api/sekki` — 節気・候データ

## UI仕様

### 期間切替
- プリセット: 1ヶ月 / 3ヶ月 / 6ヶ月 / 1年
- 日付ピッカーによるカスタム期間

### 前年比・平年比
- 前年比: オレンジトグル、1年超で自動無効化、カバー率80%未満で非表示
- 平年比: 紫トグル、過去2-5年のSQL集計平均、カバー率50%未満で非表示
- チャート: 7日移動平均の折れ線で重ね描画
- 積算カード: 差分をオレンジ/紫で表示

### チャートインタラクション
- タップ/クリックで日別詳細ツールチップ表示
- 前年値・平年値も条件付き表示
- 右端70%超で左フリップ

## パフォーマンス

- React.memo: AlertBar, SekkiHeader, ForecastTable, WeatherChart
- astronomy-engine: manualChunks で別チャンク分離（メイン178KB + astro 50KB）
- SVGパス: 配列+join で O(n) 構築
- /normal: SQL GROUP BY で集計（JS側ループ廃止）
- Open-Meteo: 8sタイムアウト + 2回リトライ（指数バックオフ）
- KV: stale-while-revalidate（Fresh 30分 / Stale 90分）+ 障害フォールバック

## 開発コマンド

```bash
npm run dev          # Vite開発サーバー (:5173, proxy→:8787)
npx wrangler dev     # Workers ローカル開発
npm run build        # TypeScript + Vite ビルド
npx wrangler deploy  # Cloudflare Workersへデプロイ
```
