import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { RequestKind } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminRequests, entries, user, wipeoutEvents } from "../db/schema.js";
import type { Executor } from "./activity.js";

// The "another admin confirms" rule. The routes that make a decision call these to apply it, and
// the confirm route calls the same ones, so a confirmed decision does exactly what a direct one
// would have.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The other admins who could confirm: every admin except the one acting. */
export async function otherAdmins(executor: Executor, actorId: string): Promise<{ id: string; name: string }[]> {
  return executor
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.isAdmin, true), ne(user.id, actorId)));
}

export type StatusChange = { status: "alive" | "eliminated"; eliminatedWeek: number | null };

/** Eliminates everyone unticked and marks the wipeout resolved. Returns the resolved event. */
export async function applyWipeoutResolution(
  tx: Tx,
  event: typeof wipeoutEvents.$inferSelect,
  survivingEntryIds: string[],
  resolvedBy: string
) {
  const surviving = new Set(survivingEntryIds);
  const toEliminate = event.candidateEntryIds.filter((id) => !surviving.has(id));
  if (toEliminate.length > 0) {
    await tx
      .update(entries)
      .set({ status: "eliminated", eliminatedWeek: event.weekNumber })
      .where(inArray(entries.id, toEliminate));
  }
  const [resolved] = await tx
    .update(wipeoutEvents)
    .set({ resolvedAt: new Date(), resolvedBy, survivingEntryIds })
    .where(eq(wipeoutEvents.id, event.id))
    .returning();
  return resolved!;
}

export async function applyStatusChange(tx: Tx, entryId: string, change: StatusChange) {
  const [updated] = await tx.update(entries).set(change).where(eq(entries.id, entryId)).returning();
  return updated!;
}

/** A decision made some other way (directly, by an admin it does not involve) makes any request
 * still waiting on it pointless: cancel it, and tidy declined ones so they stop showing. */
export async function settleRequestsFor(tx: Tx, target: { wipeoutId?: string; entryId?: string }) {
  const where = target.wipeoutId
    ? eq(adminRequests.wipeoutId, target.wipeoutId)
    : eq(adminRequests.entryId, target.entryId!);
  await tx
    .update(adminRequests)
    .set({ status: "cancelled", decidedAt: new Date() })
    .where(and(where, eq(adminRequests.status, "pending")));
  await tx
    .update(adminRequests)
    .set({ seenAt: new Date() })
    .where(and(where, eq(adminRequests.status, "declined"), isNull(adminRequests.seenAt)));
}

/** Stores a new pending request, replacing any earlier one for the same wipeout or entry. */
export async function createRequest(
  tx: Tx,
  input: {
    kind: RequestKind;
    poolId: string;
    wipeoutId?: string;
    entryId?: string;
    payload: Record<string, unknown>;
    actor: { id: string; name: string };
  }
) {
  await settleRequestsFor(tx, input.wipeoutId ? { wipeoutId: input.wipeoutId } : { entryId: input.entryId });
  const [row] = await tx
    .insert(adminRequests)
    .values({
      kind: input.kind,
      poolId: input.poolId,
      wipeoutId: input.wipeoutId ?? null,
      entryId: input.entryId ?? null,
      payload: input.payload,
      requestedBy: input.actor.id,
      requestedByName: input.actor.name,
    })
    .returning();
  return row!;
}
