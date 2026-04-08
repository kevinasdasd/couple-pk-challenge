import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Plus, Coffee, Hand, Utensils, Crown, ShoppingCart, PackageCheck, UtensilsCrossed } from "lucide-react";
import { Header } from "../components/Header";
import { Button } from "../components/Button";

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
    const newSelected = selectedStakes.includes(id)
      ? selectedStakes.filter((s) => s !== id)
      : [...selectedStakes, id];
    setSelectedStakes(newSelected);
    localStorage.setItem("selectedStakes", JSON.stringify(newSelected));
  };

  const addCustomStake = () => {
    if (!newStake.trim()) return;
    const newCustom = [...customStakes, newStake.trim()];
    setCustomStakes(newCustom);
    localStorage.setItem("customStakes", JSON.stringify(newCustom));
    setNewStake("");
  };

  const removeCustomStake = (stake: string) => {
    const newCustom = customStakes.filter((s) => s !== stake);
    setCustomStakes(newCustom);
    localStorage.setItem("customStakes", JSON.stringify(newCustom));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 pb-8">
      <Header title="赌注设置" showBack showHistory />

      <div className="px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <p className="text-gray-600">选择游戏失败后要做的事情</p>
        </motion.div>

        {/* Preset stakes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h3 className="font-bold text-gray-800 mb-4">常用赌注</h3>
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_STAKES.map((stake) => {
              const IconComponent = stake.icon;
              return (
                <motion.button
                  key={stake.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleStake(stake.id)}
                  className={`relative rounded-2xl p-4 shadow-md transition-all ${
                    selectedStakes.includes(stake.id)
                      ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg scale-105"
                      : "bg-white text-gray-800 hover:shadow-lg"
                  }`}
                >
                  <div className="mb-3 flex justify-center">
                    <IconComponent className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <div className="font-medium">{stake.label}</div>
                  {selectedStakes.includes(stake.id) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-orange-500" />
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
          className="mb-8"
        >
          <h3 className="font-bold text-gray-800 mb-4">自定义赌注</h3>
          
          <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="输入自定义赌注..."
                value={newStake}
                onChange={(e) => setNewStake(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCustomStake()}
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={addCustomStake}
                className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-md hover:shadow-lg transition-shadow"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {customStakes.length > 0 && (
            <div className="space-y-2">
              {customStakes.map((stake, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl p-4 shadow-md flex items-center justify-between"
                >
                  <span className="text-gray-800">{stake}</span>
                  <button
                    onClick={() => removeCustomStake(stake)}
                    className="text-red-500 hover:text-red-600 font-medium text-sm"
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
          className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 shadow-lg"
        >
          <h4 className="font-bold text-gray-800 mb-3">当前已选择</h4>
          {selectedStakes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedStakes.map((id) => {
                const stake = DEFAULT_STAKES.find((s) => s.id === id);
                if (!stake) return null;
                const IconComponent = stake.icon;
                return (
                  <div
                    key={id}
                    className="bg-white px-4 py-2 rounded-full text-sm font-medium text-gray-700 shadow-sm flex items-center gap-2"
                  >
                    <IconComponent className="w-4 h-4" />
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
  );
}