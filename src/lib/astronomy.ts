import { AstroTime, GeoVector, Body, Ecliptic, SearchSunLongitude, SearchMoonPhase, MoonPhase } from "astronomy-engine";

/**
 * 指定日時の太陽黄経 (0-360°) を計算する
 */
export function getSolarEclipticLongitude(date: Date): number {
  const t = new AstroTime(date);
  const v = GeoVector(Body.Sun, t, true);
  const ecl = Ecliptic(v);
  return ((ecl.elon % 360) + 360) % 360;
}

/**
 * 黄経から24節気インデックスを判定する
 * 春分=0° → idx 5, 15°刻みで +1
 */
export function getSekkiFromLongitude(lambda: number): { index: number } {
  const normalized = ((lambda % 360) + 360) % 360;
  const segment = Math.floor(normalized / 15);
  const index = (segment + 5) % 24;
  return { index };
}

/**
 * 節気インデックス → 太陽黄経の開始角度
 * 小寒(idx=0)=285°, 春分(idx=5)=0°, 冬至(idx=23)=270°
 */
export function sekkiIndexToLongitude(sekkiIndex: number): number {
  return (((sekkiIndex - 5) * 15) % 360 + 360) % 360;
}

/**
 * 指定年・節気の正確な開始日時を SearchSunLongitude で求める
 */
export function searchSekkiStartDate(year: number, sekkiIndex: number): Date {
  const targetLon = sekkiIndexToLongitude(sekkiIndex);
  const approxMonth = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];
  const searchStart = new Date(year, approxMonth[sekkiIndex], 1);
  const startTime = new AstroTime(new Date(searchStart.getTime() - 20 * 86400000));
  const result = SearchSunLongitude(targetLon, startTime, 60);
  return result!.date;
}

// ========== 月相ピーク探索 ==========

export type LunarPeakKind = "full" | "new";

export interface LunarPeak {
  kind: LunarPeakKind;
  peakTime: Date;
  elongation: number;
}

function collectMoonPhases(
  targetLon: number,
  startDate: Date,
  limitDays: number
): LunarPeak[] {
  const kind: LunarPeakKind = targetLon === 180 ? "full" : "new";
  const peaks: LunarPeak[] = [];
  let cursor = new AstroTime(startDate);
  const endMs = startDate.getTime() + limitDays * 86400000;

  while (cursor.date.getTime() < endMs) {
    const result = SearchMoonPhase(targetLon, cursor, limitDays);
    if (!result || result.date.getTime() >= endMs) break;

    peaks.push({
      kind,
      peakTime: result.date,
      elongation: MoonPhase(result),
    });

    cursor = new AstroTime(new Date(result.date.getTime() + 86400000));
  }

  return peaks;
}

export function findLunarPeaksBothSides(
  centerDate: Date,
  rangeDays: number
): {
  fullMoonBefore: LunarPeak | null;
  fullMoonAfter: LunarPeak | null;
  newMoonBefore: LunarPeak | null;
  newMoonAfter: LunarPeak | null;
} {
  const rangeStart = new Date(centerDate.getTime() - rangeDays * 86400000);
  const totalDays = rangeDays * 2;
  const allFullPeaks = collectMoonPhases(180, rangeStart, totalDays);
  const allNewPeaks = collectMoonPhases(0, rangeStart, totalDays);

  const nowMs = centerDate.getTime();

  const findClosestBefore = (peaks: LunarPeak[]): LunarPeak | null => {
    const before = peaks.filter(p => p.peakTime.getTime() < nowMs);
    return before.length === 0 ? null : before[before.length - 1];
  };

  const findClosestAfter = (peaks: LunarPeak[]): LunarPeak | null => {
    const after = peaks.filter(p => p.peakTime.getTime() >= nowMs);
    return after.length === 0 ? null : after[0];
  };

  return {
    fullMoonBefore: findClosestBefore(allFullPeaks),
    fullMoonAfter: findClosestAfter(allFullPeaks),
    newMoonBefore: findClosestBefore(allNewPeaks),
    newMoonAfter: findClosestAfter(allNewPeaks),
  };
}
