import { z } from "zod";
import { isRealDate } from "./music.js";

// Site notices: an important message an admin posts that shows at the top of every player page.
// A player closes one on their own device; it stays closed until a NEW notice is posted.
// No Node imports.

export const MAX_ACTIVE_NOTICES = 3;

export const createNoticeSchema = z
  .object({
    title: z.string().trim().min(1, "Add a short title").max(60, "Keep the title to 60 characters"),
    message: z.string().trim().min(1, "Add a message").max(200, "Keep the message to 200 characters"),
    /** The last day it shows, as "YYYY-MM-DD" in Eastern time. Empty: until removed. */
    showThrough: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-17")
      .refine(isRealDate, "Not a real date")
      .nullish()
      .transform((v) => v ?? null),
  })
  .strict();
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export type Notice = { id: string; title: string; message: string; showThrough: string | null };

/** The closed notice ids worth remembering: only those still active, so storage never grows. */
export function closedStillActive(closed: string[], active: Notice[]): string[] {
  const ids = new Set(active.map((n) => n.id));
  return closed.filter((id) => ids.has(id));
}

/** The notices to show: active ones the player has not closed on this device. */
export function visibleNotices(active: Notice[], closed: string[]): Notice[] {
  const hidden = new Set(closed);
  return active.filter((n) => !hidden.has(n.id));
}
