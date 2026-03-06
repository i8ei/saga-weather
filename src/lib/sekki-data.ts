import * as Astronomy from "astronomy-engine";
import { getSolarEclipticLongitude, getSekkiFromLongitude, searchSekkiStartDate } from "./astronomy";

// 24節気（小寒から始まる順序）
export const SEKKI_24 = [
  { name: "小寒", start: [1, 6], season: "winter" },
  { name: "大寒", start: [1, 20], season: "winter" },
  { name: "立春", start: [2, 4], season: "spring" },
  { name: "雨水", start: [2, 19], season: "spring" },
  { name: "啓蟄", start: [3, 6], season: "spring" },
  { name: "春分", start: [3, 21], season: "spring" },
  { name: "清明", start: [4, 5], season: "spring" },
  { name: "穀雨", start: [4, 20], season: "spring" },
  { name: "立夏", start: [5, 6], season: "summer" },
  { name: "小満", start: [5, 21], season: "summer" },
  { name: "芒種", start: [6, 6], season: "summer" },
  { name: "夏至", start: [6, 21], season: "summer" },
  { name: "小暑", start: [7, 7], season: "summer" },
  { name: "大暑", start: [7, 23], season: "summer" },
  { name: "立秋", start: [8, 8], season: "autumn" },
  { name: "処暑", start: [8, 23], season: "autumn" },
  { name: "白露", start: [9, 8], season: "autumn" },
  { name: "秋分", start: [9, 23], season: "autumn" },
  { name: "寒露", start: [10, 8], season: "autumn" },
  { name: "霜降", start: [10, 24], season: "autumn" },
  { name: "立冬", start: [11, 8], season: "winter" },
  { name: "小雪", start: [11, 22], season: "winter" },
  { name: "大雪", start: [12, 7], season: "winter" },
  { name: "冬至", start: [12, 22], season: "winter" },
] as const;

// 節気の色（HSLベース）
const SEKKI_COLORS: Record<number, string> = {
  0: "hsl(210, 50%, 35%)",   // 小寒
  1: "hsl(220, 55%, 30%)",   // 大寒
  2: "hsl(170, 45%, 40%)",   // 立春
  3: "hsl(160, 50%, 42%)",   // 雨水
  4: "hsl(145, 50%, 44%)",   // 啓蟄
  5: "hsl(130, 50%, 45%)",   // 春分
  6: "hsl(110, 55%, 45%)",   // 清明
  7: "hsl(90, 55%, 45%)",    // 穀雨
  8: "hsl(70, 60%, 50%)",    // 立夏
  9: "hsl(55, 70%, 50%)",    // 小満
  10: "hsl(45, 75%, 50%)",   // 芒種
  11: "hsl(40, 80%, 50%)",   // 夏至
  12: "hsl(35, 80%, 48%)",   // 小暑
  13: "hsl(28, 80%, 48%)",   // 大暑
  14: "hsl(25, 70%, 45%)",   // 立秋
  15: "hsl(22, 60%, 42%)",   // 処暑
  16: "hsl(20, 55%, 40%)",   // 白露
  17: "hsl(18, 50%, 38%)",   // 秋分
  18: "hsl(15, 45%, 35%)",   // 寒露
  19: "hsl(12, 40%, 32%)",   // 霜降
  20: "hsl(215, 45%, 35%)",  // 立冬
  21: "hsl(220, 50%, 32%)",  // 小雪
  22: "hsl(225, 55%, 30%)",  // 大雪
  23: "hsl(230, 55%, 28%)",  // 冬至
};

export function getSekkiColor(sekkiIndex: number): string {
  return SEKKI_COLORS[sekkiIndex] ?? "hsl(0, 0%, 30%)";
}

export function getSekkiIndex(d: Date): number {
  const lon = getSolarEclipticLongitude(d);
  return getSekkiFromLongitude(lon).index;
}

export function sekkiStartDate(year: number, sekkiIndex: number): Date {
  return searchSekkiStartDate(year, sekkiIndex);
}

export function getMoonPhase(d: Date): number {
  return Astronomy.MoonPhase(new Astronomy.AstroTime(d)) / 360;
}

