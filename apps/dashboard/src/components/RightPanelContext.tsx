import { createContext, useContext, useState, type ReactNode } from "react";

type RightPanelContextValue = { open: boolean; setOpen: (open: boolean) => void };

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <RightPanelContext.Provider value={{ open, setOpen }}>{children}</RightPanelContext.Provider>;
}

export function useRightPanel(): RightPanelContextValue {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
  return ctx;
}
