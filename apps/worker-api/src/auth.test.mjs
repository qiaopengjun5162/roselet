import assert from "node:assert/strict";
import test from "node:test";

import {
  hashRefreshToken,
  parseRefreshRequest,
  shouldRevokeByAccessToken,
  validateRefreshToken,
} from "../.tmp-test/auth.js";

test("hashRefreshToken is deterministic", async () => {
  const first = await hashRefreshToken("refresh-token");
  const second = await hashRefreshToken("refresh-token");

  assert.equal(first, second);
});

test("validateRefreshToken accepts uuid-like token", () => {
  assert.equal(validateRefreshToken("550e8400-e29b-41d4-a716-446655440000"), true);
});

test("validateRefreshToken rejects malformed token", () => {
  assert.equal(validateRefreshToken("not-a-valid-uuid"), false);
});

test("parseRefreshRequest returns refresh token from json body", async () => {
  const request = new Request("https://example.com/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: "550e8400-e29b-41d4-a716-446655440000",
    }),
  });

  assert.equal(await parseRefreshRequest(request), "550e8400-e29b-41d4-a716-446655440000");
});

test("parseRefreshRequest rejects missing refresh_token", async () => {
  const request = new Request("https://example.com/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  await assert.rejects(() => parseRefreshRequest(request), /invalid or expired refresh token/);
});

test("shouldRevokeByAccessToken returns false without jwt secret", async () => {
  const request = new Request("https://example.com/api/auth/logout", {
    headers: {
      Authorization: "Bearer refresh-token",
    },
  });

  assert.equal(await shouldRevokeByAccessToken(request, {}), false);
});
