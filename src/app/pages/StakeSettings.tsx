import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Plus, Coffee, Hand, Utensils, Crown, ShoppingCart, PackageCheck } from "lucide-react";
import { Header } from "../components/Header";
import { useBgm } from "../components/BgmProvider";
import { playUiSound } from "../utils/soundEffects";

const STAKE_PALETTE = {
  yellow: {
    strong: "bg-[#FFEA6F] border-[#F3D95C] text-[#1F2430]",
    soft: "bg-[#FFFDF0] border-[#F3E7A5] text-[#38404C]",
    ring: "focus:ring-[#FFEA6F]",
    check: "text-[#B89511]",
    chip: "bg-[#FFF6C6] text-[#6D5B16]",
  },
} as const;

const DEFAULT_STAKES = [
  { id: "coffee", label: "买咖啡", icon: Coffee },
  { id: "massage", label: "做按摩", icon: Hand },
  { id: "dinner", label: "请吃饭", icon: Utensils },
  { id: "emperor", label: "谁是大皇帝", icon: Crown },
  { id: "order", label: "点外卖", icon: ShoppingCart },
  { id: "receive", label: "收外卖", icon: PackageCheck },
];

export default function StakeSettings() {
  const [selectedStakes, setSelectedStakes] = useState<string[]>([]);
  const [customStakes, setCustomStakes] = useState<string[]>([]);
  const [newStake, setNewStake] = useState("");
  const { enabled: audioEnabled } = useBgm();

  useEffect(() => {
    const saved = localStorage.getItem("selectedStakes");
    if (saved) {
      setSelectedStakes(JSON.parse(saved));
    } else {
      setSelectedStakes(["coffee", "dinner"]);
    }

    const savedCustom = localStorage.getItem("customStakes");
    if (savedCustom) {
      setCustomStakes(JSON.parse(savedCustom));
    }
  }, []);

  const toggleStake = (id: string) => {
    playUiSound(selectedStakes.includes(id) ? "back" : "confirm", audioEnabled);
    const newSelected = selectedStakes.includes(id)
      ? selectedStakes.filter((s) => s !== id)
      : [...selectedStakes, id];
    setSelectedStakes(newSelected);
    localStorage.setItem("selectedStakes", JSON.stringify(newSelected));
  };

  const addCustomStake = () => {
    if (!newStake.trim()) return;
    playUiSound("confirm", audioEnabled);
    const newCustom = [...customStakes, newStake.trim()];
    setCustomStakes(newCustom);
    localStorage.setItem("customStakes", JSON.stringify(newCustom));
    setNewStake("");
  };

  const removeCustomStake = (stake: string) => {
    playUiSound("back", audioEnabled);
    const newCustom = customStakes.filter((s) => s !== stake);
    setCustomStakes(newCustom);
    localStorage.setItem("customStakes", JSON.stringify(newCustom));
  };

  return (
    <div className="app-mobile-page app-screen-gradient">
      <Header title="赌注设置" showBack showHistory />

      <div className="app-page-content">
        <div className="app-page-center app-page-content--fit flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
          >
            <h3 className="font-bold text-gray-800 mb-3 text-[1.05rem]">常用赌注</h3>
            <div className="grid grid-cols-3 auto-rows-fr gap-2">
              {DEFAULT_STAKES.map((stake) => {
                const IconComponent = stake.icon;
                const isSelected = selectedStakes.includes(stake.id);
                const palette = STAKE_PALETTE.yellow;
                return (
                  <motion.button
                    key={stake.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleStake(stake.id)}
                    className={`relative flex h-full min-h-[108px] flex-col items-center justify-center rounded-[1.35rem] border p-3 transition-all ${
                      isSelected ? palette.strong : palette.soft
                    }`}
                  >
                    <div className="mb-2 flex justify-center">
                      <IconComponent className="w-6 h-6" strokeWidth={2} />
                    </div>
                    <div className="flex min-h-9 items-center justify-center text-center text-sm font-medium leading-tight">
                      {stake.label}
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center border border-white"
                      >
                        <Check className={`w-3.5 h-3.5 ${palette.check}`} />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Custom stakes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-bold text-gray-800 mb-3 text-[1.05rem]">自定义赌注</h3>

            <div className="rounded-2xl border border-[#F3E7A5] bg-[#FFFDF0] p-3 mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入自定义赌注..."
                  value={newStake}
                  onChange={(e) => setNewStake(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addCustomStake();
                    }
                  }}
                  className="flex-1 rounded-xl border border-[#F6E59A] bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#FFEA6F]"
                />
                <button
                  onClick={addCustomStake}
                  className="w-10 h-10 rounded-xl border border-[#F3D95C] bg-[#FFEA6F] flex items-center justify-center text-[#1F2430] transition-colors"
                >
                  <Plus className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {customStakes.length > 0 && (
              <div className="space-y-1.5">
                {customStakes.map((stake, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border border-[#F3D3E8] bg-[#FFF9FD] px-4 py-3 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">{stake}</span>
                    <button
                      onClick={() => removeCustomStake(stake)}
                      className="text-[#B66FA0] font-medium text-sm"
                    >
                      删除
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Current selection summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-[#D3E7F7] bg-[#F6FBFE] p-4"
          >
            <h4 className="font-bold text-gray-800 mb-2 text-[1.02rem]">当前已选择</h4>
            {selectedStakes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedStakes.map((id) => {
                  const stake = DEFAULT_STAKES.find((s) => s.id === id);
                  if (!stake) return null;
                  const IconComponent = stake.icon;
                  const palette = STAKE_PALETTE.yellow;
                  return (
                    <div
                      key={id}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${palette.chip}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      {stake.label}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">还没有选择任何赌注</p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
