import { ArrowLeft, History as HistoryIcon, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router";
import { useBgm } from "./BgmProvider";
import { playUiSound } from "../utils/soundEffects";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showHistory?: boolean;
  onBackClick?: () => void;
}

export function Header({ title, showBack = false, showHistory = false, onBackClick }: HeaderProps) {
  const navigate = useNavigate();
  const { enabled, available, toggle } = useBgm();

  return (
    <div className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center p-4 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
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
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
      {title && <h1 className="font-bold text-lg text-gray-800 text-center truncate px-2">{title}</h1>}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => {
            playUiSound("confirm", enabled);
            toggle();
          }}
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title={available ? (enabled ? "关闭音乐" : "开启音乐") : "BGM 文件暂不可用"}
          aria-label={available ? (enabled ? "关闭音乐" : "开启音乐") : "BGM 文件暂不可用"}
        >
          {enabled && available ? (
            <Volume2 className="w-5 h-5 text-gray-700" />
          ) : (
            <VolumeX className="w-5 h-5 text-gray-700" />
          )}
        </button>
        {showHistory && (
          <button
            onClick={() => {
              playUiSound("navigate", enabled);
              navigate("/history");
            }}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <HistoryIcon className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
}
