# お天道さん — 佐賀県農業気象ダッシュボード

佐賀県の農家が、毎朝見てその日の作業判断に使える気象ダッシュボードです。

天気予報を見るだけでは分かりにくい、

- いま寒さがどれくらい効いているか
- 雨がどれくらい足りているか
- 日照がどれくらい積み上がっているか
- 今日は散布できそうか
- 霜に注意した方がよさそうか

といった感覚を、気温・日照・降水量・風速・蒸発散量・積算気温・水収支などの指標で、ひと目で確認できるようにしています。

佐賀県20市町に対応し、毎朝6時（JST）に自動更新されます。

**https://saga-weather.ichevi.workers.dev**

---

## できること

- 佐賀県20市町の気象データ表示（気温・日照・降水・風速・蒸発散量）
- 8日間の天気予報と農作業判断（霜注意・散布可否）
- 積算気温・有効積算温度・水収支などの農業指標
- 前年比・平年比（過去4年平均）との比較チャート
- 二十四節気・七十二候・月齢の表示
- グラフのタップ/クリックで日別詳細を確認

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18 + TypeScript + Vite |
| バックエンド | Cloudflare Workers + Hono |
| データベース | Cloudflare D1（SQLite互換） |
| キャッシュ | Cloudflare KV（予報30分TTL） |
| 気象API | [Open-Meteo](https://open-meteo.com/)（無料・APIキー不要） |
| 天文計算 | [astronomy-engine](https://github.com/cosinekitty/astronomy) |
| 日次更新 | Cron Triggers（毎朝 JST 06:00） |

```
Open-Meteo
   ↓
Cloudflare Workers (Hono)
   ├─ D1 に日次データ保存
   ├─ KV に予報キャッシュ
   └─ API 提供
        ↓
React + Vite フロントエンド
        ↓
PC / スマホで閲覧
```

---

## セットアップ

```bash
# 依存インストール
npm install

# フロントエンド開発
npm run dev

# Workers ローカル開発
npx wrangler dev

# ビルド & デプロイ
npm run build && npx wrangler deploy
```

Vite dev server が `/api` を `localhost:8787` にプロキシ転送します。

## データ更新

気象データは Cron Triggers で毎朝自動取得・D1に保存されます（730日保持）。

```bash
# 節気データの再生成（年1回、ローカルで実行）
.venv/bin/python backend/generate_sekki.py
cp data/sekki.json public/data/sekki.json
```

---

## API

| エンドポイント | 説明 |
|----------------|------|
| `GET /api/weather/latest` | 直近7日の気象データ |
| `GET /api/weather/daily?from=&to=` | 期間指定の日別データ |
| `GET /api/weather/bundle?from=&to=` | 日別 + 積算を1レスポンスで |
| `GET /api/weather/accumulation?from=&to=` | 積算値（気温・日照・降水・ET0・風） |
| `GET /api/weather/normal?from=&to=` | 平年値（過去4年平均、前年除く） |
| `GET /api/weather/forecast` | 8日間予報（KV 30分キャッシュ） |
| `GET /api/sekki` | 二十四節気・七十二候データ |

全エンドポイントで `?mc=` パラメータにより市町を切替可能（デフォルト: 太良町 41441）。

---

## ライセンス

MIT

---

気象データ提供: [Open-Meteo.com](https://open-meteo.com/) | Built by Circulart
