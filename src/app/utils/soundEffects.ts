type Player = "Kevin" | "Demi";
type UiSoundKind = "confirm" | "back" | "navigate";
type AudioCategory = "bgm" | "ui" | "stone" | "skill" | "voice" | "impact" | "victory" | "system";

const UI_SOUND_POOL: Record<UiSoundKind, string[]> = {
  confirm: ["/sounds/wula1.mp3", "/sounds/wula2.mp3"],
  navigate: ["/sounds/wula1.mp3", "/sounds/wula2.mp3"],
  back: ["/sounds/ha1.mp3", "/sounds/ha2.mp3"],
};

const AUDIO_CATEGORY_LEVELS: Record<AudioCategory, number> = {
  bgm: 0.18,
  ui: 0.72,
  stone: 0.64,
  skill: 0.8,
  voice: 0.76,
  impact: 0.66,
  victory: 0.84,
  system: 0.7,
};

const AUDIO_SOURCE_OVERRIDES: Record<string, number> = {
  "/sounds/mainbgm.mp3": 0.16,
  "/sounds/minecraft.mp3": 0.17,
  "/sounds/victory.mp3": 0.82,
  "/sounds/villagerdead.mp3": 0.8,
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => {
      // Ignore resume failure until the next gesture.
    });
  }
  return audioContext;
}

function scheduleTone(
  ctx: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  options?: { gain?: number; type?: OscillatorType }
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = options?.type || "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(options?.gain ?? 0.06, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function scheduleSweep(
  ctx: AudioContext,
  start: number,
  fromFrequency: number,
  toFrequency: number,
  duration: number,
  options?: { gain?: number; type?: OscillatorType }
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = options?.type || "triangle";
  oscillator.frequency.setValueAtTime(fromFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(toFrequency, 1), start + duration);

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(options?.gain ?? 0.08, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function getAudioVolume(src: string, category: AudioCategory, multiplier = 1) {
  const baseVolume = AUDIO_SOURCE_OVERRIDES[src] ?? AUDIO_CATEGORY_LEVELS[category];
  return Math.max(0, Math.min(1, baseVolume * multiplier));
}

export function playAudioEffect(
  src: string,
  enabled: boolean,
  options?: number | { category?: AudioCategory; multiplier?: number }
) {
  if (!enabled || typeof window === "undefined") return;
  const audio = new Audio(src);
  const volume =
    typeof options === "number"
      ? options
      : getAudioVolume(src, options?.category ?? "voice", options?.multiplier ?? 1);
  audio.volume = volume;
  void audio.play().catch(() => {
    // Ignore playback rejection on restricted browsers.
  });
}

export function playUiSound(kind: UiSoundKind, enabled: boolean) {
  if (!enabled) return;
  const src = pickRandom(UI_SOUND_POOL[kind]);
  if (!src) return;
  playAudioEffect(src, enabled, { category: "ui" });
}

export function playStonePlaceSound(player: Player, enabled: boolean) {
  if (!enabled) return;
  const pool =
    player === "Kevin"
      ? ["/sounds/ha1.mp3", "/sounds/ha2.mp3"]
      : ["/sounds/wula1.mp3", "/sounds/wula2.mp3"];
  const src = pickRandom(pool);
  if (!src) return;
  playAudioEffect(src, enabled, { category: "stone" });
}

export function playFallbackSkillSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.001;
  scheduleTone(ctx, start, 520, 0.11, { gain: 0.05 });
  scheduleTone(ctx, start + 0.08, 700, 0.12, { gain: 0.045 });
  scheduleTone(ctx, start + 0.16, 920, 0.14, { gain: 0.04 });
}

export function startDiceRollingLoop(enabled: boolean, intervalMs = 180) {
  if (!enabled || typeof window === "undefined") return () => {};
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  const tick = () => {
    const start = ctx.currentTime + 0.001;
    scheduleTone(ctx, start, 560, 0.045, { gain: 0.07, type: "square" });
    scheduleTone(ctx, start + 0.03, 690, 0.04, { gain: 0.05, type: "triangle" });
  };

  tick();
  const timer = window.setInterval(tick, intervalMs);

  return () => {
    window.clearInterval(timer);
  };
}

export function playDiceRevealSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.001;
  scheduleTone(ctx, start, 520, 0.09, { gain: 0.085, type: "triangle" });
  scheduleTone(ctx, start + 0.08, 740, 0.1, { gain: 0.08, type: "triangle" });
  scheduleTone(ctx, start + 0.16, 980, 0.14, { gain: 0.075, type: "sine" });
}

export function playTieRoundSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.001;
  scheduleSweep(ctx, start, 620, 380, 0.18, { gain: 0.09, type: "sawtooth" });
  scheduleSweep(ctx, start + 0.16, 520, 300, 0.18, { gain: 0.08, type: "triangle" });
}

export function playInvalidActionSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.001;
  scheduleTone(ctx, start, 360, 0.08, { gain: 0.08, type: "square" });
  scheduleTone(ctx, start + 0.09, 280, 0.11, { gain: 0.07, type: "square" });
}

export function playCrocodileBiteImpactSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + 0.001;
  scheduleSweep(ctx, start, 180, 72, 0.22, { gain: 0.13, type: "sawtooth" });
  scheduleTone(ctx, start + 0.03, 120, 0.15, { gain: 0.08, type: "square" });
  scheduleTone(ctx, start + 0.09, 420, 0.08, { gain: 0.06, type: "triangle" });
}
