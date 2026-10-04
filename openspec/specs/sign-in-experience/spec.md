# sign-in-experience Specification

## Purpose
What a signed-out or brand-new person sees and can do before they are playing: the sign-in page, the check-your-email step, the page for a link that did not work, the age and responsible-drinking lines, and the welcome a first-time player gets.

## Requirements

### Requirement: Pages shown before sign-in share one public frame
The system SHALL show every page a signed-out person can reach inside a phone-first frame with the Brew Bowl logo and name at the top and no tab bar. Each of these pages SHALL show the lines "You must be 19 or older to play." and "Please drink responsibly."

#### Scenario: Sign-in page frame
- **WHEN** a signed-out person opens the app
- **THEN** they see the logo and name, the sign-in form, and both lines, with no tab bar

#### Scenario: No tab bar before sign-in
- **WHEN** a signed-out person opens any address
- **THEN** no bottom tab bar is shown

### Requirement: The sign-in page explains the email link
The system SHALL title the sign-in page "Sign in to play", explain that a link is emailed and no password is needed, offer a single email field and an "Email me a sign-in link" button, and say "First time here? Same thing. Your account is created when you tap the link."

#### Scenario: Sending a link
- **WHEN** a person enters an email and taps "Email me a sign-in link"
- **THEN** they are taken to the check-your-email step

#### Scenario: Request fails
- **WHEN** sending the link fails (for example the phone is offline)
- **THEN** a plain message says the link could not be sent and to try again, and the typed email is kept

### Requirement: Check your email lets the person resend
The system SHALL, after a link is sent, show "Check your email" with the address it was sent to, a "Resend link" button, and a "Use a different email" option. Resend SHALL be unavailable for a short wait after each send and SHALL say how long is left.

#### Scenario: Address shown
- **WHEN** a link has just been sent to an address
- **THEN** the page shows that address

#### Scenario: Resend
- **WHEN** the wait is over and the person taps "Resend link"
- **THEN** a new link is sent and the wait starts again

#### Scenario: Resend too soon
- **WHEN** the wait has not finished
- **THEN** the Resend button is disabled and shows the seconds remaining

#### Scenario: Wrong address
- **WHEN** the person taps "Use a different email"
- **THEN** they return to the sign-in page with the field ready to edit

### Requirement: A link that did not work has its own page
The system SHALL show a "That link didn't work" page when a person opens a sign-in link that is expired, already used or invalid, saying that links work once and only for a short while, with an "Email me a new link" button and the tip to open the new link on the same phone.

#### Scenario: Expired or used link
- **WHEN** a person opens a sign-in link that has expired or was already used
- **THEN** they see the link-problem page and are not signed in

#### Scenario: Asking for a new link
- **WHEN** they tap "Email me a new link"
- **THEN** they reach the sign-in page, with the email prefilled if this phone just asked for a link

#### Scenario: Link that works
- **WHEN** a person opens a valid sign-in link
- **THEN** they are signed in as before and do not see this page

### Requirement: A first-time player is welcomed on Home
The system SHALL show a first-run welcome on Home to a signed-in person who is in no pool yet: a greeting with their name, the three steps "Join a pool", "Make your picks" and "Watch it play out", and each open pool with a one-tap join button. A person who is in at least one pool SHALL NOT see it.

#### Scenario: New player's Home
- **WHEN** a signed-in person with no entries opens Home
- **THEN** they see the welcome, the three steps and the pools they can join

#### Scenario: Joining from the welcome
- **WHEN** they tap a pool's join button
- **THEN** they are in that pool and the welcome is replaced by their normal Home

#### Scenario: No open pools
- **WHEN** there are no pools to join
- **THEN** the welcome says no pools are open yet and to check back soon

#### Scenario: Returning player
- **WHEN** a person who is already in a pool opens Home
- **THEN** no welcome is shown

### Requirement: Existing sign-in behavior is unchanged
The system SHALL keep the sign-in link flow, session length and account creation exactly as they were; this change only alters what is shown.

#### Scenario: Link still signs in
- **WHEN** a person requests a link and opens it
- **THEN** they are signed in and an account exists for them
