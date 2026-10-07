# Roles and rules for Brew Bowl

_Written 2026-10-04. A design proposal, not built. Nothing here is a commitment until it becomes an OpenSpec change._

This lists who can use Brew Bowl, what each kind of person should be allowed to do, and the rules the app must always keep. It is based on how the app works today, on what Robin has said, and on how the same questions were answered in noisefloor and kerfy.

## What the two other projects teach

**Both use the same core idea: roles are labels, rules are what is actually enforced.**

- **Kerfy** gives each person a list of rules (58 of them, grouped into 11 areas). Roles like "owner" or "office admin" are only a shortcut: ticking one fills in a standard set of rules, and after that each rule can be changed one by one. The server checks rules, never role names. Its test for adding a new role is: *add a role only if the system must behave differently for it; otherwise add a rule.*
- **Noisefloor** works the same way: a global site admin who bypasses every check, a list of site-wide rules, and group memberships that carry their own rules. Its role templates are also only a bulk-apply shortcut.

**Mistakes to avoid, both seen in those projects:**

1. **Rules that exist but nothing enforces them.** Noisefloor stores site rules but no route checks them; kerfy has project rules in its catalog that its routes don't check. For Brew Bowl: a rule is only added when a route enforces it and a test proves it.
2. **The screen hides it but the server allows it.** Several routes in this app do this today (see `openspec/changes/secure-pick-access`).
3. **An audit log that doesn't say who.** Kerfy's database trigger records every change but the "changed by" column is empty on every row, because the database connection doesn't know the signed-in user. Brew Bowl is small enough to write the actor explicitly in the route code.
4. **Losing the last admin.** Both projects block removing the last admin; noisefloor also protects a bootstrap account. Brew Bowl needs the same.
5. **No answer for a person who is both a participant and an admin.** Neither project handles it. Brew Bowl must, because the owner's wife will play.

## Who uses the app

| Who | Signed in? | In one line |
| --- | --- | --- |
| Visitor | No | Looks at the public menu and music, and signs in. |
| Player | Yes | Joins pools, makes picks, follows standings, reads the menu. |
| Spectator | Yes | A player who has been knocked out. This is a state, not a role. |
| Results helper | Yes | Staff who only enter game results. For example, a bartender. |
| Menu and events editor | Yes | Keeps the drinks, kitchen menu, music and announcements current. |
| Pool manager | Yes | Runs the pools and the weekly job. |
| Brewery admin | Yes | Everything above, plus managing who else has access. |
| Operator | No account | The developer (Robin). Runs scripts: schedule import, password reset, first admin. Never a login with special powers in the app. |

Everyone with an account is a player first. **An admin is a normal player account with extra rules.** That is already how the app works (a flag on the user), and it is why "player and admin at once" is the normal case, not an edge case.

## The rules (permissions)

Each rule is a single sentence about one thing a person may do. Default roles below are templates only. A rule shown here becomes real only when a route enforces it and a test covers it.

### Playing (every signed-in account has these)

| Rule | Meaning |
| --- | --- |
| `join_pool` | Join an open pool. |
| `make_own_picks` | Submit, change and delete picks on **their own** entry, before the lock. |
| `view_own_picks` | See their own picks at any time. |
| `view_standings` | See standings, names, status and points. |
| `view_locked_picks` | See everyone's picks for a week once it has locked. |
| `view_menu` | Read the menu and music (also open to visitors). |
| `edit_own_account` | Change their name and email, set or change their own password. |

### Running pools

| Rule | Meaning |
| --- | --- |
| `create_pool` | Create a pool. |
| `edit_pool_rules` | Change a pool's name, season, rules and double-pick weeks while it is unlocked. |
| `lock_pool` | Lock or unlock a pool's rules. |
| `delete_pool` | Delete a pool (type its name to confirm). |
| `set_pool_total` | Type in the pool total shown on standings. |
| `manage_roster` | Add a player by email and edit a player's status. |
| `view_player_emails` | See players' email addresses. |
| `view_pick_status` | See which players have picked, but not what, before the lock. |

### Results and decisions

