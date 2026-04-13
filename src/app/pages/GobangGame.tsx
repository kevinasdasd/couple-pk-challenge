import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, Bug, Copy, Crown, Dices, Link2, LogIn, Plus, SmilePlus, Users } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { SkillModal } from "../components/SkillModal";
import { DestinyModal } from "../components/DestinyModal";
import { useLocation, useNavigate } from "react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { DEFAULT_BGM_SOURCE, useBgm } from "../components/BgmProvider";
import { supabase } from "../../lib/supabase";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import {
  playAudioEffect,
  playDiceRevealSound,
  playFallbackSkillSound,
  playStonePlaceSound,
  playTieRoundSound,
  playUiSound,
  startDiceRollingLoop,
} from "../utils/soundEffects";
import { getStoredPlayerNames } from "../utils/playerSettings";
import { getStoredOnlinePlayerSettings, type OnlineRole } from "../utils/onlineSettings";
import { getAvatarOptionById } from "../utils/avatarOptions";

type GameMode = "offline" | "create" | "join" | null;
type Player = "Kevin" | "Demi";
type LobbyPlayerId = "host" | "guest";
type Cell = null | Player;
type Board = Cell[][];
type Coordinate = [number, number];
type SkillTier = "normal" | "strong" | "chaos" | "destiny";
type SkillKey =
  | "createStone"
  | "moveEnemyStone"
  | "lockZone"
  | "convertEnemyStone"
  | "deleteEnemyTwo"
  | "dropSelfTwo"
  | "crossBloom"
  | "worldUnity"
  | "starRain"
  | "tianyuanBlast"
  | "destinyWin";

interface SkillDefinition {
  key: SkillKey;
  tier: SkillTier;
  name: string;
  description: string;
}

interface BoardEffect {
  kind: "lockZone";
  top: number;
  left: number;
  size: number;
  blockedPlayer: Player;
}

type HighlightKind = "added" | "removed" | "from" | "to" | "converted" | "zone" | "area";

interface HighlightMark {
  row: number;
  col: number;
  kind: HighlightKind;
}

interface SkillHighlights {
  marks: HighlightMark[];
  expiresAtMove: number;
}

type PendingAction = "reset" | "home" | "back" | null;
type OpeningStage = "duel" | "board";
type DuelStatus = "rolling" | "tie" | "winner";
type EmojiMessage = {
  id: string;
  message_type: "emoji";
  content: string;
  sender: Player;
  senderName: string;
  createdAt: string;
  clientId: string;
};

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
  stake: string;
  duelDice: Record<Player, number>;
  startingPlayer: Player;
}

interface OnlineMoveRequestPayload {
  row: number;
  col: number;
  requesterId: LobbyPlayerId;
}

interface OnlineStateSyncRequestPayload {
  requesterClientId: string;
}

interface OnlineRematchRequestPayload {
  requesterId: LobbyPlayerId;
}

interface OnlineRematchAcceptPayload {
  requesterId: LobbyPlayerId;
  accepterId: LobbyPlayerId;
}

interface GobangSnapshot {
  generatedBy: string;
  board: Board;
  currentPlayer: Player;
  moveCount: number;
  skillEnergy: number;
  currentStake: string;
  currentSkillKey: SkillKey;
  skillOwner: Player;
  startingPlayer: Player;
  winner: Player | null;
  winningLine: Coordinate[];
  boardEffects: BoardEffect[];
  skillHighlights: SkillHighlights | null;
  destinyChance: number;
  boardNotice: string | null;
  destinyWinner: Player;
  destinyFillCount: number;
  destinyFillPlayer: Player;
  showSkillModal: boolean;
  showDestinyModal: boolean;
  showResultModal: boolean;
  openingStage: OpeningStage;
  duelStatus: DuelStatus;
  duelRound: number;
  duelWinner: Player | null;
  duelDice: Record<Player, number>;
}

interface GobangRoomSession {
  gameMode: Exclude<GameMode, null | "offline">;
  playerId: LobbyPlayerId;
}

const boardSize = 15;
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
  subInk: "#6B7280",
  line: "#E7DCA8",
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
const CENTER = Math.floor(boardSize / 2);
const BOARD_LAST_INDEX = boardSize - 1;
const HOSHI_OFFSET = 3;
const GO_FIVE_POINTS: Coordinate[] = [
  [HOSHI_OFFSET, HOSHI_OFFSET],
  [HOSHI_OFFSET, BOARD_LAST_INDEX - HOSHI_OFFSET],
  [BOARD_LAST_INDEX - HOSHI_OFFSET, HOSHI_OFFSET],
  [BOARD_LAST_INDEX - HOSHI_OFFSET, BOARD_LAST_INDEX - HOSHI_OFFSET],
  [CENTER, CENTER],
];
const DIRECTIONS: Coordinate[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const DIE_DOT_MAP: Record<number, Coordinate[]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const SKILL_DEFINITIONS: Record<SkillKey, SkillDefinition> = {
  createStone: {
    key: "createStone",
    tier: "normal",
    name: "无中生有",
    description: "随机空位生成 1 颗当前玩家棋子",
  },
  moveEnemyStone: {
    key: "moveEnemyStone",
    tier: "normal",
    name: "乾坤大挪移",
    description: "随机移动对方 1 颗棋子到另一个空位",
  },
  lockZone: {
    key: "lockZone",
    tier: "normal",
    name: "画地为牢",
    description: "随机生成一个 5x5 禁区，对手下一手不能落在其中",
  },
  convertEnemyStone: {
    key: "convertEnemyStone",
    tier: "normal",
    name: "偷天换日",
    description: "随机将对方 1 颗棋子变为当前玩家棋子",
  },
  deleteEnemyTwo: {
    key: "deleteEnemyTwo",
    tier: "strong",
    name: "降维打击",
    description: "随机删除对方 2 颗棋子（不足则全删）",
  },
  dropSelfTwo: {
    key: "dropSelfTwo",
    tier: "strong",
    name: "神兵天降",
    description: "随机空位直接生成 2 颗当前玩家棋子",
  },
  crossBloom: {
    key: "crossBloom",
    tier: "strong",
    name: "十字开花",
    description: "在天元十字线随机生成 3 颗当前玩家棋子",
  },
  worldUnity: {
    key: "worldUnity",
    tier: "strong",
    name: "天地大同",
    description: "围棋五点位（四星位+天元）强制变成当前玩家棋子",
  },
  starRain: {
    key: "starRain",
    tier: "chaos",
    name: "满天星",
    description: "随机空位直接生成 4 颗当前玩家棋子",
  },
  tianyuanBlast: {
    key: "tianyuanBlast",
    tier: "chaos",
    name: "天元震爆",
    description: "天元 5x5 内随机删对方 2 颗，再补 1 颗己方棋子",
  },
  destinyWin: {
    key: "destinyWin",
    tier: "destiny",
    name: "天命所归",
    description: "直接获得胜利",
  },
};

const SKILL_POOL_BY_TIER: Record<SkillTier, SkillKey[]> = {
  normal: ["createStone", "moveEnemyStone", "lockZone", "convertEnemyStone"],
  strong: ["deleteEnemyTwo", "dropSelfTwo", "crossBloom", "worldUnity"],
  chaos: ["starRain", "tianyuanBlast"],
  destiny: ["destinyWin"],
};

const SKILL_SOUND_MAP: Partial<Record<SkillKey, string>> = {
  createStone: "/sounds/wuzhongshengyou.mp3",
  moveEnemyStone: "/sounds/qiankundanuoyi.mp3",
  lockZone: "/sounds/huadiweilao.mp3",
  convertEnemyStone: "/sounds/toutianhuanri.mp3",
  deleteEnemyTwo: "/sounds/jiangweidaji.mp3",
  dropSelfTwo: "/sounds/shenbingtianjiang.mp3",
  crossBloom: "/sounds/shizikaihua.mp3",
  worldUnity: "/sounds/tiandidatong.mp3",
  starRain: "/sounds/mantianxing.mp3",
  tianyuanBlast: "/sounds/tianyuanzhenbao.mp3",
  destinyWin: "/sounds/tianmingsuogui.mp3",
};

const BOARD_LINE_WIDTH = 1.5;
const STONE_SCALE = 0.9;
const PENDING_MARK_SCALE = 0.82;
const BLOCKED_MARK_SCALE = 0.8;
const HIGHLIGHT_MARK_SCALE = 0.86;
const STAR_POINT_SCALE = 0.16;
const STATUS_CIRCLE_SIZE = 56;
const SKILL_RING_CENTER = STATUS_CIRCLE_SIZE / 2;
const SKILL_RING_RADIUS = 22;
const SKILL_RING_CIRCUMFERENCE = 2 * Math.PI * SKILL_RING_RADIUS;
const LOCK_ZONE_SIZE = 5;
const DESTINY_FILL_STEP = boardSize;
const DESTINY_FILL_INTERVAL_MS = 78;
const DESTINY_MODAL_SHOW_DELAY_MS = 180;
const SHARED_SKILL_TIER_CONFIG = {
  strong: 28,
  chaos: 16,
  destinyBase: 1,
  destinyIncrement: 1.5,
  destinyMax: 8.5,
} as const;
const EMOJI_PRESETS = ["🫵🏻🤡", "🧠❓", "🐶💨", "👉🏻🤡👈🏻", "😎😎😎", "🤣🤣🤣", "😤😤😤", "😡😡😡", "🤬❓"] as const;
const EMOJI_DISPLAY_MS = 2500;
const EMOJI_COOLDOWN_MS = 2000;
const SKILL_MODAL_AUTO_CLOSE_MS = 2000;
const GOBANG_ROOM_SESSION_PREFIX = "gobang-room-session:";
const GOBANG_ROOM_STATE_PREFIX = "gobang-room-state:";

const PLAYER_THEME: Record<
  Player,
  {
    card: string;
    border: string;
    badge: string;
    accent: string;
    avatarBorder: string;
    avatarGlow: string;
  }
> = {
  Kevin: {
    card: PALETTE.paleBlue,
    border: PALETTE.blue,
    badge: "#EAF5FF",
    accent: "#4E8ABB",
    avatarBorder: "#90C3F4",
    avatarGlow: "0 14px 34px rgba(171, 215, 250, 0.34)",
  },
  Demi: {
    card: PALETTE.palePink,
    border: PALETTE.pink,
    badge: "#FFF1FA",
    accent: "#BE7BA7",
    avatarBorder: "#F2B8DF",
    avatarGlow: "0 14px 34px rgba(255, 201, 239, 0.34)",
  },
};

function generateRoomCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function getStoredGobangRoomSession(roomId: string): GobangRoomSession | null {
  if (typeof window === "undefined" || !roomId) return null;
  try {
    const raw = window.localStorage.getItem(`${GOBANG_ROOM_SESSION_PREFIX}${roomId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GobangRoomSession>;
    if (parsed.gameMode !== "create" && parsed.gameMode !== "join") {
      return null;
    }
    return {
      gameMode: parsed.gameMode,
      playerId: parsed.playerId === "guest" ? "guest" : "host",
    };
  } catch {
    return null;
  }
}

function saveGobangRoomSession(roomId: string, session: GobangRoomSession) {
  if (typeof window === "undefined" || !roomId) return;
  window.localStorage.setItem(`${GOBANG_ROOM_SESSION_PREFIX}${roomId}`, JSON.stringify(session));
}

function clearGobangRoomSession(roomId: string) {
  if (typeof window === "undefined" || !roomId) return;
  window.localStorage.removeItem(`${GOBANG_ROOM_SESSION_PREFIX}${roomId}`);
}

function getStoredGobangSnapshot(roomId: string): GobangSnapshot | null {
  if (typeof window === "undefined" || !roomId) return null;
  try {
    const raw = window.localStorage.getItem(`${GOBANG_ROOM_STATE_PREFIX}${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as GobangSnapshot;
  } catch {
    return null;
  }
}

function saveGobangSnapshot(roomId: string, snapshot: GobangSnapshot) {
  if (typeof window === "undefined" || !roomId) return;
  window.localStorage.setItem(`${GOBANG_ROOM_STATE_PREFIX}${roomId}`, JSON.stringify(snapshot));
}

function clearGobangSnapshot(roomId: string) {
  if (typeof window === "undefined" || !roomId) return;
  window.localStorage.removeItem(`${GOBANG_ROOM_STATE_PREFIX}${roomId}`);
}

const createEmptyBoard = (): Board =>
  Array(boardSize)
    .fill(null)
    .map(() => Array(boardSize).fill(null));

const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

const getOpponent = (player: Player): Player => (player === "Kevin" ? "Demi" : "Kevin");

const isInsideBoard = (row: number, col: number) =>
  row >= 0 && row < boardSize && col >= 0 && col < boardSize;

const pickOne = <T,>(items: T[]): T | null => {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
};

const sampleMany = <T,>(items: T[], count: number): T[] => {
  if (!items.length || count <= 0) return [];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
};

const pickByWeight = <T,>(items: Array<{ item: T; weight: number }>): T => {
  const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of items) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return items[items.length - 1].item;
};

const getCells = (
  board: Board,
  predicate: (cell: Cell, row: number, col: number) => boolean
): Coordinate[] => {
  const cells: Coordinate[] = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (predicate(board[row][col], row, col)) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
};

const getCellsInSquare = (top: number, left: number, size: number): Coordinate[] => {
  const cells: Coordinate[] = [];
  for (let row = top; row < top + size; row++) {
    for (let col = left; col < left + size; col++) {
      if (isInsideBoard(row, col)) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
};

const isCellInBoardEffect = (effect: BoardEffect, row: number, col: number) =>
  row >= effect.top &&
  row < effect.top + effect.size &&
  col >= effect.left &&
  col < effect.left + effect.size;

const getLineFromMove = (board: Board, row: number, col: number, player: Player): Coordinate[] | null => {
  for (const [dx, dy] of DIRECTIONS) {
    const line: Coordinate[] = [[row, col]];
    let nextRow = row + dx;
    let nextCol = col + dy;

    while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === player) {
      line.push([nextRow, nextCol]);
      nextRow += dx;
      nextCol += dy;
    }

    nextRow = row - dx;
    nextCol = col - dy;
    while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === player) {
      line.unshift([nextRow, nextCol]);
      nextRow -= dx;
      nextCol -= dy;
    }

    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }

  return null;
};

const findLineForPlayer = (board: Board, player: Player): Coordinate[] | null => {
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (board[row][col] !== player) continue;

      for (const [dx, dy] of DIRECTIONS) {
        const prevRow = row - dx;
        const prevCol = col - dy;
        if (isInsideBoard(prevRow, prevCol) && board[prevRow][prevCol] === player) {
          continue;
        }

        const line: Coordinate[] = [];
        let nextRow = row;
        let nextCol = col;
        while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === player) {
          line.push([nextRow, nextCol]);
          nextRow += dx;
          nextCol += dy;
        }

        if (line.length >= 5) {
          return line.slice(0, 5);
        }
      }
    }
  }

  return null;
};

