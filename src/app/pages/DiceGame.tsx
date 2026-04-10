import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dices } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { ResultModal } from "../components/ResultModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useBgm } from "../components/BgmProvider";
import { getPlayerInitial, getStoredPlayerNames, type PlayerId } from "../utils/playerSettings";
import {
  playDiceRevealSound,
  playInvalidActionSound,
  playTieRoundSound,
  startDiceRollingLoop,
} from "../utils/soundEffects";

interface Player {
  name: string;
  guess: string;
}

const PALETTE = {
  yellow: "#FFEA6F",
  paleYellow: "#FFFDF0",
  pink: "#FFC9EF",
  palePink: "#FFF9FD",
  blue: "#ABD7FA",
  paleBlue: "#F6FBFE",
  ink: "#1F2430",
  subInk: "#6B7280",
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

export default function DiceGame() {
  const [player1, setPlayer1] = useState<Player>({ name: getStoredPlayerNames().Kevin, guess: "" });
  const [player2, setPlayer2] = useState<Player>({ name: getStoredPlayerNames().Demi, guess: "" });
  const [activePlayer, setActivePlayer] = useState<PlayerId | null>(null);
  const [gameState, setGameState] = useState<"setup" | "rolling" | "result">("setup");
  const [diceResults, setDiceResults] = useState<number[]>([1, 1, 1]);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState("");
  const [loser, setLoser] = useState("");
  const [currentStake, setCurrentStake] = useState("请吃饭");
  const { enabled: audioEnabled } = useBgm();
  const diceIntervalRef = useRef<number | null>(null);
  const diceStopTimerRef = useRef<number | null>(null);
  const stopRollingAudioRef = useRef<(() => void) | null>(null);

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

  useEffect(() => {
    const playerNames = getStoredPlayerNames();
    setPlayer1((current) => ({ ...current, name: playerNames.Kevin }));
    setPlayer2((current) => ({ ...current, name: playerNames.Demi }));

    return () => {
      stopRollingEffects();
    };
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

  const rollDice = () => {
    const guess1 = parseInt(player1.guess);
    const guess2 = parseInt(player2.guess);
    
    if (!player1.guess || !player2.guess || isNaN(guess1) || isNaN(guess2)) {
      playInvalidActionSound(audioEnabled);
      alert("请输入猜测的点数");
      return;
    }

    if (guess1 < 3 || guess1 > 18 || guess2 < 3 || guess2 > 18) {
      playInvalidActionSound(audioEnabled);
      alert("点数范围必须在3-18之间");
      return;
    }

    stopRollingEffects();
    setGameState("rolling");
    const selectedStake = getCurrentStake();
    setCurrentStake(selectedStake);
    stopRollingAudioRef.current = startDiceRollingLoop(audioEnabled);
    
    // Animate dice rolling
    diceIntervalRef.current = window.setInterval(() => {
      setDiceResults([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    // Stop after 2 seconds and show result
    diceStopTimerRef.current = window.setTimeout(() => {
      stopRollingEffects();
      const finalDice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      setDiceResults(finalDice);
      playDiceRevealSound(audioEnabled);
      
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
        playTieRoundSound(audioEnabled);
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
    stopRollingEffects();
    const playerNames = getStoredPlayerNames();
    setPlayer1({ name: playerNames.Kevin, guess: "" });
    setPlayer2({ name: playerNames.Demi, guess: "" });
    setActivePlayer(null);
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
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center relative border border-[#F1E8D4]"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="grid grid-cols-3 gap-1 p-2">
          {Array.from({ length: 9 }).map((_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const hasDot = dots[value].some(([r, c]) => r === row && c === col);
            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  hasDot ? "bg-[#1F2430]" : "bg-transparent"
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="骰子猜点" showBack showHistory />

      <div className="app-page-content">
        {gameState === "setup" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="app-page-center app-page-content--fit flex flex-col gap-4"
          >
            {/* Game visual */}
            <div className="relative h-36 rounded-[1.75rem] overflow-hidden border border-white/80">
              <ImageWithFallback
                src="/images/dice-fight.png"
                alt="骰子游戏"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-4">
                <p className="text-white font-bold text-base">猜猜三个骰子的总点数</p>
              </div>
            </div>

            <div className="app-page-stack app-page-stack--tight">
              <div
                className="rounded-[1.75rem] p-4 border transition-colors"
                style={{
                  backgroundColor: PALETTE.paleBlue,
                  borderColor: activePlayer === "Kevin" ? PALETTE.blue : "#FFFFFF",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: PALETTE.blue }}
                  >
                    {getPlayerInitial(player1.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[28px] leading-none" style={{ color: PALETTE.ink }}>
                      {player1.name}
                    </p>
                    <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                      输入猜测分数 (3-18)
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-[1.35rem] border-2 px-4 py-2.5 transition-colors"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: activePlayer === "Kevin" ? PALETTE.blue : "#E9EEF5",
                  }}
                >
                  <input
                    type="number"
                    placeholder="输入数字"
                    min="3"
                    max="18"
                    value={player1.guess}
                    onFocus={() => setActivePlayer("Kevin")}
                    onBlur={() => setActivePlayer((current) => (current === "Kevin" ? null : current))}
                    onChange={(e) => setPlayer1({ ...player1, guess: e.target.value })}
                    className="w-full bg-transparent text-center text-2xl font-bold outline-none"
                    style={{ color: PALETTE.ink }}
                  />
                </div>
              </div>

              <div
                className="rounded-[1.75rem] p-4 border transition-colors"
                style={{
                  backgroundColor: PALETTE.palePink,
                  borderColor: activePlayer === "Demi" ? PALETTE.pink : "#FFFFFF",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: PALETTE.pink }}
                  >
                    {getPlayerInitial(player2.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[28px] leading-none" style={{ color: PALETTE.ink }}>
                      {player2.name}
                    </p>
                    <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                      输入猜测分数 (3-18)
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-[1.35rem] border-2 px-4 py-2.5 transition-colors"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: activePlayer === "Demi" ? PALETTE.pink : "#F5E8F1",
                  }}
                >
                  <input
                    type="number"
                    placeholder="输入数字"
                    min="3"
                    max="18"
                    value={player2.guess}
                    onFocus={() => setActivePlayer("Demi")}
                    onBlur={() => setActivePlayer((current) => (current === "Demi" ? null : current))}
                    onChange={(e) => setPlayer2({ ...player2, guess: e.target.value })}
                    className="w-full bg-transparent text-center text-2xl font-bold outline-none"
                    style={{ color: PALETTE.ink }}
                  />
                </div>
              </div>
            </div>

            <Button size="md" onClick={rollDice} className="w-full">
              <Dices className="w-5 h-5 inline mr-2" />
              开启挑战
            </Button>

            <p className="text-center text-xs" style={{ color: PALETTE.subInk }}>
              点数范围：3-18 · 猜得最接近的人获胜
            </p>
          </motion.div>
        )}

        {(gameState === "rolling" || gameState === "result") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="app-page-center text-center"
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
                  <div
                    className="rounded-2xl p-6 border"
                    style={{ backgroundColor: PALETTE.paleYellow, borderColor: "#F5DA57" }}
                  >
                    <p className="mb-2" style={{ color: PALETTE.subInk }}>总点数</p>
                    <p className="text-5xl font-bold" style={{ color: PALETTE.ink }}>
                      {diceResults.reduce((a, b) => a + b, 0)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="rounded-2xl p-4 border"
                      style={{ backgroundColor: PALETTE.paleBlue, borderColor: PALETTE.blue }}
                    >
                      <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{player1.name}</p>
                      <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>猜{player1.guess}</p>
                      <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
                        差距 {Math.abs(parseInt(player1.guess) - diceResults.reduce((a, b) => a + b, 0))}
                      </p>
                    </div>
                    <div
                      className="rounded-2xl p-4 border"
                      style={{ backgroundColor: PALETTE.palePink, borderColor: PALETTE.pink }}
                    >
                      <p className="text-sm mb-1" style={{ color: PALETTE.subInk }}>{player2.name}</p>
                      <p className="text-2xl font-bold" style={{ color: PALETTE.ink }}>猜{player2.guess}</p>
                      <p className="text-sm mt-1" style={{ color: PALETTE.subInk }}>
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
