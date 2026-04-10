import { motion } from "motion/react";
import { ReactNode } from "react";
import { useBgm } from "./BgmProvider";
import { playUiSound } from "../utils/soundEffects";

interface GameCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  color: "pink" | "green" | "blue";
  onClick?: () => void;
}

export function GameCard({ title, description, icon, color, onClick }: GameCardProps) {
  const { enabled } = useBgm();
  const cardStyles = {
    pink: {
      backgroundColor: "#FFF9FD",
      borderColor: "rgba(255, 201, 239, 0.58)",
      boxShadow: "0 18px 36px rgba(255, 201, 239, 0.18)",
      iconBackground: "#FFC9EF",
    },
    green: {
      backgroundColor: "#F9FEE5",
      borderColor: "rgba(201, 241, 0, 0.5)",
      boxShadow: "0 18px 36px rgba(201, 241, 0, 0.14)",
      iconBackground: "#C9F100",
    },
    blue: {
      backgroundColor: "#F6FBFE",
      borderColor: "rgba(171, 215, 250, 0.58)",
      boxShadow: "0 18px 36px rgba(171, 215, 250, 0.16)",
      iconBackground: "#ABD7FA",
    },
  };
  const selectedStyle = cardStyles[color];

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        playUiSound("navigate", enabled);
        onClick?.();
      }}
      className="border rounded-[1.65rem] p-4 cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
      style={{
        backgroundColor: selectedStyle.backgroundColor,
        borderColor: selectedStyle.borderColor,
        boxShadow: selectedStyle.boxShadow,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-[#1F2430] shadow-md flex-shrink-0"
          style={{
            backgroundColor: selectedStyle.iconBackground,
            boxShadow:
              color === "pink"
                ? "0 12px 24px rgba(255, 201, 239, 0.35)"
                : color === "green"
                ? "0 12px 24px rgba(201, 241, 0, 0.30)"
                : "0 12px 24px rgba(171, 215, 250, 0.32)",
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[1rem] text-[#1F2430] mb-1">{title}</h3>
          <p className="text-[14px] leading-5 text-[#5D6673]">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
