import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  MAX_PLAYLISTS,
  MAX_SCREENS,
  SLIDE_KIND_TEXT,
  easternToday,
  createScreenSchema,
  playlistInputSchema,
  updateScreenSchema,
  type AdminPlaylist,
  type AdminScreen,
  type AdminTv,
  type MenuSection,
  type PublicMusic,
  type SlideKind,
  type TvFeed,
  type TvFeedSlide,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { pools, tvPlaylistSlides, tvPlaylists, tvScreens } from "../db/schema.js";
import { requireAdmin, requireOperator } from "../lib/guards.js";
import { isOperatorUser } from "../lib/operator.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";
import { buildPoolTv } from "../lib/pool-tv.js";
import { loadMenu } from "./menu.js";
import { loadPublicMusic } from "./music.js";
import { loadPublicCalendar } from "../lib/calendar.js";

// TV screens. A playlist is an ordered list of slides; a screen is one physical TV with its own
// private link (a long random code) that plays one playlist. Any admin edits playlists and chooses
// what a screen plays; only the god-user creates, renames or deletes a screen, or sees or resets
// its link. A private link is never written to Activity. The public feed carries only what the
// signed-in TV page and the public menu already show.

const NOT_FOUND = { error: "Not found" };
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const newCode = () => randomBytes(32).toString("base64url");
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function loadPlaylists(): Promise<AdminPlaylist[]> {
  const [lists, slides, poolRows, screens] = await Promise.all([
    db.select().from(tvPlaylists).orderBy(asc(tvPlaylists.name)),
    db.select().from(tvPlaylistSlides).orderBy(asc(tvPlaylistSlides.position)),
    db.select({ id: pools.id, name: pools.name }).from(pools),
    db.select({ name: tvScreens.name, playlistId: tvScreens.playlistId }).from(tvScreens).orderBy(asc(tvScreens.name)),
  ]);
  const poolName = new Map(poolRows.map((p) => [p.id, p.name]));
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    slides: slides
      .filter((s) => s.playlistId === l.id)
      .map((s) => ({
        id: s.id,
        kind: s.kind as SlideKind,
        poolId: s.poolId,
        poolName: s.poolId ? (poolName.get(s.poolId) ?? null) : null,
        seconds: s.seconds,
        enabled: s.enabled,
      })),
    screens: screens.filter((s) => s.playlistId === l.id).map((s) => s.name),
  }));
}

async function loadAdminTv(operator: boolean): Promise<AdminTv> {
  const [playlists, screens, poolRows] = await Promise.all([
    loadPlaylists(),
    db.select().from(tvScreens).orderBy(asc(tvScreens.name)),
    db.select({ id: pools.id, name: pools.name }).from(pools).orderBy(asc(pools.name)),
  ]);
  return {
    playlists,
    screens: screens.map((s): AdminScreen => ({ id: s.id, name: s.name, playlistId: s.playlistId, showQr: s.showQr, ...(operator ? { code: s.code } : {}) })),
    pools: poolRows,
  };
}

/** What a TV shows for a playlist: its enabled slides in order, each with its content. The public TV
 * feed and the admin previews both use this, so a preview is exactly what a TV will show. */
async function buildFeed(name: string, showQr: boolean, playlistId: string | null): Promise<TvFeed> {
  const rows = playlistId
    ? await db.select().from(tvPlaylistSlides).where(eq(tvPlaylistSlides.playlistId, playlistId)).orderBy(asc(tvPlaylistSlides.position))
    : [];

  let menu: MenuSection[][] | null = null;
  let music: PublicMusic | null = null;
  const slides: TvFeedSlide[] = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    if (row.kind === "standings" && row.poolId) {
      const pool = await db.query.pools.findFirst({ where: eq(pools.id, row.poolId) });
      if (pool) slides.push({ id: row.id, kind: "standings", seconds: row.seconds, content: await buildPoolTv(pool) });
    } else if (row.kind === "drinks" || row.kind === "kitchen") {
      if (!menu) {
        const full = await loadMenu();
        menu = [full.drinks, full.kitchen];
      }
      slides.push({ id: row.id, kind: row.kind, seconds: row.seconds, content: row.kind === "drinks" ? menu[0]! : menu[1]! });
    } else if (row.kind === "music") {
      music ??= await loadPublicMusic();
      slides.push({ id: row.id, kind: "music", seconds: row.seconds, content: music });
    } else if (row.kind === "calendar") {
      const today = easternToday(new Date());
      slides.push({ id: row.id, kind: "calendar", seconds: row.seconds, content: (await loadPublicCalendar(today, today)).days });
    }
  }
  return { screen: { name, showQr }, slides };
}

