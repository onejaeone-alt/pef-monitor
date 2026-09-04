const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { localErrors } = require("../scripts/check-schema");

const schema = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");

test("Supabase schema contains every persistence table, column, and unique key", () => {
  assert.deepEqual(localErrors(schema), []);
});

test("schema check reports a missing conflict key", () => {
  const broken = schema.replace(/entity_key text/gi, "removed_key text");
  assert.match(localErrors(broken).join("\n"), /entities\.entity_key/);
});
