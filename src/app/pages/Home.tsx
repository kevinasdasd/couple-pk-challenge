import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Dices, Smile, ListChecks, Trophy, Grid3x3, Volume2, VolumeX } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useBgm } from "../components/BgmProvider";
import { playUiSound } from "../utils/soundEffects";

const HOME_COLORS = {
  yellow: "#FFEA6F",
  pink: "#FFC9EF",
  green: "#C9F100",
  blue: "#ABD7FA",
  paleYellow: "#FFFDF0",
  palePink: "#FFF9FD",
  paleGreen: "#F9FEE5",
  paleBlue: "#F6FBFE",
  ink: "#1F2430",
  subInk: "#5D6673",
} as const;

export default function Home() {
  const navigate = useNavigate();
  const { enabled, available, toggle } = useBgm();

  return (
    <div className="min-h-screen app-screen-gradient pb-8">
      {/* Header */}
      <div className="flex justify-end gap-2 px-4 pt-4 pb-1">
        <button
          onClick={() => {
            playUiSound("confirm", enabled);
            toggle();
          }}
          className="p-3 rounded-full transition-colors border"
          style={{
            backgroundColor: HOME_COLORS.paleYellow,
            borderColor: HOME_COLORS.yellow,
            color: HOME_COLORS.ink,
          }}
          title={available ? (enabled ? "关闭音乐" : "开启音乐") : "BGM 文件暂不可用"}
          aria-label={available ? (enabled ? "关闭音乐" : "开启音乐") : "BGM 文件暂不可用"}
        >
          {enabled && available ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button
          onClick={() => {
            playUiSound("navigate", enabled);
            navigate("/history");
          }}
          className="p-3 rounded-full transition-colors border"
          style={{
            backgroundColor: HOME_COLORS.yellow,
            color: HOME_COLORS.ink,
            borderColor: "#F5DA57",
          }}
        >
          <Trophy className="w-5 h-5" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="px-6 pt-3 pb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3"
        >
          <div
            className="inline-block px-6 py-2 rounded-full text-sm font-semibold shadow-lg mb-3"
            style={{
              backgroundColor: HOME_COLORS.yellow,
              color: HOME_COLORS.ink,
              boxShadow: "0 14px 28px rgba(255, 234, 111, 0.35)",
            }}
          >
            D&K专属小游戏
          </div>
          <h1 className="text-4xl font-black mb-2" style={{ color: HOME_COLORS.ink }}>
            情侣PK挑战
          </h1>
          <p className="text-lg max-w-xs mx-auto" style={{ color: HOME_COLORS.subInk }}>
            谁是大皇帝，靠实力说话 🎲
          </p>
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-64 h-64 mx-auto mb-5"
        >
          <div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 234, 111, 0.28), rgba(255, 201, 239, 0.22), rgba(171, 215, 250, 0.22))",
            }}
          />
          <ImageWithFallback
            src="images/couple-fight.png"
            alt="情侣游戏"
            className="relative w-full h-full object-cover rounded-3xl shadow-2xl"
            style={{ boxShadow: "0 24px 44px rgba(31, 36, 48, 0.08)" }}
          />
        </motion.div>
      </div>

      {/* Quick Game Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-6 mb-5"
      >
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => {
              playUiSound("navigate", enabled);
              navigate("/dice");
            }}
            className="rounded-2xl p-3 border shadow-lg hover:shadow-xl transition-shadow cursor-pointer active:scale-95 transition-transform aspect-square flex flex-col items-center justify-center text-center"
            style={{
              backgroundColor: HOME_COLORS.palePink,
              borderColor: "rgba(255, 201, 239, 0.55)",
              boxShadow: "0 18px 32px rgba(255, 201, 239, 0.18)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-md mx-auto"
              style={{
                backgroundColor: HOME_COLORS.pink,
                boxShadow: "0 10px 20px rgba(255, 201, 239, 0.35)",
              }}
            >
              <Dices className="w-5 h-5" style={{ color: HOME_COLORS.ink }} />
            </div>
            <h3 className="font-bold mb-2 text-sm leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.ink }}>
              骰子猜点
            </h3>
            <p className="text-xs leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.subInk }}>
              比拼运气
            </p>
          </div>

          <div
            onClick={() => {
              playUiSound("navigate", enabled);
              navigate("/crocodile");
            }}
            className="rounded-2xl p-3 border shadow-lg hover:shadow-xl transition-shadow cursor-pointer active:scale-95 transition-transform aspect-square flex flex-col items-center justify-center text-center"
            style={{
              backgroundColor: HOME_COLORS.paleGreen,
              borderColor: "rgba(201, 241, 0, 0.5)",
              boxShadow: "0 18px 32px rgba(201, 241, 0, 0.14)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-md mx-auto"
              style={{
                backgroundColor: HOME_COLORS.green,
                boxShadow: "0 10px 20px rgba(201, 241, 0, 0.30)",
              }}
            >
              <Smile className="w-5 h-5" style={{ color: HOME_COLORS.ink }} />
            </div>
            <h3 className="font-bold mb-2 text-sm leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.ink }}>
              鳄鱼拔牙
            </h3>
            <p className="text-xs leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.subInk }}>
              刺激紧张
            </p>
          </div>

          <div
            onClick={() => {
              playUiSound("navigate", enabled);
              navigate("/gobang");
            }}
            className="rounded-2xl p-3 border shadow-lg hover:shadow-xl transition-shadow cursor-pointer active:scale-95 transition-transform aspect-square flex flex-col items-center justify-center text-center"
            style={{
              backgroundColor: HOME_COLORS.paleBlue,
              borderColor: "rgba(171, 215, 250, 0.55)",
              boxShadow: "0 18px 32px rgba(171, 215, 250, 0.18)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-md mx-auto"
              style={{
                backgroundColor: HOME_COLORS.blue,
                boxShadow: "0 10px 20px rgba(171, 215, 250, 0.35)",
              }}
            >
              <Grid3x3 className="w-5 h-5" style={{ color: HOME_COLORS.ink }} />
            </div>
            <h3 className="font-bold mb-2 text-sm leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.ink }}>
              整活五子棋
            </h3>
            <p className="text-xs leading-none min-h-4 flex items-center" style={{ color: HOME_COLORS.subInk }}>
              棋力较量
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stake Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-6 mb-5"
      >
        <div
          className="rounded-2xl p-5 shadow-lg border"
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "rgba(255, 255, 255, 0.85)",
            boxShadow: "0 20px 36px rgba(31, 36, 48, 0.06)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ color: HOME_COLORS.ink }}>今日赌注</h3>
            <button
              onClick={() => {
                playUiSound("navigate", enabled);
                navigate("/stake");
              }}
              className="text-sm font-medium"
              style={{ color: HOME_COLORS.subInk }}
            >
              修改
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" style={{ color: "#A7AFBC" }} />
            <span style={{ color: HOME_COLORS.subInk }}>点外卖、请客吃饭、谁当大皇帝</span>
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
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            playUiSound("confirm", enabled);
            navigate("/select");
          }}
          className="w-full rounded-full py-4 text-xl font-bold transition-shadow"
          style={{
            backgroundColor: HOME_COLORS.yellow,
            color: HOME_COLORS.ink,
            boxShadow: "0 18px 36px rgba(255, 234, 111, 0.42)",
          }}
        >
          开始挑战
        </motion.button>
      </motion.div>
    </div>
  );
}
