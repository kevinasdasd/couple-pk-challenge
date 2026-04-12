import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Mars, Music4, Sparkles, UserRound, Users, Venus, Volume2 } from "lucide-react";
import { Header } from "../components/Header";
import { useBgm } from "../components/BgmProvider";
import { playUiSound } from "../utils/soundEffects";
import { DEFAULT_PLAYER_NAMES, getStoredPlayerNames, setStoredPlayerName, type PlayerId } from "../utils/playerSettings";
import {
  DEFAULT_ONLINE_PLAYER_SETTINGS,
  getStoredOnlinePlayerSettings,
  saveStoredOnlinePlayerSettings,
  type OnlinePlayerSettings,
  type OnlineRole,
} from "../utils/onlineSettings";

const SETTINGS_COLORS = {
  yellow: "#FFEA6F",
  pink: "#FFC9EF",
  blue: "#ABD7FA",
  paleYellow: "#FFFDF0",
  palePink: "#FFF9FD",
  paleBlue: "#F6FBFE",
  ink: "#1F2430",
  subInk: "#667085",
} as const;

const AVATAR_OPTIONS = [
  { id: "avatar-1", emoji: "🦁", solid: "#FFEA6F", soft: "#FFF7C9" },
  { id: "avatar-2", emoji: "🐼", solid: "#FFC9EF", soft: "#FFE6F7" },
  { id: "avatar-3", emoji: "🐸", solid: "#ABD7FA", soft: "#E4F3FF" },
  { id: "avatar-4", emoji: "🐻", solid: "#FFEA6F", soft: "#FFF4BA" },
  { id: "avatar-5", emoji: "🐯", solid: "#FFC9EF", soft: "#FFE8F8" },
  { id: "avatar-6", emoji: "🐰", solid: "#ABD7FA", soft: "#EAF5FF" },
  { id: "avatar-7", emoji: "🦊", solid: "#FFEA6F", soft: "#FFF7CD" },
  { id: "avatar-8", emoji: "🐨", solid: "#FFC9EF", soft: "#FFE4F6" },
  { id: "avatar-9", emoji: "🐶", solid: "#ABD7FA", soft: "#E8F4FD" },
] as const;

const THEME_BY_PLAYER: Record<PlayerId, { card: string; border: string; input: string; accent: string; chip: string }> = {
  Kevin: {
    card: SETTINGS_COLORS.paleBlue,
    border: "#D3E7F7",
    input: "#EAF5FF",
    accent: "#5B88AB",
    chip: SETTINGS_COLORS.blue,
  },
  Demi: {
    card: SETTINGS_COLORS.palePink,
    border: "#F3D3E8",
    input: "#FFF1FA",
    accent: "#BE7BA7",
    chip: SETTINGS_COLORS.pink,
  },
};

function SectionTitle({
  icon,
  title,
  subtitle,
  tint,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tint: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
        style={{ backgroundColor: tint, borderColor: "rgba(255,255,255,0.85)", color: SETTINGS_COLORS.ink }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold" style={{ color: SETTINGS_COLORS.ink }}>
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px]" style={{ color: SETTINGS_COLORS.subInk }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function MajorSectionTitle({ title }: { title: string }) {
  return (
    <div className="px-1">
      <h2 className="text-[1.15rem] font-black tracking-[0.01em]" style={{ color: SETTINGS_COLORS.ink }}>
        {title}
      </h2>
    </div>
  );
}

function AudioSliderRow({
  icon,
  label,
  value,
  color,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ color }}>{icon}</div>
          <span className="text-base font-bold" style={{ color: SETTINGS_COLORS.ink }}>
            {label}
          </span>
        </div>
        <span className="text-[1.05rem] font-black" style={{ color }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="app-settings-slider"
        style={
          {
            ["--slider-thumb" as string]: color,
            ["--slider-shadow" as string]: `${color}44`,
            ["--slider-track" as string]: `linear-gradient(90deg, ${color} 0%, ${color} ${value}%, #E5E7EB ${value}%, #E5E7EB 100%)`,
          } as CSSProperties
        }
      />
    </div>
  );
}

