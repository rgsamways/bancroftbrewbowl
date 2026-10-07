import { useEffect, useState } from "react";
import { api } from "./api";
import { useSession, type AppUser } from "./auth-client";

// What the signed-in person may reach. The server decides (an admin, or the site's god-user, who
// needs no admin flag); the session alone cannot say, so this asks once per account and remembers.

export type Access = { isAdmin: boolean; isOperator: boolean };

const asked = new Map<string, Promise<Access>>();

export function useAccess(): Access & { ready: boolean } {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const flagged = Boolean((session?.user as AppUser | undefined)?.isAdmin);
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (!userId) {
      setAccess(null);
      return;
    }
    let live = true;
    let promise = asked.get(userId);
    if (!promise) {
      promise = api<Access>("/me/access");
      asked.set(userId, promise);
      promise.catch(() => asked.delete(userId));
    }
    promise.then((a) => live && setAccess(a)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId]);

  return {
    isAdmin: access?.isAdmin ?? flagged,
    isOperator: access?.isOperator ?? false,
    ready: !userId || access !== null,
  };
}
