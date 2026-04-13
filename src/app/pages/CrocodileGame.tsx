import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Copy,
  Crown,
  Link2,
  LogIn,
  Plus,
  Users,
} from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { DEFAULT_BGM_SOURCE, useBgm } from "../components/BgmProvider";
import { supabase } from "../../lib/supabase";
import { getStoredPlayerNames } from "../utils/playerSettings";
import { getStoredOnlinePlayerSettings, type OnlineRole } from "../utils/onlineSettings";
import { getAvatarOptionById } from "../utils/avatarOptions";
import {
  playAudioEffect,
  playCrocodileBiteImpactSound,
  playUiSound,
} from "../utils/soundEffects";

type GameMode = "offline" | "create" | "join" | null;
type LobbyPlayerId = "host" | "guest";

interface LobbyPlayer {
  id: LobbyPlayerId;
  nickname: string;
  avatarId: string;
  role: OnlineRole;
  isReady: boolean;
  isHost: boolean;
}

interface RoomPresencePayload extends LobbyPlayer {
  clientId: string;
}

interface OnlineMatchStartPayload {
  dangerTooth: number;
  firstPlayer: 1 | 2;
  stake: string;
}

interface OnlineMovePayload {
  index: number;
  hitDanger: boolean;
  nextPlayer: 1 | 2;
  loserPlayer: 1 | 2 | null;
  stake: string;
}

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

const ROLE_THEME: Record<
  OnlineRole,
  {
    tint: string;
    pale: string;
    border: string;
    accent: string;
    badge: string;
  }
> = {
  male: {
    tint: PALETTE.blue,
    pale: PALETTE.paleBlue,
    border: "#CFE4F4",
    accent: "#4D8FC6",
    badge: "#E9F5FF",
  },
  female: {
    tint: PALETTE.pink,
    pale: PALETTE.palePink,
    border: "#F4D2E8",
    accent: "#C879B0",
    badge: "#FFEAF7",
  },
};

const STAKE_LABELS: Record<string, string> = {
  coffee: "买咖啡",
  massage: "做按摩",
  dinner: "请吃饭",
  emperor: "谁是大皇帝",
  order: "点外卖",
  receive: "收外卖",
};

function generateRoomCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function getOppositeRole(role: OnlineRole): OnlineRole {
  return role === "female" ? "male" : "female";
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
  const [currentStake, setCurrentStake] = useState("谁是大皇帝");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [myLobbyPlayerId, setMyLobbyPlayerId] = useState<LobbyPlayerId>("host");
  const [lobbyNotice, setLobbyNotice] = useState("房主先准备，TA 进来后就能一起开战。");
  const [localReady, setLocalReady] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const { setTrack, enabled: audioEnabled } = useBgm();
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const roomClientIdRef = useRef(`croc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  const player1Name = playerNames.Demi;
  const player2Name = playerNames.Kevin;
  const selfRole = onlineProfile.role;
  const rivalRole = getOppositeRole(selfRole);
  const selfAvatarId = selfRole === "female" ? onlineProfile.femaleAvatarId : onlineProfile.maleAvatarId;
  const rivalAvatarId = rivalRole === "female" ? onlineProfile.femaleAvatarId : onlineProfile.maleAvatarId;
  const selfAvatar = getAvatarOptionById(selfAvatarId, selfRole === "female" ? 1 : 0);
  const rivalAvatar = getAvatarOptionById(rivalAvatarId, rivalRole === "female" ? 1 : 0);
  const selfNickname = onlineProfile.nickname || (selfRole === "female" ? playerNames.Demi : playerNames.Kevin);
  const rivalNickname = rivalRole === "female" ? playerNames.Demi : playerNames.Kevin;
  const selfRoleLabel = selfRole === "female" ? "女生身份" : "男生身份";
  const selfTheme = ROLE_THEME[selfRole];
  const rivalTheme = ROLE_THEME[rivalRole];
  const isOnlineMode = gameMode === "create" || gameMode === "join";

  const pressedCount = useMemo(() => teeth.filter(Boolean).length, [teeth]);
  const myLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id === myLobbyPlayerId) ?? null,
    [lobbyPlayers, myLobbyPlayerId]
  );
  const rivalLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id !== myLobbyPlayerId) ?? null,
    [lobbyPlayers, myLobbyPlayerId]
  );
  const myLobbyReady = myLobbyPlayer?.isReady ?? localReady;
  const everyoneReady = lobbyPlayers.length === 2 && lobbyPlayers.every((player) => player.isReady);
  const myLobbyAvatar = myLobbyPlayer
    ? getAvatarOptionById(myLobbyPlayer.avatarId, myLobbyPlayer.role === "female" ? 1 : 0)
    : selfAvatar;
  const rivalLobbyAvatar = rivalLobbyPlayer
    ? getAvatarOptionById(rivalLobbyPlayer.avatarId, rivalLobbyPlayer.role === "female" ? 1 : 0)
    : rivalAvatar;
  const myLobbyTheme = ROLE_THEME[myLobbyPlayer?.role ?? selfRole];
  const rivalLobbyTheme = ROLE_THEME[rivalLobbyPlayer?.role ?? rivalRole];
  const hostLobbyPlayer = lobbyPlayers.find((player) => player.id === "host") ?? null;
  const guestLobbyPlayer = lobbyPlayers.find((player) => player.id === "guest") ?? null;
  const onlineTurnName = currentPlayer === 1
    ? hostLobbyPlayer?.nickname ?? "房主"
    : guestLobbyPlayer?.nickname ?? "加入者";
  const onlineTurnTheme = currentPlayer === 1
    ? ROLE_THEME[hostLobbyPlayer?.role ?? selfRole]
    : ROLE_THEME[guestLobbyPlayer?.role ?? rivalRole];
  const canHostStartMatch = isOnlineMode && everyoneReady && myLobbyPlayerId === "host" && roomConnected;
  const waitingForHostStart = isOnlineMode && everyoneReady && myLobbyPlayerId === "guest";

  const getCurrentStake = () => {
    const selectedStakeIds = JSON.parse(localStorage.getItem("selectedStakes") || "[]");
    const customStakes = JSON.parse(localStorage.getItem("customStakes") || "[]");

    const presetStakes = selectedStakeIds
      .map((id: string) => STAKE_LABELS[id])
      .filter(Boolean);

    const allStakes = [...presetStakes, ...customStakes].filter(
      (stake: string) => typeof stake === "string" && stake.trim()
    );

    return allStakes[0] || "谁是大皇帝";
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

  const clearRoomChannel = () => {
    if (roomChannelRef.current) {
      void supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setRoomConnected(false);
  };

  const syncLobbyPlayersFromPresence = (channel: RealtimeChannel) => {
    const presenceState = channel.presenceState<RoomPresencePayload>();
    const nextPlayersMap = new Map<LobbyPlayerId, LobbyPlayer>();

    Object.values(presenceState)
      .flat()
      .forEach((presence) => {
        if (presence.id !== "host" && presence.id !== "guest") {
          return;
        }

        nextPlayersMap.set(presence.id, {
          id: presence.id,
          nickname: presence.nickname,
          avatarId: presence.avatarId,
          role: presence.role,
          isReady: presence.isReady,
          isHost: presence.isHost,
        });
      });

    setLobbyPlayers(
      Array.from(nextPlayersMap.values()).sort((left, right) => (left.id === right.id ? 0 : left.id === "host" ? -1 : 1))
    );
  };

  const applyOnlineMatchStart = (payload: OnlineMatchStartPayload) => {
    setCurrentStake(payload.stake);
    setDangerTooth(payload.dangerTooth);
    setTeeth(Array(12).fill(false));
    setCurrentPlayer(payload.firstPlayer);
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setGameStarted(true);
    setLocalReady(false);
  };

  const applyOnlineMove = (payload: OnlineMovePayload) => {
    const effectPool = ["/sounds/villager1.mp3", "/sounds/villager2.mp3", "/sounds/villager3.mp3"];
    if (payload.hitDanger) {
      playAudioEffect("/sounds/villagerdead.mp3", audioEnabled, {
        category: "voice",
        multiplier: 1.02,
      });
    } else {
      playAudioEffect(effectPool[Math.floor(Math.random() * effectPool.length)], audioEnabled, {
        category: "voice",
      });
    }

    setTeeth((current) => {
      if (current[payload.index]) {
        return current;
      }
      const next = [...current];
      next[payload.index] = true;
      return next;
    });

    if (payload.hitDanger) {
      const selectedStake = payload.stake;
      const loserName =
        payload.loserPlayer === 1
          ? hostLobbyPlayer?.nickname ?? "房主"
          : guestLobbyPlayer?.nickname ?? "加入者";

      setCurrentStake(selectedStake);
      setIsBiting(true);
      playCrocodileBiteImpactSound(audioEnabled);
      window.setTimeout(() => {
        setGameOver(true);
        const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
        history.unshift({
          date: new Date().toISOString(),
          game: "鳄鱼拔牙",
          loser: loserName,
          stake: selectedStake,
        });
        localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));
        window.setTimeout(() => setShowResult(true), 1500);
      }, 1000);
      return;
    }

    setCurrentPlayer(payload.nextPlayer);
  };

  useEffect(() => {
    return () => {
      clearRoomChannel();
    };
  }, []);

  useEffect(() => {
    if (!isOnlineMode || !roomCode) {
      clearRoomChannel();
      return;
    }

    clearRoomChannel();

    const channel = supabase.channel(`crocodile-room-${roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: roomClientIdRef.current },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      syncLobbyPlayersFromPresence(channel);
    });

    channel.on("broadcast", { event: "match_start" }, ({ payload }) => {
      applyOnlineMatchStart(payload as OnlineMatchStartPayload);
      setLobbyNotice("联机对局开始了，轮到当前高亮的一方。");
    });

    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      applyOnlineMove(payload as OnlineMovePayload);
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        return;
      }

      roomChannelRef.current = channel;
      setRoomConnected(true);
      void channel.track({
        id: myLobbyPlayerId,
        nickname: selfNickname,
        avatarId: selfAvatarId,
        role: selfRole,
        isReady: localReady,
        isHost: myLobbyPlayerId === "host",
        clientId: roomClientIdRef.current,
      } satisfies RoomPresencePayload);

      setLobbyNotice(
        gameMode === "create" ? "房间已建立，把数字房间号发给 TA。" : "已连接房间，等双方准备后就能开始。"
      );
    });

    return () => {
      if (roomChannelRef.current === channel) {
        roomChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
      setRoomConnected(false);
    };
  }, [gameMode, isOnlineMode, roomCode]);

  useEffect(() => {
    if (!roomChannelRef.current || !roomConnected || !isOnlineMode || !roomCode) {
      return;
    }

    void roomChannelRef.current.track({
      id: myLobbyPlayerId,
      nickname: selfNickname,
      avatarId: selfAvatarId,
      role: selfRole,
      isReady: localReady,
      isHost: myLobbyPlayerId === "host",
      clientId: roomClientIdRef.current,
    } satisfies RoomPresencePayload);
  }, [isOnlineMode, localReady, myLobbyPlayerId, roomCode, roomConnected, selfAvatarId, selfNickname, selfRole]);

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
    clearRoomChannel();
    setGameMode(null);
    setRoomCode("");
    setJoinCode("");
    setCopied(false);
    setLobbyPlayers([]);
    setMyLobbyPlayerId("host");
    setLocalReady(false);
    setGameStarted(false);
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setTeeth(Array(12).fill(false));
    setLobbyNotice("房主先准备，TA 进来后就能一起开战。");
  };

  const createRoom = () => {
    playUiSound("confirm", audioEnabled);
    const nextRoomCode = generateRoomCode();
    setGameMode("create");
    setGameStarted(false);
    setRoomCode(nextRoomCode);
    setJoinCode("");
    setCopied(false);
    setMyLobbyPlayerId("host");
    setLocalReady(false);
    setLobbyPlayers([
      {
        id: "host",
        nickname: selfNickname,
        avatarId: selfAvatarId,
        role: selfRole,
        isReady: false,
        isHost: true,
      },
    ]);
    setLobbyNotice("房间已建立，把数字房间号发给 TA。");
  };

  const joinRoom = () => {
    playUiSound("confirm", audioEnabled);
    setGameMode("join");
    setGameStarted(false);
    setRoomCode("");
    setJoinCode("");
    setCopied(false);
    setLobbyPlayers([]);
    setMyLobbyPlayerId("guest");
    setLocalReady(false);
    setLobbyNotice("先把数字房间号填好，再进入准备室。");
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

  const saveJoinRoomCode = () => {
    if (!/^\d{6}$/.test(joinCode.trim())) {
      return;
    }

    playUiSound("confirm", audioEnabled);
    setRoomCode(joinCode.trim());
    setMyLobbyPlayerId("guest");
    setLocalReady(false);
    setLobbyPlayers([
      {
        id: "guest",
        nickname: selfNickname,
        avatarId: selfAvatarId,
        role: selfRole,
        isReady: false,
        isHost: false,
      },
    ]);
    setLobbyNotice("已进入房间，等房主出现后就能一起准备。");
  };

  const toggleLobbyReady = () => {
    const nextReady = !localReady;
    setLocalReady(nextReady);

    if (!nextReady) {
      setLobbyNotice("你已取消准备，等调整好再点一次就行。");
      return;
    }

    if (!rivalLobbyPlayer) {
      setLobbyNotice("你已准备，等 TA 进入房间就能继续。");
      return;
    }

    if (rivalLobbyPlayer.isReady) {
      setLobbyNotice(myLobbyPlayerId === "host" ? "双方都准备好了，房主可以开始。" : "双方都准备好了，等房主开始。");
      return;
    }

    setLobbyNotice("你已准备，等 TA 也准备一下。");
  };

  const startOnlineMatch = async () => {
    if (!canHostStartMatch || !roomChannelRef.current) {
      return;
    }

    const payload: OnlineMatchStartPayload = {
      dangerTooth: Math.floor(Math.random() * 12),
      firstPlayer: Math.random() < 0.5 ? 1 : 2,
      stake: getCurrentStake(),
    };

    playUiSound("confirm", audioEnabled);
    applyOnlineMatchStart(payload);
    setLobbyNotice("联机对局开始了，轮到当前高亮的一方。");

    await roomChannelRef.current.send({
      type: "broadcast",
      event: "match_start",
      payload,
    });
  };

  const resetOnlineRound = () => {
    setShowResult(false);
    setGameStarted(false);
    setGameOver(false);
    setIsBiting(false);
    setTeeth(Array(12).fill(false));
    setDangerTooth(-1);
    setCurrentPlayer(1);
    setLocalReady(false);
    setLobbyNotice("这一局结束了，可以重新准备再来。");
  };

  const pressTooth = (index: number) => {
    if (teeth[index] || gameOver) return;

    if (isOnlineMode) {
      const localTurn = myLobbyPlayerId === "host" ? 1 : 2;
      if (!gameStarted || currentPlayer !== localTurn) {
        playUiSound("back", audioEnabled);
        return;
      }

      const selectedStake = currentStake || getCurrentStake();
      const hitDanger = index === dangerTooth;
      const payload: OnlineMovePayload = {
        index,
        hitDanger,
        nextPlayer: currentPlayer === 1 ? 2 : 1,
        loserPlayer: hitDanger ? currentPlayer : null,
        stake: selectedStake,
      };

      applyOnlineMove(payload);

      if (roomChannelRef.current) {
        void roomChannelRef.current.send({
          type: "broadcast",
          event: "move",
          payload,
        });
      }
      return;
    }

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

              {gameMode === "join" && !roomCode && (
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
                        先把数字房间号入口做好，后面直接接联机
                      </p>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-[#A56E90]">输入房间号</span>
                    <input
                      type="text"
                      value={joinCode}
                      maxLength={6}
                      placeholder="例如 620518"
                      onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.18em] outline-none focus:ring-2 focus:ring-[#FFC9EF]"
                      style={{ borderColor: "#F2C7E3", color: PALETTE.ink }}
                    />
                  </label>

                  <div className="mt-3 rounded-2xl border bg-white/70 p-3" style={{ borderColor: "#F3D3E8" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                        style={{
                          background: `linear-gradient(135deg, ${selfAvatar.soft} 0%, ${selfAvatar.solid} 100%)`,
                          borderColor: selfTheme.border,
                        }}
                      >
                        <span className="text-[1.45rem]">{selfAvatar.emoji}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                          {selfNickname}
                        </p>
                        <p className="text-xs" style={{ color: PALETTE.subInk }}>
                          {selfRoleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={leaveModeSetup} sound="back">
                      返回选择
                    </Button>
                    <Button variant="primary" className="flex-1" onClick={saveJoinRoomCode} disabled={joinCode.trim().length !== 6}>
                      加入房间
                    </Button>
                  </div>
                </motion.div>
              )}

              {(gameMode === "create" || (gameMode === "join" && roomCode)) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[2rem] border px-5 py-5 text-center shadow-[0_18px_40px_rgba(31,36,48,0.08)]"
                  style={{ backgroundColor: "#FFFFFFF5", borderColor: "#F0ECE0" }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: PALETTE.subInk }}>
                        房间号
                      </p>
                      <p className="mt-1 text-[2.15rem] font-black tracking-[0.12em]" style={{ color: PALETTE.ink }}>
                        {roomCode}
                      </p>
                    </div>
                    <button
                      onClick={copyRoomCode}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95"
                      style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F3E7A5", color: PALETTE.ink }}
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>

                  <div
                    className="rounded-[1.7rem] border px-4 py-4"
                    style={{ backgroundColor: "#FBFCFF", borderColor: "#E9EDF5" }}
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="min-w-0 text-center">
                        <div
                          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(31,36,48,0.08)]"
                          style={{
                            background: `linear-gradient(135deg, ${myLobbyAvatar.soft} 0%, ${myLobbyAvatar.solid} 100%)`,
                            borderColor: myLobbyTheme.border,
                          }}
                        >
                          <span className="text-[2.15rem]">{myLobbyAvatar.emoji}</span>
                        </div>
                        <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                          {myLobbyPlayer?.nickname ?? selfNickname}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                          {myLobbyPlayer?.isHost && <Crown className="h-3.5 w-3.5" style={{ color: "#E99E34" }} />}
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: myLobbyPlayer?.isHost ? "#FFF1D4" : myLobbyTheme.badge,
                              color: myLobbyPlayer?.isHost ? "#B86A1E" : myLobbyTheme.accent,
                            }}
                          >
                            {myLobbyPlayer?.isHost ? "房主" : myLobbyPlayer?.role === "female" ? "女生" : "男生"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold" style={{ color: myLobbyReady ? myLobbyTheme.accent : PALETTE.subInk }}>
                          {myLobbyReady ? "已准备" : "未准备"}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <div
                          className="rounded-full px-4 py-2 text-[2.1rem] font-black leading-none"
                          style={{
                            background: "linear-gradient(135deg, #FFB347 0%, #FF4D8D 48%, #8E5BFF 100%)",
                            WebkitBackgroundClip: "text",
                            color: "transparent",
                          }}
                        >
                          VS
                        </div>
                        <p className="text-[11px] font-medium" style={{ color: PALETTE.subInk }}>
                          {everyoneReady ? "双方就绪" : copied ? "已复制房间号" : "等待匹配"}
                        </p>
                      </div>

                      <div className="min-w-0 text-center">
                        {rivalLobbyPlayer ? (
                          <>
                            <div
                              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(31,36,48,0.08)]"
                              style={{
                                background: `linear-gradient(135deg, ${rivalLobbyAvatar.soft} 0%, ${rivalLobbyAvatar.solid} 100%)`,
                                borderColor: rivalLobbyTheme.border,
                              }}
                            >
                              <span className="text-[2.15rem]">{rivalLobbyAvatar.emoji}</span>
                            </div>
                            <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                              {rivalLobbyPlayer.nickname}
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-1.5">
                              {rivalLobbyPlayer.isHost && <Crown className="h-3.5 w-3.5" style={{ color: "#E99E34" }} />}
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                style={{
                                  backgroundColor: rivalLobbyPlayer.isHost ? "#FFF1D4" : rivalLobbyTheme.badge,
                                  color: rivalLobbyPlayer.isHost ? "#B86A1E" : rivalLobbyTheme.accent,
                                }}
                              >
                                {rivalLobbyPlayer.isHost ? "房主" : rivalLobbyPlayer.role === "female" ? "女生" : "男生"}
                              </span>
                            </div>
                            <p
                              className="mt-2 text-sm font-semibold"
                              style={{ color: rivalLobbyPlayer.isReady ? rivalLobbyTheme.accent : PALETTE.subInk }}
                            >
                              {rivalLobbyPlayer.isReady ? "已准备" : "未准备"}
                            </p>
                          </>
                        ) : (
                          <>
                            <div
                              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed"
                              style={{ borderColor: "#DFE3EC", color: "#C4CBD8", backgroundColor: "#FFFFFF" }}
                            >
                              <span className="text-[2rem]">?</span>
                            </div>
                            <p className="mt-3 text-[1rem] font-bold" style={{ color: PALETTE.subInk }}>
                              等待加入...
                            </p>
                            <p className="mt-2 text-xs" style={{ color: "#A3AABA" }}>
                              把数字房间号发给 TA
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-5 w-full !rounded-[1.4rem] !py-3.5 text-[1.2rem] font-black"
                    onClick={canHostStartMatch ? () => void startOnlineMatch() : toggleLobbyReady}
                    disabled={waitingForHostStart}
                  >
                    {canHostStartMatch ? "开始对战" : waitingForHostStart ? "等待房主开始" : myLobbyReady ? "取消准备" : "准备"}
                  </Button>

                  <button
                    onClick={leaveModeSetup}
                    className="mt-4 text-[1rem] font-semibold transition-colors"
                    style={{ color: PALETTE.subInk }}
                  >
                    离开房间
                  </button>

                  <p className="mt-4 text-sm leading-6" style={{ color: PALETTE.subInk }}>
                    {lobbyNotice}
                  </p>
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
                {gameMode === null ? "这一步先把模式入口和房间流转搭顺" : "房间这一步先把准备态和视觉节奏做好"}
              </p>
              <p className="mt-1 text-[12px] leading-5" style={{ color: PALETTE.subInk }}>
                {gameMode === null
                  ? "真正联机同步我们后面再接 Supabase 房间和加入逻辑，现在先把 UI 和交互路径搭牢。"
                  : "现在先做数字房间号、准备、等待加入和 VS 资料卡，后面再把真实联机状态接进来。"}
              </p>
            </motion.div>
          </div>
        </div>
      )}

      {gameStarted && (
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
                  backgroundColor: isOnlineMode
                    ? currentPlayer === 1
                      ? ROLE_THEME[hostLobbyPlayer?.role ?? selfRole].pale
                      : ROLE_THEME[guestLobbyPlayer?.role ?? rivalRole].pale
                    : currentPlayer === 1
                      ? PALETTE.palePink
                      : PALETTE.paleBlue,
                  borderColor: isOnlineMode
                    ? currentPlayer === 1
                      ? ROLE_THEME[hostLobbyPlayer?.role ?? selfRole].tint
                      : ROLE_THEME[guestLobbyPlayer?.role ?? rivalRole].tint
                    : currentPlayer === 1
                      ? PALETTE.pink
                      : PALETTE.blue,
                }}
              >
                <p className="mb-1 text-xs" style={{ color: PALETTE.subInk }}>
                  当前轮到
                </p>
                <p className="text-xl font-bold" style={{ color: PALETTE.ink }}>
                  {isOnlineMode ? onlineTurnName : currentPlayer === 1 ? player1Name : player2Name}
                </p>
                {isOnlineMode && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: onlineTurnTheme.accent }}>
                    {currentPlayer === 1 ? "房主回合" : "加入者回合"}
                  </p>
                )}
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
              {isOnlineMode ? (
                <>
                  <Button size="md" variant="secondary" onClick={leaveModeSetup} className="flex-1" sound="back">
                    离开房间
                  </Button>
                  <Button size="md" variant="primary" onClick={resetOnlineRound} className="flex-1">
                    返回准备室
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <ResultModal
        isOpen={showResult}
        onClose={isOnlineMode ? resetOnlineRound : () => setShowResult(false)}
        winner={
          isOnlineMode
            ? currentPlayer === 1
              ? guestLobbyPlayer?.nickname ?? "加入者"
              : hostLobbyPlayer?.nickname ?? "房主"
            : currentPlayer === 1
              ? player2Name
              : player1Name
        }
        loser={
          isOnlineMode
            ? currentPlayer === 1
              ? hostLobbyPlayer?.nickname ?? "房主"
              : guestLobbyPlayer?.nickname ?? "加入者"
            : currentPlayer === 1
              ? player1Name
              : player2Name
        }
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