export async function tvScreenRoutes(fastify: FastifyInstance) {
  // ---- The public feed a TV loads, keyed by its private code ---------------------------------

  fastify.get("/public/tv/:code", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const { code } = request.params as { code: string };
    const screen = code.length >= 20 && code.length <= 80 ? await db.query.tvScreens.findFirst({ where: eq(tvScreens.code, code) }) : undefined;
    if (!screen) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.send(await buildFeed(screen.name, screen.showQr, screen.playlistId));
  });

  // ---- Previews for admins: the same feed a TV gets, without the private link -----------------

  fastify.get("/tv/screens/:id/preview", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.header("Cache-Control", "no-store");
    const { id } = request.params as { id: string };
    const screen = isId(id) ? await db.query.tvScreens.findFirst({ where: eq(tvScreens.id, id) }) : undefined;
    if (!screen) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.send(await buildFeed(screen.name, screen.showQr, screen.playlistId));
  });

  fastify.get("/tv/playlists/:id/preview", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.header("Cache-Control", "no-store");
    const { id } = request.params as { id: string };
    const playlist = isId(id) ? await db.query.tvPlaylists.findFirst({ where: eq(tvPlaylists.id, id) }) : undefined;
    if (!playlist) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.send(await buildFeed(playlist.name, true, playlist.id));
  });

  // ---- Playlists and screens, for admins -----------------------------------------------------

  fastify.get("/tv", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    reply.send(await loadAdminTv(isOperatorUser(session.user)));
  });

  /** Create (no id) or replace (an id) a playlist and its slides, in one transaction. */
  async function savePlaylist(request: FastifyRequest, reply: FastifyReply, id: string | null) {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    if (id !== null && !isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const body = parseBody(playlistInputSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const poolIds = [...new Set(body.slides.map((s) => s.poolId).filter((p): p is string => p !== null))];
    if (poolIds.length > 0) {
      const found = await db.select({ id: pools.id }).from(pools).where(inArray(pools.id, poolIds));
      if (found.length !== poolIds.length) {
        reply.status(400).send({ error: "One of the pools isn't there any more. Pick another pool and save again." });
        return;
      }
    }

    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7302)`);
      const existing = await tx.select().from(tvPlaylists);
      if (existing.some((p) => p.id !== id && sameName(p.name, body.name))) return { error: "Another playlist already has that name." as const };
      let playlistId = id;
      if (id === null) {
        if (existing.length >= MAX_PLAYLISTS) return { error: `You can have at most ${MAX_PLAYLISTS} playlists.` as const };
        const [row] = await tx.insert(tvPlaylists).values({ name: body.name }).returning();
        playlistId = row!.id;
      } else {
        const [row] = await tx.update(tvPlaylists).set({ name: body.name }).where(eq(tvPlaylists.id, id)).returning();
        if (!row) return { missing: true as const };
        await tx.delete(tvPlaylistSlides).where(eq(tvPlaylistSlides.playlistId, id));
      }
      if (body.slides.length > 0) {
        await tx
          .insert(tvPlaylistSlides)
          .values(body.slides.map((s, position) => ({ playlistId: playlistId!, kind: s.kind, poolId: s.poolId, position, seconds: s.seconds, enabled: s.enabled })));
      }
      await recordActivity(tx, actor, {
        kind: "tv_playlist_saved",
        summary: `${actor.name} ${id === null ? "created" : "saved"} the TV playlist "${body.name}" (${body.slides.length} slide${body.slides.length === 1 ? "" : "s"}${
          body.slides.length > 0 ? `: ${body.slides.map((s) => SLIDE_KIND_TEXT[s.kind]).join(", ")}` : ""
        }).`,
      });
      return { id: playlistId! };
    });
    if ("missing" in outcome) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    if ("error" in outcome) {
      reply.status(409).send({ error: outcome.error });
      return;
    }
    reply.status(id === null ? 201 : 200).send({ id: outcome.id });
  }

  fastify.post("/tv/playlists", async (request, reply) => savePlaylist(request, reply, null));
  fastify.put("/tv/playlists/:id", async (request, reply) => savePlaylist(request, reply, (request.params as { id: string }).id));

  fastify.delete("/tv/playlists/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const actor = actorOf(session);
    const outcome = await db.transaction(async (tx) => {
      const [playlist] = await tx.select().from(tvPlaylists).where(eq(tvPlaylists.id, id));
      if (!playlist) return { missing: true as const };
      const using = await tx.select({ name: tvScreens.name }).from(tvScreens).where(eq(tvScreens.playlistId, id));
      if (using.length > 0) return { using: using.map((s) => s.name) };
      await tx.delete(tvPlaylists).where(eq(tvPlaylists.id, id));
      await recordActivity(tx, actor, { kind: "tv_playlist_deleted", summary: `${actor.name} deleted the TV playlist "${playlist.name}".` });
      return { ok: true as const };
    });
    if ("missing" in outcome) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    if ("using" in outcome && outcome.using) {
      const names = outcome.using.map((n) => `"${n}"`).join(" and ");
      reply.status(409).send({ error: `${names} ${outcome.using.length === 1 ? "is" : "are"} playing this playlist. Choose something else for ${outcome.using.length === 1 ? "that screen" : "those screens"} first.` });
      return;
    }
    reply.status(204).send();
  });

  fastify.post("/tv/screens", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const body = parseBody(createScreenSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7303)`);
      const existing = await tx.select().from(tvScreens);
      if (existing.length >= MAX_SCREENS) return { error: `You can have at most ${MAX_SCREENS} screens.` };
      if (existing.some((s) => sameName(s.name, body.name))) return { error: "Another screen already has that name." };
      const [row] = await tx.insert(tvScreens).values({ name: body.name, code: newCode() }).returning();
      await recordActivity(tx, actor, { kind: "tv_screen_created", summary: `${actor.name} added the TV screen "${body.name}".` });
      return { row: row! };
    });
    if ("error" in outcome) {
      reply.status(409).send({ error: outcome.error });
      return;
    }
    reply.status(201).send({ id: outcome.row.id });
  });

  fastify.patch("/tv/screens/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const body = parseBody(updateScreenSchema, request.body, reply);
    if (!body) return;
    if (body.name !== undefined && !isOperatorUser(session.user)) {
      reply.status(403).send({ error: "Site setup access required" });
      return;
    }
    const actor = actorOf(session);
    const outcome = await db.transaction(async (tx) => {
      const [screen] = await tx.select().from(tvScreens).where(eq(tvScreens.id, id));
      if (!screen) return { missing: true as const };
      let playlistName: string | null | undefined;
      if (body.playlistId !== undefined && body.playlistId !== null) {
        const [playlist] = await tx.select().from(tvPlaylists).where(eq(tvPlaylists.id, body.playlistId));
        if (!playlist) return { error: "That playlist isn't there any more." };
        playlistName = playlist.name;
      }
      if (body.name !== undefined) {
        const others = await tx.select().from(tvScreens);
        if (others.some((s) => s.id !== id && sameName(s.name, body.name!))) return { error: "Another screen already has that name." };
      }
      await tx
        .update(tvScreens)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.playlistId !== undefined ? { playlistId: body.playlistId } : {}),
          ...(body.showQr !== undefined ? { showQr: body.showQr } : {}),
        })
        .where(eq(tvScreens.id, id));
      const name = body.name ?? screen.name;
      if (body.name !== undefined && body.name !== screen.name) {
        await recordActivity(tx, actor, { kind: "tv_screen_renamed", summary: `${actor.name} renamed the TV screen "${screen.name}" to "${body.name}".` });
      }
      if (body.playlistId !== undefined && body.playlistId !== screen.playlistId) {
        await recordActivity(tx, actor, {
          kind: "tv_screen_playlist_set",
          summary: `${actor.name} set the TV screen "${name}" to ${playlistName ? `play "${playlistName}"` : "play nothing"}.`,
        });
      }
      if (body.showQr !== undefined && body.showQr !== screen.showQr) {
        await recordActivity(tx, actor, {
          kind: "tv_screen_playlist_set",
          summary: `${actor.name} turned the "Play on your phone" strip ${body.showQr ? "on" : "off"} for the TV screen "${name}".`,
        });
      }
      return { ok: true as const };
    });
    if ("missing" in outcome) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    if ("error" in outcome) {
      reply.status(409).send({ error: outcome.error });
      return;
    }
    reply.status(204).send();
  });

  fastify.post("/tv/screens/:id/reset-link", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const actor = actorOf(session);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx.update(tvScreens).set({ code: newCode() }).where(eq(tvScreens.id, id)).returning();
      if (!row) return false;
      await recordActivity(tx, actor, { kind: "tv_screen_link_reset", summary: `${actor.name} reset the link for the TV screen "${row.name}".` });
      return true;
    });
    if (!done) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.status(204).send();
  });

  fastify.delete("/tv/screens/:id", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const actor = actorOf(session);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx.delete(tvScreens).where(eq(tvScreens.id, id)).returning();
      if (!row) return false;
      await recordActivity(tx, actor, { kind: "tv_screen_deleted", summary: `${actor.name} deleted the TV screen "${row.name}".` });
      return true;
    });
    if (!done) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.status(204).send();
  });
}
