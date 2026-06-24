import assert from "node:assert/strict";
import test from "node:test";

import { canAccessRose, extractBearerToken, getUserIdFromRequest } from "../.tmp-test/rose.js";

test("extractBearerToken returns token from Authorization header", () => {
  const request = new Request("https://example.com/api/rose/1", {
    headers: {
      Authorization: "Bearer token-123",
    },
  });

  assert.equal(extractBearerToken(request), "token-123");
});

test("extractBearerToken returns null for missing bearer token", () => {
  const request = new Request("https://example.com/api/rose/1");

  assert.equal(extractBearerToken(request), null);
});

test("getUserIdFromRequest returns null without JWT secret", async () => {
  const request = new Request("https://example.com/api/rose/1", {
    headers: {
      Authorization: "Bearer token-123",
    },
  });

  assert.equal(await getUserIdFromRequest(request, {}), null);
});

test("canAccessRose allows public rose without user", () => {
  assert.equal(
    canAccessRose(
      {
        is_private: false,
        user_id: "owner-id",
        recipient_user_id: "recipient-id",
      },
      null
    ),
    true
  );
});

test("canAccessRose rejects private rose without user", () => {
  assert.equal(
    canAccessRose(
      {
        is_private: true,
        user_id: "owner-id",
        recipient_user_id: "recipient-id",
      },
      null
    ),
    false
  );
});

test("canAccessRose allows private rose owner", () => {
  assert.equal(
    canAccessRose(
      {
        is_private: true,
        user_id: "owner-id",
        recipient_user_id: "recipient-id",
      },
      "owner-id"
    ),
    true
  );
});

test("canAccessRose allows private rose recipient", () => {
  assert.equal(
    canAccessRose(
      {
        is_private: true,
        user_id: "owner-id",
        recipient_user_id: "recipient-id",
      },
      "recipient-id"
    ),
    true
  );
});

test("canAccessRose rejects unrelated user for private rose", () => {
  assert.equal(
    canAccessRose(
      {
        is_private: true,
        user_id: "owner-id",
        recipient_user_id: "recipient-id",
      },
      "other-id"
    ),
    false
  );
});
