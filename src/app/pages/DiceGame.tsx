import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dices } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface Player {
  name: string;
  guess: string;
}

const STAKE_LABELS: Record<string, string> = {
  coffee: "买咖啡",
  massage: "做按摩",
  dinner: "请吃饭",
  emperor: "谁是大皇帝",
  order: "点外卖",
  receive: "收外卖",
  eat: "吃外卖",
};

export default function DiceGame() {
  const [player1, setPlayer1] = useState<Player>({ name: "Kevin", guess: "" });
  const [player2, setPlayer2] = useState<Player>({ name: "Demi", guess: "" });
  const [gameState, setGameState] = useState<"setup" | "rolling" | "result">("setup");
  const [diceResults, setDiceResults] = useState<number[]>([1, 1, 1]);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState("");
  const [loser, setLoser] = useState("");
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

  const rollDice = () => {
    const guess1 = parseInt(player1.guess);
    const guess2 = parseInt(player2.guess);
    
    if (!player1.guess || !player2.guess || isNaN(guess1) || isNaN(guess2)) {
      alert("请输入猜测的点数");
      return;
    }

    if (guess1 < 3 || guess1 > 18 || guess2 < 3 || guess2 > 18) {
      alert("点数范围必须在3-18之间");
      return;
    }

    setGameState("rolling");
    const selectedStake = getCurrentStake();
    setCurrentStake(selectedStake);
    
    // Animate dice rolling
    const interval = setInterval(() => {
      setDiceResults([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    // Stop after 2 seconds and show result
    setTimeout(() => {
      clearInterval(interval);
      const finalDice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      setDiceResults(finalDice);
      
      const total = finalDice.reduce((a, b) => a + b, 0);
      const diff1 = Math.abs(parseInt(player1.guess) - total);
      const diff2 = Math.abs(parseInt(player2.guess) - total);
      
      let roundWinner = "";
      let roundLoser = "";

      if (diff1 < diff2) {
        roundWinner = player1.name;
        roundLoser = player2.name;
      } else if (diff2 < diff1) {
        roundWinner = player2.name;
        roundLoser = player1.name;
      } else {
        roundWinner = "平局";
        roundLoser = "重新来过";
      }

      setWinner(roundWinner);
      setLoser(roundLoser);
      setGameState("result");

      if (roundWinner !== "平局") {
        const history = JSON.parse(localStorage.getItem("gameHistory") || "[]");
        history.unshift({
          date: new Date().toISOString(),
          game: "骰子猜点",
          loser: roundLoser,
          stake: selectedStake,
        });
        localStorage.setItem("gameHistory", JSON.stringify(history.slice(0, 50)));
      }
      
      setTimeout(() => setShowResult(true), 1500);
    }, 2000);
  };

  const resetGame = () => {
    setPlayer1({ name: "Kevin", guess: "" });
    setPlayer2({ name: "Demi", guess: "" });
    setGameState("setup");
    setDiceResults([1, 1, 1]);
    setShowResult(false);
    setCurrentStake(getCurrentStake());
  };

  const renderDice = (value: number) => {
    const dots: { [key: number]: number[][] } = {
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
    };

    return (
      <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center relative">
        <div className="grid grid-cols-3 gap-1 p-2">
          {Array.from({ length: 9 }).map((_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const hasDot = dots[value].some(([r, c]) => r === row && c === col);
            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  hasDot ? "bg-orange-500" : "bg-transparent"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      <Header title="骰子猜点" showBack showHistory />

      <div className="px-6 py-8">
        {gameState === "setup" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Game visual */}
            <div className="relative h-48 rounded-3xl overflow-hidden mb-6">
              <ImageWithFallback
                src="/images/dice-fight.png"
                alt="骰子游戏"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-6">
                <p className="text-white font-bold text-lg">猜猜三个骰子的总点数</p>
              </div>
            </div>

            {/* Player 1 */}
            <div className="bg-white rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                  K
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{player1.name}</p>
                  <p className="text-sm text-gray-500">输入猜测点数 (3-18)</p>
                </div>
              </div>
              <input
                type="number"
                placeholder="输入数字"
                min="3"
                max="18"
                value={player1.guess}
                onChange={(e) => setPlayer1({ ...player1, guess: e.target.value })}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            {/* Player 2 */}
            <div className="bg-white rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  D
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{player2.name}</p>
                  <p className="text-sm text-gray-500">输入猜测点数 (3-18)</p>
                </div>
              </div>
              <input
                type="number"
                placeholder="输入数字"
                min="3"
                max="18"
                value={player2.guess}
                onChange={(e) => setPlayer2({ ...player2, guess: e.target.value })}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <Button size="lg" onClick={rollDice} className="w-full">
              <Dices className="w-5 h-5 inline mr-2" />
              开启挑战
            </Button>

            <p className="text-center text-sm text-gray-500">
              点数范围：3-18 · 猜得最接近的人获胜
            </p>
          </motion.div>
        )}

        {(gameState === "rolling" || gameState === "result") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {gameState === "rolling" ? "骰子滚动中..." : "开奖结果"}
              </h2>
              <div className="flex justify-center gap-4 mb-6">
                {diceResults.map((value, i) => (
                  <motion.div
                    key={i}
                    animate={gameState === "rolling" ? { rotate: 360 } : {}}
                    transition={{ duration: 0.3, repeat: gameState === "rolling" ? Infinity : 0 }}
                  >
                    {renderDice(value)}
                  </motion.div>
                ))}
              </div>
              {gameState === "result" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 shadow-lg">
                    <p className="text-gray-600 mb-2">总点数</p>
                    <p className="text-5xl font-bold text-orange-600">
                      {diceResults.reduce((a, b) => a + b, 0)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-4 shadow-md">
                      <p className="text-sm text-gray-500 mb-1">{player1.name}</p>
                      <p className="text-2xl font-bold text-gray-800">猜{player1.guess}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        差距 {Math.abs(parseInt(player1.guess) - diceResults.reduce((a, b) => a + b, 0))}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-md">
                      <p className="text-sm text-gray-500 mb-1">{player2.name}</p>
                      <p className="text-2xl font-bold text-gray-800">猜{player2.guess}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        差距 {Math.abs(parseInt(player2.guess) - diceResults.reduce((a, b) => a + b, 0))}
                      </p>
                    </div>
                  </div>

                  <Button size="lg" onClick={resetGame} className="w-full">
                    再来一局
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <ResultModal
        isOpen={showResult}
        onClose={() => setShowResult(false)}
        winner={winner}
        loser={loser}
        stake={currentStake}
        message={currentStake === "谁是大皇帝" ? "今天这把，你就是大皇帝！👑" : "愿赌服输，今天就靠你啦！💪"}
      />
    </div>
  );
}