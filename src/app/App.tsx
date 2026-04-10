import { RouterProvider } from "react-router";
import { router } from "./routes";
import { BgmProvider } from "./components/BgmProvider";

export default function App() {
  return (
    <BgmProvider>
      <div className="app-shell max-w-md mx-auto">
        <RouterProvider router={router} />
      </div>
    </BgmProvider>
  );
}
