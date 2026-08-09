import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto rounded border border-brand-border bg-brand-surface p-4 shadow-xl`}
      >
        {children}
      </div>
    </div>
  );
}
