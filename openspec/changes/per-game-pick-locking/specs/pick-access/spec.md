## ADDED Requirements

### Requirement: Per-game locking of picks
A pool whose `pick_deadline_rule` is `per_game_kickoff` SHALL lock each pick at its own game's kickoff. A team SHALL be pickable, changeable and removable by the entry's owner until its game's kickoff, and never once that game has started or has a result (even if its kickoff is later moved). Picking a team that does not play that week SHALL still be refused. For a survivor pool, changing a pick SHALL need both the old team's game and the new team's game to be unlocked, and the replaced pick's result SHALL be cleared. For a pick 'em pool the server SHALL allow at most one pick per game, picking a team replacing the pick on the other team of the same game while that game is unlocked. A pool using `first_kickoff_of_week` (the default for pools saved before this rule) SHALL behave exactly as before.

#### Scenario: Later game stays open
- **WHEN** the Thursday game has started and a player picks a team in a Sunday game that has not started
- **THEN** the pick is saved

#### Scenario: Started game
- **WHEN** a player tries to pick, change or remove a pick for a team whose game has started
- **THEN** the request is refused (409) and the pick is unchanged

#### Scenario: Cannot swap out of a locked pick
- **WHEN** a survivor's picked team's game has started and they pick another team
- **THEN** the change is refused

#### Scenario: Whole-week pool
- **WHEN** a pool uses the whole-week rule and the week's first game has started
- **THEN** every pick for that week is refused, as before

### Requirement: Other players' picks show as each game starts
In a per-game pool with the reveal rule `at_lock`, another player's pick SHALL be visible once that pick's game has started or has a result, and not before; an admin SHALL see only that a pick exists until then. With the reveal rule `after_final_game`, picks SHALL stay hidden until every game of the week has a result, as before. A player's own picks SHALL always be visible to them.

#### Scenario: One game started
- **WHEN** only the Thursday game has started
- **THEN** another player's Thursday pick is visible and their Sunday pick is not

#### Scenario: Held until the week is final
- **WHEN** the pool waits until the week's last game is final
- **THEN** no one else's pick shows until then, whichever games have started
