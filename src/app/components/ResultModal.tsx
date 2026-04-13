import { ReactNode, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, X } from "lucide-react";
import { Button } from "./Button";
import { useBgm } from "./BgmProvider";
import { getAudioVolume, playUiSound } from "../utils/soundEffects";

interface ResultModalAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  sound?: "confirm" | "back" | "navigate" | "none";
}

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  winner: string;
  loser: string;
  stake: string;
  message: string;
  secondaryAction?: ResultModalAction;
  primaryAction?: ResultModalAction;
  footerNote?: ReactNode;
}

export function ResultModal({
  isOpen,
  onClose,
  winner,
  loser,
  stake,
  message,
  secondaryAction,
  primaryAction,
  footerNote,
}: ResultModalProps) {
  const { enabled, pauseForEffect, resumeAfterEffect } = useBgm();
  const wasOpenRef = useRef(false);
  const victoryAudioRef = useRef<HTMLAudioElement | null>(null);
  const palette = {
    yellow: "#FFEA6F",
    paleYellow: "#FFFDF0",
    pink: "#FFC9EF",
    palePink: "#FFF9FD",
    ink: "#1F2430",
    subInk: "#6B7280",
  };
  const isTie = winner === "平局" || loser === "重新来过";
  const displayMessage = isTie
    ? stake === "谁是大皇帝"
      ? "这局打成平手，谁也还不是大皇帝。"
      : "这局打成平手，本次不结算赌注。"
    : message;
  const resolvedSecondaryAction: ResultModalAction = secondaryAction ?? {
    label: "再来一局",
    onClick: onClose,
    variant: "secondary",
    sound: "confirm",
  };
  const resolvedPrimaryAction: ResultModalAction = primaryAction ?? {
    label: "返回首页",
    onClick: () => {
      onClose();
      window.history.back();
    },
    variant: "primary",
    sound: "back",
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (!enabled) {
        wasOpenRef.current = isOpen;
        return;
      }
      if (victoryAudioRef.current) {
        victoryAudioRef.current.pause();
        victoryAudioRef.current.currentTime = 0;
        victoryAudioRef.current = null;
      }
      pauseForEffect();
      const victoryAudio = new Audio("/sounds/victory.mp3");
      victoryAudio.preload = "auto";
      victoryAudio.volume = getAudioVolume("/sounds/victory.mp3", "victory");
      victoryAudioRef.current = victoryAudio;
      void victoryAudio.play().catch(() => {
        resumeAfterEffect();
      });

      const handleEnded = () => {
        if (victoryAudioRef.current === victoryAudio) {
          victoryAudioRef.current = null;
        }
        resumeAfterEffect();
      };

      victoryAudio.addEventListener("ended", handleEnded, { once: true });
    }

    if (!isOpen && wasOpenRef.current) {
      if (victoryAudioRef.current) {
        victoryAudioRef.current.pause();
        victoryAudioRef.current.currentTime = 0;
        victoryAudioRef.current = null;
      }
      resumeAfterEffect();
    }

    wasOpenRef.current = isOpen;
  }, [enabled, isOpen, pauseForEffect, resumeAfterEffect]);

  useEffect(() => {
    return () => {
      if (victoryAudioRef.current) {
        victoryAudioRef.current.pause();
        victoryAudioRef.current.currentTime = 0;
        victoryAudioRef.current = null;
      }
      if (wasOpenRef.current) {
        resumeAfterEffect();
      }
    };
  }, [resumeAfterEffect]);

  const handleClose = (sound: "confirm" | "back") => {
    playUiSound(sound, enabled);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => handleClose("back")}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
          >
            <div className="bg-white rounded-3xl p-6 border" style={{ borderColor: palette.yellow }}>
              <button
                onClick={() => handleClose("back")}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: palette.subInk }} />
              </button>

              <div className="text-center mt-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center border"
                  style={{ backgroundColor: palette.yellow, borderColor: "#F5DA57" }}
                >
                  <Trophy className="w-10 h-10" style={{ color: palette.ink }} />
                </motion.div>

                <h2 className="text-2xl font-bold mb-2" style={{ color: palette.ink }}>挑战结束！</h2>
                
                <div className="rounded-2xl p-4 mb-4 border" style={{ backgroundColor: palette.paleYellow, borderColor: palette.yellow }}>
                  {isTie ? (
                    <>
                      <p className="text-lg font-bold mb-1" style={{ color: palette.ink }}>本次挑战结果</p>
                      <p className="text-2xl font-bold" style={{ color: palette.ink }}>平局</p>
                    </>
                  ) : stake === "谁是大皇帝" ? (
                    <>
                      <p className="text-lg font-bold mb-1" style={{ color: palette.ink }}>本次{stake}</p>
                      <p className="text-2xl font-bold" style={{ color: palette.ink }}>由{winner}担任</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold mb-1" style={{ color: palette.ink }}>本次{stake}由</p>
                      <p className="text-2xl font-bold" style={{ color: palette.ink }}>{loser}</p>
                      <p className="text-lg font-bold" style={{ color: palette.ink }}>承担</p>
                    </>
                  )}
                </div>

                <p className="mb-6" style={{ color: palette.subInk }}>{displayMessage}</p>

                {footerNote && (
                  <div
                    className="mb-4 rounded-2xl border px-4 py-3 text-left text-sm"
                    style={{ backgroundColor: "#FFFFFF", borderColor: "#ECE7D4", color: palette.subInk }}
                  >
                    {footerNote}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant={resolvedSecondaryAction.variant ?? "secondary"}
                    onClick={resolvedSecondaryAction.onClick}
                    className="flex-1"
                    disabled={resolvedSecondaryAction.disabled}
                    sound={resolvedSecondaryAction.sound ?? "confirm"}
                  >
                    {resolvedSecondaryAction.label}
                  </Button>
                  <Button
                    variant={resolvedPrimaryAction.variant ?? "primary"}
                    onClick={resolvedPrimaryAction.onClick}
                    className="flex-1"
                    disabled={resolvedPrimaryAction.disabled}
                    sound={resolvedPrimaryAction.sound ?? "confirm"}
                  >
                    {resolvedPrimaryAction.label}
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
