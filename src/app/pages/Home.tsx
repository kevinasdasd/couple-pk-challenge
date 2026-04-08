import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Dices, Smile, ListChecks, Trophy } from "lucide-react";
import { Button } from "../components/Button";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 pb-8">
      {/* Header */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => navigate("/history")}
          className="p-3 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow"
        >
          <Trophy className="w-5 h-5 text-orange-500" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="px-6 pt-8 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="inline-block bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-full text-sm font-medium shadow-lg mb-4">
            D&K专属小游戏
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            情侣PK挑战
          </h1>
          <p className="text-lg text-gray-600 max-w-xs mx-auto">
            谁是大皇帝，靠实力说话 🎲
          </p>
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-64 h-64 mx-auto mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200/30 to-blue-200/30 rounded-full blur-3xl" />
          <ImageWithFallback
            src="images/couple-fight.png"
            alt="情侣游戏"
            className="relative w-full h-full object-cover rounded-3xl shadow-2xl"
          />
        </motion.div>
      </div>

      {/* Quick Game Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-6 mb-8"
      >
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => navigate("/dice")}
            className="bg-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center mb-3 shadow-md">
              <Dices className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">骰子猜点</h3>
            <p className="text-xs text-gray-500">比拼运气</p>
          </div>

          <div
            onClick={() => navigate("/crocodile")}
            className="bg-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center mb-3 shadow-md">
              <Smile className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">鳄鱼拔牙</h3>
            <p className="text-xs text-gray-500">刺激紧张</p>
          </div>
        </div>
      </motion.div>

      {/* Stake Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-6 mb-8"
      >
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">今日赌注</h3>
            <button
              onClick={() => navigate("/stake")}
              className="text-sm text-orange-500 font-medium"
            >
              修改
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">点外卖、请客吃饭、谁当大皇帝</span>
          </div>
        </div>
      </motion.div>

      {/* Main CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-6"
      >
        <Button
          size="lg"
          onClick={() => navigate("/select")}
          className="w-full"
        >
          🎯 开始挑战
        </Button>
      </motion.div>
    </div>
  );
}