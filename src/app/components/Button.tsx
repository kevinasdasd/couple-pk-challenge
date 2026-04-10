import { motion } from "motion/react";
import { ReactNode } from "react";
import { useBgm } from "./BgmProvider";
import { playUiSound } from "../utils/soundEffects";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  sound?: "confirm" | "back" | "navigate" | "none";
}

const BUTTON_VARIANT_STYLES = {
  primary: "bg-[#FFEA6F] text-[#1F2430] border border-[#F5DA57]",
  secondary: "bg-[#FFC9EF] text-[#1F2430] border border-[#F5B6E1]",
  danger: "bg-[#FFD4D4] text-[#8F2F2F] border border-[#F3B4B4]",
} as const;

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  sound = "confirm",
}: ButtonProps) {
  const { enabled } = useBgm();
  const baseStyles = "rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3.5 text-lg",
  };

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={() => {
        if (!disabled && sound !== "none") {
          playUiSound(sound, enabled);
        }
        onClick?.();
      }}
      disabled={disabled}
      className={`${baseStyles} ${BUTTON_VARIANT_STYLES[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
