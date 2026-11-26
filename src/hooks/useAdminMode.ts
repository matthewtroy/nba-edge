import { useState } from "react";

export const ADMIN_STORAGE_KEY = "nba-edge-admin";

/**
 * `?admin=1` turns admin rows on for this device, `?admin=0` turns them off.
 * Presentation only: anyone can set the flag, and the data is public JSON either way.
 */
export function readAdminMode(search: string, storage: Storage): boolean {
  const flag = new URLSearchParams(search).get("admin");
  if (flag === "1") storage.setItem(ADMIN_STORAGE_KEY, "1");
  else if (flag === "0") storage.removeItem(ADMIN_STORAGE_KEY);
  return storage.getItem(ADMIN_STORAGE_KEY) === "1";
}

export function useAdminMode(): boolean {
  const [admin] = useState(() => {
    try {
      return readAdminMode(window.location.search, window.localStorage);
    } catch {
      return false;
    }
  });
  return admin;
}
