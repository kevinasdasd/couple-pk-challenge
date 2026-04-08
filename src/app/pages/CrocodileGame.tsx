import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smile } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const STAKE_LABELS: Record<string, string> = {
  coffee: "买咖啡",
  massage: "做按摩",
  dinner: "请吃饭",
  emperor: "谁是大皇帝",
  order: "点外卖",
  receive: "收外卖",
};

export default function CrocodileGame() {
  const [player1Name] = useState("Demi");
  const [player2Name] = useState("Kevin");
  const [gameStarted, setGameStarted] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [teeth, setTeeth] = useState<boolean[]>(Array(12).fill(false));
  const [dangerTooth, setDangerTooth] = useState<number>(-1);
  const [gameOver, setGameOver] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isBiting, setIsBiting] = useState(false);
  const [currentStake, setCurrentStake] = useState("请吃饭");

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
    // Auto-start game on mount
    setDangerTooth(Math.floor(Math.random() * 12));
    setCurrentStake(getCurrentStake());
  }, []);

  const startGame = () => {
    setDangerTooth(Math.floor(Math.random() * 12));
    setTeeth(Array(12).fill(false));
    setCurrentPlayer(1);
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setCurrentStake(getCurrentStake());
  };

  const pressTooth = (index: number) => {
    if (teeth[index] || gameOver) return;

    const newTeeth = [...teeth];
    newTeeth[index] = true;
    setTeeth(newTeeth);

    if (index === dangerTooth) {
      const selectedStake = getCurrentStake();
      setCurrentStake(selectedStake);
      setIsBiting(true);
      setTimeout(() => {
        setGameOver(true);
        
        // Save to history
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

  const resetGame = () => {
    setTeeth(Array(12).fill(false));
    setGameOver(false);
    setShowResult(false);
    setIsBiting(false);
    setCurrentPlayer(1);
    setDangerTooth(Math.floor(Math.random() * 12));
    setCurrentStake(getCurrentStake());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <Header title="鳄鱼拔牙" showBack showHistory />

      <div className="px-6 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Current player indicator */}
          {!gameOver && (
            <motion.div
              key={currentPlayer}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`rounded-2xl p-4 text-center shadow-lg ${
                currentPlayer === 1
                  ? "bg-gradient-to-br from-orange-100 to-orange-200"
                  : "bg-gradient-to-br from-blue-100 to-blue-200"
              }`}
            >
              <p className="text-sm text-gray-600 mb-1">当前轮到</p>
              <p className="text-2xl font-bold text-gray-800">
                {currentPlayer === 1 ? player1Name : player2Name}
              </p>
            </motion.div>
          )}

          {/* Crocodile */}
          <div className="relative">
            <motion.div
              animate={isBiting ? { rotate: [0, -5, 5, -5, 5, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`rounded-3xl p-8 shadow-2xl transition-colors duration-300 ${
                isBiting
                  ? "bg-gradient-to-br from-red-500 to-red-700"
                  : "bg-gradient-to-br from-green-400 to-green-600"
              }`}
            >
              <div className="text-center mb-4">
                <motion.div
                  animate={isBiting ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-2"
                >
                  🐊
                </motion.div>
                {isBiting && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white font-bold text-xl"
                  >
                    咬到啦！
                  </motion.p>
                )}
              </div>

              {/* Teeth */}
              <div className="grid grid-cols-6 gap-3">
                {teeth.map((pressed, index) => (
                  <motion.button
                    key={index}
                    whileTap={{ scale: pressed || gameOver ? 1 : 0.9 }}
                    onClick={() => pressTooth(index)}
                    disabled={pressed || gameOver}
                    className={`aspect-square rounded-xl transition-all ${
                      pressed
                        ? "bg-green-700 shadow-inner"
                        : "bg-white shadow-lg hover:shadow-xl active:shadow-inner"
                    }`}
                  >
                    {!pressed && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-3 h-6 bg-gray-200 rounded-sm" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">已按下</span>
              <span className="text-sm font-bold text-gray-800">
                {teeth.filter((t) => t).length} / 12
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(teeth.filter((t) => t).length / 12) * 100}%` }}
                className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full"
              />
            </div>
          </div>

          {gameOver && (
            <Button size="lg" variant="secondary" onClick={resetGame} className="w-full">
              再来一局
            </Button>
          )}
        </motion.div>
      </div>

      <ResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        winner={currentPlayer === 1 ? player2Name : player1Name}
        loser={currentPlayer === 1 ? player1Name : player2Name}
        stake={currentStake}
        message={currentStake === "谁是大皇帝" ? "今天这把，你就是大皇帝！👑" : "愿赌服输，今天就靠你啦！💪"}
      />
    </div>
  );
}