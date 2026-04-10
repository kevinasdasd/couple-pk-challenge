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

export default function History() {
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [stats, setStats] = useState({ player1: 0, player2: 0 });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { enabled: audioEnabled } = useBgm();

  useEffect(() => {
    const saved = localStorage.getItem("gameHistory");
    if (saved) {
      const data = JSON.parse(saved);
      setHistory(data);

      // Calculate stats
      const losers: { [key: string]: number } = {};
      data.forEach((record: GameRecord) => {
        losers[record.loser] = (losers[record.loser] || 0) + 1;
      });
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

  return (
    <div className="min-h-screen app-screen-gradient pb-8">
      <Header title="战绩历史" showBack />

      <div className="px-6 py-8">
        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5" />
              <span className="text-sm opacity-90">总场次</span>
            </div>
            <p className="text-3xl font-bold">{history.length}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5" />
              <span className="text-sm opacity-90">本月</span>
            </div>
            <p className="text-3xl font-bold">
              {history.filter((r) => {
                const recordDate = new Date(r.date);
                const now = new Date();
                return (
                  recordDate.getMonth() === now.getMonth() &&
                  recordDate.getFullYear() === now.getFullYear()
                );
              }).length}
            </p>
          </div>
        </motion.div>

        {/* Top losers */}
        {topLosers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h3 className="font-bold text-gray-800 mb-4">输得最多的人 😅</h3>
            <div className="space-y-3">
              {topLosers.map(([name, count], index) => (
                <div
                  key={name}
                  className="bg-white rounded-2xl p-4 shadow-md flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                        : index === 1
                        ? "bg-gradient-to-br from-gray-300 to-gray-400"
                        : "bg-gradient-to-br from-orange-300 to-orange-400"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{name}</p>
                    <p className="text-sm text-gray-500">输了 {count} 次</p>
                  </div>
                  {index === 0 && <span className="text-2xl">👑</span>}
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
                className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-md">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">还没有任何挑战记录</p>
              <p className="text-sm text-gray-400 mt-2">快去玩几局吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-4 shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{record.game}</span>
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
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
