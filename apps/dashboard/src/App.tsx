import { useRef } from "react";
import { Routes, Route } from "react-router";
import { useSession } from "./lib/auth-client";
import { Login } from "./pages/Login";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Account } from "./pages/Account";
import { PasswordPage } from "./pages/PasswordPage";
import { JoinPage } from "./pages/JoinPage";
import { PoolStandings } from "./pages/PoolStandings";
import { PickScreen } from "./pages/PickScreen";
import { AdminDashboard } from "./pages/AdminDashboard";
import { SchedulePage } from "./pages/SchedulePage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { PickLanding, StandingsLanding } from "./pages/TabLanding";

export default function App() {
  const { data: session, isPending } = useSession();

  // Blank only for the very first session lookup. The session is looked up again after
  // a sign-in request is sent, and blanking then would unmount the sign-in page and lose
  // its "Check your email" state.
  const loadedOnce = useRef(false);
  if (!isPending) loadedOnce.current = true;
  if (isPending && !loadedOnce.current) return null;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/password" element={<PasswordPage />} />
        <Route path="/pick" element={<PickLanding />} />
        <Route path="/join/:poolId" element={<JoinPage />} />
        <Route path="/standings" element={<StandingsLanding />} />
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
