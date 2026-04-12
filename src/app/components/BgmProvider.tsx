import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAudioVolume } from "../utils/soundEffects";
import { getStoredAudioSettings, saveStoredAudioSettings } from "../utils/audioSettings";

interface BgmContextValue {
  enabled: boolean;
  available: boolean;
  track: string;
  masterVolume: number;
  bgmVolume: number;
  effectsVolume: number;
  toggle: () => void;
  setTrack: (track: string) => void;
  setMasterVolume: (value: number) => void;
  setBgmVolume: (value: number) => void;
  setEffectsVolume: (value: number) => void;
  pauseForEffect: () => void;
  resumeAfterEffect: () => void;
}

const DEFAULT_BGM_SOURCE = "/sounds/mainbgm.mp3";

const BgmContext = createContext<BgmContextValue | null>(null);

export function BgmProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [track, setTrack] = useState(DEFAULT_BGM_SOURCE);
  const [suspendCount, setSuspendCount] = useState(0);
  const [audioSettings, setAudioSettings] = useState(() => getStoredAudioSettings());

  const attemptPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !available || suspendCount > 0) return;
    audio.volume = getAudioVolume(track, "bgm", 1, audioSettings);
    void audio.play().catch(() => {
      // Mobile browsers may still block playback until a gesture.
    });
  }, [audioSettings, available, enabled, suspendCount, track]);

  useEffect(() => {
    const markInteracted = () => {
      setHasInteracted(true);
      attemptPlayback();
    };

    window.addEventListener("pointerdown", markInteracted, { passive: true });
    window.addEventListener("keydown", markInteracted);

    return () => {
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, [attemptPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = getAudioVolume(track, "bgm", 1, audioSettings);
    if (audio.src !== new URL(track, window.location.origin).href) {
      audio.src = track;
      audio.load();
    }

    if (!enabled || suspendCount > 0) {
      audio.pause();
      return;
    }

    if (!available) {
      return;
    }

    attemptPlayback();
  }, [attemptPlayback, enabled, hasInteracted, available, track, suspendCount, audioSettings]);

  const toggle = () => {
    setHasInteracted(true);
    const audio = audioRef.current;
    if (enabled && audio && audio.paused && available && suspendCount === 0) {
      attemptPlayback();
      return;
    }
    setEnabled((current) => !current);
  };

  const handleSetTrack = useCallback((nextTrack: string) => {
    setTrack(nextTrack || DEFAULT_BGM_SOURCE);
  }, []);

  const handleSetMasterVolume = useCallback((value: number) => {
    setAudioSettings(saveStoredAudioSettings({ masterVolume: value }));
  }, []);

  const handleSetBgmVolume = useCallback((value: number) => {
    setAudioSettings(saveStoredAudioSettings({ bgmVolume: value }));
  }, []);

  const handleSetEffectsVolume = useCallback((value: number) => {
    setAudioSettings(saveStoredAudioSettings({ effectsVolume: value }));
  }, []);

  const pauseForEffect = useCallback(() => {
    setSuspendCount((current) => current + 1);
  }, []);

  const resumeAfterEffect = useCallback(() => {
    setSuspendCount((current) => Math.max(0, current - 1));
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      available,
      track,
      masterVolume: audioSettings.masterVolume,
      bgmVolume: audioSettings.bgmVolume,
      effectsVolume: audioSettings.effectsVolume,
      toggle,
      setTrack: handleSetTrack,
      setMasterVolume: handleSetMasterVolume,
      setBgmVolume: handleSetBgmVolume,
      setEffectsVolume: handleSetEffectsVolume,
      pauseForEffect,
      resumeAfterEffect,
    }),
    [
      enabled,
      available,
      track,
      audioSettings.masterVolume,
      audioSettings.bgmVolume,
      audioSettings.effectsVolume,
      handleSetTrack,
      handleSetMasterVolume,
      handleSetBgmVolume,
      handleSetEffectsVolume,
      pauseForEffect,
      resumeAfterEffect,
    ]
  );

  return (
    <BgmContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={track}
        preload="auto"
        autoPlay
        playsInline
        onCanPlay={() => setAvailable(true)}
        onError={() => setAvailable(false)}
      />
    </BgmContext.Provider>
  );
}

export function useBgm() {
  const context = useContext(BgmContext);
  if (!context) {
    throw new Error("useBgm must be used within BgmProvider");
  }
  return context;
}

export { DEFAULT_BGM_SOURCE };
