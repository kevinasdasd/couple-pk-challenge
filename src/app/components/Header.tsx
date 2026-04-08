import { ArrowLeft, History as HistoryIcon } from "lucide-react";
import { useNavigate } from "react-router";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showHistory?: boolean;
}

export function Header({ title, showBack = false, showHistory = false }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="w-10">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
      {title && <h1 className="font-bold text-lg text-gray-800">{title}</h1>}
      <div className="w-10">
        {showHistory && (
          <button
            onClick={() => navigate("/history")}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <HistoryIcon className="w-5 h-5 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
}