| Rule | Meaning |
| --- | --- |
| `enter_results` | Enter a game's result and score. |
| `correct_results` | Change a result that was already entered. |
| `resolve_wipeout` | Choose who stays in when a result would knock out everyone. |

### Menu, music and promotions

| Rule | Meaning |
| --- | --- |
| `mark_sold_out` | Switch an item on or off tap or sold out. Small enough to give to anyone behind the bar. |
| `manage_menu` | Add, edit and remove drinks and dishes. |
| `manage_music` | Add and edit bands and events. |
| `manage_promotions` | Feature an item, add a special, write an announcement. |

### People and records

| Rule | Meaning |
| --- | --- |
| `manage_admins` | Invite someone as an admin, change their rules, remove them. |
| `view_activity_log` | Read the record of admin changes. |
| `confirm_admin_decisions` | Confirm or decline another admin's decision that affects their own entry. Never usable on your own. |

### Operator only (never grantable inside the app)

| Rule | Meaning |
| --- | --- |
| `import_schedule` | Load a season's NFL schedule (a script). |
| `reset_password` | Set a new password for someone locked out (a script). |
| `make_first_admin` | Create the first admin (a script, as `make-admin.ts` does today). |
| `impersonate` | **Never.** Not built, not planned. |

## Default roles as templates

| Role | Rules |
| --- | --- |
| Player | The "Playing" group. |
| Results helper | Player, plus `enter_results`, `mark_sold_out`. |
| Menu and events editor | Player, plus `mark_sold_out`, `manage_menu`, `manage_music`, `manage_promotions`. |
| Pool manager | Player, plus all of "Running pools", "Results and decisions", and `view_activity_log`. |
| Brewery admin | Everything except the operator-only rules, including `manage_admins`. |

