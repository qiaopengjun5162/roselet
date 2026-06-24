import assert from "node:assert/strict";
import test from "node:test";

import { isAdminUser, normalizeUsageStats, progressToGoal } from "../.tmp-test/stats.js";

test("progressToGoal caps percent at 100", () => {
  assert.deepEqual(progressToGoal(125, 100), {
    current: 125,
    goal: 100,
    percent: 100,
  });
});

test("progressToGoal returns zero when goal is invalid", () => {
  assert.deepEqual(progressToGoal(10, 0), {
    current: 10,
    goal: 0,
    percent: 0,
  });
});

test("normalizeUsageStats converts database aggregate strings to numbers", () => {
  assert.deepEqual(
    normalizeUsageStats({
      total_users: "12",
      total_roses: "30",
      public_roses: "24",
      private_roses: "6",
      total_likes: "7",
      total_feedback: "2",
      users_last_7_days: "3",
      roses_last_7_days: "5",
      feedback_last_7_days: "1",
      latest_rose_at: "2026-06-24 10:00:00+00",
      latest_feedback_at: null,
    }),
    {
      total_users: 12,
      total_roses: 30,
      public_roses: 24,
      private_roses: 6,
      total_likes: 7,
      total_feedback: 2,
      users_last_7_days: 3,
      roses_last_7_days: 5,
      feedback_last_7_days: 1,
      latest_rose_at: "2026-06-24 10:00:00+00",
      latest_feedback_at: null,
      user_goal: {
        current: 12,
        goal: 100,
        percent: 12,
      },
    }
  );
});

test("isAdminUser accepts exact user id from comma-separated allowlist", () => {
  assert.equal(isAdminUser("user-2", "user-1,user-2,user-3"), true);
});

test("isAdminUser trims allowlist entries", () => {
  assert.equal(isAdminUser("user-2", " user-1, user-2 "), true);
});

test("isAdminUser rejects missing or unrelated user", () => {
  assert.equal(isAdminUser(null, "user-1"), false);
  assert.equal(isAdminUser("user-2", undefined), false);
  assert.equal(isAdminUser("user-2", "user-1"), false);
});