export default function History() {
  const [maleName, setMaleName] = useState(DEFAULT_PLAYER_NAMES.Kevin);
  const [femaleName, setFemaleName] = useState(DEFAULT_PLAYER_NAMES.Demi);
  const [onlineSettings, setOnlineSettings] = useState<OnlinePlayerSettings>(DEFAULT_ONLINE_PLAYER_SETTINGS);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const { enabled, masterVolume, bgmVolume, effectsVolume, setMasterVolume, setBgmVolume, setEffectsVolume } =
    useBgm();

  useEffect(() => {
    const storedNames = getStoredPlayerNames();
    setMaleName(storedNames.Kevin);
    setFemaleName(storedNames.Demi);
    setOnlineSettings(getStoredOnlinePlayerSettings());
  }, []);

  const myPlayerId: PlayerId = onlineSettings.role === "male" ? "Kevin" : "Demi";
  const opponentPlayerId: PlayerId = myPlayerId === "Kevin" ? "Demi" : "Kevin";
  const myTheme = THEME_BY_PLAYER[myPlayerId];
  const opponentTheme = THEME_BY_PLAYER[opponentPlayerId];

  const selectedAvatar = useMemo(
    () => AVATAR_OPTIONS.find((avatar) => avatar.id === onlineSettings.avatarId) ?? AVATAR_OPTIONS[0],
    [onlineSettings.avatarId]
  );

  const myNickname = myPlayerId === "Kevin" ? maleName : femaleName;
  const opponentNickname = opponentPlayerId === "Kevin" ? maleName : femaleName;

  const commitPlayerName = (player: PlayerId, value: string) => {
    const fallback = DEFAULT_PLAYER_NAMES[player];
    const nextName = value.trim().slice(0, 20) || fallback;
    setStoredPlayerName(player, nextName);

    if (player === "Kevin") {
      setMaleName(nextName);
      return;
    }
    setFemaleName(nextName);
  };

  const updateOnlineSettings = (patch: Partial<OnlinePlayerSettings>) => {
    setOnlineSettings((current) => saveStoredOnlinePlayerSettings({ ...current, ...patch }));
  };

  const selectRole = (role: OnlineRole) => {
    playUiSound("confirm", enabled);
    updateOnlineSettings({ role });
  };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="游戏设置" showBack />

      <div className="app-page-content">
        <div className="app-page-center app-page-content--fit app-page-stack app-page-stack--tight">
          <MajorSectionTitle title="资料设置" />

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[1.55rem] border p-3.5"
            style={{ backgroundColor: myTheme.card, borderColor: myTheme.border }}
          >
            <SectionTitle
              icon={<UserRound className="h-5 w-5" />}
              title="我的资料"
              subtitle="联机与个人标签都会使用这里的信息"
              tint="#FFFFFF"
            />

            <div className="flex flex-col items-center">
              <button
                onClick={() => {
                  playUiSound("confirm", enabled);
                  setShowAvatarPicker((current) => !current);
                }}
                className="relative flex h-24 w-24 items-center justify-center rounded-full border transition-transform active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${selectedAvatar.soft} 0%, ${selectedAvatar.solid} 100%)`,
                  borderColor: selectedAvatar.solid,
                }}
              >
                <span className="text-[2.35rem]">{selectedAvatar.emoji}</span>
                <div className="absolute -bottom-1.5 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5D6673]">
                  我的头像
                </div>
              </button>

              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                <button
                  onClick={() => selectRole("male")}
                  className="flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: onlineSettings.role === "male" ? SETTINGS_COLORS.blue : "#FFFFFF",
                    borderColor: onlineSettings.role === "male" ? "#93C4EC" : "#E7EAF0",
                    color: SETTINGS_COLORS.ink,
                  }}
                >
                  <Mars className="h-4.5 w-4.5" />
                  男生
                </button>
                <button
                  onClick={() => selectRole("female")}
                  className="flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: onlineSettings.role === "female" ? SETTINGS_COLORS.pink : "#FFFFFF",
                    borderColor: onlineSettings.role === "female" ? "#F2B8DF" : "#E7EAF0",
                    color: SETTINGS_COLORS.ink,
                  }}
                >
                  <Venus className="h-4.5 w-4.5" />
                  女生
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showAvatarPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="w-full overflow-hidden"
                  >
                    <div className="mt-3 rounded-2xl border bg-white/75 p-3" style={{ borderColor: myTheme.border }}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: SETTINGS_COLORS.ink }}>
                          选择我的头像
                        </p>
                        <ChevronDown className="h-4 w-4" style={{ color: SETTINGS_COLORS.subInk }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {AVATAR_OPTIONS.map((avatar) => {
                          const isActive = avatar.id === onlineSettings.avatarId;
                          return (
                            <button
                              key={avatar.id}
                              onClick={() => {
                                playUiSound("confirm", enabled);
                                updateOnlineSettings({ avatarId: avatar.id });
                                setShowAvatarPicker(false);
                              }}
                              className="flex aspect-square items-center justify-center rounded-xl border transition-transform active:scale-95"
                              style={{
                                background: `linear-gradient(135deg, ${avatar.soft} 0%, ${avatar.solid} 100%)`,
                                borderColor: isActive ? SETTINGS_COLORS.ink : avatar.solid,
                              }}
                            >
                              <span className="text-[1.55rem]">{avatar.emoji}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <label className="mt-3 w-full rounded-2xl border bg-white/88 p-3" style={{ borderColor: myTheme.border }}>
                <span className="mb-1 block text-[11px] font-medium" style={{ color: myTheme.accent }}>
                  我的昵称
                </span>
                <input
                  type="text"
                  value={myNickname}
                  maxLength={20}
                  placeholder={DEFAULT_PLAYER_NAMES[myPlayerId]}
                  onChange={(event) => {
                    if (myPlayerId === "Kevin") {
                      setMaleName(event.target.value);
                    } else {
                      setFemaleName(event.target.value);
                    }
                  }}
                  onBlur={() => commitPlayerName(myPlayerId, myNickname)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitPlayerName(myPlayerId, myNickname);
                    }
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm font-medium outline-none"
                  style={{ backgroundColor: myTheme.input, color: SETTINGS_COLORS.ink }}
                />
              </label>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[1.55rem] border p-3.5"
            style={{ backgroundColor: opponentTheme.card, borderColor: opponentTheme.border }}
          >
            <SectionTitle
              icon={<Users className="h-5 w-5" />}
              title="线下双人"
              subtitle="仅一台手机双人游玩时使用"
              tint="#FFFFFF"
            />

            <label className="block rounded-2xl border bg-white/88 p-3" style={{ borderColor: opponentTheme.border }}>
              <span className="mb-1 block text-[11px] font-medium" style={{ color: opponentTheme.accent }}>
                对手昵称
              </span>
              <input
                type="text"
                value={opponentNickname}
                maxLength={20}
                placeholder={DEFAULT_PLAYER_NAMES[opponentPlayerId]}
                onChange={(event) => {
                  if (opponentPlayerId === "Kevin") {
                    setMaleName(event.target.value);
                  } else {
                    setFemaleName(event.target.value);
                  }
                }}
                onBlur={() => commitPlayerName(opponentPlayerId, opponentNickname)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitPlayerName(opponentPlayerId, opponentNickname);
                  }
                }}
                className="w-full rounded-xl px-3 py-2 text-sm font-medium outline-none"
                style={{ backgroundColor: opponentTheme.input, color: SETTINGS_COLORS.ink }}
              />
            </label>
          </motion.section>

          <MajorSectionTitle title="音效设置" />

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-[1.55rem] border bg-white p-4"
            style={{ borderColor: "#E5ECF4" }}
          >
            <div className="space-y-5">
              <AudioSliderRow
                icon={<Volume2 className="h-5.5 w-5.5" />}
                label="总音量"
                value={masterVolume}
                color={SETTINGS_COLORS.yellow}
                onChange={setMasterVolume}
              />
              <AudioSliderRow
                icon={<Music4 className="h-5.5 w-5.5" />}
                label="背景音乐"
                value={bgmVolume}
                color={SETTINGS_COLORS.blue}
                onChange={setBgmVolume}
              />
              <AudioSliderRow
                icon={<Sparkles className="h-5.5 w-5.5" />}
                label="动效音效"
                value={effectsVolume}
                color={SETTINGS_COLORS.pink}
                onChange={setEffectsVolume}
              />
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
