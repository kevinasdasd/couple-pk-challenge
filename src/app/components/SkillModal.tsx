import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Zap, RefreshCw, Shuffle } from "lucide-react";

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  skillDescription: string;
  playerName: string;
  isDestiny?: boolean;
}

export function SkillModal({
  isOpen,
  onClose,
  skillName,
  skillDescription,
  playerName,
  isDestiny = false,
}: SkillModalProps) {
  const palette = {
    yellow: "#FFEA6F",
    paleYellow: "#FFFDF0",
    pink: "#FFC9EF",
    palePink: "#FFF9FD",
    blue: "#ABD7FA",
    paleBlue: "#F6FBFE",
    ink: "#1F2430",
    subInk: "#6B7280",
  };

  const getSkillIcon = () => {
    if (isDestiny) return <Sparkles className="w-12 h-12" />;
    if (skillName.includes("重置")) return <RefreshCw className="w-12 h-12" />;
    if (skillName.includes("交换")) return <Shuffle className="w-12 h-12" />;
    return <Zap className="w-12 h-12" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
          >
            <div
              className={`rounded-3xl p-8 border ${
                isDestiny
                  ? ""
                  : playerName === "Kevin"
                  ? ""
                  : ""
              }`}
              style={{
                backgroundColor: isDestiny
                  ? palette.paleYellow
                  : playerName === "Kevin"
                  ? palette.paleBlue
                  : palette.palePink,
                borderColor: isDestiny
                  ? palette.yellow
                  : playerName === "Kevin"
                  ? palette.blue
                  : palette.pink,
              }}
            >
              <div className="text-center" style={{ color: palette.ink }}>
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: isDestiny
                      ? palette.yellow
                      : playerName === "Kevin"
                      ? palette.blue
                      : palette.pink,
                    borderColor: "#FFFFFF",
                  }}
                >
                  {getSkillIcon()}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-sm mb-2" style={{ color: palette.subInk }}>{playerName} 触发技能</p>
                  <h2 className="text-3xl font-bold mb-4">{skillName}</h2>
                  <p className="mb-8 leading-relaxed" style={{ color: palette.subInk }}>{skillDescription}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <button
                    onClick={onClose}
                    className="w-full font-bold py-4 rounded-2xl active:scale-95 transition-all border"
                    style={{ backgroundColor: palette.yellow, borderColor: "#F5DA57", color: palette.ink }}
                  >
                    确认
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
