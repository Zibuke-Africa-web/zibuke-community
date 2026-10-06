import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// A single atomic UPDATE prevents simultaneous login/post requests awarding twice.
// Days are South African calendar days (UTC+2, with no daylight saving).
export async function recordActivity(userId: string, now = new Date()) {
  const seconds = Math.floor(now.getTime() / 1000);
  const day = Math.floor((seconds + 7200) / 86400);
  await (await getDb()).run(sql`update users set
    points = points + case when last_active_at is not null and cast((last_active_at+7200)/86400 as integer)=${day - 1} then 10 else 0 end,
    current_streak = case when last_active_at is null or ${seconds}-last_active_at>172800 then 1
      when cast((last_active_at+7200)/86400 as integer)=${day - 1} then current_streak+1
      when cast((last_active_at+7200)/86400 as integer)<${day - 1} then 1 else current_streak end,
    last_active_at=${seconds}
    where id=${userId} and (last_active_at is null or last_active_at<${seconds})`);
}
