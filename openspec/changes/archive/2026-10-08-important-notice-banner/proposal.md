## Why

Some news is too important for the From the brewery cards on Home: a big event, a menu change, a closure. Robin wants a notice that sits at the top of every player page, and that a player can close to save space on a phone.

## What Changes

- **Notices:** any admin posts a notice (a short title and a message, with an optional "show through" date) and can remove it. Up to 3 can be active at once. A notice cannot be edited: remove it and post a new one.
- **The banner:** signed-in players see active notices at the top of every player page (on Home, above the pool section). Not on admin pages or the public menu.
- **Closing:** each notice has a close button. It stays closed on that device until a new notice is posted (a new notice always shows). Nothing about who closed what is stored on the server.
- **Admin screen:** a simple "Notices" screen under More: a form, and the list of active notices with Remove.
- No schema change: notices reuse the existing `promotions` table with a new kind.

## Capabilities

### New Capabilities
- `site-notices`: posting, showing, closing and removing notices.

### Modified Capabilities
- `admin-activity`: new kinds of recorded change for notices.

## Impact

- **API:** `GET /me/notices` (signed in), admin `GET`, `POST` and `DELETE /notices`. `lib/brewery.ts` must ignore the new kind so notices never appear in From the brewery.
- **Shared:** notice schema, Activity kinds.
- **Dashboard:** a banner in `Shell.tsx`, a Notices admin screen linked from More.
- **Tests:** API (active window, limit of three, players refused), shared schema tests, a test that From the brewery ignores notices, a browser spec (post, see, close, stays closed after reload, new notice shows again), alignment spec updated.
- Not included: showing notices on the TV or public pages, server-side read tracking, a future start date, rich text or images.
