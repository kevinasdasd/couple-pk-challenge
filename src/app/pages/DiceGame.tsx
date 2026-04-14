import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Clock3, Copy, Crown, Dices, Link2, LogIn, Plus, Users } from "lucide-react";
import { AvatarBadge } from "../components/AvatarBadge";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useBgm } from "../components/BgmProvider";
import { supabase } from "../../lib/supabase";
import { getAvatarOptionById } from "../utils/avatarOptions";
import { getStoredOnlinePlayerSettings, type OnlineRole } from "../utils/onlineSettings";
import { getPlayerInitial, getStoredPlayerNames, type PlayerId } from "../utils/playerSettings";
import {
  playDiceRevealSound,
  playInvalidActionSound,
  playTieRoundSound,
  startDiceRollingLoop,
  playUiSound,
} from "../utils/soundEffects";

type GameMode = "offline" | "create" | "join" | null;
type LobbyPlayerId = "host" | "guest";
type DicePhase = "setup" | "rolling" | "result";

interface OfflinePlayer {
  name: string;
  guess: string;
}

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
  roundId: string;
  stake: string;
}

interface OnlineGuessPayload {
  roundId: string;
  playerId: LobbyPlayerId;
  guess: string;
}

interface OnlineResultPayload {
  roundId: string;
  stake: string;
  diceResults: number[];
  total: number;
  hostGuess: string;
  guestGuess: string;
  hostNickname: string;
  guestNickname: string;
  winnerId: LobbyPlayerId | "tie";
  loserId: LobbyPlayerId | null;
}

const ONLINE_LIMIT_MS = 30000;

const PALETTE = {
  yellow: "#FFEA6F",
  paleYellow: "#FFFDF0",
  pink: "#FFC9EF",
  palePink: "#FFF9FD",
  blue: "#ABD7FA",
  paleBlue: "#F6FBFE",
  ink: "#1F2430",
  subInk: "#667085",
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
  eat: "吃外卖",
};

function generateRoomCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function getStoredStake() {
  const selectedStakeIds = JSON.parse(localStorage.getItem("selectedStakes") || "[]");
  const customStakes = JSON.parse(localStorage.getItem("customStakes") || "[]");

  const presetStakes = selectedStakeIds
    .map((id: string) => STAKE_LABELS[id])
    .filter(Boolean);

  const allStakes = [...presetStakes, ...customStakes].filter(
    (stake: string) => typeof stake === "string" && stake.trim()
  );

  return allStakes[0] || "谁是大皇帝";
}

function getOppositeRole(role: OnlineRole): OnlineRole {
  return role === "female" ? "male" : "female";
}

function getGuessNumber(value: string) {
  const nextValue = value.trim();
  if (!nextValue) return null;
  const parsed = Number.parseInt(nextValue, 10);
  if (Number.isNaN(parsed) || parsed < 3 || parsed > 18) {
    return null;
  }
  return parsed;
}

