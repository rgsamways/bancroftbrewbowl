import { createContext, useContext, useState, type ReactNode } from "react";

type AdminPanelContextValue = {
  poolId: string | null;
  setPoolId: (poolId: string | null) => void;
  poolName: string | null;
  setPoolName: (name: string | null) => void;
};

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null);

// Bridges AdminDashboard (which knows the selected pool) with the page
// header — a layout sibling, not a descendant, so it can't read that state
// via props or route params alone. See PageHeader in Shell.tsx.
export function AdminPanelProvider({ children }: { children: ReactNode }) {
  const [poolId, setPoolId] = useState<string | null>(null);
  const [poolName, setPoolName] = useState<string | null>(null);
  return (
    <AdminPanelContext.Provider value={{ poolId, setPoolId, poolName, setPoolName }}>
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel(): AdminPanelContextValue {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) throw new Error("useAdminPanel must be used within AdminPanelProvider");
  return ctx;
}
