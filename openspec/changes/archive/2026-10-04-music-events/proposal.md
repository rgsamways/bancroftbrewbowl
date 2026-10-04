## Why

Slice 11b of the v2 build. The brewery hosts live bands and wants players, and anyone with the table QR code, to see who is playing, and an easy way for the owner's wife to add a band. `menu-items` (11a) is live with Drinks and Kitchen; this adds the third part of the Menu tab, Music.

## What Changes

- A new table `music_events` (additive, migration 0009): a title, a date, and optional start and end times.
- Public read-only `GET /public/music` (no sign-in): "This weekend" and "Coming up". Past events are not shown to the public.
- A Music sub-tab next to Drinks and Kitchen, at `/menu/music`, for signed-out visitors and signed-in players alike.
- Admin Music in the admin Menu (a third sub-tab): a list (Coming up, Past), a three-step add wizard (who, when, review), edit and remove. Every change is recorded in Activity.
- **Not in this change:** the "Live this weekend" card on Home and the "Show on Home this week" switch. Both belong to slice 13 so no switch is built that does nothing. No genre, cover charge, images or notes field.

## Capabilities

### New Capabilities
- `music-events`: the events data, the public music list, and the admin screens to keep it current.

### Modified Capabilities
<!-- None: the new Music sub-tab is described in the new capability's spec. -->

## Impact

- Schema: one new table `music_events` (migration 0009).
- API: new `routes/music.ts`; new activity kinds in `packages/shared/src/admin-activity.ts`; a small Eastern-date helper in `packages/shared`.
- Dashboard: `pages/Menu.tsx` (third sub-tab and Music list), `App.tsx` routes, admin Menu (third sub-tab, add wizard, edit).
- Tests: API tests (real Postgres), unit tests for the date helper, new `e2e/music.spec.ts` and `e2e/admin-music.spec.ts`.
