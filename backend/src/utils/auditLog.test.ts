import assert from "assert";
import { logAudit } from "./auditLog";

async function runTests() {
  console.log("--- Audit async non-blocking ---");

  let completed = false;
  let threw = false;

  try {
    logAudit(
      "login",
      "user",
      "test-user-id",
      null,
      { email: "test@example.com" },
      undefined
    );
    completed = true;
  } catch (e) {
    threw = true;
  }

  assert.strictEqual(threw, false, "logAudit must not throw");
  assert.strictEqual(completed, true, "logAudit must return synchronously");

  await new Promise((r) => setImmediate(r));

  console.log("✅ Audit async non-blocking passed");
}

runTests();
