import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Dices, Smile, Grid3x3 } from "lucide-react";
import { Header } from "../components/Header";
import { GameCard } from "../components/GameCard";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export default function GameSelect() {
  const navigate = useNavigate();

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="选择游戏" showBack showHistory />

      <div className="app-page-content">
        <div className="app-page-center app-page-content--fit flex flex-col gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-[15px] text-gray-600">选择一个游戏来决定今天的输赢</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="app-page-stack app-page-stack--tight"
          >
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[4.1/1]">
                <ImageWithFallback
                  src="/images/dice-fight.png"
                  alt="三枚骰子猜点数"
                  className="w-full h-full object-cover"
                />
              </div>
              <GameCard
                title="三枚骰子猜点数"
                description="猜三个骰子的总点数，最接近的人获胜。"
                icon={<Dices className="w-6 h-6" />}
                color="pink"
                onClick={() => navigate("/dice")}
              />
            </div>

            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[4.1/1]">
                <ImageWithFallback
                  src="/images/cocodi.png"
                  alt="鳄鱼拔牙"
                  className="w-full h-full object-cover"
                />
              </div>
              <GameCard
                title="鳄鱼拔牙"
                description="轮流按牙，触发机关的人输掉游戏。"
                icon={<Smile className="w-6 h-6" />}
                color="green"
                onClick={() => navigate("/crocodile")}
              />
            </div>

            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[4.1/1]">
                <ImageWithFallback
                  src="/images/wuziqi.png"
                  alt="胜天半子"
                  className="w-full h-full object-cover"
                />
              </div>
              <GameCard
                title="胜天半子"
                description="搅局的五子棋对决，既拼棋力也拼运气。"
                icon={<Grid3x3 className="w-6 h-6" />}
                color="blue"
                onClick={() => navigate("/gobang")}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center pt-1"
          >
            <p className="text-[13px] text-gray-500">
              💡 小提示：输掉的人要履行今天的赌注哦
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
