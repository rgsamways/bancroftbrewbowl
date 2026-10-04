/**
 * What an admin gets in place of another player's pick for a week that hasn't
 * locked: proof that the player has picked, with the team and result withheld.
 * Ordinary players get nothing at all for those rows. See the `pick-access`
 * spec in openspec/changes/secure-pick-access.
 */
export type HiddenPick = {
  entryId: string;
  weekNumber: number;
  teamCode: null;
  result: null;
  submitted: true;
};
