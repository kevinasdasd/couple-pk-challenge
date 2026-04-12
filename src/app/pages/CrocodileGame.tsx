import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Copy,
  Gamepad2,
  Link2,
  LogIn,
  Plus,
  Smile,
  Users,
  Wifi,
} from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { DEFAULT_BGM_SOURCE, useBgm } from "../components/BgmProvider";
import { getStoredPlayerNames } from "../utils/playerSettings";
import { getStoredOnlinePlayerSettings } from "../utils/onlineSettings";
import {
  playAudioEffect,
  playCrocodileBiteImpactSound,
  playUiSound,
} from "../utils/soundEffects";

type GameMode = "offline" | "create" | "join" | null;

const PALETTE = {
  yellow: "#FFEA6F",
  paleYellow: "#FFFDF0",
  pink: "#FFC9EF",
  palePink: "#FFF9FD",
  green: "#C9F100",
  paleGreen: "#F9FEE5",
  blue: "#ABD7FA",
  paleBlue: "#F6FBFE",
  ink: "#1F2430",
  subInk: "#667085",
  line: "#E7E5DA",
} as const;

const STAKE_LABELS: Record<string, string> = {
  coffee: "买咖啡",
  massage: "做按摩",
  dinner: "请吃饭",
  emperor: "谁是大皇帝",
  order: "点外卖",
  receive: "收外卖",
};

