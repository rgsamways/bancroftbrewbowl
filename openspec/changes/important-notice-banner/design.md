## Context

From the brewery items are rows in `promotions` with a `kind` (feature, special, announcement) and are read by `lib/brewery.ts`, whose "is it showing now" check treats any kind that is not a special or a feature as an announcement. The Shell (`components/Shell.tsx`) wraps every signed-in player page. `useAccess` shows the project's pattern for asking the server once and remembering. See proposal.md for scope.

## Goals / Non-Goals

**Goals:** a notice that is easy to post, impossible to miss, easy to dismiss, and needs no migration.

**Non-Goals:** per-player read tracking on the server, scheduling a future start, editing, rich text, showing it on the TV or public pages.

## Decisions

- **Reuse `promotions` with `kind = 'notice'`**: `title`, `description` (the message), `on_date` (the show-through date, nullable). No schema change. The cost is that the brewery code must ignore the new kind: `isShowingNow` and the loaders filter by an explicit list of their own kinds, and a test posts a notice and checks it appears nowhere in From the brewery or its admin list. *Alternative:* a new table, which is cleaner but a migration for a three-column list.
- **Closing is remembered on the device.** The banner stores closed notice ids in `localStorage` (one key). A notice has a new id when posted, so a new notice always shows. Ids that are no longer active are dropped from storage on each load, so it cannot grow. If storage is unavailable the banner simply shows again each visit. *Alternative:* a server table of dismissals: more moving parts for something that only saves screen space.
- **No editing.** Editing text would need a rule for whether it re-shows. Remove and repost is one tap more and the rule is obvious.
- **Active means** `on_date` is null or `on_date >= today` in Eastern time (`easternToday`). At most 3 active; the check and the insert run in one transaction so two admins cannot both post a fourth. Newest first.
- **Routes:** `GET /me/notices` (any signed-in user, active only, `no-store`), and for admins `GET /notices` (same list), `POST /notices`, `DELETE /notices/:id`. Both writes call `recordActivity` (kinds `notice_posted` and `notice_removed`, category `content`); the coverage test must pass with no exceptions. A delete must only delete a row of kind `notice`.
- **The banner is in `Shell.tsx`**, fetching once per page load (not per route), above `PageHeader`'s content; on Home that is above the pool section. The admin layout and public pages use other layouts, so they never show it. It renders nothing while loading or when empty, so there is no layout jump when nothing is active. Role `region` with an accessible name "Notice" per notice, close button labelled "Close notice: <title>".
- **Admin screen:** "Notices" under More: a form (title, message, optional "show through" date) and the active list with Remove (with a confirm). Plain wording.

## Risks / Trade-offs

- [Brewery code treats an unknown kind as an announcement] → Explicit kind filters plus a test that fails if a notice leaks.
- [A closed notice stays closed on that phone even if a later reload would be useful] → By design; a new notice re-shows.
- [A newly posted notice appears only on the next page load] → Acceptable; players load pages often and there is no refresh timer today.
- [Clearing browser storage re-shows notices] → Harmless.
