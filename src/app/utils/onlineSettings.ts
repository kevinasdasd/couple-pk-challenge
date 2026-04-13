export type OnlineRole = "male" | "female";

export interface OnlinePlayerSettings {
  role: OnlineRole;
  maleAvatarId: string;
  femaleAvatarId: string;
  nickname: string;
}

export const DEFAULT_ONLINE_PLAYER_SETTINGS: OnlinePlayerSettings = {
  role: "male",
  maleAvatarId: "avatar-1",
  femaleAvatarId: "avatar-2",
  nickname: "",
};

const ONLINE_PLAYER_SETTINGS_STORAGE_KEY = "onlinePlayerSettings";

function trimNickname(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 20) : "";
}

function normalizeRole(value: string | null | undefined): OnlineRole {
  return value === "female" ? "female" : "male";
}

function normalizeAvatarId(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getStoredOnlinePlayerSettings(): OnlinePlayerSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_ONLINE_PLAYER_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(ONLINE_PLAYER_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ONLINE_PLAYER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OnlinePlayerSettings>;

    return {
      role: normalizeRole(parsed.role),
      maleAvatarId: normalizeAvatarId(parsed.maleAvatarId ?? parsed.avatarId, DEFAULT_ONLINE_PLAYER_SETTINGS.maleAvatarId),
      femaleAvatarId: normalizeAvatarId(parsed.femaleAvatarId, DEFAULT_ONLINE_PLAYER_SETTINGS.femaleAvatarId),
      nickname: trimNickname(parsed.nickname),
    };
  } catch {
    return { ...DEFAULT_ONLINE_PLAYER_SETTINGS };
  }
}

export function saveStoredOnlinePlayerSettings(settings: Partial<OnlinePlayerSettings>) {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_ONLINE_PLAYER_SETTINGS,
      ...settings,
      role: normalizeRole(settings.role),
      maleAvatarId: normalizeAvatarId(settings.maleAvatarId, DEFAULT_ONLINE_PLAYER_SETTINGS.maleAvatarId),
      femaleAvatarId: normalizeAvatarId(settings.femaleAvatarId, DEFAULT_ONLINE_PLAYER_SETTINGS.femaleAvatarId),
      nickname: trimNickname(settings.nickname),
    };
  }

  const current = getStoredOnlinePlayerSettings();
  const nextSettings: OnlinePlayerSettings = {
    role: normalizeRole(settings.role ?? current.role),
    maleAvatarId: normalizeAvatarId(settings.maleAvatarId ?? current.maleAvatarId, DEFAULT_ONLINE_PLAYER_SETTINGS.maleAvatarId),
    femaleAvatarId: normalizeAvatarId(
      settings.femaleAvatarId ?? current.femaleAvatarId,
      DEFAULT_ONLINE_PLAYER_SETTINGS.femaleAvatarId
    ),
    nickname: trimNickname(settings.nickname ?? current.nickname),
  };

  window.localStorage.setItem(ONLINE_PLAYER_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
}
