# 運用ガイド

## 日常運用

**何もしなくてよい。** Cron Triggers が毎朝自動で動く。

- 20市町の過去7日分を Open-Meteo から取得し D1 に upsert
- 1825日（5年）超のデータを自動削除
- 障害時は翌日のCronで自動復旧（7日分を毎回upsert）

## デプロイ

```bash
npm run build && npx wrangler deploy
```

## D1 データ確認

```bash
# 行数確認
npx wrangler d1 execute saga-weather-db --remote \
  --command "SELECT COUNT(*), MIN(date), MAX(date) FROM daily_weather"

# 市町別行数
npx wrangler d1 execute saga-weather-db --remote \
  --command "SELECT municipality_code, COUNT(*) FROM daily_weather GROUP BY municipality_code"

# 直近データ確認
npx wrangler d1 execute saga-weather-db --remote \
  --command "SELECT * FROM daily_weather WHERE municipality_code='41441' ORDER BY date DESC LIMIT 3"
```

## インデックス作成

```bash
# 方法1: admin API経由
curl -X POST https://saga-weather.ichevi.workers.dev/api/admin/migrate \
  -H "X-Admin-Key: YOUR_KEY"

# 方法2: wrangler直接
npx wrangler d1 execute saga-weather-db --remote \
  --command "CREATE INDEX IF NOT EXISTS idx_daily_weather_date ON daily_weather(date);"
```

## Cron 手動実行

```bash
# ローカルで実行
npx wrangler dev --test-scheduled
# 別ターミナルで:
curl http://localhost:8787/__scheduled

# 本番で実行
curl -X POST https://saga-weather.ichevi.workers.dev/api/admin/ingest \
  -H "X-Admin-Key: YOUR_KEY"
```

## バックフィル

```bash
# 過去1年分をバックフィル（最大400日）
curl -X POST "https://saga-weather.ichevi.workers.dev/api/admin/backfill?from=2025-03-07&to=2026-03-07" \
  -H "X-Admin-Key: YOUR_KEY"
```

## ログ確認

```bash
# Workers のリアルタイムログ
npx wrangler tail

# Cron 実行ログを確認
npx wrangler tail --format pretty | grep -i "ingest\|fetch\|batch\|prune"
```

Cron の出力例:
```
Fetching weather for 20 municipalities: 2026-02-28 → 2026-03-07
Upserted 160 rows for 20 municipalities
Pruned 20 old rows
Ingest summary: fetch=OK, batches=2/2
```

エラー時の出力例:
```
Open-Meteo 500 (attempt 1/3): Internal Server Error...
Open-Meteo 500 (attempt 2/3): Internal Server Error...
Open-Meteo fetch failed: Open-Meteo error: 500
Ingest summary: fetch=FAILED, batches=0/0
```

## 節気データ更新（2027年末頃）

```bash
# Python で節気計算（2028-2030年分を追加）
.venv/bin/python backend/generate_sekki.py

# 静的アセットにコピー
cp data/sekki.json public/data/sekki.json

# デプロイ
npm run build && npx wrangler deploy
```

## トラブルシューティング

### データが更新されない
1. `npx wrangler tail` でCronエラーを確認
2. Open-Meteo の障害を確認: https://status.open-meteo.com
3. `POST /api/admin/ingest` で手動実行してテスト

### 予報が表示されない
- Open-Meteo 障害時は KV の古いデータがフォールバック表示される
- レスポンスヘッダーに `X-Forecast-Stale: true` があれば障害中
- KV にデータがなければ 503 が返る

### フロントエンドが表示されない
1. `npm run build` が成功しているか確認
2. `npx wrangler deploy` を再実行
3. ブラウザキャッシュクリア

### D1 のサイズが大きい
- 1825日自動削除が動いているか確認（ログで `Pruned N old rows` を確認）
- 手動削除: `DELETE FROM daily_weather WHERE date < date('now', '-1825 days')`
