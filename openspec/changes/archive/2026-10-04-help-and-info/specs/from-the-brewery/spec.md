## MODIFIED Requirements

### Requirement: Home shows the brewery section
The system SHALL return the live music this weekend, the featured item, today's specials and the announcement in the single Home request, and Home SHALL show them under "At the brewery" in that order, leaving out any that do not apply. The live music card SHALL show the first music event this weekend (its day, name and time) and link to the Music tab; it SHALL appear and disappear by itself as events are added and removed. The section SHALL not appear on the first-run welcome. Home SHALL keep "Please drink responsibly." at the bottom.

#### Scenario: Everything posted
- **WHEN** a music event this weekend, a feature, a special for today and an announcement exist
- **THEN** Home shows the four in that order

#### Scenario: Live this weekend
- **WHEN** a band is scheduled for this weekend
- **THEN** Home shows "Live this weekend" with the day, the band and the time, linking to the Music tab

#### Scenario: Not this weekend
- **WHEN** the only events are in the past or after this weekend
- **THEN** no live music card is shown

#### Scenario: Nothing posted
- **WHEN** nothing is posted
- **THEN** Home shows the standard "Watch with us" message only