const checkBoardWinner = (board: Board, priorityPlayer?: Player): { winner: Player | null; line: Coordinate[] } => {
  const kevinLine = findLineForPlayer(board, "Kevin");
  const demiLine = findLineForPlayer(board, "Demi");

  if (!kevinLine && !demiLine) {
    return { winner: null, line: [] };
  }

  if (kevinLine && demiLine) {
    if (priorityPlayer === "Demi") {
      return { winner: "Demi", line: demiLine };
    }
    return { winner: "Kevin", line: kevinLine };
  }

  if (kevinLine) return { winner: "Kevin", line: kevinLine };
  return { winner: "Demi", line: demiLine || [] };
};

const getSkillTierWeights = (destinyChance: number) => {
  const destinyWeight = Math.max(
    SHARED_SKILL_TIER_CONFIG.destinyBase,
    Math.min(destinyChance, SHARED_SKILL_TIER_CONFIG.destinyMax)
  );
  const normalWeight = 100 - SHARED_SKILL_TIER_CONFIG.strong - SHARED_SKILL_TIER_CONFIG.chaos - destinyWeight;

  return [
    { tier: "normal" as const, weight: normalWeight },
    { tier: "strong" as const, weight: SHARED_SKILL_TIER_CONFIG.strong },
    { tier: "chaos" as const, weight: SHARED_SKILL_TIER_CONFIG.chaos },
    { tier: "destiny" as const, weight: destinyWeight },
  ];
};

const rollSkillTier = (destinyChance: number): SkillTier =>
  pickByWeight(getSkillTierWeights(destinyChance).map((entry) => ({ item: entry.tier, weight: entry.weight })));

const rollSkillKey = (destinyChance: number): SkillKey => {
  const tier = rollSkillTier(destinyChance);
  return pickOne(SKILL_POOL_BY_TIER[tier]) || "createStone";
};

const HIGHLIGHT_PRIORITY: Record<HighlightKind, number> = {
  area: 0,
  zone: 1,
  from: 2,
  to: 3,
  converted: 4,
  removed: 5,
  added: 6,
};

const HIGHLIGHT_CLASS_MAP: Record<HighlightKind, string> = {
  added: "border-2 border-[#C9F100] bg-[#F9FEE5]",
  removed: "border-2 border-red-500 bg-red-200/35",
  from: "border-2 border-dashed border-[#ABD7FA] bg-[#F6FBFE]",
  to: "border-2 border-[#ABD7FA] bg-[#F6FBFE]",
  converted: "border-2 border-[#FFC9EF] bg-[#FFF9FD]",
  zone: "border-2 border-[#94A3B8] bg-[#E2E8F0]/70",
  area: "border border-purple-500 bg-purple-200/15",
};

const STONE_HALO_KINDS: HighlightKind[] = ["added", "to", "converted"];

const STONE_HALO_STYLE_MAP: Record<
  Extract<HighlightKind, "added" | "to" | "converted">,
  { borderColor: string; glow: string }
> = {
  added: {
    borderColor: "#C9F100",
    glow: "0 0 0 3px rgba(201, 241, 0, 0.28), 0 0 18px rgba(201, 241, 0, 0.32)",
  },
  to: {
    borderColor: "#ABD7FA",
    glow: "0 0 0 3px rgba(171, 215, 250, 0.3), 0 0 18px rgba(171, 215, 250, 0.34)",
  },
  converted: {
    borderColor: "#FFC9EF",
    glow: "0 0 0 3px rgba(255, 201, 239, 0.3), 0 0 18px rgba(255, 201, 239, 0.34)",
  },
};

const createLockZoneEffect = (player: Player): BoardEffect => ({
  kind: "lockZone",
  top: Math.floor(Math.random() * (boardSize - LOCK_ZONE_SIZE + 1)),
  left: Math.floor(Math.random() * (boardSize - LOCK_ZONE_SIZE + 1)),
  size: LOCK_ZONE_SIZE,
  blockedPlayer: getOpponent(player),
});

const isCellBlockedByBoardEffects = (effects: BoardEffect[], player: Player, row: number, col: number) =>
  effects.some((effect) => effect.blockedPlayer === player && isCellInBoardEffect(effect, row, col));

const rollDie = () => Math.floor(Math.random() * 6) + 1;

