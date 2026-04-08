import { motion } from "motion/react";
import { ReactNode } from "react";

interface GameCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  color: "orange" | "blue";
  onClick?: () => void;
}

export function GameCard({ title, description, icon, color, onClick }: GameCardProps) {
  const colorStyles = {
    orange: "from-orange-50 to-orange-100 border-orange-200",
    blue: "from-blue-50 to-blue-100 border-blue-200",
  };

  const iconBgStyles = {
    orange: "bg-gradient-to-br from-orange-400 to-orange-500",
    blue: "bg-gradient-to-br from-blue-400 to-blue-500",
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`bg-gradient-to-br ${colorStyles[color]} border-2 rounded-3xl p-6 cursor-pointer shadow-lg hover:shadow-xl transition-shadow`}
    >
      <div className="flex items-start gap-4">
        <div className={`${iconBgStyles[color]} rounded-2xl p-3 text-white shadow-md flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-800 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
