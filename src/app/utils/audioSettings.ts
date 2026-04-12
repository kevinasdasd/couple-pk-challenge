export interface AudioSettings {
  masterVolume: number;
  bgmVolume: number;
  effectsVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 80,
  bgmVolume: 60,
  effectsVolume: 70,
};

const AUDIO_SETTINGS_STORAGE_KEY = "audioSettings";

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeAudioSettings(settings?: Partial<AudioSettings>): AudioSettings {
  return {
    masterVolume: clampVolume(settings?.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    bgmVolume: clampVolume(settings?.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume),
    effectsVolume: clampVolume(settings?.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume),
  };
}

export function getStoredAudioSettings(): AudioSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    return normalizeAudioSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveStoredAudioSettings(settings: Partial<AudioSettings>) {
  if (typeof window === "undefined") {
    return normalizeAudioSettings(settings);
  }

  const nextSettings = normalizeAudioSettings({
    ...getStoredAudioSettings(),
    ...settings,
  });
  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
}