export default function DiceGame() {
  const initialNames = getStoredPlayerNames();
  const [player1, setPlayer1] = useState<OfflinePlayer>({ name: initialNames.Kevin, guess: "" });
  const [player2, setPlayer2] = useState<OfflinePlayer>({ name: initialNames.Demi, guess: "" });
  const [activePlayer, setActivePlayer] = useState<PlayerId | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [phase, setPhase] = useState<DicePhase>("setup");
  const [gameStarted, setGameStarted] = useState(false);
  const [diceResults, setDiceResults] = useState<number[]>([1, 1, 1]);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState("");
  const [loser, setLoser] = useState("");
  const [currentStake, setCurrentStake] = useState("谁是大皇帝");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [myLobbyPlayerId, setMyLobbyPlayerId] = useState<LobbyPlayerId>("host");
  const [lobbyNotice, setLobbyNotice] = useState("房主先准备，TA 进来后就能一起开战。");
  const [localReady, setLocalReady] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const [onlineGuessInput, setOnlineGuessInput] = useState("");
  const [onlineGuesses, setOnlineGuesses] = useState<Record<LobbyPlayerId, string>>({ host: "", guest: "" });
  const [onlineSubmitted, setOnlineSubmitted] = useState<Record<LobbyPlayerId, boolean>>({ host: false, guest: false });
  const [roundId, setRoundId] = useState("");
  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(ONLINE_LIMIT_MS);
  const { enabled: audioEnabled } = useBgm();

  const diceIntervalRef = useRef<number | null>(null);
  const diceStopTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const stopRollingAudioRef = useRef<(() => void) | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const roomClientIdRef = useRef(`dice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const joinValidationTimerRef = useRef<number | null>(null);
  const onlineGuessesRef = useRef(onlineGuesses);
  const onlineSubmittedRef = useRef(onlineSubmitted);
  const roundIdRef = useRef(roundId);
  const resultSentRoundRef = useRef<string | null>(null);

  const selfProfile = getStoredOnlinePlayerSettings();
  const selfRole = selfProfile.role;
  const selfAvatarId = selfRole === "female" ? selfProfile.femaleAvatarId : selfProfile.maleAvatarId;
  const selfAvatar = getAvatarOptionById(selfAvatarId, selfRole === "female" ? 1 : 0);
  const selfTheme = ROLE_THEME[selfRole];
  const selfNickname = selfProfile.nickname || (selfRole === "female" ? player2.name : player1.name);
  const selfRoleLabel = selfRole === "female" ? "女生身份" : "男生身份";
  const fallbackRivalRole = getOppositeRole(selfRole);
  const fallbackRivalAvatarId = fallbackRivalRole === "female" ? selfProfile.femaleAvatarId : selfProfile.maleAvatarId;
  const fallbackRivalAvatar = getAvatarOptionById(fallbackRivalAvatarId, fallbackRivalRole === "female" ? 1 : 0);
  const isOnlineMode = gameMode === "create" || gameMode === "join";

  const myLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id === myLobbyPlayerId) ?? null,
    [lobbyPlayers, myLobbyPlayerId]
  );
  const rivalLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id !== myLobbyPlayerId) ?? null,
    [lobbyPlayers, myLobbyPlayerId]
  );
  const hostLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id === "host") ?? null,
    [lobbyPlayers]
  );
  const guestLobbyPlayer = useMemo(
    () => lobbyPlayers.find((player) => player.id === "guest") ?? null,
    [lobbyPlayers]
  );
  const myLobbyReady = myLobbyPlayer?.isReady ?? localReady;
  const everyoneReady = lobbyPlayers.length === 2 && lobbyPlayers.every((player) => player.isReady);
  const canHostStartMatch = isOnlineMode && everyoneReady && myLobbyPlayerId === "host" && roomConnected;
  const waitingForHostStart = isOnlineMode && everyoneReady && myLobbyPlayerId === "guest";
  const hostTheme = ROLE_THEME[hostLobbyPlayer?.role ?? selfRole];
  const guestTheme = ROLE_THEME[guestLobbyPlayer?.role ?? fallbackRivalRole];
  const hostAvatar = hostLobbyPlayer
    ? getAvatarOptionById(hostLobbyPlayer.avatarId, hostLobbyPlayer.role === "female" ? 1 : 0)
    : myLobbyPlayerId === "host"
      ? selfAvatar
      : fallbackRivalAvatar;
  const guestAvatar = guestLobbyPlayer
    ? getAvatarOptionById(guestLobbyPlayer.avatarId, guestLobbyPlayer.role === "female" ? 1 : 0)
    : myLobbyPlayerId === "guest"
      ? selfAvatar
      : fallbackRivalAvatar;
  const localSubmitted = onlineSubmitted[myLobbyPlayerId];
  const rivalSubmitted = onlineSubmitted[myLobbyPlayerId === "host" ? "guest" : "host"];
  const countdownProgress = Math.max(0, Math.min(1, timeLeftMs / ONLINE_LIMIT_MS));
  const countdownSeconds = Math.ceil(timeLeftMs / 1000);
  const currentOnlineGuessDisplay = myLobbyPlayerId === "host" ? onlineGuesses.host : onlineGuesses.guest;
  useEffect(() => {
    onlineGuessesRef.current = onlineGuesses;
  }, [onlineGuesses]);

  useEffect(() => {
    onlineSubmittedRef.current = onlineSubmitted;
  }, [onlineSubmitted]);

  useEffect(() => {
    roundIdRef.current = roundId;
  }, [roundId]);

  const stopRollingEffects = () => {
    if (diceIntervalRef.current !== null) {
      window.clearInterval(diceIntervalRef.current);
      diceIntervalRef.current = null;
    }
    if (diceStopTimerRef.current !== null) {
      window.clearTimeout(diceStopTimerRef.current);
      diceStopTimerRef.current = null;
    }
    if (stopRollingAudioRef.current) {
      stopRollingAudioRef.current();
      stopRollingAudioRef.current = null;
    }
  };

  const clearJoinValidationTimer = () => {
    if (joinValidationTimerRef.current !== null) {
      window.clearTimeout(joinValidationTimerRef.current);
      joinValidationTimerRef.current = null;
    }
  };

  const clearCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const clearRoomChannel = () => {
    clearJoinValidationTimer();
    if (roomChannelRef.current) {
      void supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setRoomConnected(false);
  };

  const saveHistoryRecord = (loserName: string, stake: string) => {
    const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
    history.unshift({
      date: new Date().toISOString(),
      game: "骰子猜点",
      loser: loserName,
      stake,
    });
    localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));
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
      Array.from(nextPlayersMap.values()).sort((left, right) => (left.id === "host" ? -1 : 1) - (right.id === "host" ? -1 : 1))
    );
  };

  const startOnlineRoundLocally = (payload: OnlineMatchStartPayload) => {
    stopRollingEffects();
    clearCountdown();
    resultSentRoundRef.current = null;
    setCurrentStake(payload.stake);
    setRoundId(payload.roundId);
    // Use each client's local receipt time to avoid cross-device clock skew.
    setRoundStartedAt(Date.now());
    setTimeLeftMs(ONLINE_LIMIT_MS);
    setOnlineGuesses({ host: "", guest: "" });
    setOnlineSubmitted({ host: false, guest: false });
    setOnlineGuessInput("");
    setWinner("");
    setLoser("");
    setShowResult(false);
    setDiceResults([1, 1, 1]);
    setPhase("setup");
    setGameStarted(true);
    setLobbyNotice("联机对局开始了，30 秒内提交你的猜测。");
  };

  const animateResult = (payload: OnlineResultPayload) => {
    stopRollingEffects();
    clearCountdown();
    setCurrentStake(payload.stake);
    setPhase("rolling");
    stopRollingAudioRef.current = startDiceRollingLoop(audioEnabled);

    diceIntervalRef.current = window.setInterval(() => {
      setDiceResults([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    diceStopTimerRef.current = window.setTimeout(() => {
      stopRollingEffects();
      setDiceResults(payload.diceResults);
      playDiceRevealSound(audioEnabled);

      if (payload.winnerId === "tie") {
        setWinner("平局");
        setLoser("重新来过");
        playTieRoundSound(audioEnabled);
      } else {
        const nextWinner = payload.winnerId === "host"
          ? payload.hostNickname
          : payload.guestNickname;
        const nextLoser = payload.loserId === "host"
          ? payload.hostNickname
          : payload.guestNickname;
        setWinner(nextWinner);
        setLoser(nextLoser);
        saveHistoryRecord(nextLoser, payload.stake);
      }

      setPhase("result");
      window.setTimeout(() => setShowResult(true), 1500);
    }, 2000);
  };

  const maybeBroadcastOnlineResult = async () => {
    if (!roomChannelRef.current || myLobbyPlayerId !== "host" || !gameStarted || phase !== "setup") {
      return;
    }
    const nextRoundId = roundIdRef.current;
    if (!nextRoundId || resultSentRoundRef.current === nextRoundId) {
      return;
    }

    const guesses = onlineGuessesRef.current;
    const submitted = onlineSubmittedRef.current;
    if (!submitted.host && !submitted.guest && timeLeftMs > 0) {
      return;
    }

    resultSentRoundRef.current = nextRoundId;
    const finalDice = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
    const total = finalDice.reduce((sum, value) => sum + value, 0);
    const hostGuessNumber = submitted.host ? getGuessNumber(guesses.host) : null;
    const guestGuessNumber = submitted.guest ? getGuessNumber(guesses.guest) : null;
    const hostDiff = hostGuessNumber === null ? Number.POSITIVE_INFINITY : Math.abs(hostGuessNumber - total);
    const guestDiff = guestGuessNumber === null ? Number.POSITIVE_INFINITY : Math.abs(guestGuessNumber - total);

    let winnerId: LobbyPlayerId | "tie" = "tie";
    let loserId: LobbyPlayerId | null = null;

    if (hostDiff < guestDiff) {
      winnerId = "host";
      loserId = "guest";
    } else if (guestDiff < hostDiff) {
      winnerId = "guest";
      loserId = "host";
    }

    const payload: OnlineResultPayload = {
      roundId: nextRoundId,
      stake: currentStake,
      diceResults: finalDice,
      total,
      hostGuess: guesses.host,
      guestGuess: guesses.guest,
      hostNickname: hostLobbyPlayer?.nickname ?? "房主",
      guestNickname: guestLobbyPlayer?.nickname ?? "加入者",
      winnerId,
      loserId,
    };

    animateResult(payload);
    await roomChannelRef.current.send({
      type: "broadcast",
      event: "result_reveal",
      payload,
    });
  };

  useEffect(() => {
    const nextNames = getStoredPlayerNames();
    setPlayer1((current) => ({ ...current, name: nextNames.Kevin }));
    setPlayer2((current) => ({ ...current, name: nextNames.Demi }));
    setCurrentStake(getStoredStake());

    return () => {
      stopRollingEffects();
      clearCountdown();
      clearRoomChannel();
    };
  }, []);

  useEffect(() => {
    if (!isOnlineMode || !roomCode) {
      clearRoomChannel();
      return;
    }

    clearRoomChannel();

    const channel = supabase.channel(`dice-room-${roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: roomClientIdRef.current },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      syncLobbyPlayersFromPresence(channel);
    });

    channel.on("broadcast", { event: "match_start" }, ({ payload }) => {
      startOnlineRoundLocally(payload as OnlineMatchStartPayload);
    });

    channel.on("broadcast", { event: "guess_submit" }, ({ payload }) => {
      const message = payload as OnlineGuessPayload;
      if (message.roundId !== roundIdRef.current) return;
      setOnlineGuesses((current) => ({ ...current, [message.playerId]: message.guess }));
      setOnlineSubmitted((current) => ({ ...current, [message.playerId]: true }));
    });

    channel.on("broadcast", { event: "result_reveal" }, ({ payload }) => {
      const resultPayload = payload as OnlineResultPayload;
      if (resultPayload.roundId !== roundIdRef.current) return;
      animateResult(resultPayload);
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
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

  useEffect(() => {
    if (gameMode !== "join" || myLobbyPlayerId !== "guest" || !roomCode || !roomConnected || gameStarted) {
      clearJoinValidationTimer();
      return;
    }

    if (hostLobbyPlayer) {
      clearJoinValidationTimer();
      setJoinError("");
      return;
    }

    clearJoinValidationTimer();
    joinValidationTimerRef.current = window.setTimeout(() => {
      playInvalidActionSound(audioEnabled);
      setJoinError("未找到这个房间号，请检查后重试。");
      clearRoomChannel();
      setRoomCode("");
      setLobbyPlayers([]);
      setLocalReady(false);
      setLobbyNotice("先把数字房间号填好，再进入准备室。");
    }, 2200);

    return () => {
      clearJoinValidationTimer();
    };
  }, [audioEnabled, gameMode, gameStarted, hostLobbyPlayer, myLobbyPlayerId, roomCode, roomConnected]);

  useEffect(() => {
    if (!isOnlineMode || !gameStarted || phase !== "setup" || roundStartedAt === null) {
      clearCountdown();
      return;
    }

    const updateTime = () => {
      const remaining = Math.max(0, ONLINE_LIMIT_MS - (Date.now() - roundStartedAt));
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearCountdown();
        if (myLobbyPlayerId === "host") {
          void maybeBroadcastOnlineResult();
        }
      }
    };

    updateTime();
    countdownIntervalRef.current = window.setInterval(updateTime, 200);

    return () => {
      clearCountdown();
    };
  }, [gameStarted, isOnlineMode, myLobbyPlayerId, phase, roundStartedAt]);

  useEffect(() => {
    if (
      isOnlineMode &&
      myLobbyPlayerId === "host" &&
      phase === "setup" &&
      gameStarted &&
      onlineSubmitted.host &&
      onlineSubmitted.guest
    ) {
      void maybeBroadcastOnlineResult();
    }
  }, [gameStarted, isOnlineMode, myLobbyPlayerId, onlineSubmitted.guest, onlineSubmitted.host, phase]);

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
    setJoinError("");
    setCopied(false);
    setMyLobbyPlayerId("guest");
    setLocalReady(false);
    setLobbyPlayers([]);
    setLobbyNotice("先把数字房间号填好，再进入准备室。");
  };

  const leaveModeSetup = () => {
    clearRoomChannel();
    clearCountdown();
    stopRollingEffects();
    setGameMode(null);
    setPhase("setup");
    setGameStarted(false);
    setRoomCode("");
    setJoinCode("");
    setJoinError("");
    setCopied(false);
    setLobbyPlayers([]);
    setMyLobbyPlayerId("host");
    setLocalReady(false);
    setOnlineGuessInput("");
    setOnlineGuesses({ host: "", guest: "" });
    setOnlineSubmitted({ host: false, guest: false });
    setRoundId("");
    setRoundStartedAt(null);
    setTimeLeftMs(ONLINE_LIMIT_MS);
    setWinner("");
    setLoser("");
    setShowResult(false);
    setCurrentStake(getStoredStake());
    setLobbyNotice("房主先准备，TA 进来后就能一起开战。");
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
      setJoinError("请输入 6 位数字房间号。");
      playInvalidActionSound(audioEnabled);
      return;
    }
    playUiSound("confirm", audioEnabled);
    setJoinError("");
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
      roundId: `round-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      stake: getStoredStake(),
    };

    playUiSound("confirm", audioEnabled);
    startOnlineRoundLocally(payload);
    await roomChannelRef.current.send({
      type: "broadcast",
      event: "match_start",
      payload,
    });
  };

  const submitOnlineGuess = async (forcedGuess?: string) => {
    if (!roomChannelRef.current || !gameStarted || phase !== "setup" || localSubmitted) {
      return;
    }

    const guessValue = (forcedGuess ?? onlineGuessInput).trim();
    if (getGuessNumber(guessValue) === null) {
      playInvalidActionSound(audioEnabled);
      return;
    }

    playUiSound("confirm", audioEnabled);
    setOnlineGuesses((current) => ({ ...current, [myLobbyPlayerId]: guessValue }));
    setOnlineSubmitted((current) => ({ ...current, [myLobbyPlayerId]: true }));

    await roomChannelRef.current.send({
      type: "broadcast",
      event: "guess_submit",
      payload: {
        roundId,
        playerId: myLobbyPlayerId,
        guess: guessValue,
      } satisfies OnlineGuessPayload,
    });
  };

  const resetOnlineRound = () => {
    stopRollingEffects();
    clearCountdown();
    setShowResult(false);
    setGameStarted(false);
    setPhase("setup");
    setDiceResults([1, 1, 1]);
    setWinner("");
    setLoser("");
    setLocalReady(false);
    setOnlineGuessInput("");
    setOnlineGuesses({ host: "", guest: "" });
    setOnlineSubmitted({ host: false, guest: false });
    setRoundId("");
    setRoundStartedAt(null);
    setTimeLeftMs(ONLINE_LIMIT_MS);
    setLobbyNotice("这一局结束了，双方重新准备就能再来。");
  };

  const rollOfflineDice = () => {
    const guess1 = getGuessNumber(player1.guess);
    const guess2 = getGuessNumber(player2.guess);

    if (guess1 === null || guess2 === null) {
      playInvalidActionSound(audioEnabled);
      alert("请输入 3 到 18 之间的点数");
      return;
    }

    stopRollingEffects();
    setPhase("rolling");
    const selectedStake = getStoredStake();
    setCurrentStake(selectedStake);
    stopRollingAudioRef.current = startDiceRollingLoop(audioEnabled);

    diceIntervalRef.current = window.setInterval(() => {
      setDiceResults([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    diceStopTimerRef.current = window.setTimeout(() => {
      stopRollingEffects();
      const finalDice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      setDiceResults(finalDice);
      playDiceRevealSound(audioEnabled);

      const total = finalDice.reduce((sum, value) => sum + value, 0);
      const diff1 = Math.abs(guess1 - total);
      const diff2 = Math.abs(guess2 - total);

      if (diff1 < diff2) {
        setWinner(player1.name);
        setLoser(player2.name);
        saveHistoryRecord(player2.name, selectedStake);
      } else if (diff2 < diff1) {
        setWinner(player2.name);
        setLoser(player1.name);
        saveHistoryRecord(player1.name, selectedStake);
      } else {
        setWinner("平局");
        setLoser("重新来过");
        playTieRoundSound(audioEnabled);
      }

      setPhase("result");
      window.setTimeout(() => setShowResult(true), 1500);
    }, 2000);
  };

  const resetOfflineGame = () => {
    stopRollingEffects();
    const nextNames = getStoredPlayerNames();
    setPlayer1({ name: nextNames.Kevin, guess: "" });
    setPlayer2({ name: nextNames.Demi, guess: "" });
    setActivePlayer(null);
    setPhase("setup");
    setDiceResults([1, 1, 1]);
    setShowResult(false);
    setWinner("");
    setLoser("");
    setCurrentStake(getStoredStake());
  };

  const renderDice = (value: number) => {
    const dots: Record<number, number[][]> = {
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
    };

    return (
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative border border-[#F1E8D4]" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="grid grid-cols-3 gap-1 p-2">
          {Array.from({ length: 9 }).map((_, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const hasDot = dots[value].some(([r, c]) => r === row && c === col);
            return <div key={index} className={`w-3 h-3 rounded-full ${hasDot ? "bg-[#1F2430]" : "bg-transparent"}`} />;
          })}
        </div>
      </div>
    );
  };

  const onlineResultCards = (
    <>
      <div className="rounded-2xl p-6 border" style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F5DA57" }}>
        <p className="mb-2" style={{ color: PALETTE.subInk }}>总点数</p>
        <p className="text-5xl font-bold" style={{ color: PALETTE.ink }}>
          {diceResults.reduce((sum, value) => sum + value, 0)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: hostTheme.pale, borderColor: hostTheme.tint }}>
          <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{hostLobbyPlayer?.nickname ?? "房主"}</p>
          <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>
            {onlineGuesses.host ? `猜 ${onlineGuesses.host}` : "未提交"}
          </p>
          <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
            差距{" "}
            {getGuessNumber(onlineGuesses.host) === null
              ? "∞"
              : Math.abs(getGuessNumber(onlineGuesses.host)! - diceResults.reduce((sum, value) => sum + value, 0))}
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: guestTheme.pale, borderColor: guestTheme.tint }}>
          <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{guestLobbyPlayer?.nickname ?? "加入者"}</p>
          <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>
            {onlineGuesses.guest ? `猜 ${onlineGuesses.guest}` : "未提交"}
          </p>
          <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
            差距{" "}
            {getGuessNumber(onlineGuesses.guest) === null
              ? "∞"
              : Math.abs(getGuessNumber(onlineGuesses.guest)! - diceResults.reduce((sum, value) => sum + value, 0))}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="骰子猜点" showBack showHistory />

      <div className="app-page-content">
        {gameMode === null && (
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(255,201,239,0.34), rgba(255,234,111,0.14) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback src="/images/dice-fight.png" alt="骰子猜点" className="h-20 w-20 rounded-3xl object-cover" />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  选择游戏模式
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  先选玩法，再开始今天这局
                </p>
              </motion.div>

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
                    description: "两个人轮流输入猜测，一起等骰子揭晓。",
                    badge: <Users className="h-6 w-6" />,
                    side: "🎲",
                    tint: PALETTE.yellow,
                    card: PALETTE.paleYellow,
                    border: "#F3E7A5",
                    onClick: () => {
                      playUiSound("confirm", audioEnabled);
                      setGameMode("offline");
                      setPhase("setup");
                      setCurrentStake(getStoredStake());
                    },
                  },
                  {
                    key: "create",
                    title: "创建房间",
                    description: "生成数字房间号，准备邀请好友加入。",
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
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-2xl border px-4 py-3"
              style={{ backgroundColor: "#FFFFFFB8", borderColor: "#FFFFFF" }}
            >
              <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>
                默认赌注现在走大皇帝逻辑
              </p>
              <p className="mt-1 text-[12px] leading-5" style={{ color: PALETTE.subInk }}>
                现在没改赌注的话，默认按“谁是大皇帝”结算，联机和线下都会沿用这套结果展示。
              </p>
            </motion.div>
          </div>
        )}

        {gameMode === "join" && !roomCode && (
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(255,201,239,0.34), rgba(255,234,111,0.14) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback src="/images/dice-fight.png" alt="骰子猜点" className="h-20 w-20 rounded-3xl object-cover" />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  选择游戏模式
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  先选玩法，再开始今天这局
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[1.65rem] border p-4 text-left"
                style={{ backgroundColor: PALETTE.palePink, borderColor: "#F3D3E8" }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: PALETTE.pink, color: PALETTE.ink }}>
                    <Link2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-black" style={{ color: PALETTE.ink }}>准备加入房间</p>
                    <p className="text-sm" style={{ color: PALETTE.subInk }}>先把数字房间号入口做好，后面直接接联机</p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#A56E90]">输入房间号</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={joinCode}
                    maxLength={6}
                    placeholder="例如 620518"
                    onChange={(event) => {
                      setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                      if (joinError) {
                        setJoinError("");
                      }
                    }}
                    className="w-full rounded-2xl border bg-white px-4 py-3 text-center text-lg font-black tracking-[0.18em] outline-none focus:ring-2 focus:ring-[#FFC9EF]"
                    style={{ borderColor: "#F2C7E3", color: PALETTE.ink }}
                  />
                </label>
                {joinError && (
                  <p className="mt-2 text-sm font-medium text-[#B64C88]">{joinError}</p>
                )}

                <div className="mt-3 rounded-2xl border bg-white/70 p-3" style={{ borderColor: "#F3D3E8" }}>
                  <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                    style={{
                      background: `linear-gradient(135deg, ${selfAvatar.soft} 0%, ${selfAvatar.solid} 100%)`,
                      borderColor: selfTheme.border,
                    }}
                  >
                    <AvatarBadge avatar={selfAvatar} alt={`${selfNickname}头像`} emojiClassName="text-[1.45rem]" />
                  </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>{selfNickname}</p>
                      <p className="text-xs" style={{ color: PALETTE.subInk }}>{selfRoleLabel}</p>
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
            </div>
          </div>
        )}

        {isOnlineMode && roomCode && !gameStarted && (
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(255,201,239,0.34), rgba(255,234,111,0.14) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback src="/images/dice-fight.png" alt="骰子猜点" className="h-20 w-20 rounded-3xl object-cover" />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  选择游戏模式
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  先选玩法，再开始今天这局
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[2rem] border px-5 py-5 text-center shadow-[0_18px_40px_rgba(31,36,48,0.08)]"
                style={{ backgroundColor: "#FFFFFFF5", borderColor: "#F0ECE0" }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: PALETTE.subInk }}>房间号</p>
                    <p className="mt-1 text-[2.15rem] font-black tracking-[0.12em]" style={{ color: PALETTE.ink }}>{roomCode}</p>
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95"
                    style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F3E7A5", color: PALETTE.ink }}
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>

                <div className="rounded-[1.7rem] border px-4 py-4" style={{ backgroundColor: "#FBFCFF", borderColor: "#E9EDF5" }}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="min-w-0 text-center">
                      <div
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(31,36,48,0.08)]"
                        style={{
                          background: `linear-gradient(135deg, ${(myLobbyPlayer ? getAvatarOptionById(myLobbyPlayer.avatarId, myLobbyPlayer.role === "female" ? 1 : 0) : selfAvatar).soft} 0%, ${(myLobbyPlayer ? getAvatarOptionById(myLobbyPlayer.avatarId, myLobbyPlayer.role === "female" ? 1 : 0) : selfAvatar).solid} 100%)`,
                          borderColor: ROLE_THEME[myLobbyPlayer?.role ?? selfRole].border,
                        }}
                      >
                        <AvatarBadge
                          avatar={myLobbyPlayer ? getAvatarOptionById(myLobbyPlayer.avatarId, myLobbyPlayer.role === "female" ? 1 : 0) : selfAvatar}
                          alt={`${myLobbyPlayer?.nickname ?? selfNickname}头像`}
                          emojiClassName="text-[2.15rem]"
                        />
                      </div>
                      <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                        {myLobbyPlayer?.nickname ?? selfNickname}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-1.5">
                        {myLobbyPlayer?.isHost && <Crown className="h-3.5 w-3.5" style={{ color: "#E99E34" }} />}
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: myLobbyPlayer?.isHost ? "#FFF1D4" : ROLE_THEME[myLobbyPlayer?.role ?? selfRole].badge,
                            color: myLobbyPlayer?.isHost ? "#B86A1E" : ROLE_THEME[myLobbyPlayer?.role ?? selfRole].accent,
                          }}
                        >
                          {myLobbyPlayer?.isHost ? "房主" : myLobbyPlayer?.role === "female" ? "女生" : "男生"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: myLobbyReady ? ROLE_THEME[myLobbyPlayer?.role ?? selfRole].accent : PALETTE.subInk }}>
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
                              background: `linear-gradient(135deg, ${getAvatarOptionById(rivalLobbyPlayer.avatarId, rivalLobbyPlayer.role === "female" ? 1 : 0).soft} 0%, ${getAvatarOptionById(rivalLobbyPlayer.avatarId, rivalLobbyPlayer.role === "female" ? 1 : 0).solid} 100%)`,
                              borderColor: ROLE_THEME[rivalLobbyPlayer.role].border,
                            }}
                          >
                            <AvatarBadge
                              avatar={getAvatarOptionById(rivalLobbyPlayer.avatarId, rivalLobbyPlayer.role === "female" ? 1 : 0)}
                              alt={`${rivalLobbyPlayer.nickname}头像`}
                              emojiClassName="text-[2.15rem]"
                            />
                          </div>
                          <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                            {rivalLobbyPlayer.nickname}
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            {rivalLobbyPlayer.isHost && <Crown className="h-3.5 w-3.5" style={{ color: "#E99E34" }} />}
                            <span
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                              style={{
                                backgroundColor: rivalLobbyPlayer.isHost ? "#FFF1D4" : ROLE_THEME[rivalLobbyPlayer.role].badge,
                                color: rivalLobbyPlayer.isHost ? "#B86A1E" : ROLE_THEME[rivalLobbyPlayer.role].accent,
                              }}
                            >
                              {rivalLobbyPlayer.isHost ? "房主" : rivalLobbyPlayer.role === "female" ? "女生" : "男生"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold" style={{ color: rivalSubmitted ? ROLE_THEME[rivalLobbyPlayer.role].accent : PALETTE.subInk }}>
                            {rivalLobbyPlayer.isReady ? "已准备" : "未准备"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: "#DFE3EC", color: "#C4CBD8", backgroundColor: "#FFFFFF" }}>
                            <span className="text-[2rem]">?</span>
                          </div>
                          <p className="mt-3 text-[1rem] font-bold" style={{ color: PALETTE.subInk }}>等待加入...</p>
                          <p className="mt-2 text-xs" style={{ color: "#A3AABA" }}>把数字房间号发给 TA</p>
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

                <button onClick={leaveModeSetup} className="mt-4 text-[1rem] font-semibold transition-colors" style={{ color: PALETTE.subInk }}>
                  离开房间
                </button>

                <p className="mt-4 text-sm leading-6" style={{ color: PALETTE.subInk }}>
                  {lobbyNotice}
                </p>
              </motion.div>
            </div>
          </div>
        )}

        {gameMode === "offline" && phase === "setup" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="app-page-center app-page-content--fit flex flex-col gap-4">
            <div className="relative h-36 rounded-[1.75rem] overflow-hidden border border-white/80">
              <ImageWithFallback src="/images/dice-fight.png" alt="骰子游戏" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-4">
                <p className="text-white font-bold text-base">猜猜三个骰子的总点数</p>
              </div>
            </div>

            <div className="app-page-stack app-page-stack--tight">
              <div className="rounded-[1.75rem] p-4 border transition-colors" style={{ backgroundColor: PALETTE.paleBlue, borderColor: activePlayer === "Kevin" ? PALETTE.blue : "#FFFFFF" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: PALETTE.blue }}>
                    {getPlayerInitial(player1.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[28px] leading-none" style={{ color: PALETTE.ink }}>{player1.name}</p>
                    <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>输入猜测分数 (3-18)</p>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border-2 px-4 py-2.5 transition-colors" style={{ backgroundColor: "#FFFFFF", borderColor: activePlayer === "Kevin" ? PALETTE.blue : "#E9EEF5" }}>
                  <input
                    type="number"
                    placeholder="输入数字"
                    min="3"
                    max="18"
                    value={player1.guess}
                    onFocus={() => setActivePlayer("Kevin")}
                    onBlur={() => setActivePlayer((current) => (current === "Kevin" ? null : current))}
                    onChange={(event) => setPlayer1({ ...player1, guess: event.target.value })}
                    className="w-full bg-transparent text-center text-2xl font-bold outline-none"
                    style={{ color: PALETTE.ink }}
                  />
                </div>
              </div>

              <div className="rounded-[1.75rem] p-4 border transition-colors" style={{ backgroundColor: PALETTE.palePink, borderColor: activePlayer === "Demi" ? PALETTE.pink : "#FFFFFF" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: PALETTE.pink }}>
                    {getPlayerInitial(player2.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[28px] leading-none" style={{ color: PALETTE.ink }}>{player2.name}</p>
                    <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>输入猜测分数 (3-18)</p>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border-2 px-4 py-2.5 transition-colors" style={{ backgroundColor: "#FFFFFF", borderColor: activePlayer === "Demi" ? PALETTE.pink : "#F5E8F1" }}>
                  <input
                    type="number"
                    placeholder="输入数字"
                    min="3"
                    max="18"
                    value={player2.guess}
                    onFocus={() => setActivePlayer("Demi")}
                    onBlur={() => setActivePlayer((current) => (current === "Demi" ? null : current))}
                    onChange={(event) => setPlayer2({ ...player2, guess: event.target.value })}
                    className="w-full bg-transparent text-center text-2xl font-bold outline-none"
                    style={{ color: PALETTE.ink }}
                  />
                </div>
              </div>
            </div>

            <Button size="md" onClick={rollOfflineDice} className="w-full">
              <Dices className="w-5 h-5 inline mr-2" />
              开启挑战
            </Button>

            <p className="text-center text-xs" style={{ color: PALETTE.subInk }}>
              点数范围：3-18 · 猜得最接近的人获胜
            </p>
          </motion.div>
        )}

        {isOnlineMode && gameStarted && phase === "setup" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="app-page-center app-page-content--fit flex flex-col gap-4">
            <div className="relative h-32 rounded-[1.75rem] overflow-hidden border border-white/80">
              <ImageWithFallback src="/images/dice-fight.png" alt="骰子游戏" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col items-center justify-end pb-3">
                <p className="text-white/80 text-xs mb-1 tracking-[0.2em] uppercase">Online Round</p>
                <p className="text-white font-black text-[1.35rem]">30 秒内提交你的猜测</p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border p-4" style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F3E7A5" }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: PALETTE.yellow }}>
                    <Clock3 className="h-6 w-6" style={{ color: PALETTE.ink }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: PALETTE.subInk }}>本轮倒计时</p>
                    <p className="text-[1.2rem] font-black" style={{ color: PALETTE.ink }}>
                      {countdownSeconds}s
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: PALETTE.subInk }}>
                    赌注
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: "#8F6C12" }}>
                    {currentStake}
                  </p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-white/90 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${countdownProgress * 100}%` }}
                  transition={{ duration: 0.18, ease: "linear" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: PALETTE.yellow }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.55rem] border p-4" style={{ backgroundColor: PALETTE.paleBlue, borderColor: "#D3E7F7" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border"
                    style={{
                      background: `linear-gradient(135deg, ${hostAvatar.soft} 0%, ${hostAvatar.solid} 100%)`,
                      borderColor: hostTheme.border,
                    }}
                  >
                    <AvatarBadge avatar={hostAvatar} alt={`${hostLobbyPlayer?.nickname ?? "房主"}头像`} emojiClassName="text-[1.35rem]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate" style={{ color: PALETTE.ink }}>{hostLobbyPlayer?.nickname ?? "房主"}</p>
                    <p className="text-xs mt-1" style={{ color: onlineSubmitted.host ? hostTheme.accent : PALETTE.subInk }}>
                      {onlineSubmitted.host ? `已提交 ${onlineGuesses.host}` : "等待提交"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.55rem] border p-4" style={{ backgroundColor: PALETTE.palePink, borderColor: "#F3D3E8" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border"
                    style={{
                      background: `linear-gradient(135deg, ${guestAvatar.soft} 0%, ${guestAvatar.solid} 100%)`,
                      borderColor: guestTheme.border,
                    }}
                  >
                    <AvatarBadge avatar={guestAvatar} alt={`${guestLobbyPlayer?.nickname ?? "加入者"}头像`} emojiClassName="text-[1.35rem]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate" style={{ color: PALETTE.ink }}>{guestLobbyPlayer?.nickname ?? "加入者"}</p>
                    <p className="text-xs mt-1" style={{ color: onlineSubmitted.guest ? guestTheme.accent : PALETTE.subInk }}>
                      {onlineSubmitted.guest ? `已提交 ${onlineGuesses.guest}` : "等待提交"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border p-4" style={{ backgroundColor: myLobbyPlayerId === "host" ? hostTheme.pale : guestTheme.pale, borderColor: myLobbyPlayerId === "host" ? hostTheme.tint : guestTheme.tint }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border"
                  style={{
                    background: `linear-gradient(135deg, ${(myLobbyPlayerId === "host" ? hostAvatar : guestAvatar).soft} 0%, ${(myLobbyPlayerId === "host" ? hostAvatar : guestAvatar).solid} 100%)`,
                    borderColor: myLobbyPlayerId === "host" ? hostTheme.border : guestTheme.border,
                  }}
                >
                  <AvatarBadge
                    avatar={myLobbyPlayerId === "host" ? hostAvatar : guestAvatar}
                    alt={`${myLobbyPlayer?.nickname ?? selfNickname}头像`}
                    emojiClassName="text-[1.35rem]"
                  />
                </div>
                <div>
                  <p className="font-bold text-[1.45rem] leading-none" style={{ color: PALETTE.ink }}>
                    {myLobbyPlayer?.nickname ?? selfNickname}
                  </p>
                  <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                    输入你猜的总点数 (3-18)
                  </p>
                </div>
              </div>
              <div className="rounded-[1.35rem] border-2 px-4 py-2.5 transition-colors" style={{ backgroundColor: "#FFFFFF", borderColor: myLobbyPlayerId === "host" ? hostTheme.tint : guestTheme.tint }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={localSubmitted ? currentOnlineGuessDisplay : "输入数字"}
                  min="3"
                  max="18"
                  value={localSubmitted ? currentOnlineGuessDisplay : onlineGuessInput}
                  onChange={(event) => setOnlineGuessInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  disabled={localSubmitted || timeLeftMs <= 0}
                  className="w-full bg-transparent text-center text-2xl font-bold outline-none disabled:text-[#98A0B3]"
                  style={{ color: PALETTE.ink }}
                />
              </div>
            </div>

            <Button
              size="md"
              onClick={() => void submitOnlineGuess()}
              className="w-full"
              disabled={localSubmitted || getGuessNumber(onlineGuessInput) === null || timeLeftMs <= 0}
            >
              <Dices className="w-5 h-5 inline mr-2" />
              {localSubmitted ? "已提交" : "提交猜测"}
            </Button>
          </motion.div>
        )}

        {(phase === "rolling" || phase === "result") && (gameMode === "offline" || isOnlineMode) && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="app-page-center text-center">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {phase === "rolling" ? "骰子滚动中..." : "开奖结果"}
              </h2>
              <div className="flex justify-center gap-4 mb-6">
                {diceResults.map((value, index) => (
                  <motion.div
                    key={index}
                    animate={phase === "rolling" ? { rotate: 360 } : {}}
                    transition={{ duration: 0.3, repeat: phase === "rolling" ? Infinity : 0 }}
                  >
                    {renderDice(value)}
                  </motion.div>
                ))}
              </div>
              {phase === "result" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {isOnlineMode ? (
                    onlineResultCards
                  ) : (
                    <>
                      <div className="rounded-2xl p-6 border" style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F5DA57" }}>
                        <p className="mb-2" style={{ color: PALETTE.subInk }}>总点数</p>
                        <p className="text-5xl font-bold" style={{ color: PALETTE.ink }}>
                          {diceResults.reduce((sum, value) => sum + value, 0)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl p-4 border" style={{ backgroundColor: PALETTE.paleBlue, borderColor: PALETTE.blue }}>
                          <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{player1.name}</p>
                          <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>猜 {player1.guess}</p>
                          <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                            差距 {Math.abs((getGuessNumber(player1.guess) ?? 0) - diceResults.reduce((sum, value) => sum + value, 0))}
                          </p>
                        </div>
                        <div className="rounded-2xl p-4 border" style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink }}>
                          <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{player2.name}</p>
                          <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>猜 {player2.guess}</p>
                          <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                            差距 {Math.abs((getGuessNumber(player2.guess) ?? 0) - diceResults.reduce((sum, value) => sum + value, 0))}
                          </p>
                        </div>
                      </div>

                      <Button size="lg" onClick={resetOfflineGame} className="w-full">
                        再来一局
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <ResultModal
        isOpen={showResult}
        onClose={isOnlineMode ? resetOnlineRound : () => setShowResult(false)}
        winner={winner}
        loser={loser}
        stake={currentStake}
        message={currentStake === "谁是大皇帝" ? "今天这把，你就是大皇帝！👑" : "愿赌服输，今天就靠你啦！💪"}
      />
    </div>
  );
}
