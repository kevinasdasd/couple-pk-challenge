import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import GameSelect from "./pages/GameSelect";
import DiceGame from "./pages/DiceGame";
import CrocodileGame from "./pages/CrocodileGame";
import StakeSettings from "./pages/StakeSettings";
import History from "./pages/History";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/select",
    Component: GameSelect,
  },
  {
    path: "/dice",
    Component: DiceGame,
  },
  {
    path: "/crocodile",
    Component: CrocodileGame,
  },
  {
    path: "/stake",
    Component: StakeSettings,
  },
  {
    path: "/history",
    Component: History,
  },
]);
