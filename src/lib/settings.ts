import "server-only";
import { all, run } from "./db";
import { DEFAULT_SETTINGS, type SettingKey } from "./settings-defaults";

export type Settings = typeof DEFAULT_SETTINGS;

export function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM site_settings");
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const def = DEFAULT_SETTINGS[key as SettingKey];
    if (typeof def === "boolean") out[key] = value === "true" || value === "1";
    else if (typeof def === "number") out[key] = Number(value);
    else out[key] = value ?? "";
  }
  return out as Settings;
}

export function setSetting(key: SettingKey, value: string | number | boolean) {
  run("INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, String(value));
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
