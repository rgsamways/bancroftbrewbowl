// Requests for a second admin's confirmation, and the shapes the screens read. No Node imports.

export const REQUEST_KINDS = ["wipeout_resolution", "status_change"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ["pending", "confirmed", "declined", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const DECLINE_REASON_MAX = 200;

/** Whether a choice needs another admin: it does when the admin's own entry is kept alive in a
 * wipeout or edited, and at least one other admin exists to ask. */
export function needsConfirmation(input: { touchesOwnEntry: boolean; otherAdmins: number }): boolean {
  return input.touchesOwnEntry && input.otherAdmins > 0;
}

/** What the requester gets back when a choice became a request instead of being applied. */
export type RequestCreated = { request: { id: string; askedAdmins: string[] } };

export type AdminRequestLine = {
  id: string;
  kind: RequestKind;
  poolId: string;
  poolName: string;
  requestedByName: string;
  wipeoutId: string | null;
  declineReason: string | null;
  decidedByName: string | null;
  /** Names of the other admins who can confirm. */
  askedAdmins: string[];
};

export type AdminRequestDetail = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  poolId: string;
  poolName: string;
  requestedByName: string;
  decidedByName: string | null;
  declineReason: string | null;
  /** True when the viewer is a different admin and the request is still pending. */
  canDecide: boolean;
  isRequester: boolean;
  askedAdmins: string[];
  weekNumber: number | null;
  game: { homeTeam: string; awayTeam: string } | null;
  /** Wipeout: every player who would be out, with whether the requester kept them. */
  players: { id: string; displayName: string; kept: boolean; isRequesterEntry: boolean; pickedTeams: string[] }[];
  /** Status change: the player and the change asked for. */
  change: {
    displayName: string;
    isRequesterEntry: boolean;
    from: { status: "alive" | "eliminated"; eliminatedWeek: number | null };
    to: { status: "alive" | "eliminated"; eliminatedWeek: number | null };
  } | null;
};
