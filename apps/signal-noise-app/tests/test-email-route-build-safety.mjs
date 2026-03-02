import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mailboxSendRoute = readFileSync(
  new URL("../src/app/api/mailbox/send/route.ts", import.meta.url),
  "utf8",
);

const rfpNotificationRoute = readFileSync(
  new URL("../src/app/api/notifications/rfp-detected/route.ts", import.meta.url),
  "utf8",
);

test("mailbox send route does not instantiate Resend at module import time", () => {
  assert.doesNotMatch(
    mailboxSendRoute,
    /const\s+resend\s*=\s*new\s+Resend\(/,
    "mailbox send route should construct Resend lazily inside runtime code paths",
  );
});

test("rfp notification route does not instantiate Resend in a constructor at import time", () => {
  assert.doesNotMatch(
    rfpNotificationRoute,
    /constructor\s*\(\)\s*{\s*this\.resend\s*=\s*new\s+Resend\(/,
    "notification route should not eagerly construct Resend during module initialization",
  );
});
