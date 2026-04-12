import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, Zap, Bug, Dices } from "lucide-react";
import { Header } from "../components/Header";
import { ResultModal } from "../components/ResultModal";
import { SkillModal } from "../components/SkillModal";
import { DestinyModal } from "../components/DestinyModal";
import { useNavigate } from "react-router";
import { DEFAULT_BGM_SOURCE, useBgm } from "../components/BgmProvider";
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

type Player = "Kevin" | "Demi";
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

interface BlockedZone {
  top: number;
  left: number;
  untilMove: number;
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
    description: "随机封锁一个 2x2 区域，持续 1 个完整回合",
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

const PLAYER_TIER_WEIGHTS: Record<Player, Array<{ tier: SkillTier; weight: number }>> = {
  Kevin: [
    { tier: "normal", weight: 62 },
    { tier: "strong", weight: 26 },
    { tier: "chaos", weight: 11 },
    { tier: "destiny", weight: 1 },
  ],
  Demi: [
    { tier: "normal", weight: 46 },
    { tier: "strong", weight: 32 },
    { tier: "chaos", weight: 20.8 },
    { tier: "destiny", weight: 1.2 },
  ],
};

const BOARD_LINE_WIDTH = 1.5;
const STONE_SCALE = 0.9;
const PENDING_MARK_SCALE = 0.82;
const BLOCKED_MARK_SCALE = 0.8;
const HIGHLIGHT_MARK_SCALE = 0.86;
const STAR_POINT_SCALE = 0.16;

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

const isCellInBlockedZone = (blockedZone: BlockedZone, row: number, col: number) =>
  row >= blockedZone.top &&
  row <= blockedZone.top + 1 &&
  col >= blockedZone.left &&
  col <= blockedZone.left + 1;

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

const rollSkillTier = (player: Player): SkillTier =>
  pickByWeight(PLAYER_TIER_WEIGHTS[player].map((entry) => ({ item: entry.tier, weight: entry.weight })));

const rollSkillKey = (player: Player): SkillKey => {
  const tier = rollSkillTier(player);
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
  zone: "border-2 border-[#FFEA6F] bg-[#FFF3B4]/60",
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
  skillKey: SkillKey,
  moveCount: number
): {
  board: Board;
  newBlockedZone: BlockedZone | null;
  destinyWin: boolean;
  highlightMarks: HighlightMark[];
} => {
  const workingBoard = cloneBoard(board);
  const opponent = getOpponent(player);
  let newBlockedZone: BlockedZone | null = null;
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
      const top = Math.floor(Math.random() * (boardSize - 1));
      const left = Math.floor(Math.random() * (boardSize - 1));
      newBlockedZone = { top, left, untilMove: moveCount + 2 };
      markCells(
        [
          [top, left],
          [top, left + 1],
          [top + 1, left],
          [top + 1, left + 1],
        ],
        "zone"
      );
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

  return { board: workingBoard, newBlockedZone, destinyWin, highlightMarks };
};

export default function GobangGame() {
  const navigate = useNavigate();
  const { setTrack, enabled: audioEnabled } = useBgm();
  const [playerNames] = useState(() => getStoredPlayerNames());
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("Kevin");
  const [moveCount, setMoveCount] = useState(0);
  const [skillEnergy, setSkillEnergy] = useState(0);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showDestinyModal, setShowDestinyModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentStake, setCurrentStake] = useState("请吃饭");
  const [currentSkill, setCurrentSkill] = useState<SkillDefinition>(SKILL_DEFINITIONS.createStone);
  const [skillOwner, setSkillOwner] = useState<Player>("Kevin");
  const [startingPlayer, setStartingPlayer] = useState<Player>("Kevin");
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<Coordinate[]>([]);
  const [blockedZones, setBlockedZones] = useState<BlockedZone[]>([]);
  const [skillHighlights, setSkillHighlights] = useState<SkillHighlights | null>(null);
  const [destinyWinner, setDestinyWinner] = useState<Player>("Kevin");
  const [destinyFillCount, setDestinyFillCount] = useState(0);
  const [destinyFillPlayer, setDestinyFillPlayer] = useState<Player>("Kevin");
  const destinyFillIntervalRef = useRef<number | null>(null);
  const destinyModalTimerRef = useRef<number | null>(null);
  const destinyResultTimerRef = useRef<number | null>(null);
  const areaHighlightTimerRef = useRef<number | null>(null);

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
    if (destinyResultTimerRef.current !== null) {
      window.clearTimeout(destinyResultTimerRef.current);
      destinyResultTimerRef.current = null;
    }
  };

  const clearAreaHighlightTimer = () => {
    if (areaHighlightTimerRef.current !== null) {
      window.clearTimeout(areaHighlightTimerRef.current);
      areaHighlightTimerRef.current = null;
    }
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
    };
  }, []);

  useEffect(() => {
    setTrack("/sounds/minecraft.mp3");
    return () => {
      setTrack(DEFAULT_BGM_SOURCE);
    };
  }, [setTrack]);

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

  useEffect(() => {
    startOpeningRoll();
  }, []);

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

  const saveHistory = (winnerPlayer: Player, stake: string) => {
    const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
    history.unshift({
      date: new Date().toISOString(),
      game: "胜天半子",
      loser: playerNames[winnerPlayer === "Kevin" ? "Demi" : "Kevin"],
      stake,
    });
    localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));
  };

  const finishGame = (winnerPlayer: Player, line: Coordinate[], options?: { destiny?: boolean }) => {
    clearDestinyTimers();
    clearAreaHighlightTimer();
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
          const next = prev + 9;
          if (next >= totalCells) {
            if (destinyFillIntervalRef.current !== null) {
              window.clearInterval(destinyFillIntervalRef.current);
              destinyFillIntervalRef.current = null;
            }
            setBoard(Array.from({ length: boardSize }, () => Array(boardSize).fill(winnerPlayer)));
            destinyModalTimerRef.current = window.setTimeout(() => {
              setShowDestinyModal(true);
            }, 120);
            destinyResultTimerRef.current = window.setTimeout(() => {
              setShowDestinyModal(false);
              setDestinyFillCount(0);
              setSkillHighlights(null);
              setShowResultModal(true);
            }, 2800);
            return totalCells;
          }
          return next;
        });
      }, 24);
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

  const isCellBlocked = (zones: BlockedZone[], move: number, row: number, col: number) =>
    zones.some((zone) => move < zone.untilMove && isCellInBlockedZone(zone, row, col));

  const executeMove = (row: number, col: number) => {
    if (winner || board[row][col]) return;
    if (isCellBlocked(blockedZones, moveCount, row, col)) {
      return;
    }
    clearAreaHighlightTimer();

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

    let nextBlockedZones = blockedZones.filter((zone) => nextMoveCount < zone.untilMove);

    const naturalLine = getLineFromMove(nextBoard, row, col, player);
    if (naturalLine) {
      playStonePlaceSound(player, audioEnabled);
      setBoard(nextBoard);
      setMoveCount(nextMoveCount);
      setSkillEnergy(nextSkillEnergy);
      setBlockedZones(nextBlockedZones);
      setSkillHighlights(nextSkillHighlights);
      finishGame(player, naturalLine);
      return;
    }

    if (shouldTriggerSkill) {
      clearAreaHighlightTimer();
      const skillKey = debugForcedSkillKey || rollSkillKey(player);
      if (SKILL_SOUND_MAP[skillKey]) {
        playAudioEffect(SKILL_SOUND_MAP[skillKey]!, audioEnabled, { category: "skill" });
      } else {
        playFallbackSkillSound(audioEnabled);
      }
      const skill = SKILL_DEFINITIONS[skillKey];
      const { board: boardAfterSkill, newBlockedZone, destinyWin, highlightMarks } = applySkill(
        nextBoard,
        player,
        skillKey,
        nextMoveCount
      );

      nextBoard = boardAfterSkill;
      if (newBlockedZone) {
        nextBlockedZones = [...nextBlockedZones, newBlockedZone];
      }

      setCurrentSkill(skill);
      setSkillOwner(player);
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
        setBlockedZones(nextBlockedZones);
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
        setBlockedZones(nextBlockedZones);
        setSkillHighlights(nextSkillHighlights);
        setShowSkillModal(false);
        finishGame(boardWinner, line);
        return;
      }

      setSkillHighlights(nextSkillHighlights);
      setShowSkillModal(true);
    } else {
      playStonePlaceSound(player, audioEnabled);
    }

    setBoard(nextBoard);
    setMoveCount(nextMoveCount);
    setSkillEnergy(nextSkillEnergy);
    setBlockedZones(nextBlockedZones);
    setSkillHighlights(nextSkillHighlights);
    setCurrentPlayer(getOpponent(player));
  };

  const handleCellClick = (row: number, col: number) => {
    if (winner || board[row][col]) return;
    if (isCellBlocked(blockedZones, moveCount, row, col)) return;
    setPendingMove([row, col]);
  };

  const confirmPendingMove = () => {
    if (!pendingMove) return;
    const [row, col] = pendingMove;
    setPendingMove(null);
    executeMove(row, col);
  };

  const cancelPendingMove = () => {
    playUiSound("back", audioEnabled);
    setPendingMove(null);
  };

  const confirmPendingAction = () => {
    if (pendingAction === "reset") {
      playUiSound("confirm", audioEnabled);
      resetGame();
      return;
    }

    if (pendingAction === "back") {
      playUiSound("back", audioEnabled);
      setPendingAction(null);
      navigate(-1);
      return;
    }

    if (pendingAction === "home") {
      playUiSound("back", audioEnabled);
      setPendingAction(null);
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
    setBoard(createEmptyBoard());
    setCurrentPlayer("Kevin");
    setStartingPlayer("Kevin");
    setMoveCount(0);
    setSkillEnergy(0);
    setWinner(null);
    setWinningLine([]);
    setBlockedZones([]);
    setSkillHighlights(null);
    setPendingMove(null);
    setCurrentSkill(SKILL_DEFINITIONS.createStone);
    setSkillOwner("Kevin");
    setDestinyWinner("Kevin");
    setDestinyFillCount(0);
    setDestinyFillPlayer("Kevin");
    setShowSkillModal(false);
    setShowDestinyModal(false);
    setShowResultModal(false);
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

  const triggerDebugDestiny = () => {
    if (winner) return;
    setPendingMove(null);
    finishGame(currentPlayer, [], { destiny: true });
  };

  const activeBlockedZones = blockedZones.filter((zone) => moveCount < zone.untilMove);
  const skillChargeOwner =
    Math.floor(moveCount / 3) % 2 === 0 ? startingPlayer : getOpponent(startingPlayer);
  const skillChargeTheme =
    skillChargeOwner === "Kevin"
      ? {
          bg: PALETTE.paleBlue,
          border: PALETTE.blue,
          track: "#DDEEFF",
          fill: "#79BDF5",
          accent: "#5B88AB",
          label: `${playerNames.Kevin} 蓄力中`,
        }
      : {
          bg: PALETTE.palePink,
          border: PALETTE.pink,
          track: "#F8DEEF",
          fill: "#D889E8",
          accent: "#AE68C4",
          label: `${playerNames.Demi} 蓄力中`,
        };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header
        title="胜天半子"
        showBack
        showHistory
        onBackClick={() => setPendingAction("back")}
        rightActions={
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
        }
      />

      {openingStage === "duel" ? (
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
                {playerNames.Kevin} 在上，{playerNames.Demi} 在下。掷 3 秒，点数大的人先手，平局自动重掷。
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
                    <p className="text-[1.7rem] font-black leading-none" style={{ color: PALETTE.ink }}>{playerNames.Kevin}</p>
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
                    <p className="text-[1.7rem] font-black leading-none" style={{ color: PALETTE.ink }}>{playerNames.Demi}</p>
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
                {duelStatus === "winner" && duelWinner && `${playerNames[duelWinner]} 拿下先手`}
              </p>
              <p className="text-xs sm:text-sm" style={{ color: PALETTE.subInk }}>
                {duelStatus === "rolling" && "3 秒后揭晓结果"}
                {duelStatus === "tie" && "两个骰子一样大，马上自动重掷"}
                {duelStatus === "winner" && duelWinner && `本局由 ${playerNames[duelWinner]} 先落第一手`}
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
          <div className="app-page-content app-floating-reserve">
            <div
              className="app-page-center flex flex-col"
              style={{ minHeight: "calc(var(--app-content-safe-body-height) - 4.5rem)" }}
            >
              <div className="app-page-stack app-page-stack--tight">
                {/* 当前回合提示 */}
                <motion.div
                  key={currentPlayer}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-2xl p-3.5 text-center border"
                  style={{
                    backgroundColor: currentPlayer === "Kevin" ? PALETTE.paleBlue : PALETTE.palePink,
                    borderColor: currentPlayer === "Kevin" ? PALETTE.blue : PALETTE.pink,
                  }}
                >
                  <p className="text-xs mb-1" style={{ color: PALETTE.subInk }}>当前回合</p>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: PALETTE.ink }}>
                    {winner ? `${playerNames[winner]} 获胜！` : `轮到 ${playerNames[currentPlayer]}`}
                  </p>
                </motion.div>

                {/* 技能能量槽 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl p-3.5 border"
                  style={{ backgroundColor: skillChargeTheme.bg, borderColor: skillChargeTheme.border }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4.5 h-4.5" style={{ color: skillChargeTheme.accent }} />
                      <span className="text-sm font-medium" style={{ color: PALETTE.ink }}>技能能量</span>
                    </div>
                    <span className="text-xs" style={{ color: PALETTE.subInk }}>{skillEnergy}/3</span>
                  </div>
                  <div className="w-full rounded-full h-2.5" style={{ backgroundColor: skillChargeTheme.track }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(skillEnergy / 3) * 100}%` }}
                      className="h-2.5 rounded-full transition-all"
                      style={{ backgroundColor: skillChargeTheme.fill }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs" style={{ color: PALETTE.subInk }}>每3手触发一次技能</p>
                    <p className="text-xs font-semibold" style={{ color: skillChargeTheme.accent }}>
                      {skillChargeTheme.label}
                    </p>
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
                    强制当前玩家 {playerNames.Kevin}
                  </button>
                  <button
                    onClick={() => {
                      playUiSound("confirm", audioEnabled);
                      setCurrentPlayer("Demi");
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-medium border"
                    style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }}
                  >
                    强制当前玩家 {playerNames.Demi}
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
                className="-mx-3 sm:-mx-1 md:mx-0 mt-2.5 mb-4 rounded-[1.35rem] border p-[3px]"
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
                        const isBlockedCell =
                          !displayCell && isCellBlocked(activeBlockedZones, moveCount, rowIndex, colIndex);
                        const isPendingCell = pendingMove?.[0] === rowIndex && pendingMove?.[1] === colIndex;
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
                            {isBlockedCell && (
                              <div
                                className="absolute left-1/2 top-1/2 z-10 rounded-full border -translate-x-1/2 -translate-y-1/2"
                                style={{
                                  width: `${BLOCKED_MARK_SCALE * 100}%`,
                                  height: `${BLOCKED_MARK_SCALE * 100}%`,
                                  borderColor: "rgba(248, 113, 113, 0.75)",
                                  backgroundColor: "rgba(252, 165, 165, 0.22)",
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
            className="sticky bottom-0 z-30 px-3 sm:px-4 app-floating-dock"
          >
            <div
              className="rounded-2xl border p-2.5"
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
                  onClick={cancelPendingMove}
                  disabled={!pendingMove}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all border ${
                    pendingMove
                      ? ""
                      : ""
                  }`}
                  style={
                    pendingMove
                      ? { backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink, color: PALETTE.ink }
                      : { backgroundColor: "#F9FAFB", borderColor: "#F1F5F9", color: "#D1D5DB" }
                  }
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
          </div>
      )}

      {/* 技能触发弹窗 */}
        <SkillModal
          isOpen={showSkillModal}
          onClose={() => setShowSkillModal(false)}
          skillName={currentSkill.name}
          skillDescription={currentSkill.description}
          playerId={skillOwner}
          playerName={playerNames[skillOwner]}
        />

      {/* 天命弹窗 */}
      <DestinyModal
        isOpen={showDestinyModal}
        onClose={() => setShowDestinyModal(false)}
        winnerName={playerNames[destinyWinner]}
      />

      {/* 获胜弹窗 */}
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        winner={winner ? playerNames[winner] : ""}
        loser={winner ? playerNames[winner === "Kevin" ? "Demi" : "Kevin"] : ""}
        stake={currentStake}
        message={
          currentStake === "谁是大皇帝"
            ? "今天这局，谁才是真正的大皇帝！👑"
            : "愿赌服输，今天这把就靠你啦！💪"
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
