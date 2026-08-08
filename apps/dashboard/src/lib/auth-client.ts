import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [magicLinkClient()],
});

export const { useSession, signIn, signOut } = authClient;

// better-auth's client type doesn't know about our server-side `isAdmin`
// additional field — this mirrors it locally rather than pulling api's
// server code into the dashboard bundle just for a type.
export type AppUser = { isAdmin?: boolean };

