import { describe, expect, it } from "vitest";
import {
  describePasswordFailure,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SIGN_IN_FAILED_MESSAGE,
  validateNewPassword,
  validatePasswordForm,
} from "./password-form.js";

const change = { current: "old password 1", next: "a much better password", confirm: "a much better password", hasPassword: true };

describe("validatePasswordForm", () => {
  it("accepts a valid change and a valid first password", () => {
    expect(validatePasswordForm(change)).toEqual({});
    expect(validatePasswordForm({ ...change, current: "", hasPassword: false })).toEqual({});
  });

  it("asks for the current password only when one is set", () => {
    expect(validatePasswordForm({ ...change, current: "" }).current).toBe("Please enter your current password.");
    expect(validatePasswordForm({ ...change, current: "", hasPassword: false }).current).toBeUndefined();
  });

  it("says too short at 9 characters and accepts exactly 10", () => {
    const nine = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePasswordForm({ ...change, next: nine, confirm: nine }).next).toBe(
      "Your new password needs at least 10 characters."
    );
    const ten = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validatePasswordForm({ ...change, next: ten, confirm: ten })).toEqual({});
  });

  it("says too long at 128 characters and accepts 127", () => {
    const long = "a".repeat(MAX_PASSWORD_LENGTH);
    expect(validatePasswordForm({ ...change, next: long, confirm: long }).next).toBe(
      "That password is too long. Please use fewer than 128 characters."
    );
    expect(validateNewPassword("a".repeat(MAX_PASSWORD_LENGTH - 1))).toBeNull();
  });

  it("says same as current", () => {
    const same = "an existing long password";
    expect(validatePasswordForm({ current: same, next: same, confirm: same, hasPassword: true }).next).toBe(
      "Please choose a password that's different from your current one."
    );
  });

  it("flags a mismatch on the confirm field only", () => {
    expect(validatePasswordForm({ ...change, confirm: "something else entirely" })).toEqual({
      confirm: "The two passwords don't match.",
    });
  });
});

describe("describePasswordFailure", () => {
  it("places each library code next to the right field", () => {
    expect(describePasswordFailure({ code: "INVALID_PASSWORD" })).toEqual({
      current: "That isn't your current password. Please try again.",
    });
    expect(describePasswordFailure({ code: "PASSWORD_TOO_SHORT" }).next).toContain("at least 10");
    expect(describePasswordFailure({ code: "PASSWORD_TOO_LONG" }).next).toContain("too long");
    expect(describePasswordFailure({ code: "NEW_PASSWORD_MUST_BE_DIFFERENT" }).next).toContain("different");
  });

  it("explains a lost connection and an ended session plainly", () => {
    expect(describePasswordFailure("network").form).toBe(
      "We couldn't reach the server, so your password was not changed. Check your connection and try again."
    );
    expect(describePasswordFailure({ status: 0 }).form).toContain("couldn't reach the server");
    expect(describePasswordFailure({ status: 401 }).form).toBe(
      "Your session has ended, so your password was not changed. Please sign in again."
    );
  });

  it("falls back to a generic message", () => {
    expect(describePasswordFailure({ status: 500 }).form).toContain("Something went wrong");
  });

  it("has the one sign-in failure message", () => {
    expect(SIGN_IN_FAILED_MESSAGE).toBe(
      "That email and password don't match. Check them and try again, or have a sign-in link emailed to you."
    );
  });
});
