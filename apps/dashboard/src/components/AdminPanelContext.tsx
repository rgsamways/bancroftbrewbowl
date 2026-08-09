import { createContext, useContext, useState, type ReactNode } from "react";

type AdminPanelContextValue = {
  poolId: string | null;
  setPoolId: (poolId: string | null) => void;
  poolName: string | null;
  setPoolName: (name: string | null) => void;
  showCreatePool: boolean;
  setShowCreatePool: (show: boolean) => void;
};

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null);

// Bridges AdminDashboard (which knows the selected pool and active tab) with
// RightPanel and the page header — both layout siblings, not descendants, so
// they can't read that state via props or route params alone. See
// RightPanel.tsx and PageHeader in Shell.tsx.
export function AdminPanelProvider({ children }: { children: ReactNode }) {
  const [poolId, setPoolId] = useState<string | null>(null);
  const [poolName, setPoolName] = useState<string | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);
  return (
    <AdminPanelContext.Provider
      value={{ poolId, setPoolId, poolName, setPoolName, showCreatePool, setShowCreatePool }}
    >
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel(): AdminPanelContextValue {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) throw new Error("useAdminPanel must be used within AdminPanelProvider");
  return ctx;
}
