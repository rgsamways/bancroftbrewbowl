// Rules and wording for password sign-in, shared by the API (first-password route) and the
// dashboard (instant feedback). No Node imports: this file is bundled into the browser.
//
// better-auth 1.1.9 error codes, proved against the real library (password-sign-in task 1):
//   sign-in, any failure (unknown email, no password, wrong password): 401 INVALID_EMAIL_OR_PASSWORD
//   change-password: wrong current password 400 INVALID_PASSWORD, 400 PASSWORD_TOO_SHORT,
//   400 PASSWORD_TOO_LONG; new equal to current is NEW_PASSWORD_MUST_BE_DIFFERENT (our own hook).

export const MIN_PASSWORD_LENGTH = 10;
/** A password must be shorter than this. */
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordField = "current" | "next" | "confirm";
export type PasswordFormErrors = Partial<Record<PasswordField | "form", string>>;

export const SIGN_IN_FAILED_MESSAGE =
  "That email and password don't match. Check them and try again, or have a sign-in link emailed to you.";

const MSG = {
  currentRequired: "Please enter your current password.",
  nextRequired: "Please enter a new password.",
  tooShort: `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
  tooLong: `That password is too long. Please use fewer than ${MAX_PASSWORD_LENGTH} characters.`,
  same: "Please choose a password that's different from your current one.",
  mismatch: "The two passwords don't match.",
  wrongCurrent: "That isn't your current password. Please try again.",
  network: "We couldn't reach the server, so your password was not changed. Check your connection and try again.",
  signedOut: "Your session has ended, so your password was not changed. Please sign in again.",
  alreadySet: "You already have a password. Use Change password instead.",
  generic: "Something went wrong, so your password was not changed. Please try again.",
};

/** Checks the new password on its own (used by the API for a first password too). */
export function validateNewPassword(next: string): string | null {
  if (!next) return MSG.nextRequired;
  if (next.length < MIN_PASSWORD_LENGTH) return MSG.tooShort;
  if (next.length >= MAX_PASSWORD_LENGTH) return MSG.tooLong;
  return null;
}

/** Everything we can know before sending anything to the server. `current` is only
 * checked when `hasPassword` is true (a first password has no current one). */
export function validatePasswordForm(input: {
  current: string;
  next: string;
  confirm: string;
  hasPassword: boolean;
}): PasswordFormErrors {
  const errors: PasswordFormErrors = {};
  if (input.hasPassword && !input.current) errors.current = MSG.currentRequired;
  const nextError = validateNewPassword(input.next);
  if (nextError) errors.next = nextError;
  else if (input.hasPassword && input.next === input.current) errors.next = MSG.same;
  if (!errors.next && input.confirm !== input.next) errors.confirm = MSG.mismatch;
  return errors;
}

/** Turns a failed set or change call into a message placed next to the right field. */
export function describePasswordFailure(
  failure: { code?: string; status?: number } | "network"
): PasswordFormErrors {
  if (failure === "network") return { form: MSG.network };

  switch (failure.code) {
    case "INVALID_PASSWORD":
      return { current: MSG.wrongCurrent };
    case "PASSWORD_TOO_SHORT":
      return { next: MSG.tooShort };
    case "PASSWORD_TOO_LONG":
      return { next: MSG.tooLong };
    case "NEW_PASSWORD_MUST_BE_DIFFERENT":
      return { next: MSG.same };
    case "PASSWORD_ALREADY_SET":
      return { form: MSG.alreadySet };
  }
  if (failure.status === 401) return { form: MSG.signedOut };
  if (failure.status === 0) return { form: MSG.network };
  return { form: MSG.generic };
}
