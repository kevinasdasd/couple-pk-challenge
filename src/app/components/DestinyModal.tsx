import { motion, AnimatePresence } from "motion/react";
import { Crown, Sparkles } from "lucide-react";

interface DestinyModalProps {
  isOpen: boolean;
  onClose: () => void;
  winnerName: string;
}

export function DestinyModal({ isOpen, onClose, winnerName }: DestinyModalProps) {
  const palette = {
    yellow: "#FFEA6F",
    paleYellow: "#FFFDF0",
    pink: "#FFC9EF",
    blue: "#ABD7FA",
    ink: "#1F2430",
    subInk: "#6B7280",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 backdrop-blur-md z-50"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,234,111,0.78) 0%, rgba(255,201,239,0.68) 45%, rgba(171,215,250,0.62) 100%)",
            }}
          >
            <div className="h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
              {/* Floating sparkles */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 100, x: Math.random() * 300 - 150 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: -100,
                    x: Math.random() * 300 - 150,
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: "100%",
                  }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: palette.ink }} />
                </motion.div>
              ))}

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 1 }}
                className="relative z-10"
              >
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center mb-8 border"
                  style={{ backgroundColor: palette.yellow, borderColor: "#FFFFFF" }}
                >
                  <Crown className="w-16 h-16" style={{ color: palette.ink }} />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center relative z-10"
              >
                <motion.h1
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                  className="text-6xl font-bold mb-4"
                  style={{ color: palette.ink }}
                >
                  天命已定
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-2xl mb-12"
                  style={{ color: palette.ink }}
                >
                  {winnerName} 获得天命庇护
                </motion.p>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  onClick={onClose}
                  className="px-12 py-4 rounded-full font-bold text-lg active:scale-95 transition-all border"
                  style={{ backgroundColor: "#FFFFFF", color: palette.ink, borderColor: palette.pink }}
                >
                  接受命运
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