function DuelDie({
  value,
  player,
  rolling,
  isWinner,
}: {
  value: number;
  player: Player;
  rolling: boolean;
  isWinner: boolean;
}) {
  const toneClass =
    player === "Kevin"
      ? "from-[#ABD7FA] to-[#8FC8F7] text-[#4F88B8]"
      : "from-[#FFC9EF] to-[#F7B7E6] text-[#BA6EA0]";

  return (
    <motion.div
      animate={
        rolling
          ? { rotate: [0, 180, 360], scale: [1, 1.08, 1] }
          : isWinner
          ? { scale: [1, 1.06, 1] }
          : { scale: 1 }
      }
      transition={{
        duration: rolling ? 0.55 : 0.8,
        repeat: rolling || isWinner ? Infinity : 0,
        ease: "easeInOut",
      }}
      className={`w-24 h-24 sm:w-28 sm:h-28 rounded-[1.7rem] sm:rounded-[2rem] bg-gradient-to-br ${toneClass} p-[3px] border border-white/70`}
    >
      <div className="w-full h-full rounded-[1.5rem] sm:rounded-[1.8rem] bg-white flex items-center justify-center">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {Array.from({ length: 9 }).map((_, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const hasDot = DIE_DOT_MAP[value].some(([r, c]) => r === row && c === col);
            return (
              <div
                key={index}
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${hasDot ? "bg-current" : "bg-transparent"}`}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

const applySkill = (
  board: Board,
  player: Player,
  skillKey: SkillKey
): {
  board: Board;
  newBoardEffect: BoardEffect | null;
  destinyWin: boolean;
  highlightMarks: HighlightMark[];
} => {
  const workingBoard = cloneBoard(board);
  const opponent = getOpponent(player);
  let newBoardEffect: BoardEffect | null = null;
  let destinyWin = false;
  const highlightMarks: HighlightMark[] = [];

  const markCells = (cells: Coordinate[], kind: HighlightKind) => {
    cells.forEach(([row, col]) => {
      highlightMarks.push({ row, col, kind });
    });
  };

  switch (skillKey) {
    case "createStone": {
      const emptyCells = getCells(workingBoard, (cell) => cell === null);
      const target = pickOne(emptyCells);
      if (target) {
        const [row, col] = target;
        workingBoard[row][col] = player;
        markCells([target], "added");
      }
      break;
    }
    case "moveEnemyStone": {
      const enemyCells = getCells(workingBoard, (cell) => cell === opponent);
      const emptyCells = getCells(workingBoard, (cell) => cell === null);
      const from = pickOne(enemyCells);
      const to = pickOne(emptyCells);
      if (from && to) {
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        workingBoard[fromRow][fromCol] = null;
        workingBoard[toRow][toCol] = opponent;
        markCells([from], "from");
        markCells([to], "to");
      }
      break;
    }
    case "lockZone": {
      newBoardEffect = createLockZoneEffect(player);
      break;
    }
    case "convertEnemyStone": {
      const enemyCells = getCells(workingBoard, (cell) => cell === opponent);
      const target = pickOne(enemyCells);
      if (target) {
        const [row, col] = target;
        workingBoard[row][col] = player;
        markCells([target], "converted");
      }
      break;
    }
    case "deleteEnemyTwo": {
      const enemyCells = getCells(workingBoard, (cell) => cell === opponent);
      const targets = sampleMany(enemyCells, 2);
      targets.forEach(([row, col]) => {
        workingBoard[row][col] = null;
      });
      markCells(targets, "removed");
      break;
    }
    case "dropSelfTwo": {
      const emptyCells = getCells(workingBoard, (cell) => cell === null);
      const targets = sampleMany(emptyCells, 2);
      targets.forEach(([row, col]) => {
        workingBoard[row][col] = player;
      });
      markCells(targets, "added");
      break;
    }
    case "crossBloom": {
      const crossCells = getCells(
        workingBoard,
        (cell, row, col) => cell === null && (row === CENTER || col === CENTER)
      );
      const targets = sampleMany(crossCells, 3);
      targets.forEach(([row, col]) => {
        workingBoard[row][col] = player;
      });
      markCells(targets, "added");
      break;
    }
    case "worldUnity": {
      GO_FIVE_POINTS.forEach(([row, col]) => {
        workingBoard[row][col] = player;
      });
      markCells(GO_FIVE_POINTS, "converted");
      break;
    }
    case "starRain": {
      const emptyCells = getCells(workingBoard, (cell) => cell === null);
      const targets = sampleMany(emptyCells, 4);
      targets.forEach(([row, col]) => {
        workingBoard[row][col] = player;
      });
      markCells(targets, "added");
      break;
    }
    case "tianyuanBlast": {
      const areaCells: Coordinate[] = [];
      for (let row = CENTER - 2; row <= CENTER + 2; row++) {
        for (let col = CENTER - 2; col <= CENTER + 2; col++) {
          areaCells.push([row, col]);
        }
      }
      markCells(areaCells, "area");

      const enemyCells = areaCells.filter(([row, col]) => workingBoard[row][col] === opponent);
      const deleteTargets = sampleMany(enemyCells, 2);
      deleteTargets.forEach(([row, col]) => {
        workingBoard[row][col] = null;
      });
      markCells(deleteTargets, "removed");

      const emptyCells = areaCells.filter(([row, col]) => workingBoard[row][col] === null);
      const addTarget = pickOne(emptyCells);
      if (addTarget) {
        const [row, col] = addTarget;
        workingBoard[row][col] = player;
        markCells([addTarget], "added");
      }
      break;
    }
    case "destinyWin": {
      destinyWin = true;
      break;
    }
    default:
      break;
  }

  return { board: workingBoard, newBoardEffect, destinyWin, highlightMarks };
};

export default function GobangGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRoomId = new URLSearchParams(location.search).get("room")?.trim().toUpperCase() ?? "";
  const restoredRoomSession = getStoredGobangRoomSession(searchRoomId);
  const { setTrack, enabled: audioEnabled } = useBgm();
  const [playerNames] = useState(() => getStoredPlayerNames());
  const [onlineProfile] = useState(() => getStoredOnlinePlayerSettings());
  const [gameMode, setGameMode] = useState<GameMode>(restoredRoomSession?.gameMode ?? (searchRoomId ? "join" : null));
  const [gameStarted, setGameStarted] = useState(false);
  const [roomCode, setRoomCode] = useState(searchRoomId);
  const [joinCode, setJoinCode] = useState(searchRoomId);
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [myLobbyPlayerId, setMyLobbyPlayerId] = useState<LobbyPlayerId>(restoredRoomSession?.playerId ?? "guest");
  const [localReady, setLocalReady] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const [lobbyNotice, setLobbyNotice] = useState("房主先准备，TA 进来后就能一起开战。");
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("Kevin");
  const [moveCount, setMoveCount] = useState(0);
  const [skillEnergy, setSkillEnergy] = useState(0);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showDestinyModal, setShowDestinyModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [rematchRequesterId, setRematchRequesterId] = useState<LobbyPlayerId | null>(null);
  const [currentStake, setCurrentStake] = useState("谁是大皇帝");
  const [currentSkill, setCurrentSkill] = useState<SkillDefinition>(SKILL_DEFINITIONS.createStone);
  const [skillOwner, setSkillOwner] = useState<Player>("Kevin");
  const [startingPlayer, setStartingPlayer] = useState<Player>("Kevin");
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<Coordinate[]>([]);
  const [boardEffects, setBoardEffects] = useState<BoardEffect[]>([]);
  const [skillHighlights, setSkillHighlights] = useState<SkillHighlights | null>(null);
  const [destinyChance, setDestinyChance] = useState(SHARED_SKILL_TIER_CONFIG.destinyBase);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);
  const [destinyWinner, setDestinyWinner] = useState<Player>("Kevin");
  const [destinyFillCount, setDestinyFillCount] = useState(0);
  const [destinyFillPlayer, setDestinyFillPlayer] = useState<Player>("Kevin");
  const [showEmojiSheet, setShowEmojiSheet] = useState(false);
  const [activeEmoji, setActiveEmoji] = useState<EmojiMessage | null>(null);
  const [emojiCooldownUntil, setEmojiCooldownUntil] = useState(0);
  const [remoteMoveHighlight, setRemoteMoveHighlight] = useState<Coordinate | null>(null);
  const destinyFillIntervalRef = useRef<number | null>(null);
  const destinyModalTimerRef = useRef<number | null>(null);
  const areaHighlightTimerRef = useRef<number | null>(null);
  const boardNoticeTimerRef = useRef<number | null>(null);
  const emojiDisplayTimerRef = useRef<number | null>(null);
  const emojiCooldownTimerRef = useRef<number | null>(null);
  const remoteMoveHighlightTimerRef = useRef<number | null>(null);
  const emojiChannelRef = useRef<RealtimeChannel | null>(null);
  const emojiClientIdRef = useRef(`emoji-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const roomClientIdRef = useRef(`gobang-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const joinValidationTimerRef = useRef<number | null>(null);
  const executeMoveRef = useRef<(row: number, col: number) => void>(() => undefined);
  const buildSnapshotRef = useRef<() => GobangSnapshot>(() => {
    throw new Error("snapshot not ready");
  });
  const applySnapshotRef = useRef<(snapshot: GobangSnapshot) => void>(() => undefined);
  const currentPlayerRef = useRef<Player>("Kevin");
  const winnerRef = useRef<Player | null>(null);
  const openingStageRef = useRef<OpeningStage>("duel");
  const gameStartedRef = useRef(false);
  const lastBroadcastSnapshotRef = useRef("");

  const isDebugMode = import.meta.env.DEV;
  const [debugForceEveryMoveSkill, setDebugForceEveryMoveSkill] = useState(false);
  const [debugForcedSkillKey, setDebugForcedSkillKey] = useState<SkillKey | "">("");
  const [pendingMove, setPendingMove] = useState<Coordinate | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [openingStage, setOpeningStage] = useState<OpeningStage>("duel");
  const [duelStatus, setDuelStatus] = useState<DuelStatus>("rolling");
  const [duelRound, setDuelRound] = useState(1);
  const [duelWinner, setDuelWinner] = useState<Player | null>(null);
  const [duelDice, setDuelDice] = useState<Record<Player, number>>({
    Kevin: 1,
    Demi: 1,
  });
  const duelIntervalRef = useRef<number | null>(null);
  const duelStopTimerRef = useRef<number | null>(null);
  const duelNextRoundTimerRef = useRef<number | null>(null);
  const stopDuelRollingAudioRef = useRef<(() => void) | null>(null);

  const clearDestinyTimers = () => {
    if (destinyFillIntervalRef.current !== null) {
      window.clearInterval(destinyFillIntervalRef.current);
      destinyFillIntervalRef.current = null;
    }
    if (destinyModalTimerRef.current !== null) {
      window.clearTimeout(destinyModalTimerRef.current);
      destinyModalTimerRef.current = null;
    }
  };

  const clearAreaHighlightTimer = () => {
    if (areaHighlightTimerRef.current !== null) {
      window.clearTimeout(areaHighlightTimerRef.current);
      areaHighlightTimerRef.current = null;
    }
  };

  const clearBoardNoticeTimer = () => {
    if (boardNoticeTimerRef.current !== null) {
      window.clearTimeout(boardNoticeTimerRef.current);
      boardNoticeTimerRef.current = null;
    }
  };

  const clearEmojiDisplayTimer = () => {
    if (emojiDisplayTimerRef.current !== null) {
      window.clearTimeout(emojiDisplayTimerRef.current);
      emojiDisplayTimerRef.current = null;
    }
  };

  const clearEmojiCooldownTimer = () => {
    if (emojiCooldownTimerRef.current !== null) {
      window.clearTimeout(emojiCooldownTimerRef.current);
      emojiCooldownTimerRef.current = null;
    }
  };

  const clearRemoteMoveHighlightTimer = () => {
    if (remoteMoveHighlightTimerRef.current !== null) {
      window.clearTimeout(remoteMoveHighlightTimerRef.current);
      remoteMoveHighlightTimerRef.current = null;
    }
  };

  const clearRematchState = () => {
    setRematchRequesterId(null);
  };

  const showRemoteMoveHighlight = (row: number, col: number) => {
    clearRemoteMoveHighlightTimer();
    setRemoteMoveHighlight([row, col]);
    remoteMoveHighlightTimerRef.current = window.setTimeout(() => {
      setRemoteMoveHighlight(null);
      remoteMoveHighlightTimerRef.current = null;
    }, 2200);
  };

  const clearJoinValidationTimer = () => {
    if (joinValidationTimerRef.current !== null) {
      window.clearTimeout(joinValidationTimerRef.current);
      joinValidationTimerRef.current = null;
    }
  };

  const showBoardNotice = (message: string) => {
    clearBoardNoticeTimer();
    setBoardNotice(message);
    boardNoticeTimerRef.current = window.setTimeout(() => {
      setBoardNotice(null);
      boardNoticeTimerRef.current = null;
    }, 1400);
  };

  const clearDuelTimers = () => {
    if (stopDuelRollingAudioRef.current) {
      stopDuelRollingAudioRef.current();
      stopDuelRollingAudioRef.current = null;
    }
    if (duelIntervalRef.current !== null) {
      window.clearInterval(duelIntervalRef.current);
      duelIntervalRef.current = null;
    }
    if (duelStopTimerRef.current !== null) {
      window.clearTimeout(duelStopTimerRef.current);
      duelStopTimerRef.current = null;
    }
    if (duelNextRoundTimerRef.current !== null) {
      window.clearTimeout(duelNextRoundTimerRef.current);
      duelNextRoundTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearDestinyTimers();
      clearDuelTimers();
      clearAreaHighlightTimer();
      clearBoardNoticeTimer();
      clearEmojiDisplayTimer();
      clearEmojiCooldownTimer();
      clearJoinValidationTimer();
    };
  }, []);

  useEffect(() => {
    setTrack("/sounds/minecraft.mp3");
    return () => {
      setTrack(DEFAULT_BGM_SOURCE);
    };
  }, [setTrack]);

  useEffect(() => {
    if (openingStage !== "board") {
      setShowEmojiSheet(false);
    }
  }, [openingStage]);

  const roomId = roomCode.trim().toUpperCase();
  const isOnlineMode = gameMode === "create" || gameMode === "join";
  const selfRole = onlineProfile.role;
  const selfAvatarId = selfRole === "female" ? onlineProfile.femaleAvatarId : onlineProfile.maleAvatarId;
  const fallbackOpponentRole: OnlineRole = selfRole === "female" ? "male" : "female";
  const fallbackOpponentAvatarId =
    fallbackOpponentRole === "female" ? onlineProfile.femaleAvatarId : onlineProfile.maleAvatarId;
  const selfNickname = onlineProfile.nickname || (selfRole === "female" ? playerNames.Demi : playerNames.Kevin);
  const selfAvatar = getAvatarOptionById(selfAvatarId, selfRole === "female" ? 1 : 0);
  const fallbackOpponentAvatar = getAvatarOptionById(fallbackOpponentAvatarId, fallbackOpponentRole === "female" ? 1 : 0);
  const myLobbyPlayer = lobbyPlayers.find((player) => player.id === myLobbyPlayerId) ?? null;
  const rivalLobbyPlayer = lobbyPlayers.find((player) => player.id !== myLobbyPlayerId) ?? null;
  const hostLobbyPlayer = lobbyPlayers.find((player) => player.id === "host") ?? null;
  const guestLobbyPlayer = lobbyPlayers.find((player) => player.id === "guest") ?? null;
  const effectiveHostReady = hostLobbyPlayer?.isReady ?? (myLobbyPlayerId === "host" ? localReady : false);
  const effectiveGuestReady = guestLobbyPlayer?.isReady ?? (myLobbyPlayerId === "guest" ? localReady : false);
  const myLobbyReady = myLobbyPlayerId === "host" ? effectiveHostReady : effectiveGuestReady;
  const hasHostSeat = !!hostLobbyPlayer || myLobbyPlayerId === "host";
  const hasGuestSeat = !!guestLobbyPlayer || myLobbyPlayerId === "guest";
  const everyoneReady = hasHostSeat && hasGuestSeat && effectiveHostReady && effectiveGuestReady;
  const canHostStartMatch = isOnlineMode && everyoneReady && myLobbyPlayerId === "host" && roomConnected;
  const waitingForHostStart = isOnlineMode && everyoneReady && myLobbyPlayerId === "guest";
  const incomingRematchRequest =
    isOnlineMode && !!rematchRequesterId && rematchRequesterId !== myLobbyPlayerId;
  const waitingForRematchAccept = isOnlineMode && rematchRequesterId === myLobbyPlayerId;
  const displayPlayerNames = roomId
    ? {
        Kevin: hostLobbyPlayer?.nickname ?? (myLobbyPlayerId === "host" ? selfNickname : "房主"),
        Demi: guestLobbyPlayer?.nickname ?? (myLobbyPlayerId === "guest" ? selfNickname : "加入者"),
      }
    : playerNames;
  const avatarByPlayer = roomId
    ? {
        Kevin: hostLobbyPlayer
          ? getAvatarOptionById(hostLobbyPlayer.avatarId, hostLobbyPlayer.role === "female" ? 1 : 0)
          : myLobbyPlayerId === "host"
            ? selfAvatar
            : fallbackOpponentAvatar,
        Demi: guestLobbyPlayer
          ? getAvatarOptionById(guestLobbyPlayer.avatarId, guestLobbyPlayer.role === "female" ? 1 : 0)
          : myLobbyPlayerId === "guest"
            ? selfAvatar
            : fallbackOpponentAvatar,
      }
    : {
        Kevin: getAvatarOptionById(onlineProfile.maleAvatarId, 0),
        Demi: getAvatarOptionById(onlineProfile.femaleAvatarId, 1),
      };
  const localEmojiSender: Player = roomId ? (myLobbyPlayerId === "host" ? "Kevin" : "Demi") : currentPlayer;
  const onlineTurnOwnerId: LobbyPlayerId = currentPlayer === "Kevin" ? "host" : "guest";
  const isMyOnlineTurn = !roomId || myLobbyPlayerId === onlineTurnOwnerId;

  const showEmojiBubble = (message: EmojiMessage) => {
    clearEmojiDisplayTimer();
    setActiveEmoji(message);
    emojiDisplayTimerRef.current = window.setTimeout(() => {
      setActiveEmoji(null);
      emojiDisplayTimerRef.current = null;
    }, EMOJI_DISPLAY_MS);
  };

  useEffect(() => {
    if (!roomId) {
      if (emojiChannelRef.current) {
        void supabase.removeChannel(emojiChannelRef.current);
        emojiChannelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(`gobang-emoji-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "emoji" }, ({ payload }) => {
      const message = payload as EmojiMessage;
      if (!message || message.clientId === emojiClientIdRef.current || message.message_type !== "emoji") {
        return;
      }
      showEmojiBubble(message);
    });

    void channel.subscribe();
    emojiChannelRef.current = channel;

    return () => {
      if (emojiChannelRef.current === channel) {
        emojiChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const startOpeningRoll = (round = 1) => {
    clearDuelTimers();
    setOpeningStage("duel");
    setDuelStatus("rolling");
    setDuelRound(round);
    setDuelWinner(null);
    setPendingMove(null);
    setPendingAction(null);
    stopDuelRollingAudioRef.current = startDiceRollingLoop(audioEnabled, 170);

    duelIntervalRef.current = window.setInterval(() => {
      setDuelDice({
        Kevin: rollDie(),
        Demi: rollDie(),
      });
    }, 110);

    duelStopTimerRef.current = window.setTimeout(() => {
      const finalDice = {
        Kevin: rollDie(),
        Demi: rollDie(),
      };
      setDuelDice(finalDice);
      clearDuelTimers();
      playDiceRevealSound(audioEnabled);

      if (finalDice.Kevin === finalDice.Demi) {
        setDuelStatus("tie");
        playTieRoundSound(audioEnabled);
        duelNextRoundTimerRef.current = window.setTimeout(() => {
          startOpeningRoll(round + 1);
        }, 900);
        return;
      }

      const winnerPlayer: Player = finalDice.Kevin > finalDice.Demi ? "Kevin" : "Demi";
      setCurrentPlayer(winnerPlayer);
      setStartingPlayer(winnerPlayer);
      setDuelWinner(winnerPlayer);
      setDuelStatus("winner");
      duelNextRoundTimerRef.current = window.setTimeout(() => {
        setOpeningStage("board");
      }, 1100);
    }, 3000);
  };

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

  const saveHistory = (winnerPlayer: Player, stake: string) => {
    const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
    history.unshift({
      date: new Date().toISOString(),
      game: "胜天半子",
      loser: displayPlayerNames[winnerPlayer === "Kevin" ? "Demi" : "Kevin"],
      stake,
    });
    localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));
  };

  const finishGame = (winnerPlayer: Player, line: Coordinate[], options?: { destiny?: boolean }) => {
    clearDestinyTimers();
    clearAreaHighlightTimer();
    clearRematchState();
    const selectedStake = getCurrentStake();
    setWinner(winnerPlayer);
    setWinningLine(line);
    setCurrentStake(selectedStake);
    saveHistory(winnerPlayer, selectedStake);

    if (options?.destiny) {
      setDestinyWinner(winnerPlayer);
      setDestinyFillPlayer(winnerPlayer);
      setDestinyFillCount(0);
      setShowDestinyModal(false);

      const totalCells = boardSize * boardSize;
      destinyFillIntervalRef.current = window.setInterval(() => {
        setDestinyFillCount((prev) => {
          const next = prev + DESTINY_FILL_STEP;
          if (next >= totalCells) {
            if (destinyFillIntervalRef.current !== null) {
              window.clearInterval(destinyFillIntervalRef.current);
              destinyFillIntervalRef.current = null;
            }
            setBoard(Array.from({ length: boardSize }, () => Array(boardSize).fill(winnerPlayer)));
            destinyModalTimerRef.current = window.setTimeout(() => {
              setShowDestinyModal(true);
            }, DESTINY_MODAL_SHOW_DELAY_MS);
            return totalCells;
          }
          return next;
        });
      }, DESTINY_FILL_INTERVAL_MS);
      return;
    }

    setDestinyFillCount(0);
    window.setTimeout(() => setShowResultModal(true), 420);
  };

  const getHighlightKind = (row: number, col: number): HighlightKind | null => {
    if (!skillHighlights || moveCount >= skillHighlights.expiresAtMove) {
      return null;
    }

    let bestMatch: HighlightKind | null = null;
    let bestPriority = -1;
    for (const mark of skillHighlights.marks) {
      if (mark.row !== row || mark.col !== col) continue;
      const priority = HIGHLIGHT_PRIORITY[mark.kind];
      if (priority > bestPriority) {
        bestPriority = priority;
        bestMatch = mark.kind;
      }
    }

    return bestMatch;
  };

  const executeMove = (row: number, col: number) => {
    if (winner || board[row][col]) return;
    if (isCellBlockedByBoardEffects(boardEffects, currentPlayer, row, col)) {
      return;
    }
    clearAreaHighlightTimer();
    clearBoardNoticeTimer();
    clearRemoteMoveHighlightTimer();
    setBoardNotice(null);
    setRemoteMoveHighlight(null);

    const player = currentPlayer;
    const nextMoveCount = moveCount + 1;
    const nextSkillEnergy = nextMoveCount % 3;
    const shouldTriggerSkill = debugForceEveryMoveSkill || nextMoveCount % 3 === 0;
    let nextSkillHighlights = skillHighlights;
    if (nextSkillHighlights && nextMoveCount >= nextSkillHighlights.expiresAtMove) {
      nextSkillHighlights = null;
    }

    let nextBoard = cloneBoard(board);
    nextBoard[row][col] = player;
    playStonePlaceSound(player, audioEnabled);

    let nextBoardEffects = boardEffects.filter((effect) => effect.blockedPlayer !== player);

    const naturalLine = getLineFromMove(nextBoard, row, col, player);
    if (naturalLine) {
      setBoard(nextBoard);
      setMoveCount(nextMoveCount);
      setSkillEnergy(nextSkillEnergy);
      setBoardEffects(nextBoardEffects);
      setSkillHighlights(nextSkillHighlights);
      finishGame(player, naturalLine);
      return;
    }

    if (shouldTriggerSkill) {
      clearAreaHighlightTimer();
      const skillKey = debugForcedSkillKey || rollSkillKey(destinyChance);
      const nextDestinyChance =
        skillKey === "destinyWin"
          ? SHARED_SKILL_TIER_CONFIG.destinyBase
          : Math.min(
              destinyChance + SHARED_SKILL_TIER_CONFIG.destinyIncrement,
              SHARED_SKILL_TIER_CONFIG.destinyMax
            );
      if (SKILL_SOUND_MAP[skillKey]) {
        playAudioEffect(SKILL_SOUND_MAP[skillKey]!, audioEnabled, { category: "skill" });
      } else {
        playFallbackSkillSound(audioEnabled);
      }
      const skill = SKILL_DEFINITIONS[skillKey];
      const { board: boardAfterSkill, newBoardEffect, destinyWin, highlightMarks } = applySkill(nextBoard, player, skillKey);

      nextBoard = boardAfterSkill;
      if (newBoardEffect) {
        nextBoardEffects = [...nextBoardEffects.filter((effect) => effect.kind !== newBoardEffect.kind), newBoardEffect];
      }

      setCurrentSkill(skill);
      setSkillOwner(player);
      setDestinyChance(nextDestinyChance);
      nextSkillHighlights = highlightMarks.length
        ? {
            marks: highlightMarks,
            expiresAtMove: nextMoveCount + 1,
          }
        : null;

      if (skillKey === "tianyuanBlast" && nextSkillHighlights?.marks.some((mark) => mark.kind === "area")) {
        areaHighlightTimerRef.current = window.setTimeout(() => {
          setSkillHighlights((current) => {
            if (!current) return current;
            const marks = current.marks.filter((mark) => mark.kind !== "area");
            return marks.length ? { ...current, marks } : null;
          });
          areaHighlightTimerRef.current = null;
        }, 5000);
      }

      if (destinyWin) {
        setBoard(nextBoard);
        setMoveCount(nextMoveCount);
        setSkillEnergy(nextSkillEnergy);
        setBoardEffects(nextBoardEffects);
        setSkillHighlights(null);
        setShowSkillModal(false);
        finishGame(player, [], { destiny: true });
        return;
      }

      const { winner: boardWinner, line } = checkBoardWinner(nextBoard, player);
      if (boardWinner) {
        setBoard(nextBoard);
        setMoveCount(nextMoveCount);
        setSkillEnergy(nextSkillEnergy);
        setBoardEffects(nextBoardEffects);
      setSkillHighlights(nextSkillHighlights);
      setShowSkillModal(false);
      finishGame(boardWinner, line);
      return;
    }

      setSkillHighlights(nextSkillHighlights);
      setShowSkillModal(true);
    }

    setBoard(nextBoard);
    setMoveCount(nextMoveCount);
    setSkillEnergy(nextSkillEnergy);
    setBoardEffects(nextBoardEffects);
    setSkillHighlights(nextSkillHighlights);
    setCurrentPlayer(getOpponent(player));
  };

  const handleCellClick = (row: number, col: number) => {
    if (winner || board[row][col]) return;
    if (isOnlineMode && (!gameStarted || openingStage !== "board")) return;
    if (roomId && !isMyOnlineTurn) {
      playUiSound("back", audioEnabled);
      showBoardNotice("现在还没轮到你落子");
      return;
    }
    if (pendingMove?.[0] === row && pendingMove?.[1] === col) {
      cancelPendingMove();
      return;
    }
    if (isCellBlockedByBoardEffects(boardEffects, currentPlayer, row, col)) {
      playUiSound("back", audioEnabled);
      showBoardNotice("该区域本回合不可落子");
      return;
    }
    clearBoardNoticeTimer();
    setBoardNotice(null);
    setPendingMove([row, col]);
  };

  const confirmPendingMove = () => {
    if (!pendingMove) return;
    const [row, col] = pendingMove;
    setPendingMove(null);
    if (roomId && myLobbyPlayerId === "guest") {
      if (!roomChannelRef.current) {
        showBoardNotice("房间连接还没准备好");
        return;
      }
      void roomChannelRef.current.send({
        type: "broadcast",
        event: "move_request",
        payload: {
          row,
          col,
          requesterId: myLobbyPlayerId,
        } satisfies OnlineMoveRequestPayload,
      });
      showBoardNotice("已发送落子，等待同步");
      return;
    }
    executeMove(row, col);
  };

  const cancelPendingMove = () => {
    playUiSound("back", audioEnabled);
    clearBoardNoticeTimer();
    setBoardNotice(null);
    setPendingMove(null);
  };

  const acceptDestiny = () => {
    playUiSound("confirm", audioEnabled);
    clearRematchState();
    setShowDestinyModal(false);
    setDestinyFillCount(0);
    setSkillHighlights(null);
    setShowResultModal(true);
  };

  const requestOnlineRematch = async () => {
    if (!roomChannelRef.current || !roomId || !isOnlineMode || !showResultModal) {
      return;
    }

    playUiSound("confirm", audioEnabled);
    setRematchRequesterId(myLobbyPlayerId);
    showBoardNotice("已发出再来一局请求");

    await roomChannelRef.current.send({
      type: "broadcast",
      event: "rematch_request",
      payload: {
        requesterId: myLobbyPlayerId,
      } satisfies OnlineRematchRequestPayload,
    });
  };

  const acceptOnlineRematch = async () => {
    if (!roomChannelRef.current || !roomId || !isOnlineMode || !rematchRequesterId) {
      return;
    }

    playUiSound("confirm", audioEnabled);
    const requesterId = rematchRequesterId;
    clearRematchState();

    await roomChannelRef.current.send({
      type: "broadcast",
      event: "rematch_accept",
      payload: {
        requesterId,
        accepterId: myLobbyPlayerId,
      } satisfies OnlineRematchAcceptPayload,
    });

    if (myLobbyPlayerId === "host") {
      await restartOnlineMatch();
      return;
    }

    showBoardNotice("已接受请求，等待房主开始");
  };

  const handleEmojiSend = async (content: string) => {
    if (Date.now() < emojiCooldownUntil) {
      return;
    }

    const message: EmojiMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message_type: "emoji",
      content,
      sender: localEmojiSender,
      senderName: displayPlayerNames[localEmojiSender],
      createdAt: new Date().toISOString(),
      clientId: emojiClientIdRef.current,
    };

    playUiSound("confirm", audioEnabled);
    showEmojiBubble(message);
    setShowEmojiSheet(false);

    const cooldownUntil = Date.now() + EMOJI_COOLDOWN_MS;
    setEmojiCooldownUntil(cooldownUntil);
    clearEmojiCooldownTimer();
    emojiCooldownTimerRef.current = window.setTimeout(() => {
      setEmojiCooldownUntil(0);
      emojiCooldownTimerRef.current = null;
    }, EMOJI_COOLDOWN_MS);

    if (roomId && emojiChannelRef.current) {
      try {
        await emojiChannelRef.current.send({
          type: "broadcast",
          event: "emoji",
          payload: message,
        });
      } catch {
        showBoardNotice("表情发送失败，稍后再试");
      }
    }
  };

  const confirmPendingAction = () => {
    if (pendingAction === "reset") {
      playUiSound("confirm", audioEnabled);
      if (isOnlineMode) {
        if (myLobbyPlayerId !== "host") {
          setPendingAction(null);
          showBoardNotice("联机对局请由房主重新开始");
          return;
        }
        void restartOnlineMatch();
        return;
      }
      resetGame();
      return;
    }

    if (pendingAction === "back") {
      playUiSound("back", audioEnabled);
      setPendingAction(null);
      if (roomId) {
        clearRoomChannel();
        clearGobangRoomSession(roomId);
        clearGobangSnapshot(roomId);
      }
      navigate(-1);
      return;
    }

    if (pendingAction === "home") {
      playUiSound("back", audioEnabled);
      setPendingAction(null);
      if (roomId) {
        clearRoomChannel();
        clearGobangRoomSession(roomId);
        clearGobangSnapshot(roomId);
      }
      navigate("/");
    }
  };

  const cancelPendingAction = () => {
    playUiSound("back", audioEnabled);
    setPendingAction(null);
  };

  // 重新开始
  const resetGame = () => {
    clearDestinyTimers();
    clearDuelTimers();
    clearAreaHighlightTimer();
    clearBoardNoticeTimer();
    clearEmojiDisplayTimer();
    clearEmojiCooldownTimer();
    clearRemoteMoveHighlightTimer();
    setBoard(createEmptyBoard());
    setCurrentPlayer("Kevin");
    setStartingPlayer("Kevin");
    setMoveCount(0);
    setSkillEnergy(0);
    setWinner(null);
    setWinningLine([]);
    setBoardEffects([]);
    setSkillHighlights(null);
    setDestinyChance(SHARED_SKILL_TIER_CONFIG.destinyBase);
    setBoardNotice(null);
    setShowEmojiSheet(false);
    setActiveEmoji(null);
    setEmojiCooldownUntil(0);
    setRemoteMoveHighlight(null);
    setPendingMove(null);
    setCurrentSkill(SKILL_DEFINITIONS.createStone);
    setSkillOwner("Kevin");
    setDestinyWinner("Kevin");
    setDestinyFillCount(0);
    setDestinyFillPlayer("Kevin");
    setShowSkillModal(false);
    setShowDestinyModal(false);
    setShowResultModal(false);
    clearRematchState();
    setPendingAction(null);
    setCurrentStake(getCurrentStake());
    setOpeningStage("duel");
    setDuelStatus("rolling");
    setDuelRound(1);
    setDuelWinner(null);
    setDuelDice({
      Kevin: 1,
      Demi: 1,
    });
    startOpeningRoll();
  };

  const restartOnlineMatch = async () => {
    if (!roomChannelRef.current || myLobbyPlayerId !== "host") {
      return;
    }
    const payload = buildOnlineMatchStartPayload();
    setPendingAction(null);
    clearRematchState();
    startOnlineOpeningReveal(payload);
    await roomChannelRef.current.send({
      type: "broadcast",
      event: "match_start",
      payload,
    });
  };

  const triggerDebugDestiny = () => {
    if (winner) return;
    setPendingMove(null);
    finishGame(currentPlayer, [], { destiny: true });
  };

  const clearRoomChannel = () => {
    clearJoinValidationTimer();
    clearRemoteMoveHighlightTimer();
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

    if (!nextPlayersMap.has(myLobbyPlayerId)) {
      nextPlayersMap.set(myLobbyPlayerId, {
        id: myLobbyPlayerId,
        nickname: selfNickname,
        avatarId: selfAvatarId,
        role: selfRole,
        isReady: localReady,
        isHost: myLobbyPlayerId === "host",
      });
    }

    setLobbyPlayers(
      Array.from(nextPlayersMap.values()).sort((left, right) => (left.id === right.id ? 0 : left.id === "host" ? -1 : 1))
    );
  };

  const buildSnapshot = (): GobangSnapshot => ({
    generatedBy: roomClientIdRef.current,
    board,
    currentPlayer,
    moveCount,
    skillEnergy,
    currentStake,
    currentSkillKey: currentSkill.key,
    skillOwner,
    startingPlayer,
    winner,
    winningLine,
    boardEffects,
    skillHighlights,
    destinyChance,
    boardNotice,
    destinyWinner,
    destinyFillCount,
    destinyFillPlayer,
    showSkillModal,
    showDestinyModal,
    showResultModal,
    openingStage,
    duelStatus,
    duelRound,
    duelWinner,
    duelDice,
  });

  const applySnapshot = (snapshot: GobangSnapshot) => {
    clearDestinyTimers();
    clearDuelTimers();
    clearAreaHighlightTimer();
    clearBoardNoticeTimer();
    clearRemoteMoveHighlightTimer();

    let incomingMoveOwner: Player | null = null;
    let incomingMoveCell: Coordinate | null = null;

    if (snapshot.generatedBy !== roomClientIdRef.current && snapshot.moveCount > moveCount) {
      const changedCells: Array<{ row: number; col: number; before: Cell; after: Cell }> = [];
      for (let rowIndex = 0; rowIndex < boardSize; rowIndex += 1) {
        for (let colIndex = 0; colIndex < boardSize; colIndex += 1) {
          if (board[rowIndex][colIndex] !== snapshot.board[rowIndex][colIndex]) {
            changedCells.push({
              row: rowIndex,
              col: colIndex,
              before: board[rowIndex][colIndex],
              after: snapshot.board[rowIndex][colIndex],
            });
          }
        }
      }

      const latestPlacedCell =
        changedCells.find((cell) => cell.before === null && cell.after !== null) ??
        changedCells.find((cell) => cell.after !== null) ??
        null;

      if (latestPlacedCell?.after) {
        incomingMoveOwner = latestPlacedCell.after;
        incomingMoveCell = [latestPlacedCell.row, latestPlacedCell.col];
      }
    }

    setBoard(snapshot.board);
    setCurrentPlayer(snapshot.currentPlayer);
    setMoveCount(snapshot.moveCount);
    setSkillEnergy(snapshot.skillEnergy);
    setCurrentStake(snapshot.currentStake);
    setCurrentSkill(SKILL_DEFINITIONS[snapshot.currentSkillKey]);
    setSkillOwner(snapshot.skillOwner);
    setStartingPlayer(snapshot.startingPlayer);
    setWinner(snapshot.winner);
    setWinningLine(snapshot.winningLine);
    setBoardEffects(snapshot.boardEffects);
    setSkillHighlights(snapshot.skillHighlights);
    setDestinyChance(snapshot.destinyChance);
    setBoardNotice(snapshot.boardNotice);
    setDestinyWinner(snapshot.destinyWinner);
    setDestinyFillCount(snapshot.destinyFillCount);
    setDestinyFillPlayer(snapshot.destinyFillPlayer);
    setShowSkillModal(snapshot.showSkillModal);
    setShowDestinyModal(snapshot.showDestinyModal);
    setShowResultModal(snapshot.showResultModal);
    setOpeningStage(snapshot.openingStage);
    setDuelStatus(snapshot.duelStatus);
    setDuelRound(snapshot.duelRound);
    setDuelWinner(snapshot.duelWinner);
    setDuelDice(snapshot.duelDice);
    setPendingMove(null);
    setPendingAction(null);
    setShowEmojiSheet(false);
    setGameStarted(true);
    saveGobangSnapshot(roomId, snapshot);

    if (incomingMoveOwner) {
      playStonePlaceSound(incomingMoveOwner, audioEnabled);
    }

    if (incomingMoveCell && !snapshot.skillHighlights) {
      showRemoteMoveHighlight(incomingMoveCell[0], incomingMoveCell[1]);
    } else {
      setRemoteMoveHighlight(null);
    }
  };

  const buildOnlineMatchStartPayload = (): OnlineMatchStartPayload => {
    let kevinDie = rollDie();
    let demiDie = rollDie();
    while (kevinDie === demiDie) {
      kevinDie = rollDie();
      demiDie = rollDie();
    }
    return {
      stake: getCurrentStake(),
      duelDice: {
        Kevin: kevinDie,
        Demi: demiDie,
      },
      startingPlayer: kevinDie > demiDie ? "Kevin" : "Demi",
    };
  };

  const startOnlineOpeningReveal = (payload: OnlineMatchStartPayload) => {
    clearDestinyTimers();
    clearDuelTimers();
    clearAreaHighlightTimer();
    clearBoardNoticeTimer();
    clearEmojiDisplayTimer();
    clearEmojiCooldownTimer();
    clearRemoteMoveHighlightTimer();
    setBoard(createEmptyBoard());
    setCurrentPlayer(payload.startingPlayer);
    setStartingPlayer(payload.startingPlayer);
    setMoveCount(0);
    setSkillEnergy(0);
    setWinner(null);
    setWinningLine([]);
    setBoardEffects([]);
    setSkillHighlights(null);
    setDestinyChance(SHARED_SKILL_TIER_CONFIG.destinyBase);
    setBoardNotice(null);
    setShowEmojiSheet(false);
    setActiveEmoji(null);
    setEmojiCooldownUntil(0);
    setRemoteMoveHighlight(null);
    setPendingMove(null);
    setCurrentSkill(SKILL_DEFINITIONS.createStone);
    setSkillOwner(payload.startingPlayer);
    setDestinyWinner(payload.startingPlayer);
    setDestinyFillCount(0);
    setDestinyFillPlayer(payload.startingPlayer);
    setShowSkillModal(false);
    setShowDestinyModal(false);
    setShowResultModal(false);
    clearRematchState();
    setPendingAction(null);
    setCurrentStake(payload.stake);
    setOpeningStage("duel");
    setDuelStatus("rolling");
    setDuelRound(1);
    setDuelWinner(null);
    setDuelDice({
      Kevin: 1,
      Demi: 1,
    });
    setGameStarted(true);
    setLocalReady(false);

    stopDuelRollingAudioRef.current = startDiceRollingLoop(audioEnabled, 170);
    duelIntervalRef.current = window.setInterval(() => {
      setDuelDice({
        Kevin: rollDie(),
        Demi: rollDie(),
      });
    }, 110);

    duelStopTimerRef.current = window.setTimeout(() => {
      clearDuelTimers();
      setDuelDice(payload.duelDice);
      playDiceRevealSound(audioEnabled);
      setCurrentPlayer(payload.startingPlayer);
      setStartingPlayer(payload.startingPlayer);
      setDuelWinner(payload.startingPlayer);
      setDuelStatus("winner");
      duelNextRoundTimerRef.current = window.setTimeout(() => {
        setOpeningStage("board");
      }, 1100);
    }, 3000);
  };

  const startOfflineGame = () => {
    playUiSound("confirm", audioEnabled);
    if (roomId) {
      clearRoomChannel();
      clearGobangRoomSession(roomId);
      clearGobangSnapshot(roomId);
    }
    navigate({ pathname: location.pathname, search: "" }, { replace: true });
    setGameMode("offline");
    setGameStarted(true);
    setRoomCode("");
    setJoinCode("");
    setJoinError("");
    setCopied(false);
    setLobbyPlayers([]);
    setLocalReady(false);
    setMyLobbyPlayerId("host");
    clearRematchState();
    resetGame();
  };

  const createRoom = () => {
    playUiSound("confirm", audioEnabled);
    const nextRoomCode = generateRoomCode();
    setGameMode("create");
    setGameStarted(false);
    setRoomCode(nextRoomCode);
    setJoinCode("");
    setJoinError("");
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
    clearRematchState();
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
    clearRematchState();
  };

  const leaveOnlineSetup = () => {
    clearRoomChannel();
    clearGobangRoomSession(roomId);
    clearGobangSnapshot(roomId);
    lastBroadcastSnapshotRef.current = "";
    setGameMode(null);
    setGameStarted(false);
    setRoomCode("");
    setJoinCode("");
    setJoinError("");
    setCopied(false);
    setLobbyPlayers([]);
    setLocalReady(false);
    setMyLobbyPlayerId("host");
    setLobbyNotice("房主先准备，TA 进来后就能一起开战。");
    clearRematchState();
    navigate({ pathname: location.pathname, search: "" }, { replace: true });
  };

  const copyRoomCode = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
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
      playUiSound("back", audioEnabled);
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
    clearRematchState();
  };

  const toggleLobbyReady = () => {
    const nextReady = !localReady;
    setLocalReady(nextReady);
    setLobbyPlayers((current) =>
      current.map((player) =>
        player.id === myLobbyPlayerId
          ? {
              ...player,
              isReady: nextReady,
            }
          : player
      )
    );

    if (!nextReady) {
      setLobbyNotice("你已取消准备，调整好再点一次就行。");
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
    if (!roomChannelRef.current || !canHostStartMatch) {
      return;
    }
    const payload = buildOnlineMatchStartPayload();
    playUiSound("confirm", audioEnabled);
    startOnlineOpeningReveal(payload);
    await roomChannelRef.current.send({
      type: "broadcast",
      event: "match_start",
      payload,
    });
  };

  useEffect(() => {
    executeMoveRef.current = executeMove;
    buildSnapshotRef.current = buildSnapshot;
    applySnapshotRef.current = applySnapshot;
    currentPlayerRef.current = currentPlayer;
    winnerRef.current = winner;
    openingStageRef.current = openingStage;
    gameStartedRef.current = gameStarted;
  }, [applySnapshot, buildSnapshot, currentPlayer, executeMove, gameStarted, openingStage, winner]);

  useEffect(() => {
    if (!roomId || !isOnlineMode) {
      return;
    }
    saveGobangRoomSession(roomId, {
      gameMode: gameMode === "create" ? "create" : "join",
      playerId: myLobbyPlayerId,
    });
  }, [gameMode, isOnlineMode, myLobbyPlayerId, roomId]);

  useEffect(() => {
    if (searchRoomId === roomId) {
      return;
    }
    navigate(
      {
        pathname: location.pathname,
        search: roomId ? `?room=${roomId}` : "",
      },
      { replace: true }
    );
  }, [location.pathname, navigate, roomId, searchRoomId]);

  useEffect(() => {
    if (!roomId || !isOnlineMode || gameStarted) {
      return;
    }
    const restoredSnapshot = getStoredGobangSnapshot(roomId);
    if (!restoredSnapshot) {
      return;
    }
    applySnapshot(restoredSnapshot);
    setLobbyNotice("已恢复上一盘棋局，正在同步最新状态。");
  }, [gameStarted, isOnlineMode, roomId]);

  useEffect(() => {
    if (!roomId || !isOnlineMode) {
      clearRoomChannel();
      return;
    }

    clearRoomChannel();

    const channel = supabase.channel(`gobang-room-${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: roomClientIdRef.current },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      syncLobbyPlayersFromPresence(channel);
    });

    channel.on("broadcast", { event: "match_start" }, ({ payload }) => {
      clearRematchState();
      startOnlineOpeningReveal(payload as OnlineMatchStartPayload);
      setLobbyNotice("联机棋局开始了，按规则轮流落子。");
    });

    channel.on("broadcast", { event: "rematch_request" }, ({ payload }) => {
      const request = payload as OnlineRematchRequestPayload;
      if (!request || (request.requesterId !== "host" && request.requesterId !== "guest")) {
        return;
      }
      setRematchRequesterId(request.requesterId);
      setShowResultModal(true);
    });

    channel.on("broadcast", { event: "rematch_accept" }, ({ payload }) => {
      const accept = payload as OnlineRematchAcceptPayload;
      if (
        !accept ||
        (accept.requesterId !== "host" && accept.requesterId !== "guest") ||
        (accept.accepterId !== "host" && accept.accepterId !== "guest")
      ) {
        return;
      }

      clearRematchState();

      if (accept.requesterId === myLobbyPlayerId) {
        if (myLobbyPlayerId === "host") {
          void restartOnlineMatch();
          return;
        }
        showBoardNotice("TA 已接受请求，马上重新开始");
        return;
      }

      if (myLobbyPlayerId === "guest") {
        showBoardNotice("房主已接受，马上重新开始");
      }
    });

    channel.on("broadcast", { event: "move_request" }, ({ payload }) => {
      const request = payload as OnlineMoveRequestPayload;
      if (myLobbyPlayerId !== "host") {
        return;
      }
      const expectedRequester = currentPlayerRef.current === "Kevin" ? "host" : "guest";
      if (
        request.requesterId !== expectedRequester ||
        winnerRef.current ||
        openingStageRef.current !== "board" ||
        !gameStartedRef.current
      ) {
        return;
      }
      executeMoveRef.current(request.row, request.col);
    });

    channel.on("broadcast", { event: "state_snapshot" }, ({ payload }) => {
      const snapshot = payload as GobangSnapshot;
      if (!snapshot || snapshot.generatedBy === roomClientIdRef.current) {
        return;
      }
      applySnapshotRef.current(snapshot);
    });

    channel.on("broadcast", { event: "state_sync_request" }, ({ payload }) => {
      const request = payload as OnlineStateSyncRequestPayload;
      if (!request || request.requesterClientId === roomClientIdRef.current || !roomChannelRef.current) {
        return;
      }
      if (!gameStartedRef.current) {
        return;
      }
      void roomChannelRef.current.send({
        type: "broadcast",
        event: "state_snapshot",
        payload: buildSnapshotRef.current(),
      });
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        return;
      }

      roomChannelRef.current = channel;
      setRoomConnected(true);
      void channel
        .track({
        id: myLobbyPlayerId,
        nickname: selfNickname,
        avatarId: selfAvatarId,
        role: selfRole,
        isReady: localReady,
        isHost: myLobbyPlayerId === "host",
        clientId: roomClientIdRef.current,
      } satisfies RoomPresencePayload)
        .then(() => {
          syncLobbyPlayersFromPresence(channel);
        });

      setLobbyNotice(
        gameMode === "create" ? "房间已建立，把数字房间号发给 TA。" : "已连接房间，等双方准备后就能开始。"
      );

      void channel.send({
        type: "broadcast",
        event: "state_sync_request",
        payload: {
          requesterClientId: roomClientIdRef.current,
        } satisfies OnlineStateSyncRequestPayload,
      });
    });

    return () => {
      if (roomChannelRef.current === channel) {
        roomChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
      setRoomConnected(false);
    };
  }, [gameMode, isOnlineMode, roomId]);

  useEffect(() => {
    if (!roomChannelRef.current || !roomConnected || !roomId || !isOnlineMode) {
      return;
    }

    void roomChannelRef.current
      .track({
      id: myLobbyPlayerId,
      nickname: selfNickname,
      avatarId: selfAvatarId,
      role: selfRole,
      isReady: localReady,
      isHost: myLobbyPlayerId === "host",
      clientId: roomClientIdRef.current,
    } satisfies RoomPresencePayload)
      .then(() => {
        if (roomChannelRef.current) {
          syncLobbyPlayersFromPresence(roomChannelRef.current);
        }
      });
  }, [isOnlineMode, localReady, myLobbyPlayerId, roomConnected, roomId, selfAvatarId, selfNickname, selfRole]);

  useEffect(() => {
    if (gameMode !== "join" || myLobbyPlayerId !== "guest" || !roomId || !roomConnected || gameStarted) {
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
  }, [gameMode, gameStarted, hostLobbyPlayer, myLobbyPlayerId, roomConnected, roomId]);

  useEffect(() => {
    if (!roomId || !isOnlineMode || !gameStarted) {
      return;
    }
    const snapshot = buildSnapshot();
    const serialized = JSON.stringify(snapshot);
    saveGobangSnapshot(roomId, snapshot);

    if (
      myLobbyPlayerId === "host" &&
      roomConnected &&
      roomChannelRef.current &&
      serialized !== lastBroadcastSnapshotRef.current
    ) {
      lastBroadcastSnapshotRef.current = serialized;
      void roomChannelRef.current.send({
        type: "broadcast",
        event: "state_snapshot",
        payload: snapshot,
      });
    }
  }, [
    board,
    boardEffects,
    boardNotice,
    currentPlayer,
    currentSkill,
    currentStake,
    destinyChance,
    destinyFillCount,
    destinyFillPlayer,
    destinyWinner,
    duelDice,
    duelRound,
    duelStatus,
    duelWinner,
    gameStarted,
    isOnlineMode,
    moveCount,
    myLobbyPlayerId,
    openingStage,
    roomConnected,
    roomId,
    showDestinyModal,
    showResultModal,
    showSkillModal,
    skillEnergy,
    skillHighlights,
    skillOwner,
    startingPlayer,
    winner,
    winningLine,
  ]);

  useEffect(() => {
    if (!showSkillModal) {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowSkillModal(false);
    }, SKILL_MODAL_AUTO_CLOSE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [currentSkill.key, showSkillModal, skillOwner]);

  const activeBoardEffects = boardEffects;
  const activeLockZone = activeBoardEffects.find(
    (effect) => effect.kind === "lockZone" && effect.blockedPlayer === currentPlayer
  );
  const statusPlayer = winner ?? currentPlayer;
  const statusTheme = PLAYER_THEME[statusPlayer];
  const skillChargeOwner =
    Math.floor(moveCount / 3) % 2 === 0 ? startingPlayer : getOpponent(startingPlayer);
  const skillChargeTheme =
    skillChargeOwner === "Kevin"
      ? {
          tint: PALETTE.blue,
          track: "#DDEEFF",
          fill: "#79BDF5",
          accent: "#5B88AB",
          badge: "#EAF5FF",
          label: displayPlayerNames.Kevin,
        }
      : {
          tint: PALETTE.pink,
          track: "#F8DEEF",
          fill: "#D889E8",
          accent: "#BE7BA7",
          badge: "#FFF1FA",
          label: displayPlayerNames.Demi,
        };
  const statusAvatar = avatarByPlayer[statusPlayer];
  const skillRingOffset = SKILL_RING_CIRCUMFERENCE - (skillEnergy / 3) * SKILL_RING_CIRCUMFERENCE;
  const isEmojiCoolingDown = emojiCooldownUntil > Date.now();
  const activeEmojiTheme = activeEmoji ? PLAYER_THEME[activeEmoji.sender] : null;
  const activeEmojiAvatar = activeEmoji ? avatarByPlayer[activeEmoji.sender] : null;
  const hostName = displayPlayerNames.Kevin;
  const guestName = displayPlayerNames.Demi;
  const rematchRequesterName =
    rematchRequesterId === "guest" ? guestName : rematchRequesterId === "host" ? hostName : "";
  const hostAvatar = avatarByPlayer.Kevin;
  const guestAvatar = avatarByPlayer.Demi;
  const mySlotPlayer: Player = myLobbyPlayerId === "host" ? "Kevin" : "Demi";
  const rivalSlotPlayer: Player = myLobbyPlayerId === "host" ? "Demi" : "Kevin";
  const myLobbyAvatar = avatarByPlayer[mySlotPlayer];
  const rivalLobbyAvatar = avatarByPlayer[rivalSlotPlayer];
  const myLobbyTheme = PLAYER_THEME[mySlotPlayer];
  const rivalLobbyTheme = PLAYER_THEME[rivalSlotPlayer];
  const showRestartAction = gameMode === "offline" || (isOnlineMode && gameStarted);

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header
        title="胜天半子"
        showBack
        showHistory
        onBackClick={() => setPendingAction("back")}
        rightActions={showRestartAction ? (
          <button
            onClick={() => {
              playUiSound("confirm", audioEnabled);
              setPendingAction("reset");
            }}
            className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="重新开始"
            title="重新开始"
          >
            <RotateCcw className="w-5 h-5 text-gray-700" />
          </button>
        ) : undefined}
      />

      {gameMode === null ? (
        <div className="app-page-content">
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(171,215,250,0.28), rgba(255,234,111,0.18) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback src="/images/wuziqi.png" alt="胜天半子" className="h-20 w-20 rounded-3xl object-cover" />
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
                    description: "同一台手机轮流落子，技能和棋局都完整保留。",
                    badge: <Users className="h-6 w-6" />,
                    side: "🎯",
                    tint: PALETTE.yellow,
                    card: PALETTE.paleYellow,
                    border: "#F3E7A5",
                    onClick: startOfflineGame,
                  },
                  {
                    key: "create",
                    title: "创建房间",
                    description: "生成数字房间号，等 TA 加入后一起准备开战。",
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
                    description: "输入 6 位数字房间号，直接进入联机准备室。",
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
                联机五子棋这次会保留棋局快照
              </p>
              <p className="mt-1 text-[12px] leading-5" style={{ color: PALETTE.subInk }}>
                创建房间后会进准备室；真正开局后，刷新页面也会优先恢复到这一盘，再向房间同步最新状态。
              </p>
            </motion.div>
          </div>
        </div>
      ) : gameMode === "join" && !roomId ? (
        <div className="app-page-content">
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
                  <ImageWithFallback src="/images/wuziqi.png" alt="胜天半子" className="h-20 w-20 rounded-3xl object-cover" />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  准备加入房间
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  先把数字房间号填好，后面直接接联机
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
                    <p className="text-sm" style={{ color: PALETTE.subInk }}>输入 6 位数字房间号，直接去准备室</p>
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
                        background: `linear-gradient(135deg, ${myLobbyAvatar.soft} 0%, ${myLobbyAvatar.solid} 100%)`,
                        borderColor: myLobbyTheme.border,
                      }}
                    >
                      <span className="text-[1.45rem]">{myLobbyAvatar.emoji}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: PALETTE.ink }}>{selfNickname}</p>
                      <p className="text-xs" style={{ color: PALETTE.subInk }}>
                        {selfRole === "female" ? "女生身份" : "男生身份"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={leaveOnlineSetup} sound="back">
                    返回选择
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={saveJoinRoomCode} disabled={joinCode.trim().length !== 6}>
                    加入房间
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      ) : isOnlineMode && roomId && !gameStarted ? (
        <div className="app-page-content">
          <div className="app-page-center app-page-content--fit flex flex-col justify-between gap-4">
            <div className="app-page-stack app-page-stack--tight text-center">
              <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(171,215,250,0.34), rgba(255,234,111,0.18) 68%, rgba(255,255,255,0) 100%)",
                  }}
                >
                  <ImageWithFallback src="/images/wuziqi.png" alt="胜天半子" className="h-20 w-20 rounded-3xl object-cover" />
                </div>
                <h2 className="mb-1 text-[1.85rem] font-black" style={{ color: PALETTE.ink }}>
                  联机准备室
                </h2>
                <p className="text-[15px]" style={{ color: PALETTE.subInk }}>
                  房主和 TA 都准备好后，就能正式开局
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
                    <p className="mt-1 text-[2.15rem] font-black tracking-[0.12em]" style={{ color: PALETTE.ink }}>{roomId}</p>
                  </div>
                  <button
                    onClick={() => {
                      void copyRoomCode();
                    }}
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
                          background: `linear-gradient(135deg, ${hostAvatar.soft} 0%, ${hostAvatar.solid} 100%)`,
                          borderColor: PLAYER_THEME.Kevin.avatarBorder,
                        }}
                      >
                        <span className="text-[2.15rem]">{hostAvatar.emoji}</span>
                      </div>
                      <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                        {hostName}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-1.5">
                        <Crown className="h-3.5 w-3.5" style={{ color: "#E99E34" }} />
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ backgroundColor: "#FFF1D4", color: "#B86A1E" }}
                        >
                          房主
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: effectiveHostReady ? PLAYER_THEME.Kevin.accent : PALETTE.subInk }}>
                        {effectiveHostReady ? "已准备" : "未准备"}
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
                      {guestLobbyPlayer ? (
                        <>
                          <div
                            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(31,36,48,0.08)]"
                            style={{
                              background: `linear-gradient(135deg, ${guestAvatar.soft} 0%, ${guestAvatar.solid} 100%)`,
                              borderColor: PLAYER_THEME.Demi.avatarBorder,
                            }}
                          >
                            <span className="text-[2.15rem]">{guestAvatar.emoji}</span>
                          </div>
                          <p className="mt-3 text-[1.1rem] font-black leading-none" style={{ color: PALETTE.ink }}>
                            {guestName}
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                              style={{ backgroundColor: PLAYER_THEME.Demi.badge, color: PLAYER_THEME.Demi.accent }}
                            >
                              玩家 2
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold" style={{ color: effectiveGuestReady ? PLAYER_THEME.Demi.accent : PALETTE.subInk }}>
                            {effectiveGuestReady ? "已准备" : "未准备"}
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

                <button
                  onClick={leaveOnlineSetup}
                  className="mt-4 text-[1rem] font-semibold transition-colors"
                  style={{ color: PALETTE.subInk }}
                >
                  离开房间
                </button>

                <p className="mt-4 text-sm leading-6" style={{ color: PALETTE.subInk }}>
                  {lobbyNotice}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      ) : openingStage === "duel" ? (
        <div className="app-page-content app-page-content--fit">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="app-page-center flex h-full flex-col justify-center gap-4"
          >
            <div
              className="rounded-[1.75rem] app-page-card border"
              style={{ backgroundColor: PALETTE.paleYellow, borderColor: PALETTE.yellow }}
            >
              <div className="flex items-center gap-2 justify-center mb-2" style={{ color: PALETTE.ink }}>
                <Dices className="w-5 h-5" />
                <p className="text-sm font-semibold">先手决定战</p>
              </div>
              <h2 className="text-[1.65rem] font-bold text-center mb-1.5" style={{ color: PALETTE.ink }}>掷骰子比大小</h2>
                <p className="text-sm text-center" style={{ color: PALETTE.subInk }}>
                {displayPlayerNames.Kevin} 在上，{displayPlayerNames.Demi} 在下。掷 3 秒，点数大的人先手，平局自动重掷。
              </p>
            </div>

            <div className="space-y-3">
              <div
                className="rounded-[1.75rem] p-4 border"
                style={{ backgroundColor: PALETTE.paleBlue, borderColor: PALETTE.blue }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: "#5B88AB" }}>Player 1</p>
                    <p className="text-[1.7rem] font-black leading-none" style={{ color: PALETTE.ink }}>{displayPlayerNames.Kevin}</p>
                    <p className="text-xs mt-1.5" style={{ color: PALETTE.subInk }}>当前点数 {duelDice.Kevin}</p>
                  </div>
                  <DuelDie
                    value={duelDice.Kevin}
                    player="Kevin"
                    rolling={duelStatus === "rolling"}
                    isWinner={duelWinner === "Kevin"}
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <motion.div
                  animate={duelStatus === "rolling" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.8, repeat: duelStatus === "rolling" ? Infinity : 0 }}
                  className="w-16 h-16 rounded-full text-white flex items-center justify-center border border-white/70"
                  style={{ backgroundColor: PALETTE.yellow, color: PALETTE.ink }}
                >
                  <span className="text-xl font-black tracking-wide">VS</span>
                </motion.div>
              </div>

              <div
                className="rounded-[1.75rem] p-4 border"
                style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink }}
              >
                <div className="flex items-center justify-between">
                  <DuelDie
                    value={duelDice.Demi}
                    player="Demi"
                    rolling={duelStatus === "rolling"}
                    isWinner={duelWinner === "Demi"}
                  />
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: "#BE7BA7" }}>Player 2</p>
                    <p className="text-[1.7rem] font-black leading-none" style={{ color: PALETTE.ink }}>{displayPlayerNames.Demi}</p>
                    <p className="text-xs mt-1.5" style={{ color: PALETTE.subInk }}>当前点数 {duelDice.Demi}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-[1.75rem] app-page-card border text-center"
              style={{ backgroundColor: "#FFFFFFCC", borderColor: "#FFFFFF" }}
            >
              <p className="text-xs uppercase tracking-[0.25em] mb-1.5" style={{ color: PALETTE.subInk }}>Round {duelRound}</p>
              <p className="text-lg font-bold mb-1.5" style={{ color: PALETTE.ink }}>
                {duelStatus === "rolling" && "骰子滚动中..."}
                {duelStatus === "tie" && "平局，加赛一轮"}
                {duelStatus === "winner" && duelWinner && `${displayPlayerNames[duelWinner]} 拿下先手`}
              </p>
              <p className="text-xs sm:text-sm" style={{ color: PALETTE.subInk }}>
                {duelStatus === "rolling" && "3 秒后揭晓结果"}
                {duelStatus === "tie" && "两个骰子一样大，马上自动重掷"}
                {duelStatus === "winner" && duelWinner && `本局由 ${displayPlayerNames[duelWinner]} 先落第一手`}
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
          <div className="app-page-content">
            <div
              className="app-page-center flex flex-col"
              style={{ minHeight: "calc(var(--app-content-safe-body-height) - 4.5rem)" }}
            >
              <div className="app-page-stack app-page-stack--tight">
                <motion.div
                  key={`${statusPlayer}-${skillChargeOwner}-${winner ? "winner" : "turn"}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative rounded-[1.55rem] border p-3.5"
                  style={{
                    backgroundColor: statusTheme.card,
                    borderColor: statusTheme.border,
                  }}
                >
                  <AnimatePresence>
                    {activeEmoji && activeEmojiTheme && activeEmojiAvatar && (
                      <motion.div
                        initial={{ opacity: 0, x: -8, y: 2, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, y: 12, scale: 1 }}
                        exit={{ opacity: 0, x: -6, y: 12, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="pointer-events-none absolute left-3 top-[3.05rem] z-20 origin-top-left"
                      >
                        <div
                          className="flex max-w-[10.75rem] items-center gap-2 rounded-2xl border px-3 py-2 shadow-[0_14px_28px_rgba(0,0,0,0.08)]"
                          style={{
                            backgroundColor: "#FFFFFFF4",
                            borderColor: activeEmojiTheme.border,
                          }}
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full border"
                            style={{
                              background: `linear-gradient(135deg, ${activeEmojiAvatar.soft} 0%, ${activeEmojiAvatar.solid} 100%)`,
                              borderColor: activeEmojiTheme.avatarBorder,
                            }}
                          >
                            <span className="text-base">{activeEmojiAvatar.emoji}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold" style={{ color: activeEmojiTheme.accent }}>
                              {activeEmoji.senderName}
                            </p>
                            <p className="text-[1.15rem] leading-none">{activeEmoji.content}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
                        style={{
                          background: `linear-gradient(135deg, ${statusAvatar.soft} 0%, ${statusAvatar.solid} 100%)`,
                          borderColor: statusTheme.avatarBorder,
                          boxShadow: statusTheme.avatarGlow,
                        }}
                      >
                        <span className="text-[1.9rem]">{statusAvatar.emoji}</span>
                      </div>

                      <div className="min-w-0">
                        <p
                          className="mb-1 text-[11px] font-semibold tracking-[0.18em] uppercase"
                          style={{ color: statusTheme.accent }}
                        >
                          {winner ? "本局结果" : "当前回合"}
                        </p>
                        <p className="text-[1.12rem] font-black leading-tight sm:text-[1.28rem]" style={{ color: PALETTE.ink }}>
                          {winner ? (
                            <>
                              <span style={{ color: statusTheme.accent }}>{displayPlayerNames[statusPlayer]}</span>
                              <span> 获胜！</span>
                            </>
                          ) : (
                            <>
                              <span>轮到 </span>
                              <span style={{ color: statusTheme.accent }}>{displayPlayerNames[currentPlayer]}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {!winner && (
                      <div className="shrink-0 rounded-[1.2rem] border bg-white/72 px-2.5 py-2" style={{ borderColor: "rgba(255,255,255,0.92)" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="text-right">
                            <p className="text-[10px] font-semibold tracking-[0.16em] uppercase" style={{ color: PALETTE.subInk }}>
                              技能
                            </p>
                            <p className="mt-0.5 text-xs font-bold" style={{ color: skillChargeTheme.accent }}>
                              {skillChargeTheme.label}
                            </p>
                          </div>

                          <div className="relative h-14 w-14">
                            <svg width={STATUS_CIRCLE_SIZE} height={STATUS_CIRCLE_SIZE} className="-rotate-90 transform">
                              <circle
                                cx={SKILL_RING_CENTER}
                                cy={SKILL_RING_CENTER}
                                r={SKILL_RING_RADIUS}
                                stroke={skillChargeTheme.track}
                                strokeWidth="4"
                                fill="none"
                              />
                              <motion.circle
                                cx={SKILL_RING_CENTER}
                                cy={SKILL_RING_CENTER}
                                r={SKILL_RING_RADIUS}
                                stroke={skillChargeTheme.fill}
                                strokeWidth="4"
                                fill="none"
                                strokeLinecap="round"
                                initial={false}
                                animate={{ strokeDashoffset: skillRingOffset }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                                style={{
                                  strokeDasharray: `${SKILL_RING_CIRCUMFERENCE} ${SKILL_RING_CIRCUMFERENCE}`,
                                  filter:
                                    skillEnergy >= 2
                                      ? `drop-shadow(0 0 6px ${skillChargeTheme.fill}88)`
                                      : "none",
                                }}
                              />
                            </svg>

                            <div className="absolute inset-0 flex items-center justify-center">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full"
                                style={{ backgroundColor: skillChargeTheme.badge }}
                              >
                                <span className="text-sm font-black" style={{ color: skillChargeTheme.accent }}>
                                  {skillEnergy}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

            {isDebugMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl p-4 border mt-3"
                style={{ backgroundColor: PALETTE.paleYellow, borderColor: PALETTE.yellow, color: PALETTE.ink }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Bug className="w-4 h-4" />
                  <p className="text-sm font-semibold">Debug 测试面板（仅开发模式）</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => {
                      playUiSound("confirm", audioEnabled);
                      setCurrentPlayer("Kevin");
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-medium border"
                    style={{ backgroundColor: PALETTE.paleBlue, borderColor: PALETTE.blue, color: PALETTE.ink }}
                  >
                    强制当前玩家 {displayPlayerNames.Kevin}
                  </button>
                  <button
                    onClick={() => {
                      playUiSound("confirm", audioEnabled);
                      setCurrentPlayer("Demi");
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-medium border"
                    style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }}
                  >
                    强制当前玩家 {displayPlayerNames.Demi}
                  </button>
                </div>

                <label className="flex items-center gap-2 mb-3 text-xs">
                  <input
                    type="checkbox"
                    checked={debugForceEveryMoveSkill}
                    onChange={(event) => setDebugForceEveryMoveSkill(event.target.checked)}
                  />
                  每一步都触发技能
                </label>

                <select
                  value={debugForcedSkillKey}
                  onChange={(event) => setDebugForcedSkillKey(event.target.value as SkillKey | "")}
                  className="w-full rounded-xl px-3 py-2 text-xs mb-3"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}
                >
                  <option value="">随机技能（默认）</option>
                  {Object.values(SKILL_DEFINITIONS).map((skill) => (
                    <option key={skill.key} value={skill.key}>
                      {skill.name}（{skill.tier}）
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playUiSound("confirm", audioEnabled);
                      if (isOnlineMode) {
                        if (myLobbyPlayerId !== "host") {
                          showBoardNotice("联机对局请由房主重新开始");
                          return;
                        }
                        void restartOnlineMatch();
                        return;
                      }
                      resetGame();
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-medium border"
                    style={{ backgroundColor: PALETTE.paleYellow, borderColor: PALETTE.yellow, color: PALETTE.ink }}
                  >
                    一键重置棋盘
                  </button>
                  <button
                    onClick={() => {
                      playUiSound("confirm", audioEnabled);
                      triggerDebugDestiny();
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-medium border"
                    style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }}
                  >
                    单测天命所归
                  </button>
                </div>
              </motion.div>
            )}

            <div className="flex-1 flex flex-col justify-center">
              {/* 棋盘 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="-mx-3 sm:-mx-1 md:mx-0 mt-2 mb-2 rounded-[1.35rem] border p-[3px]"
                style={{ backgroundColor: PALETTE.yellow, borderColor: "#F5DA57" }}
              >
                <div
                  className="rounded-[1.05rem] border px-0.5 py-1 sm:px-1 sm:py-1.5"
                  style={{ backgroundColor: PALETTE.paleYellow, borderColor: "rgba(245, 218, 87, 0.48)" }}
                >
                  <div
                    className="grid gap-0"
                    style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
                  >
                    {board.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const cellIndex = rowIndex * boardSize + colIndex;
                        const showDestinyFill = destinyFillCount > 0 && cellIndex < destinyFillCount;
                        const displayCell: Cell = showDestinyFill ? destinyFillPlayer : cell;
                        const isWinningCell = winningLine.some(
                          ([r, c]) => r === rowIndex && c === colIndex
                        );
                        const highlightKind = getHighlightKind(rowIndex, colIndex);
                        const isInLockZone = activeLockZone
                          ? isCellInBoardEffect(activeLockZone, rowIndex, colIndex)
                          : false;
                        const isBlockedCell = !displayCell && isInLockZone;
                        const isPendingCell = pendingMove?.[0] === rowIndex && pendingMove?.[1] === colIndex;
                        const isRemoteLatestCell =
                          remoteMoveHighlight?.[0] === rowIndex && remoteMoveHighlight?.[1] === colIndex;
                        const shouldShowStoneHalo =
                          !!displayCell &&
                          !!highlightKind &&
                          STONE_HALO_KINDS.includes(highlightKind);
                        const isTengen = rowIndex === CENTER && colIndex === CENTER;
                        const isFirstRow = rowIndex === 0;
                        const isLastRow = rowIndex === BOARD_LAST_INDEX;
                        const isFirstCol = colIndex === 0;
                        const isLastCol = colIndex === BOARD_LAST_INDEX;

                        return (
                          <motion.button
                            key={`${rowIndex}-${colIndex}`}
                            whileTap={winner || !!displayCell || isBlockedCell ? undefined : { scale: 0.92 }}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                            disabled={!!winner || !!displayCell || isBlockedCell}
                            aria-label={`第 ${rowIndex + 1} 行第 ${colIndex + 1} 列`}
                            className={`relative aspect-square transition-transform ${
                              isBlockedCell
                                ? "bg-red-200/40 cursor-not-allowed"
                                : ""
                            }`}
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <span
                              className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                              style={{
                                left: isFirstCol ? "50%" : 0,
                                right: isLastCol ? "50%" : 0,
                                height: `${BOARD_LINE_WIDTH}px`,
                                backgroundColor: PALETTE.line,
                              }}
                            />
                            <span
                              className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                              style={{
                                top: isFirstRow ? "50%" : 0,
                                bottom: isLastRow ? "50%" : 0,
                                width: `${BOARD_LINE_WIDTH}px`,
                                backgroundColor: PALETTE.line,
                              }}
                            />
                            {isInLockZone && (
                              <div
                                className="pointer-events-none absolute inset-[4%] z-[1] rounded-[0.32rem] border"
                                style={{
                                  borderColor: "rgba(148, 163, 184, 0.88)",
                                  backgroundColor: "rgba(203, 213, 225, 0.34)",
                                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
                                }}
                              />
                            )}
                            {isTengen && !displayCell && !isPendingCell && !highlightKind && !isBlockedCell && (
                              <span
                                className="pointer-events-none absolute left-1/2 top-1/2 z-[1] rounded-full -translate-x-1/2 -translate-y-1/2"
                                style={{
                                  width: `${STAR_POINT_SCALE * 100}%`,
                                  height: `${STAR_POINT_SCALE * 100}%`,
                                  backgroundColor: "#8F6A25",
                                }}
                              />
                            )}
                            {isPendingCell && !displayCell && (
                              <motion.div
                                initial={{ opacity: 0.5, scale: 0.9 }}
                                animate={{ opacity: [0.45, 1, 0.45], scale: [0.9, 1, 0.9] }}
                                transition={{ duration: 0.95, repeat: Infinity }}
                                className="absolute left-1/2 top-1/2 z-20 rounded-full border-2 -translate-x-1/2 -translate-y-1/2"
                                style={{
                                  width: `${PENDING_MARK_SCALE * 100}%`,
                                  height: `${PENDING_MARK_SCALE * 100}%`,
                                  borderColor: PALETTE.yellow,
                                  backgroundColor: "rgba(255,234,111,0.24)",
                                }}
                              />
                            )}
                            {isRemoteLatestCell && displayCell && !shouldShowStoneHalo && (
                              <motion.div
                                initial={{ opacity: 0.42, scale: 0.9 }}
                                animate={{ opacity: [0.42, 0.95, 0.42], scale: [0.9, 1.04, 0.9] }}
                                transition={{ duration: 0.95, repeat: Infinity }}
                                className="absolute left-1/2 top-1/2 z-[18] rounded-full border-[3px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={{
                                  width: "108%",
                                  height: "108%",
                                  borderColor: displayCell === "Kevin" ? "rgba(121, 189, 245, 0.95)" : "rgba(216, 137, 232, 0.95)",
                                  boxShadow:
                                    displayCell === "Kevin"
                                      ? "0 0 0 3px rgba(171,215,250,0.22), 0 0 18px rgba(121,189,245,0.28)"
                                      : "0 0 0 3px rgba(255,201,239,0.22), 0 0 18px rgba(216,137,232,0.28)",
                                  backgroundColor: "transparent",
                                }}
                              />
                            )}
                            {isBlockedCell && (
                              <div
                                className="absolute left-1/2 top-1/2 z-10 rounded-full border -translate-x-1/2 -translate-y-1/2"
                                style={{
                                  width: `${BLOCKED_MARK_SCALE * 100}%`,
                                  height: `${BLOCKED_MARK_SCALE * 100}%`,
                                  borderColor: "rgba(100, 116, 139, 0.9)",
                                  backgroundColor: "rgba(203, 213, 225, 0.46)",
                                }}
                              />
                            )}
                            {highlightKind && (
                              shouldShowStoneHalo ? (
                                <motion.div
                                  initial={{ opacity: 0.4, scale: 0.92 }}
                                  animate={{ opacity: [0.6, 1, 0.6], scale: [0.94, 1.04, 0.94] }}
                                  transition={{ duration: 0.95, repeat: Infinity }}
                                  className="absolute left-1/2 top-1/2 pointer-events-none z-40 rounded-full -translate-x-1/2 -translate-y-1/2 border-[3px]"
                                  style={{
                                    width: "106%",
                                    height: "106%",
                                    borderColor: STONE_HALO_STYLE_MAP[highlightKind as "added" | "to" | "converted"].borderColor,
                                    boxShadow: STONE_HALO_STYLE_MAP[highlightKind as "added" | "to" | "converted"].glow,
                                    backgroundColor: "transparent",
                                  }}
                                />
                              ) : highlightKind === "area" ? (
                                <motion.div
                                  initial={{ opacity: 0.28 }}
                                  animate={{ opacity: [0.2, 0.44, 0.2] }}
                                  transition={{ duration: 1.05, repeat: Infinity }}
                                  className="pointer-events-none absolute inset-[4%] z-[2] rounded-[0.32rem] border"
                                  style={{
                                    borderColor: "rgba(180, 83, 255, 0.72)",
                                    backgroundColor: "rgba(216, 180, 254, 0.18)",
                                  }}
                                />
                              ) : (
                                <motion.div
                                  initial={{ opacity: 0.3, scale: 0.9 }}
                                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.92, 1, 0.92] }}
                                  transition={{ duration: 1.05, repeat: Infinity }}
                                  className={`absolute left-1/2 top-1/2 pointer-events-none z-20 rounded-full -translate-x-1/2 -translate-y-1/2 ${HIGHLIGHT_CLASS_MAP[highlightKind]}`}
                                  style={{
                                    width: `${HIGHLIGHT_MARK_SCALE * 100}%`,
                                    height: `${HIGHLIGHT_MARK_SCALE * 100}%`,
                                  }}
                                />
                              )
                            )}
                            <AnimatePresence>
                              {displayCell && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute left-1/2 top-1/2 z-30 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                                  style={{ width: `${STONE_SCALE * 100}%`, height: `${STONE_SCALE * 100}%` }}
                                >
                                  <div
                                    className={`w-full h-full rounded-full ${isWinningCell ? "border-2" : "border"}`}
                                    style={{
                                      background: displayCell === "Kevin"
                                        ? "linear-gradient(135deg, #ABD7FA 0%, #90C3F4 100%)"
                                        : "linear-gradient(135deg, #FFC9EF 0%, #F6B7E6 100%)",
                                      borderColor: isWinningCell ? PALETTE.yellow : "rgba(255,255,255,0.65)",
                                    }}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 px-3 sm:px-4"
          >
            <div
              className="rounded-2xl border p-2"
              style={{
                backgroundColor: pendingMove ? "#FFFFFFF2" : "#FFFFFFE8",
                borderColor: pendingMove ? PALETTE.yellow : "#E8E6D8",
              }}
            >
              <p className="sr-only" aria-live="polite">
                {pendingMove ? `已选中 ${pendingMove[0] + 1} 行 ${pendingMove[1] + 1} 列` : "请选择落点"}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={confirmPendingMove}
                  disabled={!pendingMove || !!winner}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all border ${
                    pendingMove && !winner
                      ? ""
                      : ""
                  }`}
                  style={
                    pendingMove && !winner
                      ? { backgroundColor: PALETTE.yellow, borderColor: "#F5DA57", color: PALETTE.ink }
                      : { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB", color: "#9CA3AF" }
                  }
                >
                  确认落子
                </button>
                <button
                  onClick={() => {
                    playUiSound(showEmojiSheet ? "back" : "confirm", audioEnabled);
                    setShowEmojiSheet((current) => !current);
                  }}
                  className="rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all"
                  style={
                    showEmojiSheet
                      ? { backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }
                      : { backgroundColor: "#FFFFFF", borderColor: "#E5E7EB", color: PALETTE.ink }
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <SmilePlus className="h-4.5 w-4.5" />
                    {isEmojiCoolingDown ? "冷却中" : "表情"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
          </div>
      )}

      <AnimatePresence>
        {showEmojiSheet && openingStage === "board" && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/12 backdrop-blur-[1px]"
              onClick={() => {
                playUiSound("back", audioEnabled);
                setShowEmojiSheet(false);
              }}
              aria-label="关闭表情面板"
            />
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md"
            >
              <div
                className="rounded-[1.7rem] border px-4 pb-4 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]"
                style={{
                  backgroundColor: "#FFFFFFF6",
                  borderColor: "#F1E9C5",
                }}
              >
                <div className="mb-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-[#E8E6D8]" />
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: PALETTE.ink }}>
                      表情互动
                    </p>
                    <p className="text-xs" style={{ color: PALETTE.subInk }}>
                      轻点一下，马上发送
                    </p>
                  </div>
                  <div
                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: isEmojiCoolingDown ? "#F9FAFB" : PALETTE.paleYellow,
                      borderColor: isEmojiCoolingDown ? "#E5E7EB" : PALETTE.yellow,
                      color: isEmojiCoolingDown ? PALETTE.subInk : PALETTE.ink,
                    }}
                  >
                    {isEmojiCoolingDown ? "冷却 2 秒" : "可发送"}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        void handleEmojiSend(emoji);
                      }}
                      disabled={isEmojiCoolingDown}
                      className="rounded-2xl border px-2 py-3 text-center text-[1.35rem] transition-transform active:scale-95 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: isEmojiCoolingDown ? "#F8FAFC" : "#FFFDF0",
                        borderColor: isEmojiCoolingDown ? "#E5E7EB" : "#F3E7B0",
                        color: PALETTE.ink,
                        opacity: isEmojiCoolingDown ? 0.62 : 1,
                      }}
                    >
                      <span className="leading-none">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 技能触发弹窗 */}
        <SkillModal
          isOpen={showSkillModal}
          onClose={() => setShowSkillModal(false)}
          skillName={currentSkill.name}
          skillDescription={currentSkill.description}
          playerId={skillOwner}
          playerName={displayPlayerNames[skillOwner]}
        />

      {/* 天命弹窗 */}
      <DestinyModal
        isOpen={showDestinyModal}
        onClose={acceptDestiny}
        winnerName={displayPlayerNames[destinyWinner]}
      />

      {/* 获胜弹窗 */}
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        winner={winner ? displayPlayerNames[winner] : ""}
        loser={winner ? displayPlayerNames[winner === "Kevin" ? "Demi" : "Kevin"] : ""}
        stake={currentStake}
        message={
          currentStake === "谁是大皇帝"
            ? "今天这局，谁才是真正的大皇帝！👑"
            : "愿赌服输，今天这把就靠你啦！💪"
        }
        footerNote={
          isOnlineMode ? (
            incomingRematchRequest ? (
              <p>
                <span className="font-semibold" style={{ color: PALETTE.ink }}>
                  {rematchRequesterName}
                </span>
                <span> 想和你再来一局，点接受后会直接重新开始。</span>
              </p>
            ) : waitingForRematchAccept ? (
              <p>再来一局请求已经发给对方了，等 TA 接受就会直接开新局。</p>
            ) : (
              <p>如果还想继续，这里可以先发一个再来一局请求给对方。</p>
            )
          ) : undefined
        }
        secondaryAction={
          isOnlineMode
            ? {
                label: "关闭结果",
                onClick: () => setShowResultModal(false),
                variant: "secondary",
                sound: "back",
              }
            : undefined
        }
        primaryAction={
          isOnlineMode
            ? incomingRematchRequest
              ? {
                  label: "接受再来一局",
                  onClick: () => {
                    void acceptOnlineRematch();
                  },
                  variant: "primary",
                }
              : waitingForRematchAccept
                ? {
                    label: "已发送请求",
                    onClick: () => undefined,
                    variant: "primary",
                    disabled: true,
                    sound: "none",
                  }
                : {
                    label: "请求再来一局",
                    onClick: () => {
                      void requestOnlineRematch();
                    },
                    variant: "primary",
                  }
            : undefined
        }
      />

      <AnimatePresence>
        {pendingAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-sm z-40"
              onClick={cancelPendingAction}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
            >
              <div className="bg-white rounded-3xl p-6 border" style={{ borderColor: PALETTE.yellow }}>
                <p className="text-xl font-bold mb-2" style={{ color: PALETTE.ink }}>
                  {pendingAction === "reset" && "确认重新开始？"}
                  {pendingAction === "home" && "确认返回主页？"}
                  {pendingAction === "back" && "确认离开当前棋局？"}
                </p>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: PALETTE.subInk }}>
                  {pendingAction === "reset"
                    ? "当前棋局会被清空，技能标记和待确认落子也会一起重置。"
                    : pendingAction === "home"
                    ? "离开后当前棋局不会继续保留，确定现在返回主页吗？"
                    : "离开后会回到上一页，当前棋局不会继续保留。"}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={cancelPendingAction}
                    className="flex-1 rounded-2xl py-3 font-semibold border"
                    style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmPendingAction}
                    className="flex-1 rounded-2xl py-3 font-semibold border"
                    style={{ backgroundColor: PALETTE.yellow, borderColor: "#F5DA57", color: PALETTE.ink }}
                  >
                    确认
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
