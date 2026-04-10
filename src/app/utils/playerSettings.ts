export type PlayerId = "Kevin" | "Demi";

export const DEFAULT_PLAYER_NAMES: Record<PlayerId, string> = {
  Kevin: "Kevin",
  Demi: "Demi",
};

const PLAYER_NAME_STORAGE_KEYS: Record<PlayerId, string> = {
  Kevin: "malePlayerName",
  Demi: "femalePlayerName",
};

function trimPlayerName(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 20) : "";
}

export function getStoredPlayerNames(): Record<PlayerId, string> {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PLAYER_NAMES };
  }

  return {
    Kevin: trimPlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEYS.Kevin)) || DEFAULT_PLAYER_NAMES.Kevin,
    Demi: trimPlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEYS.Demi)) || DEFAULT_PLAYER_NAMES.Demi,
  };
}

export function setStoredPlayerName(player: PlayerId, value: string) {
  if (typeof window === "undefined") return;

  const trimmed = trimPlayerName(value);
  if (!trimmed || trimmed === DEFAULT_PLAYER_NAMES[player]) {
    window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEYS[player]);
    return;
  }

  window.localStorage.setItem(PLAYER_NAME_STORAGE_KEYS[player], trimmed);
}

export function getPlayerInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}
