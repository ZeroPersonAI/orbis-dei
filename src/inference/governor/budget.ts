// Daily / monthly budget aggregation, sourced from `inference_calls`.
//
// We compare with `>=` on the date prefix of `created_at`. ISO timestamps sort
// lexicographically, so "created_at >= 'YYYY-MM-DD'" matches everything from
// today 00:00Z onwards, and "'YYYY-MM'" matches everything this month.

import type { DB } from "../../persistence/db.ts";

function todayKey(): string {
  // ISO8601 starts with YYYY-MM-DD; anything from 00:00Z on sorts >= this.
  return new Date().toISOString().slice(0, 10);
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function sumSince(db: DB, sincePrefix: string, instanceId: string | null): number {
  let row: { sum: number | null } | undefined;
  if (instanceId !== null) {
    row = db
      .prepare(
        `SELECT SUM(cost_usd) AS sum FROM inference_calls
         WHERE created_at >= ? AND instance_id = ?`,
      )
      .get(sincePrefix, instanceId) as { sum: number | null } | undefined;
  } else {
    row = db
      .prepare(`SELECT SUM(cost_usd) AS sum FROM inference_calls WHERE created_at >= ?`)
      .get(sincePrefix) as { sum: number | null } | undefined;
  }
  return row?.sum ?? 0;
}

export function todaySpentUsd(db: DB): number {
  return sumSince(db, todayKey(), null);
}

export function monthSpentUsd(db: DB): number {
  return sumSince(db, monthKey(), null);
}

export function todaySpentUsdForInstance(db: DB, instanceId: string): number {
  return sumSince(db, todayKey(), instanceId);
}
