import { motion, AnimatePresence } from "motion/react";
import { Trophy, X } from "lucide-react";
import { Button } from "./Button";

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  winner: string;
  loser: string;
  stake: string;
  message: string;
}

export function ResultModal({ isOpen, onClose, winner, loser, stake, message }: ResultModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
          >
            <div className="bg-white rounded-3xl p-6 shadow-2xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <div className="text-center mt-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Trophy className="w-10 h-10 text-white" />
                </motion.div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">挑战结束！</h2>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 mb-4">
                  {stake === "谁是大皇帝" ? (
                    <>
                      <p className="text-lg font-bold text-orange-600 mb-1">本次{stake}</p>
                      <p className="text-2xl font-bold text-orange-700">由{winner}担任</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-orange-600 mb-1">本次{stake}由</p>
                      <p className="text-2xl font-bold text-orange-700">{loser}</p>
                      <p className="text-lg font-bold text-orange-600">承担</p>
                    </>
                  )}
                </div>

                <p className="text-gray-600 mb-6">{message}</p>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    再来一局
                  </Button>
                  <Button variant="primary" onClick={() => {
                    onClose();
                    window.history.back();
                  }} className="flex-1">
                    返回首页
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