const ONLINE_AVATAR_MAP: Record<string, string> = {
  "avatar-1": "🦁",
  "avatar-2": "🐼",
  "avatar-3": "🐸",
  "avatar-4": "🐻",
  "avatar-5": "🐯",
  "avatar-6": "🐰",
  "avatar-7": "🦊",
  "avatar-8": "🐨",
  "avatar-9": "🐶",
};

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CrocodileGame() {
  const [playerNames] = useState(() => getStoredPlayerNames());
  const [onlineProfile] = useState(() => getStoredOnlinePlayerSettings());
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [teeth, setTeeth] = useState<boolean[]>(Array(12).fill(false));
  const [dangerTooth, setDangerTooth] = useState<number>(-1);
  const [gameOver, setGameOver] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isBiting, setIsBiting] = useState(false);
  const [currentStake, setCurrentStake] = useState("请吃饭");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { setTrack, enabled: audioEnabled } = useBgm();

  const player1Name = playerNames.Demi;
  const player2Name = playerNames.Kevin;
  const onlineAvatar = ONLINE_AVATAR_MAP[onlineProfile.avatarId] ?? "🎮";
  const onlineNickname = onlineProfile.role === "female" ? playerNames.Demi : playerNames.Kevin;
  const onlineRoleLabel = onlineProfile.role === "female" ? "女生身份" : "男生身份";

  const pressedCount = useMemo(() => teeth.filter(Boolean).length, [teeth]);

  const getCurrentStake = () => {
    const selectedStakeIds = JSON.parse(localStorage.getItem("selectedStakes") || "[]");
    const customStakes = JSON.parse(localStorage.getItem("customStakes") || "[]");

    const presetStakes = selectedStakeIds
      .map((id: string) => STAKE_LABELS[id])
      .filter(Boolean);

    const allStakes = [...presetStakes, ...customStakes].filter(
      (stake: string) => typeof stake === "string" && stake.trim()
    );

    return allStakes[0] || "请吃饭";
  };

  useEffect(() => {
    setCurrentStake(getCurrentStake());
  }, []);

  useEffect(() => {
    setTrack("/sounds/minecraft.mp3");
    return () => {
      setTrack(DEFAULT_BGM_SOURCE);
    };
  }, [setTrack]);

  const startOfflineGame = () => {
    setGameMode("offline");
    setDangerTooth(Math.floor(Math.random() * 12));
    setTeeth(Array(12).fill(false));
    setCurrentPlayer(1);
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setGameStarted(true);
    setCurrentStake(getCurrentStake());
  };

  const resetGame = () => {
    setTeeth(Array(12).fill(false));
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setCurrentPlayer(1);
    setDangerTooth(Math.floor(Math.random() * 12));
    setCurrentStake(getCurrentStake());
  };

  const leaveModeSetup = () => {
    setGameMode(null);
    setRoomCode("");
    setJoinCode("");
    setCopied(false);
  };

  const createRoom = () => {
    playUiSound("confirm", audioEnabled);
    setGameMode("create");
    setGameStarted(false);
    setRoomCode(generateRoomCode());
    setCopied(false);
  };

  const joinRoom = () => {
    playUiSound("confirm", audioEnabled);
    setGameMode("join");
    setGameStarted(false);
    setJoinCode("");
    setCopied(false);
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      playUiSound("confirm", audioEnabled);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      playUiSound("back", audioEnabled);
    }
  };

  const pressTooth = (index: number) => {
    if (teeth[index] || gameOver) return;

    if (index === dangerTooth) {
      playAudioEffect("/sounds/villagerdead.mp3", audioEnabled, {
        category: "voice",
        multiplier: 1.02,
      });
    } else {
      const effectPool = ["/sounds/villager1.mp3", "/sounds/villager2.mp3", "/sounds/villager3.mp3"];
      playAudioEffect(effectPool[Math.floor(Math.random() * effectPool.length)], audioEnabled, {
        category: "voice",
      });
    }

    const newTeeth = [...teeth];
    newTeeth[index] = true;
    setTeeth(newTeeth);

    if (index === dangerTooth) {
      const selectedStake = getCurrentStake();
      setCurrentStake(selectedStake);
      setIsBiting(true);
      playCrocodileBiteImpactSound(audioEnabled);
      setTimeout(() => {
        setGameOver(true);

        const loserName = currentPlayer === 1 ? player1Name : player2Name;
        const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
        history.unshift({
          date: new Date().toISOString(),
          game: "鳄鱼拔牙",
          loser: loserName,
          stake: selectedStake,
        });
        localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));

        setTimeout(() => setShowResult(true), 1500);
      }, 1000);
    } else {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
    }
  };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="鳄鱼拔牙" showBack showHistory />

      {!gameStarted && (
        <div className="app-page-content">
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(171,215,250,0.34), rgba(255,234,111,0.14) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback
                    src="images/cocodi.png"
                    alt="鳄鱼拔牙"
                    className="h-20 w-20 rounded-3xl object-cover"
                  />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  选择游戏模式
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  先选玩法，再开始今天这局
                </p>
              </motion.div>

              {gameMode === null && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="space-y-3"
                >
                  {[
                    {
                      key: "offline",
                      title: "线下对战",
                      description: "和身边的人轮流按牙，马上开始。",
                      badge: <Users className="h-6 w-6" />,
                      side: "🎮",
                      tint: PALETTE.yellow,
                      card: PALETTE.paleYellow,
                      border: "#F3E7A5",
                      onClick: startOfflineGame,
                    },
                    {
                      key: "create",
                      title: "创建房间",
                      description: "生成房间号，准备邀请好友加入。",
                      badge: <Plus className="h-6 w-6" />,
                      side: "🏠",
                      tint: PALETTE.blue,
                      card: PALETTE.paleBlue,
                      border: "#D3E7F7",
                      onClick: createRoom,
                    },
                    {
                      key: "join",
                      title: "加入房间",
                      description: "输入房间号，准备加入联机对战。",
                      badge: <LogIn className="h-6 w-6" />,
                      side: "🔗",
                      tint: PALETTE.pink,
                      card: PALETTE.palePink,
                      border: "#F3D3E8",
                      onClick: joinRoom,
                    },
                  ].map((mode, index) => (
                    <motion.button
                      key={mode.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + index * 0.05 }}
                      onClick={mode.onClick}
                      className="w-full rounded-[1.65rem] border p-4 text-left active:scale-[0.99] transition-transform"
                      style={{ backgroundColor: mode.card, borderColor: mode.border }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[1.35rem]"
                          style={{ backgroundColor: mode.tint, color: PALETTE.ink }}
                        >
                          {mode.badge}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[1.2rem] font-black" style={{ color: PALETTE.ink }}>
                            {mode.title}
                          </p>
                          <p className="mt-1 text-sm leading-6" style={{ color: PALETTE.subInk }}>
                            {mode.description}
                          </p>
                        </div>
                        <div className="text-[1.8rem]">{mode.side}</div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {gameMode === "create" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.65rem] border p-4 text-left"
                  style={{ backgroundColor: PALETTE.paleBlue, borderColor: "#D3E7F7" }}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: PALETTE.blue, color: PALETTE.ink }}
                    >
                      <Wifi className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-black" style={{ color: PALETTE.ink }}>
                        房间已生成
                      </p>
                      <p className="text-sm" style={{ color: PALETTE.subInk }}>
                        后面我们就用这个房间号来接真正联机
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white/80 px-4 py-3" style={{ borderColor: "#B9D8F3" }}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.22em]" style={{ color: "#6A8DAA" }}>
                      ROOM ID
                    </p>
                    <p className="text-[1.9rem] font-black tracking-[0.18em]" style={{ color: PALETTE.ink }}>
                      {roomCode}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border bg-white/70 p-3" style={{ borderColor: "#DCECF9" }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[1.5rem]">
                        {onlineAvatar}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                          {onlineNickname}
                        </p>
                        <p className="text-xs" style={{ color: PALETTE.subInk }}>
                          {onlineRoleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={leaveModeSetup} sound="back">
                      返回选择
                    </Button>
                    <Button variant="primary" className="flex-1" onClick={copyRoomCode}>
                      {copied ? "已复制" : "复制房间号"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {gameMode === "join" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.65rem] border p-4 text-left"
                  style={{ backgroundColor: PALETTE.palePink, borderColor: "#F3D3E8" }}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: PALETTE.pink, color: PALETTE.ink }}
                    >
                      <Link2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-black" style={{ color: PALETTE.ink }}>
                        准备加入房间
                      </p>
                      <p className="text-sm" style={{ color: PALETTE.subInk }}>
                        先把房间号入口做好，后面直接接联机
                      </p>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[#A56E90]">输入房间号</span>
                    <input
                      type="text"
                      value={joinCode}
                      maxLength={6}
                      placeholder="例如 AB3K9P"
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.18em] outline-none focus:ring-2 focus:ring-[#FFC9EF]"
                      style={{ borderColor: "#F2C7E3", color: PALETTE.ink }}
                    />
                  </label>

                  <div className="mt-3 rounded-2xl border bg-white/70 p-3" style={{ borderColor: "#F3D3E8" }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[1.5rem]">
                        {onlineAvatar}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                          {onlineNickname}
                        </p>
                        <p className="text-xs" style={{ color: PALETTE.subInk }}>
                          {onlineRoleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={leaveModeSetup} sound="back">
                      返回选择
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => {
                        if (!joinCode.trim()) return;
                        playUiSound("confirm", audioEnabled);
                      }}
                      disabled={!joinCode.trim()}
                    >
                      保存房间号
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-2xl border px-4 py-3"
              style={{ backgroundColor: "#FFFFFFB8", borderColor: "#FFFFFF" }}
            >
              <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                这一步先把模式入口和房间号准备好
              </p>
              <p className="mt-1 text-[12px] leading-5" style={{ color: PALETTE.subInk }}>
                真正联机同步我们后面再接 Supabase 房间和加入逻辑，现在先把 UI 和交互路径搭牢。
              </p>
            </motion.div>
          </div>
        </div>
      )}

      {gameStarted && gameMode === "offline" && (
        <div className="app-page-content">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="app-page-center app-page-content--fit flex flex-col gap-4"
          >
            {!gameOver && (
              <motion.div
                key={currentPlayer}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border p-3 text-center"
                style={{
                  backgroundColor: currentPlayer === 1 ? PALETTE.palePink : PALETTE.paleBlue,
                  borderColor: currentPlayer === 1 ? PALETTE.pink : PALETTE.blue,
                }}
              >
                <p className="mb-1 text-xs" style={{ color: PALETTE.subInk }}>
                  当前轮到
                </p>
                <p className="text-xl font-bold" style={{ color: PALETTE.ink }}>
                  {currentPlayer === 1 ? player1Name : player2Name}
                </p>
              </motion.div>
            )}

            <div className="relative">
              <motion.div
                animate={isBiting ? { rotate: [0, -5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="rounded-3xl border p-5 transition-colors duration-300"
                style={{
                  backgroundColor: isBiting ? "#FFD7D7" : PALETTE.paleGreen,
                  borderColor: isBiting ? "#F3B4B4" : "#DDECA8",
                }}
              >
                <div className="mb-3 text-center">
                  <motion.div
                    animate={isBiting ? { scale: [1, 1.18, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    className="mb-1 text-5xl"
                  >
                    🐊
                  </motion.div>
                  {isBiting && (
                    <motion.p
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-lg font-bold"
                      style={{ color: "#8F2F2F" }}
                    >
                      咬到啦！
                    </motion.p>
                  )}
                </div>

                <div className="grid grid-cols-6 gap-2.5">
                  {teeth.map((pressed, index) => (
                    <motion.button
                      key={index}
                      whileTap={{ scale: pressed || gameOver ? 1 : 0.92 }}
                      onClick={() => pressTooth(index)}
                      disabled={pressed || gameOver}
                      className="aspect-square rounded-xl border transition-all"
                      style={{
                        backgroundColor: pressed ? "#9DB552" : "#FFFFFF",
                        borderColor: pressed ? "#7C963A" : "#DDECA8",
                      }}
                    >
                      {!pressed && (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-5 w-3 rounded-sm bg-[#E5E7EB]" />
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="rounded-2xl border p-3" style={{ backgroundColor: PALETTE.paleBlue, borderColor: "#D3E7F7" }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm" style={{ color: PALETTE.subInk }}>
                  已按下
                </span>
                <span className="text-sm font-bold" style={{ color: PALETTE.ink }}>
                  {pressedCount} / 12
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/90">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(pressedCount / 12) * 100}%` }}
                  className="h-2 rounded-full"
                  style={{ backgroundColor: PALETTE.blue }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="md" variant="secondary" onClick={leaveModeSetup} className="flex-1" sound="back">
                退出模式
              </Button>
              {gameOver ? (
                <Button size="md" variant="primary" onClick={resetGame} className="flex-1">
                  再来一局
                </Button>
              ) : (
                <Button size="md" variant="primary" onClick={resetGame} className="flex-1">
                  重新开始
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <ResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        winner={currentPlayer === 1 ? player2Name : player1Name}
        loser={currentPlayer === 1 ? player1Name : player2Name}
        stake={currentStake}
        message={
          currentStake === "谁是大皇帝"
            ? "今天这把，你就是大皇帝！👑"
            : "愿赌服输，今天就靠你啦！💪"
        }
      />
    </div>
  );
}
