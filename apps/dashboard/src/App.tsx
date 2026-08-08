import { Routes, Route } from "react-router";
import { useSession } from "./lib/auth-client";
import { Login } from "./pages/Login";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Account } from "./pages/Account";
import { PoolStandings } from "./pages/PoolStandings";
import { PickScreen } from "./pages/PickScreen";
import { AdminDashboard } from "./pages/AdminDashboard";
import { SchedulePage } from "./pages/SchedulePage";
import { PromotionsPage } from "./pages/PromotionsPage";

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/pool/:poolId" element={<PoolStandings />} />
        <Route path="/pool/:poolId/entry/:entryId/pick" element={<PickScreen />} />
        <Route path="/admin/schedule" element={<SchedulePage />} />
        <Route path="/admin/promotions" element={<PromotionsPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/:poolId" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}
