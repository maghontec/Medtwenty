// Date helpers. Editions run Monday to Sunday in UK time (Europe/London).

const UK = "Europe/London";

/** YYYY-MM-DD for a date as seen in the UK. */
export function ukDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The Monday (YYYY-MM-DD) of the UK week containing d. */
export function weekStart(d: Date = new Date()): string {
  const [y, m, day] = ukDate(d).split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dow = (utc.getUTCDay() + 6) % 7; // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

/** ISO-8601 week number and week-year for a YYYY-MM-DD date. */
export function isoWeek(ymd: string): { week: number; year: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return { week, year: date.getUTCFullYear() };
}

export function weekLabel(weekStartYmd: string): string {
  const { week, year } = isoWeek(weekStartYmd);
  return `Week ${week}, ${year}`;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function monthKey(d: Date = new Date()): string {
  return ukDate(d).slice(0, 7);
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function utilityDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(d)
    .replace(/,/g, "")
    .replace(/^(\w+)/, "$1,");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function weekdayName(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(ymd + "T12:00:00Z"),
  );
}
