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
import { AVATAR_OPTIONS } from "../utils/avatarOptions";

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
  tint,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  tint: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
          style={{ backgroundColor: tint, borderColor: "rgba(255,255,255,0.9)", color: SETTINGS_COLORS.ink }}
        >
          {icon}
        </div>
        <h3 className="text-[1.08rem] font-black tracking-[0.01em]" style={{ color: SETTINGS_COLORS.ink }}>
          {title}
        </h3>
      </div>
      {trailing}
    </div>
  );
}

function MajorSectionTitle({ title }: { title: string }) {
  return (
    <div className="px-0.5">
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
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);
  const [showMyAvatarPicker, setShowMyAvatarPicker] = useState(false);
  const [showTaAvatarPicker, setShowTaAvatarPicker] = useState(false);
  const { enabled, masterVolume, bgmVolume, effectsVolume, setMasterVolume, setBgmVolume, setEffectsVolume } =
    useBgm();

  useEffect(() => {
    const storedNames = getStoredPlayerNames();
    setMaleName(storedNames.Kevin);
    setFemaleName(storedNames.Demi);
    setOnlineSettings(getStoredOnlinePlayerSettings());
    setHasHydratedSettings(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedSettings) {
      return;
    }

    setStoredPlayerName("Kevin", maleName);
  }, [hasHydratedSettings, maleName]);

  useEffect(() => {
    if (!hasHydratedSettings) {
      return;
    }

    setStoredPlayerName("Demi", femaleName);
  }, [hasHydratedSettings, femaleName]);

  const myPlayerId: PlayerId = onlineSettings.role === "male" ? "Kevin" : "Demi";
  const opponentPlayerId: PlayerId = myPlayerId === "Kevin" ? "Demi" : "Kevin";
  const myTheme = THEME_BY_PLAYER[myPlayerId];
  const opponentTheme = THEME_BY_PLAYER[opponentPlayerId];
  const myAvatarId = myPlayerId === "Kevin" ? onlineSettings.maleAvatarId : onlineSettings.femaleAvatarId;
  const taAvatarId = opponentPlayerId === "Kevin" ? onlineSettings.maleAvatarId : onlineSettings.femaleAvatarId;
  const myRoleLabel = myPlayerId === "Kevin" ? "男生" : "女生";
  const opponentRoleLabel = opponentPlayerId === "Kevin" ? "男生" : "女生";

  const myAvatar = useMemo(
    () => AVATAR_OPTIONS.find((avatar) => avatar.id === myAvatarId) ?? AVATAR_OPTIONS[0],
    [myAvatarId]
  );

  const taAvatar = useMemo(
    () => AVATAR_OPTIONS.find((avatar) => avatar.id === taAvatarId) ?? AVATAR_OPTIONS[1],
    [taAvatarId]
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
    setShowMyAvatarPicker(false);
    setShowTaAvatarPicker(false);
    updateOnlineSettings({ role });
  };

  const selectAvatarForPlayer = (player: PlayerId, avatarId: string, closePicker: () => void) => {
    playUiSound("confirm", enabled);
    updateOnlineSettings(player === "Kevin" ? { maleAvatarId: avatarId } : { femaleAvatarId: avatarId });
    closePicker();
  };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="游戏设置" showBack />

      <div className="app-page-content">
        <div className="app-page-center app-page-content--fit app-page-stack" style={{ gap: "0.7rem" }}>
          <section className="space-y-2.5">
            <MajorSectionTitle title="资料设置" />

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.5rem] border px-4 py-3.5"
              style={{ backgroundColor: myTheme.card, borderColor: myTheme.border }}
            >
              <SectionTitle
                icon={<UserRound className="h-5 w-5" />}
                title="我的资料"
                tint="#FFFFFF"
                trailing={
                  <div
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: myTheme.input,
                      borderColor: myTheme.border,
                      color: myTheme.accent,
                    }}
                  >
                    {myRoleLabel}
                  </div>
                }
              />

              <div className="space-y-3">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      playUiSound("confirm", enabled);
                      setShowTaAvatarPicker(false);
                      setShowMyAvatarPicker((current) => !current);
                    }}
                    className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full border transition-transform active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${myAvatar.soft} 0%, ${myAvatar.solid} 100%)`,
                      borderColor: myAvatar.solid,
                    }}
                  >
                    <span className="text-[2rem]">{myAvatar.emoji}</span>
                  </button>
                  <span className="mt-1 text-[11px] font-semibold" style={{ color: myTheme.accent }}>
                    点击更换我的头像
                  </span>
                </div>

                <div className="grid w-full grid-cols-2 gap-2">
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
                  {showMyAvatarPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -8 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border bg-white/78 p-3" style={{ borderColor: myTheme.border }}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold" style={{ color: SETTINGS_COLORS.ink }}>
                            选择我的头像
                          </p>
                          <ChevronDown className="h-4 w-4" style={{ color: SETTINGS_COLORS.subInk }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {AVATAR_OPTIONS.map((avatar) => {
                            const isActive = avatar.id === myAvatarId;
                            return (
                              <button
                                key={avatar.id}
                                onClick={() => selectAvatarForPlayer(myPlayerId, avatar.id, () => setShowMyAvatarPicker(false))}
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

                <label className="block w-full rounded-2xl border bg-white/88 p-2.5" style={{ borderColor: myTheme.border }}>
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
              className="rounded-[1.5rem] border px-4 py-3.5"
              style={{ backgroundColor: opponentTheme.card, borderColor: opponentTheme.border }}
            >
              <SectionTitle
                icon={<Users className="h-5 w-5" />}
                title="TA"
                tint="#FFFFFF"
                trailing={
                  <div
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: opponentTheme.input,
                      borderColor: opponentTheme.border,
                      color: opponentTheme.accent,
                    }}
                  >
                    {opponentRoleLabel}
                  </div>
                }
              />

              <div className="space-y-3">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      playUiSound("confirm", enabled);
                      setShowMyAvatarPicker(false);
                      setShowTaAvatarPicker((current) => !current);
                    }}
                    className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full border transition-transform active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${taAvatar.soft} 0%, ${taAvatar.solid} 100%)`,
                      borderColor: taAvatar.solid,
                    }}
                  >
                    <span className="text-[2rem]">{taAvatar.emoji}</span>
                  </button>
                  <span className="mt-1 text-[11px] font-semibold" style={{ color: opponentTheme.accent }}>
                    点击更换TA的头像
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {showTaAvatarPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -8 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border bg-white/78 p-3" style={{ borderColor: opponentTheme.border }}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold" style={{ color: SETTINGS_COLORS.ink }}>
                            选择TA的头像
                          </p>
                          <ChevronDown className="h-4 w-4" style={{ color: SETTINGS_COLORS.subInk }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {AVATAR_OPTIONS.map((avatar) => {
                            const isActive = avatar.id === taAvatarId;
                            return (
                              <button
                                key={avatar.id}
                                onClick={() =>
                                  selectAvatarForPlayer(opponentPlayerId, avatar.id, () => setShowTaAvatarPicker(false))
                                }
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

                <label className="block w-full rounded-2xl border bg-white/88 p-2.5" style={{ borderColor: opponentTheme.border }}>
                  <span className="mb-1 block text-[11px] font-medium" style={{ color: opponentTheme.accent }}>
                    TA的昵称
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
              </div>
            </motion.section>
          </section>

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
