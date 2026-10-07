## Purpose

Named playlists of slides that an admin builds and that a TV screen plays in order, so the brewery can show the pool, the menu and the music on its TVs without a developer.

## ADDED Requirements

### Requirement: Playlists and their slides
The system SHALL let any admin create, rename and delete named playlists. A playlist SHALL hold an ordered list of slides. A slide SHALL be one of Standings (for one chosen pool), Drinks, Kitchen or Music, and SHALL have an on/off switch and a number of seconds it stays on screen (5 to 120, default 15). A playlist SHALL hold at most 12 slides, and playlist names SHALL be 1 to 60 characters and unique ignoring case. The god-user SHALL pass these admin checks.

#### Scenario: Building a playlist
- **WHEN** an admin creates "Game day" and adds Standings for the Thursday pool, Drinks and Music, in that order
- **THEN** the playlist is saved with those three slides in that order, each on, at 15 seconds

#### Scenario: Turning a slide off
- **WHEN** an admin switches the Drinks slide off
- **THEN** the slide stays in the playlist but screens playing it skip it

#### Scenario: Invalid slide
- **WHEN** an admin saves a Standings slide with no pool, a pool that does not exist, or a duration outside 5 to 120 seconds
- **THEN** the save is refused with a clear message and nothing changes

#### Scenario: Duplicate name
- **WHEN** an admin names a playlist the same as another, ignoring upper and lower case
- **THEN** the save is refused with a clear message

### Requirement: Deleting a playlist in use
The system SHALL refuse to delete a playlist that a screen is playing, naming the screens, and SHALL otherwise delete it with its slides. Deleting a pool SHALL remove that pool's Standings slides from every playlist.

#### Scenario: Playlist on a screen
- **WHEN** an admin deletes "Game day" while "Bar TV" plays it
- **THEN** the request is refused and says "Bar TV" is playing it

#### Scenario: A pool is deleted
- **WHEN** a pool is deleted that has Standings slides in two playlists
- **THEN** those slides are gone and the other slides keep their order

### Requirement: Admin playlist screens
The system SHALL give admins a "TV screens" area under More with a list of playlists and an editor for one: its name, its slides in order (move up, move down, remove, on/off, seconds), a way to add a slide (choosing the pool for Standings), and Save. Players and signed-out visitors SHALL have no link to it and the server SHALL refuse their requests.

#### Scenario: Reordering
- **WHEN** an admin moves Music above Drinks and saves
- **THEN** the playlist shows Music before Drinks on reload

#### Scenario: Not an admin
- **WHEN** a player calls any playlist route
- **THEN** it is refused (403) and nothing is shown
