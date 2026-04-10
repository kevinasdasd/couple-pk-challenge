import { RouterProvider } from "react-router";
import { router } from "./routes";
import { BgmProvider } from "./components/BgmProvider";

export default function App() {
  return (
    <BgmProvider>
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <RouterProvider router={router} />
      </div>
    </BgmProvider>
  );
}
