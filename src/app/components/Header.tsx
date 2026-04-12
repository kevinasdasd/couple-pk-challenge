import { ArrowLeft, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useBgm } from "./BgmProvider";
import { playUiSound } from "../utils/soundEffects";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showHistory?: boolean;
  onBackClick?: () => void;
  rightActions?: ReactNode;
}

export function Header({
  title,
  showBack = false,
  showHistory = false,
  onBackClick,
  rightActions,
}: HeaderProps) {
  const navigate = useNavigate();
  const { enabled } = useBgm();

  return (
    <div
      className="grid grid-cols-[4.75rem_1fr_4.75rem] items-center px-4 py-3 bg-white/80 backdrop-blur-sm sticky top-0 z-10"
      style={{ minHeight: "var(--app-header-height)" }}
    >
      <div className="flex justify-start">
        {showBack && (
          <button
            onClick={() => {
              playUiSound("back", enabled);
              if (onBackClick) {
                onBackClick();
                return;
              }
              navigate(-1);
            }}
            className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
      {title && <h1 className="font-bold text-lg text-gray-800 text-center truncate px-2">{title}</h1>}
      <div className="flex items-center justify-end gap-2">
        {rightActions}
        {showHistory && (
          <button
            onClick={() => {
              playUiSound("navigate", enabled);
              navigate("/history");
            }}
            className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Settings2 className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
}
