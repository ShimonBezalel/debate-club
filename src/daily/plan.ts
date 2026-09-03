import type { Conjecture } from "../types/core.js";

const UTC_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_EPOCH_MS = Date.UTC(2026, 8, 4);

export type DailyAgentName = "steelman-v1" | "cross-examiner-v1";

export interface DailyMatchPlan {
  date: string;
  dayIndex: number;
  season: number;
  topicIndex: number;
  matchId: string;
  conjecture: Conjecture;
  proAgent: DailyAgentName;
  conAgent: DailyAgentName;
}

function utcDateMilliseconds(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Daily date '${value}' must use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const milliseconds = Date.UTC(year, month - 1, day);
  const parsed = new Date(milliseconds);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`Daily date '${value}' is not a calendar date.`);
  }
  return milliseconds;
}

export function dailyMatchId(date: string, season: number, conjectureId: string): string {
  if (!Number.isInteger(season) || season < 1) {
    throw new Error(`Daily season must be a positive integer, received '${season}'.`);
  }
  if (!/^[a-z0-9_]+$/.test(conjectureId)) {
    throw new Error(`Conjecture id '${conjectureId}' cannot be used in a daily match id.`);
  }
  return `daily-${date}-s${String(season).padStart(2, "0")}-${conjectureId}`;
}

export function planDailyMatch(date: string, catalog: Conjecture[]): DailyMatchPlan {
  if (catalog.length === 0) {
    throw new Error("Cannot plan a daily match from an empty catalog.");
  }
  const dateMs = utcDateMilliseconds(date);
  const dayIndex = (dateMs - DAILY_EPOCH_MS) / UTC_DAY_MS;
  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    throw new Error(`Daily date '${date}' precedes the 2026-09-04 epoch.`);
  }
  const topicIndex = dayIndex % catalog.length;
  const season = Math.floor(dayIndex / catalog.length) + 1;
  const conjecture = catalog[topicIndex];
  if (!conjecture) {
    throw new Error(`No evergreen topic exists at index ${topicIndex}.`);
  }
  const steelmanIsPro = dayIndex % 2 === 0;
  return {
    date,
    dayIndex,
    season,
    topicIndex,
    matchId: dailyMatchId(date, season, conjecture.id),
    conjecture,
    proAgent: steelmanIsPro ? "steelman-v1" : "cross-examiner-v1",
    conAgent: steelmanIsPro ? "cross-examiner-v1" : "steelman-v1"
  };
}
