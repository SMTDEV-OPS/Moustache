/**
 * Unit tests for WorkflowEngine - run with: npx ts-node src/services/workflowEngine.test.ts
 */
import assert from "assert";
import { evaluateConditions, resolveTemplateVariables } from "./workflowEngine";

function runTests() {
  console.log("--- WorkflowEngine: evaluateConditions ---");

  assert.strictEqual(evaluateConditions([], { score: 5 }), true, "no conditions returns true");

  const andConditions = [
    { field_slug: "score", operator: "gte" as const, value: "3", logical_group: 1 },
    { field_slug: "score", operator: "lte" as const, value: "7", logical_group: 1 },
  ];
  assert.strictEqual(evaluateConditions(andConditions, { score: 5 }), true, "AND group passes when all match");
  assert.strictEqual(evaluateConditions(andConditions, { score: 2 }), false, "AND group fails when one fails");

  const orConditions = [
    { field_slug: "bucket", operator: "eq" as const, value: "Hot", logical_group: 1 },
    { field_slug: "bucket", operator: "eq" as const, value: "Warm", logical_group: 2 },
  ];
  assert.strictEqual(evaluateConditions(orConditions, { bucket: "Hot" }), true, "OR groups - first passes");
  assert.strictEqual(evaluateConditions(orConditions, { bucket: "Warm" }), true, "OR groups - second passes");
  assert.strictEqual(evaluateConditions(orConditions, { bucket: "Cold" }), false, "OR groups - both fail");

  assert.strictEqual(
    evaluateConditions([{ field_slug: "x", operator: "is_empty", value: "", logical_group: 1 }], {}),
    true,
    "is_empty passes for missing"
  );
  assert.strictEqual(
    evaluateConditions([{ field_slug: "x", operator: "is_not_empty", value: "", logical_group: 1 }], { x: "hi" }),
    true,
    "is_not_empty passes for present"
  );

  assert.strictEqual(
    evaluateConditions([{ field_slug: "bucket", operator: "in", value: "Hot,Warm", logical_group: 1 }], { bucket: "Hot" }),
    true,
    "in operator passes"
  );

  console.log("--- WorkflowEngine: resolveTemplateVariables ---");

  const ctx = { lead_name: "John", agent_name: "Agent Smith" };
  const out = resolveTemplateVariables("Hello {{lead_name}}, assigned to {{agent_name}}", ctx);
  assert.strictEqual(out, "Hello John, assigned to Agent Smith", "replaces variables");

  const out2 = resolveTemplateVariables("Hello {{lead_name}} and {{unknown}}", { lead_name: "John" });
  assert.strictEqual(out2, "Hello John and ", "missing var becomes empty");

  console.log("All WorkflowEngine unit tests passed.");
}

runTests();