export function moonPhaseIcon(phase: number): string {
  if (phase < 0.125) return "🌑";
  if (phase < 0.25) return "🌒";
  if (phase < 0.375) return "🌓";
  if (phase < 0.5) return "🌔";
  if (phase < 0.625) return "🌕";
  if (phase < 0.75) return "🌖";
  if (phase < 0.875) return "🌗";
  return "🌘";
}

// 72候
export const KO_72 = [
  { name: "芹乃栄", reading: "せりすなわちさかう", sekkiIdx: 0 },
  { name: "水泉動", reading: "しみずあたたかをふくむ", sekkiIdx: 0 },
  { name: "雉始雊", reading: "きじはじめてなく", sekkiIdx: 0 },
  { name: "款冬華", reading: "ふきのはなさく", sekkiIdx: 1 },
  { name: "水沢腹堅", reading: "さわみずこおりつめる", sekkiIdx: 1 },
  { name: "鶏始乳", reading: "にわとりはじめてとやにつく", sekkiIdx: 1 },
  { name: "東風解凍", reading: "はるかぜこおりをとく", sekkiIdx: 2 },
  { name: "黄鶯睍睆", reading: "うぐいすなく", sekkiIdx: 2 },
  { name: "魚上氷", reading: "うおこおりをいずる", sekkiIdx: 2 },
  { name: "土脉潤起", reading: "つちのしょううるおいおこる", sekkiIdx: 3 },
  { name: "霞始靆", reading: "かすみはじめてたなびく", sekkiIdx: 3 },
  { name: "草木萌動", reading: "そうもくめばえいずる", sekkiIdx: 3 },
  { name: "蟄虫啓戸", reading: "すごもりむしとをひらく", sekkiIdx: 4 },
  { name: "桃始笑", reading: "ももはじめてさく", sekkiIdx: 4 },
  { name: "菜虫化蝶", reading: "なむしちょうとなる", sekkiIdx: 4 },
  { name: "雀始巣", reading: "すずめはじめてすくう", sekkiIdx: 5 },
  { name: "桜始開", reading: "さくらはじめてひらく", sekkiIdx: 5 },
  { name: "雷乃発声", reading: "かみなりすなわちこえをはっす", sekkiIdx: 5 },
  { name: "玄鳥至", reading: "つばめきたる", sekkiIdx: 6 },
  { name: "鴻雁北", reading: "こうがんかえる", sekkiIdx: 6 },
  { name: "虹始見", reading: "にじはじめてあらわる", sekkiIdx: 6 },
  { name: "葭始生", reading: "あしはじめてしょうず", sekkiIdx: 7 },
  { name: "霜止出苗", reading: "しもやみてなえいずる", sekkiIdx: 7 },
  { name: "牡丹華", reading: "ぼたんはなさく", sekkiIdx: 7 },
  { name: "蛙始鳴", reading: "かわずはじめてなく", sekkiIdx: 8 },
  { name: "蚯蚓出", reading: "みみずいずる", sekkiIdx: 8 },
  { name: "竹笋生", reading: "たけのこしょうず", sekkiIdx: 8 },
  { name: "蚕起食桑", reading: "かいこおきてくわをくらう", sekkiIdx: 9 },
  { name: "紅花栄", reading: "べにばなさかう", sekkiIdx: 9 },
  { name: "麦秋至", reading: "むぎのときいたる", sekkiIdx: 9 },
  { name: "螳螂生", reading: "かまきりしょうず", sekkiIdx: 10 },
  { name: "腐草為蛍", reading: "くされたるくさほたるとなる", sekkiIdx: 10 },
  { name: "梅子黄", reading: "うめのみきばむ", sekkiIdx: 10 },
  { name: "乃東枯", reading: "なつかれくさかるる", sekkiIdx: 11 },
  { name: "菖蒲華", reading: "あやめはなさく", sekkiIdx: 11 },
  { name: "半夏生", reading: "はんげしょうず", sekkiIdx: 11 },
  { name: "温風至", reading: "あつかぜいたる", sekkiIdx: 12 },
  { name: "蓮始開", reading: "はすはじめてひらく", sekkiIdx: 12 },
  { name: "鷹乃学習", reading: "たかすなわちわざをならう", sekkiIdx: 12 },
  { name: "桐始結花", reading: "きりはじめてはなをむすぶ", sekkiIdx: 13 },
  { name: "土潤溽暑", reading: "つちうるおうてむしあつし", sekkiIdx: 13 },
  { name: "大雨時行", reading: "たいうときどきふる", sekkiIdx: 13 },
  { name: "涼風至", reading: "すずかぜいたる", sekkiIdx: 14 },
  { name: "寒蝉鳴", reading: "ひぐらしなく", sekkiIdx: 14 },
  { name: "蒙霧升降", reading: "ふかききりまとう", sekkiIdx: 14 },
  { name: "綿柎開", reading: "わたのはなしべひらく", sekkiIdx: 15 },
  { name: "天地始粛", reading: "てんちはじめてさむし", sekkiIdx: 15 },
  { name: "禾乃登", reading: "こくものすなわちみのる", sekkiIdx: 15 },
  { name: "草露白", reading: "くさのつゆしろし", sekkiIdx: 16 },
  { name: "鶺鴒鳴", reading: "せきれいなく", sekkiIdx: 16 },
  { name: "玄鳥去", reading: "つばめさる", sekkiIdx: 16 },
  { name: "雷乃収声", reading: "かみなりすなわちこえをおさむ", sekkiIdx: 17 },
  { name: "蟄虫坏戸", reading: "むしかくれてとをふさぐ", sekkiIdx: 17 },
  { name: "水始涸", reading: "みずはじめてかる", sekkiIdx: 17 },
  { name: "鴻雁来", reading: "こうがんきたる", sekkiIdx: 18 },
  { name: "菊花開", reading: "きくのはなひらく", sekkiIdx: 18 },
  { name: "蟋蟀在戸", reading: "きりぎりすとにあり", sekkiIdx: 18 },
  { name: "霜始降", reading: "しもはじめてふる", sekkiIdx: 19 },
  { name: "霎時施", reading: "こさめときどきふる", sekkiIdx: 19 },
  { name: "楓蔦黄", reading: "もみじつたきばむ", sekkiIdx: 19 },
  { name: "山茶始開", reading: "つばきはじめてひらく", sekkiIdx: 20 },
  { name: "地始凍", reading: "ちはじめてこおる", sekkiIdx: 20 },
  { name: "金盞香", reading: "きんせんかさく", sekkiIdx: 20 },
  { name: "虹蔵不見", reading: "にじかくれてみえず", sekkiIdx: 21 },
  { name: "朔風払葉", reading: "きたかぜこのはをはらう", sekkiIdx: 21 },
  { name: "橘始黄", reading: "たちばなはじめてきばむ", sekkiIdx: 21 },
  { name: "閉塞成冬", reading: "そらさむくふゆとなる", sekkiIdx: 22 },
  { name: "熊蟄穴", reading: "くまあなにこもる", sekkiIdx: 22 },
  { name: "鱖魚群", reading: "さけのうおむらがる", sekkiIdx: 22 },
  { name: "乃東生", reading: "なつかれくさしょうず", sekkiIdx: 23 },
  { name: "麋角解", reading: "おおしかのつのおつる", sekkiIdx: 23 },
  { name: "雪下出麦", reading: "ゆきわたりてむぎのびる", sekkiIdx: 23 },
] as const;

export function getKoIndex(d: Date): number {
  const sekkiIdx = getSekkiIndex(d);
  const start = sekkiStartDate(d.getFullYear(), sekkiIdx);

  if (start > d) {
    const prevStart = sekkiStartDate(d.getFullYear() - 1, sekkiIdx);
    const daysSince = Math.floor((d.getTime() - prevStart.getTime()) / 86400000);
    const koOffset = Math.min(2, Math.floor(daysSince / 5));
    return sekkiIdx * 3 + koOffset;
  }

  const daysSince = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const koOffset = Math.min(2, Math.floor(daysSince / 5));
  return sekkiIdx * 3 + koOffset;
}

export function koStartDate(year: number, koIndex: number): Date {
  const sekkiIdx = Math.floor(koIndex / 3);
  const koOffset = koIndex % 3;
  const start = sekkiStartDate(year, sekkiIdx);
  return new Date(start.getTime() + koOffset * 5 * 86400000);
}
