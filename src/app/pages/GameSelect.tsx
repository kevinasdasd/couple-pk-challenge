import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Dices, Smile } from "lucide-react";
import { Header } from "../components/Header";
import { GameCard } from "../components/GameCard";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export default function GameSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen app-screen-gradient">
      <Header title="选择游戏" showBack showHistory />

      <div className="px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <p className="text-gray-600">选择一个游戏来决定今天的输赢</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[3/1]">
              <ImageWithFallback
                src="/images/dice-fight.png"
                alt="三枚骰子猜点数"
                className="w-full h-full object-cover"
              />
            </div>
            <GameCard
              title="三枚骰子猜点数"
              description="猜测三个骰子的总点数，最接近的人获胜。比运气，看谁更有手气！"
              icon={<Dices className="w-8 h-8" />}
              color="orange"
              onClick={() => navigate("/dice")}
            />
          </div>

          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[3/1]">
              <ImageWithFallback
                src="/images/cocodi.png"
                alt="鳄鱼拔牙"
                className="w-full h-full object-cover"
              />
            </div>
            <GameCard
              title="鳄鱼拔牙"
              description="轮流按下鳄鱼的牙齿，触发机关的人输掉游戏。紧张刺激，考验胆量！"
              icon={<Smile className="w-8 h-8" />}
              color="blue"
              onClick={() => navigate("/crocodile")}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-gray-500">
            💡 小提示：输掉的人要履行今天的赌注哦
          </p>
        </motion.div>
      </div>
    </div>
  );
}
