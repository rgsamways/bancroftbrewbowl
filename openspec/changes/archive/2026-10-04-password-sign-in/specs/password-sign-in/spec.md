## Purpose

Lets players and admins optionally sign in with an email and password as a faster alternative to the emailed sign-in link, without changing how accounts are created or how anyone recovers access.

## ADDED Requirements

### Requirement: The email link remains the default and the only way to create an account
The system SHALL keep the emailed sign-in link as the default way to sign in and the only way to create an account. A person who signs in with a link for the first time SHALL get an account, exactly as before this change.

#### Scenario: New player signs in with a link
- **WHEN** someone with no account requests a sign-in link and opens it
- **THEN** an account is created and they are signed in

#### Scenario: Sign-in page opens on the link option
- **WHEN** a signed-out person opens the sign-in page
- **THEN** the "Email link" option is selected and the password fields are not shown

### Requirement: A password can never create an account
The system SHALL refuse to create an account from an email and password. Password sign-in SHALL only work for an account that already exists and already has a password.

#### Scenario: Unknown email with a password
- **WHEN** someone tries to sign in with an email that has no account and any password
- **THEN** no account is created and they see the "email and password don't match" message

#### Scenario: Direct sign-up attempt
- **WHEN** a request is made to the service to register a new account with an email and password
- **THEN** the request is refused and no account is created

### Requirement: Players can sign in with a password
The system SHALL let a person who has set a password sign in on the Password option with their email and that password, and SHALL start the same kind of session that an email link starts.

#### Scenario: Correct email and password
- **WHEN** a person with a password enters their email and the correct password and taps Sign in
- **THEN** they are signed in and taken to Home

#### Scenario: Session lasts as long as a link session
- **WHEN** a person signs in with a password
- **THEN** their session stays valid for the same length of time as one started by an email link

#### Scenario: Password managers can help
- **WHEN** the Password option is shown
- **THEN** the email and password fields identify themselves so that a phone's password manager can fill them in

### Requirement: Wrong sign-in details are explained in plain English without giving anything away
The system SHALL show one message for every failed password sign-in, whether the email is unknown, the account has no password, or the password is wrong. The message SHALL be "That email and password don't match. Check them and try again, or have a sign-in link emailed to you." The email the person typed SHALL stay in the field.

#### Scenario: Wrong password
- **WHEN** a person enters a correct email and a wrong password
- **THEN** they see the message above and their email is still filled in

#### Scenario: Account exists but has no password
- **WHEN** a person who has never set a password tries to sign in with a password
- **THEN** they see the same message and nothing reveals that the account exists

### Requirement: The link is always one tap away from the Password option
The system SHALL offer "Email me a sign-in link instead" on the Password option, so that someone without a password, or who has forgotten it, is never stuck. The system SHALL NOT offer a separate "forgot password" email flow.

#### Scenario: Switching to a link from the Password option
- **WHEN** a person on the Password option has typed their email and taps "Email me a sign-in link instead"
- **THEN** a sign-in link is sent to that email and they see the "Check your email" page

#### Scenario: No reset flow
- **WHEN** a request is made to the service to start a password reset by email
- **THEN** the request is refused and no email is sent

### Requirement: Players can set a first password while signed in
The system SHALL let a signed-in person who has no password set one from the Me page, without asking for a current password. The person SHALL type the new password twice, and both entries SHALL match.

#### Scenario: Setting a first password
- **WHEN** a signed-in person with no password enters a valid new password twice and taps Save
- **THEN** the password is saved, they see "Password saved", and the Me page now offers "Change password"

#### Scenario: Entries do not match
- **WHEN** the two entries differ
- **THEN** they see "The two passwords don't match." next to the second field and nothing is saved

#### Scenario: Not signed in
- **WHEN** a request to set a first password arrives without a valid session
- **THEN** it is refused and no password is set

#### Scenario: Setting a first password twice
- **WHEN** a person who already has a password sends a request to set a first password
- **THEN** the request is refused and their existing password is unchanged

### Requirement: Passwords must be at least 10 characters
The system SHALL require a new password to be at least 10 characters and fewer than 128 characters, wherever a new password is chosen.

#### Scenario: Too short
- **WHEN** a person submits a new password of 9 characters
- **THEN** they see "Your new password needs at least 10 characters." and nothing is saved

#### Scenario: Too long
- **WHEN** a person submits a new password of 128 characters or more
- **THEN** they see "That password is too long. Please use fewer than 128 characters." and nothing is saved

### Requirement: Changing a password needs the current one
The system SHALL require a signed-in person to give their current password, and a new password that is different from it, to change their password.

#### Scenario: Successful change
- **WHEN** a signed-in person enters the correct current password and a valid, different new password twice
- **THEN** the password is changed, they see "Password saved", and the new password works at sign-in while the old one no longer does

#### Scenario: Wrong current password
- **WHEN** the current password is wrong
- **THEN** they see "That isn't your current password. Please try again." next to that field and nothing is changed

#### Scenario: New password same as the current one
- **WHEN** the new password equals the current password
- **THEN** they see "Please choose a password that's different from your current one." and nothing is changed

#### Scenario: Forgotten current password
- **WHEN** a person has forgotten their current password
- **THEN** the Change password page tells them to sign out and use an email link to get in

### Requirement: The Me page shows the right Password option
The system SHALL show a Password section on the Me page that says whether a password is set, offering "Set a password" when none is set and "Change password" when one is.

#### Scenario: No password yet
- **WHEN** a person without a password opens Me
- **THEN** the Password section says a password is not set and offers "Set a password"

#### Scenario: Password already set
- **WHEN** a person with a password opens Me
- **THEN** the Password section says a password is set and offers "Change password"

### Requirement: Failures never lose what the person typed or say something false
The system SHALL keep what the person typed when a form fails, and SHALL say plainly when a change did not happen because of a lost connection or an ended session.

#### Scenario: Connection lost while saving
- **WHEN** the connection fails while a password is being saved
- **THEN** they see "We couldn't reach the server, so your password was not changed. Check your connection and try again." and the form stays as typed

#### Scenario: Session ended while saving
- **WHEN** the session has ended by the time a password is submitted
- **THEN** they see "Your session has ended, so your password was not changed. Please sign in again."

### Requirement: Passwords are never exposed
The system SHALL store passwords only in a form that cannot be read back, and SHALL NOT include a password, or anything that reveals one, in any response, log or email.

#### Scenario: Stored value
- **WHEN** a password is saved
- **THEN** the stored value is not the password itself

#### Scenario: Sign-in link emails are unchanged
- **WHEN** a sign-in link is sent
- **THEN** the email contains no password information

### Requirement: An operator can reset a password
The system SHALL give the person running the service a command that sets a new password for a named account, for the case where someone is locked out. The command SHALL refuse a password under the minimum length and SHALL say clearly when the email has no account.

#### Scenario: Resetting a password
- **WHEN** the operator runs the reset command for an existing account with a valid new password
- **THEN** that account can sign in with the new password, and the old password no longer works

#### Scenario: Unknown email
- **WHEN** the operator runs the reset command for an email with no account
- **THEN** it reports that no account was found and changes nothing

#### Scenario: Reset signs the person out everywhere
- **WHEN** the operator resets a password
- **THEN** every existing session for that account ends, so anyone using the old password is signed out
