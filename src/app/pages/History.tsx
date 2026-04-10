import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Flame, Calendar, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { useBgm } from "../components/BgmProvider";
import { playUiSound } from "../utils/soundEffects";

interface GameRecord {
  date: string;
  game: string;
  loser: string;
  stake: string;
}

const HISTORY_PALETTE = {
  yellow: {
    card: "bg-[#FFFDF0] border-[#F3E7A5]",
    badge: "bg-[#FFEA6F] border-[#F3D95C] text-[#1F2430]",
    chip: "bg-[#FFF4B8] text-[#715A0E]",
    accent: "text-[#B89511]",
  },
  pink: {
    card: "bg-[#FFF9FD] border-[#F3D3E8]",
    badge: "bg-[#FFC9EF] border-[#F2B8DF] text-[#1F2430]",
    chip: "bg-[#FFE2F5] text-[#9A6287]",
    accent: "text-[#BE7BA7]",
  },
  green: {
    card: "bg-[#F9FEE5] border-[#DDECA8]",
    badge: "bg-[#C9F100] border-[#B6DB00] text-[#1F2430]",
    chip: "bg-[#EBF8B7] text-[#607B00]",
    accent: "text-[#7FA100]",
  },
  blue: {
    card: "bg-[#F6FBFE] border-[#D3E7F7]",
    badge: "bg-[#ABD7FA] border-[#93C4EC] text-[#1F2430]",
    chip: "bg-[#DCEFFE] text-[#5D88A9]",
    accent: "text-[#6E99BC]",
  },
} as const;

const getRecordPalette = (gameName: string) => {
  if (gameName.includes("骰")) return HISTORY_PALETTE.pink;
  if (gameName.includes("鳄")) return HISTORY_PALETTE.green;
  if (gameName.includes("胜天") || gameName.includes("棋")) return HISTORY_PALETTE.blue;
  return HISTORY_PALETTE.yellow;
};

export default function History() {
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { enabled: audioEnabled } = useBgm();

  useEffect(() => {
    const saved = localStorage.getItem("gameHistory");
    if (saved) {
      const data = JSON.parse(saved);
      setHistory(data);
    }
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("gameHistory");
    setHistory([]);
    setShowClearConfirm(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  // Calculate loser stats
  const loserCounts: { [key: string]: number } = {};
  history.forEach((record) => {
    loserCounts[record.loser] = (loserCounts[record.loser] || 0) + 1;
  });

  const topLosers = Object.entries(loserCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const currentMonthCount = history.filter((record) => {
    const recordDate = new Date(record.date);
    const now = new Date();
    return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="战绩历史" showBack />

      <div className="app-page-content">
        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 mb-5"
        >
          <div className="rounded-2xl border border-[#F3E7A5] bg-[#FFFDF0] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F3D95C] bg-[#FFEA6F] text-[#1F2430]">
                <Trophy className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-medium text-[#6B7280]">总场次</span>
            </div>
            <p className="text-3xl font-bold text-[#1F2430]">{history.length}</p>
          </div>

          <div className="rounded-2xl border border-[#D3E7F7] bg-[#F6FBFE] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#93C4EC] bg-[#ABD7FA] text-[#1F2430]">
                <Flame className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-medium text-[#6B7280]">本月</span>
            </div>
            <p className="text-3xl font-bold text-[#1F2430]">{currentMonthCount}</p>
          </div>
        </motion.div>

        {/* Top losers */}
        {topLosers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-5"
          >
            <h3 className="mb-3 font-bold text-gray-800">输得最多的人</h3>
            <div className="space-y-3">
              {topLosers.map(([name, count], index) => (
                <div
                  key={name}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    index === 0
                      ? HISTORY_PALETTE.yellow.card
                      : index === 1
                      ? HISTORY_PALETTE.pink.card
                      : HISTORY_PALETTE.green.card
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border font-bold ${
                      index === 0
                        ? HISTORY_PALETTE.yellow.badge
                        : index === 1
                        ? HISTORY_PALETTE.pink.badge
                        : HISTORY_PALETTE.green.badge
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{name}</p>
                    <p className="text-sm text-gray-500">输了 {count} 次</p>
                  </div>
                  {index === 0 && <span className={`text-xl ${HISTORY_PALETTE.yellow.accent}`}>👑</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* History list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">历史记录</h3>
            {history.length > 0 && (
              <button
                onClick={() => {
                  playUiSound("confirm", audioEnabled);
                  setShowClearConfirm(true);
                }}
                className="flex items-center gap-1 rounded-full border border-[#F2B8DF] bg-[#FFF9FD] px-3 py-1.5 text-sm font-medium text-[#B66FA0]"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-[#D3E7F7] bg-[#F6FBFE] p-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#93C4EC] bg-[#ABD7FA] text-[#1F2430]">
                <Calendar className="h-6 w-6" />
              </div>
              <p className="text-gray-600">还没有任何挑战记录</p>
              <p className="mt-2 text-sm text-gray-400">快去玩几局吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl border p-4 ${getRecordPalette(record.game).card}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{record.game}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getRecordPalette(record.game).chip}`}>
                          {record.stake}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        输家：<span className="font-medium text-gray-800">{record.loser}</span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(record.date)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showClearConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => {
                playUiSound("back", audioEnabled);
                setShowClearConfirm(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
            >
              <div className="rounded-[28px] bg-white border border-[#FFEA6F] p-6 text-center">
                <p className="text-2xl font-bold text-[#1F2430] mb-3">确认清空吗？</p>
                <p className="text-sm text-[#6B7280] mb-6">历史记录会一次性清空，之后就看不到啦。</p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    sound="back"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button variant="primary" sound="confirm" onClick={clearHistory} className="flex-1">
                    确认清空
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
