export default function About({ onClose }: { onClose: () => void }) {
  return (
    <section className="card" style={{ fontSize: 13, lineHeight: 1.8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="jp" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>このサイトについて</h2>
        <button className="mono" onClick={onClose} style={{ padding: "4px 10px", fontSize: 11 }}>閉じる</button>
      </div>

      <div className="jp" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0 }}>
          <strong>お天道さん</strong>は、佐賀県の農家が毎朝見て作業判断できる気象ダッシュボードです。
          天気予報だけでなく、積算気温・日照・降水量・蒸発散量など、農作業に必要な数値をひと目で確認できます。
        </p>

        <div>
          <h3 className="mono" style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 4px" }}>機能</h3>
          <ul className="jp" style={{ margin: 0, paddingLeft: 20 }}>
            <li>佐賀県20市町の気象データ（気温・日照・降水・風速・蒸発散量）</li>
            <li>8日間の天気予報と週間農作業判断（霜注意・散布可否）</li>
            <li>積算気温・有効積算温度・水収支など農業指標</li>
            <li>前年比・平年比（過去4年平均）との比較</li>
            <li>二十四節気・七十二候・月齢の表示</li>
            <li>グラフのタップで日別詳細を確認</li>
          </ul>
        </div>

        <div>
          <h3 className="mono" style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 4px" }}>データソース</h3>
          <ul className="jp" style={{ margin: 0, paddingLeft: 20 }}>
            <li>気象データ: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Open-Meteo.com</a>（毎朝6時に自動更新）</li>
            <li>天文計算: <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>astronomy-engine</a></li>
          </ul>
        </div>

        <div>
          <h3 className="mono" style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 4px" }}>技術</h3>
          <p className="mono" style={{ margin: 0, fontSize: 11, color: "var(--text-sub)" }}>
            React + TypeScript + Vite / Cloudflare Workers + D1 + KV
          </p>
        </div>

        <div>
          <h3 className="mono" style={{ fontSize: 12, color: "var(--accent)", margin: "0 0 4px" }}>ソースコード</h3>
          <p style={{ margin: 0 }}>
            <a href="https://github.com/i8ei/saga-weather" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>github.com/i8ei/saga-weather</a>
          </p>
        </div>

        <p className="mono muted" style={{ margin: 0, fontSize: 11 }}>
          Built by Circulart
        </p>
      </div>
    </section>
  )
}
