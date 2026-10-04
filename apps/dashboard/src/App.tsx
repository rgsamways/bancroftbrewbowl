import { useRef } from "react";
import { Navigate, Routes, Route } from "react-router";
import { useSession } from "./lib/auth-client";
import { Login } from "./pages/Login";
import { Shell } from "./components/Shell";
import { AdminLayout, FocusLayout, RequireAdmin } from "./components/AdminLayout";
import { NextStep } from "./pages/NextStep";
import { AdminResults } from "./pages/AdminResults";
import { ResultsWizard } from "./pages/ResultsWizard";
import { WipeoutDecision } from "./pages/WipeoutDecision";
import { ConfirmRequest, DeclineRequest, RequestDone } from "./pages/AdminRequests";
import { AdminMore } from "./pages/AdminMore";
import { Home } from "./pages/Home";
import { Account } from "./pages/Account";
import { PasswordPage } from "./pages/PasswordPage";
import { JoinPage } from "./pages/JoinPage";
import { ActivityPage } from "./pages/ActivityPage";
import { PoolStandings } from "./pages/PoolStandings";
import { PickScreen } from "./pages/PickScreen";
import { AdminPools } from "./pages/AdminPools";
import { AdminPool } from "./pages/AdminPool";
import { NewPoolWizard } from "./pages/NewPoolWizard";
import { PromotionsPage } from "./pages/PromotionsPage";
import { PickLanding, StandingsLanding } from "./pages/TabLanding";
import { MenuPage, PublicMenuPage } from "./pages/Menu";
import { AdminMenu } from "./pages/admin-menu/AdminMenu";
import { AddItemWizard } from "./pages/admin-menu/AddItemWizard";
import { EditItem } from "./pages/admin-menu/EditItem";
import { AddMusicWizard } from "./pages/admin-menu/AddMusicWizard";
import { EditMusic } from "./pages/admin-menu/EditMusic";

export default function App() {
  const { data: session, isPending } = useSession();

  // Blank only for the very first session lookup. The session is looked up again after
  // a sign-in request is sent, and blanking then would unmount the sign-in page and lose
  // its "Check your email" state.
  const loadedOnce = useRef(false);
  if (!isPending) loadedOnce.current = true;
  if (isPending && !loadedOnce.current) return null;
  // The menu is public (the table QR code opens it); everything else needs a sign-in.
  if (!session) {
    return (
      <Routes>
        <Route path="/menu" element={<PublicMenuPage />} />
        <Route path="/menu/kitchen" element={<PublicMenuPage tab="kitchen" />} />
        <Route path="/menu/music" element={<PublicMenuPage tab="music" />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/password" element={<PasswordPage />} />
        <Route path="/pick" element={<PickLanding />} />
        <Route path="/join/:poolId" element={<JoinPage />} />
        <Route path="/standings" element={<StandingsLanding />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/menu/kitchen" element={<MenuPage tab="kitchen" />} />
        <Route path="/menu/music" element={<MenuPage tab="music" />} />
        <Route path="/pool/:poolId" element={<PoolStandings />} />
        <Route path="/pool/:poolId/entry/:entryId/pick" element={<PickScreen />} />
      </Route>
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<NextStep />} />
          <Route path="/admin/results" element={<AdminResults />} />
          <Route path="/admin/more" element={<AdminMore />} />
          <Route path="/admin/activity" element={<ActivityPage />} />
          <Route path="/admin/promotions" element={<PromotionsPage />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
          <Route path="/admin/menu/:id" element={<EditItem />} />
          <Route path="/admin/music/:id" element={<EditMusic />} />
          <Route path="/admin/pools" element={<AdminPools />} />
          <Route path="/admin/pools/:poolId" element={<AdminPool />} />
        </Route>
        <Route element={<FocusLayout />}>
          <Route path="/admin/results/steps" element={<ResultsWizard />} />
          <Route path="/admin/pools/new" element={<NewPoolWizard />} />
          <Route path="/admin/menu/new" element={<AddItemWizard />} />
          <Route path="/admin/music/new" element={<AddMusicWizard />} />
          <Route path="/admin/wipeout/:poolId/:wipeoutId" element={<WipeoutDecision />} />
          <Route path="/admin/requests/:id" element={<ConfirmRequest />} />
          <Route path="/admin/requests/:id/decline" element={<DeclineRequest />} />
          <Route path="/admin/requests/:id/done/:outcome" element={<RequestDone />} />
        </Route>
        <Route path="/admin/schedule" element={<Navigate to="/admin/results" replace />} />
      </Route>
    </Routes>
  );
}