Staged so it stays small: **at launch** there is just Player and Brewery admin (the existing flag, meaning all rules), with three expected admins (the owner's wife, Robin and the owner), all of whom may also play. The finer roles arrive only when the owner actually wants to hand part of the work to someone else.

## Rules the app must always keep (not permissions)

These are not something an admin can switch off. They are what keeps the pool fair.

1. **Only the owner changes a pick.** Nobody else, including admins.
2. **Picks stay private until the week locks.** After the first kickoff everyone can see them. Before it, an admin can see who has picked, not what.
3. **Emails are private.** Only the person and admins see them.
4. **Locking is never overridden.** Nobody can submit or change a pick after the first kickoff.
5. **A wipeout is never decided silently.** The result is held back until an admin chooses who stays in.
6. **A pool's type never changes, and its rules lock once it is running.**
7. **The last admin cannot be removed**, and a person cannot remove their own admin access if they are the last.
8. **No money moves through the app.** The pool total is a number someone types in.
9. **Every admin action that changes the standings is recorded**, with who and when.
10. **A decision that changes an admin's own standing needs another admin's confirmation.** The person affected can never confirm their own. With only one admin it is allowed, recorded and flagged.

## When one person is both a player and an admin

This is the owner's wife, and probably Robin. The risks are real, and each has a simple answer.

| Risk | What the app does |
| --- | --- |
| Seeing others' picks early | Pick teams stay hidden from everyone, admins included, until the lock. Admins see only "Picked" or "No pick". |
| Saving themselves in a wipeout | Their own entry is marked "You". If they keep themselves, another admin has to confirm before anything changes (see below). |
| Editing their own status | The same: another admin confirms first. |
| Entering or correcting a game result | Allowed and recorded, flagged "affects your own entry" when it does. A result is public and can be checked against the real score, so it doesn't need a second person. |
| Changing someone else's pick | Not possible for anyone. |
| Forgetting which hat they are wearing | Admin screens have an Admin badge and their own tab bar. "Back to the player view" is always in More. |

### The confirmation rule

Robin confirmed on 2026-10-04 that there will be three admins: the owner's wife, Robin and the owner. With that many, a second person is almost always available, so this is adopted:

- **What needs confirming:** a discretionary decision that changes an admin's own standing: keeping themselves alive in a wipeout, or editing their own status or entry. Nothing else.
- **What doesn't:** results, menu, music and announcements. Those are recorded but never held up.
- **Who confirms:** any other admin, never the person affected. If the owner's entry is the one affected, the wife or Robin confirms.
- **How it feels:** the admin taps "Ask another admin to confirm", nothing changes, and the request appears as the other admins' next step ("Confirm a decision from Alex W."). They see what was chosen and confirm or decline.
- **Fallback:** if only one admin exists (for example while the others haven't signed up yet), the decision goes through, recorded and flagged, so nobody is locked out of the weekly job.
- **Record:** the request and the confirmation are both in Activity, each marked as affecting that person's entry.

## The record of admin changes

A plain table written by the route code itself: who (the signed-in admin), what, which pool or item, and when, with a flag when the change touched the admin's own entry. Entering a result, changing a result, resolving a wipeout, editing a status, adding a player, locking or unlocking a pool, changing admin access, editing the menu. Readable by admins in "Activity". It avoids the problem kerfy hit (a trigger that couldn't tell who was signed in), because the code that makes the change already knows.

## How access is stored

- **Today:** `user.isAdmin` is a boolean. It stays, meaning "all rules".
- **When the finer roles are wanted:** add a `rules` text list on the user (not an enum, so adding a rule needs no migration), and a short `admin_invitations` table so an admin can be invited by email before they have an account, applied at sign-in the same way `claimInvitedEntries` already works for pool entries. A role is only a button that fills in a standard list of rules.
- **Brew Bowl is one business per deployment**, so none of kerfy's company layer or noisefloor's groups is needed.

## Suggested order of work

1. **`secure-pick-access`** (done, live 2026-10-04): fixed the three real holes and covers rules 1 to 4 above.
2. **Admin activity record and the player-who-is-admin safeguards:** the activity table, the "You" notices and the hidden-pick table in the admin screens.
3. **Rules list and the Admins screen:** only when the owner wants to hand out part of the work. It adds the `rules` list, the role templates, the invitation, and last-admin protection.

## Staff and employee roles (added 2026-10-04, after v2 shipped)

_Robin's thought: the owner and his wife will want to hand duties to wait staff and other employees. This extends the rules above with staff in mind. Still a proposal; nothing here is built._

### What staff actually do on a game day

- **Behind the bar:** switch a tap or dish to sold out and back; add a walk-in player who asks at the bar; tell a customer whether they have picked yet; put the TV standings on.
- **In the kitchen:** switch a dish to sold out; update the day's specials.
- **Front of house or the game-night lead:** enter results when games end; chase players who haven't picked; keep the TV and the table cards up.
- **Management:** menu and prices, music, specials and announcements, the pools, and who else has access.

### Extra rules this suggests

Split the existing broad rules so a role can be given only the slice it needs.

| Rule | Meaning |
| --- | --- |
| `mark_sold_out_drinks` / `mark_sold_out_dishes` | Sold-out switch, scoped to drinks or to food (a kitchen cook doesn't need the taps, and the reverse). |
| `edit_prices` | Change prices only. Separate from adding or removing items, because price changes are the sensitive part. |
| `manage_drinks` / `manage_dishes` | Add, edit and remove drinks, or dishes. |
| `manage_specials` | Add and remove specials and the day's featured item. |
| `post_announcements` | Write announcements. Kept apart from specials because announcements are free text that goes to every phone. |
| `add_walkin_player` | Add a player to a pool by name and email, without being able to edit anyone's status. |
| `view_pick_status` | See who has picked (not what) before the lock, to chase people. Already in the list; useful for floor staff. |
| `show_tv` | Open the TV page and print the table card. Could simply be open to every signed-in account. |
| `view_player_emails` | Left off every staff role by default: staff can usually help someone without seeing the address. |
| `enter_results` (only) | Without `correct_results`: staff enter a final score, only a manager changes one afterwards. |
| `set_pool_total` | For whoever actually handles the cash at the bar. Always recorded. |
| `manage_staff` | Give or remove staff roles, never above your own level. |

### Roles (presets of rules)

| Role | Who it's for | Rules |
| --- | --- | --- |
| Player | Everyone | The "Playing" group. |
| Bar staff | Bartenders, servers | Player, plus `mark_sold_out_drinks`, `add_walkin_player`, `view_pick_status`, `show_tv`. |
| Kitchen | Cooks | Player, plus `mark_sold_out_dishes`, `manage_specials` for food. |
| Game-night lead | The person running a Sunday | Bar staff, plus `enter_results`. |
| Events and marketing | Whoever books bands and posts | Player, plus `manage_music`, `manage_specials`, `post_announcements`. |
| Menu manager | Head bartender or chef | Player, plus `manage_drinks`, `manage_dishes`, `edit_prices`, sold-out both ways. |
| Pool manager | The weekly job | Player, plus all of "Running pools" and "Results and decisions" (including `correct_results` and `resolve_wipeout`). |
| General manager | Runs the place day to day | Everything except `manage_admins` and the operator-only rules. |
| Owner / admin | Owner, his wife, Robin | Everything, including `manage_admins` and `manage_staff`. |
| Read-only auditor | Accountant or a silent partner | Player, plus `view_activity_log`. Can see, can't change. |

### Safeguards that matter more with staff

1. **A staff member who plays is held to the same fairness rules as an admin.** The confirmation rule ("a decision that changes your own standing needs another person to confirm") should apply to anyone holding a rule that could change their own entry, not only admins. Results entered by someone who is also in the pool are flagged, as for admins.
2. **Nobody can grant a rule they don't hold,** and `manage_staff` can't create anyone above their own level.
3. **Personal accounts, not a shared "bar" login.** Every change is recorded with a name, so a shared tablet account would make Activity useless. If a shared tablet is wanted, give it a narrow role (sold-out only) and accept that its records say "Bar tablet".
4. **Access can end.** Seasonal staff roles can carry an end date so a summer hire's access lapses on its own. Removing someone is one tap and recorded.
5. **Promotions and the law.** Free-text announcements and specials about alcohol are the part most likely to cause trouble with the liquor regulator. Option: staff roles may only draft them and a manager approves, using the same ask-another-person pattern as confirmations. Game-linked drink offers stay unbuilt.
6. **Cash.** `set_pool_total` is display-only, but it is the number players trust. Keep it to a small group and keep it in Activity.
7. **The last-admin and operator rules don't change.** Staff roles never include operator actions (schedule import, password reset).

### Suggested launch shape

Keep it small: Player, **Staff** (sold-out for drinks and dishes, add a walk-in player, see who has picked, enter results) , **Manager** (menu, prices, music, specials, announcements, pools) and **Admin**. Add the narrower presets above only when someone asks for them. Build order stays as in "Suggested order of work", step 3, with the rule list stored as text so adding a rule needs no migration.

### Questions to settle with the owner

- Who are the staff, and do they play in the pools?
- Personal phones, or a shared tablet behind the bar?
- Who handles the cash for the pool total?
- Should staff post announcements and specials directly, or should a manager approve first?
- Should access expire (seasonal staff), and who may add or remove staff?

## The god-user (built 2026-10-07, `admin-tools`)

Robin's account is the site's god-user, as in his other projects. It is configuration, not data: the server setting `OPERATOR_EMAILS` (a comma-separated list, set in Railway) names the accounts, and only a **verified** email counts. Nothing inside the app can grant or take the status away.

- It passes every admin check without needing the admin flag, and alone sees and uses **Site setup** (More): **Schedule** (load a season from ESPN: new games undecided, kickoffs of unstarted games, never a result), **Admins** (add by email, remove; never the last admin or the site owner's own account) and **Help someone sign in** (sign a player out everywhere and remove their password, so they use an emailed link). Each is recorded in Activity.
- Lark and any other admin keep the everyday admin screens and do not see Site setup.
- **The fairness rules still bind the god-user** (see "Rules the app must always keep"): no early look at picks, no changing anyone's pick, no overriding a lock, and a decision about its own entry still needs another admin to confirm.
- Rules `import_schedule`, `manage_admins` and `reset_password` above are therefore the god-user's, not operator-only scripts; the scripts stay as a developer backup.

