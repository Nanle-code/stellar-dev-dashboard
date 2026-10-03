import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_CAPABILITY_SCOPES,
  parseArgs,
  validateArgs,
  buildManifest,
} from "../scripts/create-plugin.mjs";

test("parseArgs parses flags including capabilities and permissions", () => {
  const argv = [
    "node",
    "create-plugin.mjs",
    "--name",
    "Custom Plugin",
    "--id",
    "community.custom-plugin",
    "--output",
    "plugins/custom-plugin",
    "--runtime",
    "iframe",
    "--capabilities",
    "dashboard:read,storage:write,network:request",
  ];

  const parsed = parseArgs(argv);
  assert.equal(parsed.name, "Custom Plugin");
  assert.equal(parsed.id, "community.custom-plugin");
  assert.equal(parsed.output, "plugins/custom-plugin");
  assert.equal(parsed.runtime, "iframe");
  assert.deepEqual(parsed.capabilities, ["dashboard:read", "storage:write", "network:request"]);
});

test("validateArgs passes for valid arguments", () => {
  const validArgs = {
    name: "Valid Plugin",
    id: "org.valid-plugin",
    output: "plugins/valid-plugin",
    runtime: "iframe",
    capabilities: ["dashboard:read", "storage:read"],
    help: false,
  };

  const err = validateArgs(validArgs);
  assert.equal(err, null);
});

test("validateArgs rejects missing name or id", () => {
  assert.match(
    validateArgs({ name: "", id: "valid.id", output: "dir", runtime: "iframe", capabilities: [] }),
    /Missing required option: --name/
  );

  assert.match(
    validateArgs({ name: "Name", id: "", output: "dir", runtime: "iframe", capabilities: [] }),
    /Missing required option: --id/
  );
});

test("validateArgs rejects invalid plugin ID patterns", () => {
  const invalidIds = ["MyPlugin", "-invalid-start", "invalid-end-", "has spaces", "special$char"];
  for (const id of invalidIds) {
    const err = validateArgs({
      name: "Plugin",
      id,
      output: "dir",
      runtime: "iframe",
      capabilities: [],
    });
    assert.match(err, /Invalid plugin ID/);
  }
});

test("validateArgs rejects unsupported runtimes", () => {
  const err = validateArgs({
    name: "Plugin",
    id: "test.plugin",
    output: "dir",
    runtime: "unsupported-runtime",
    capabilities: [],
  });
  assert.match(err, /Unsupported runtime "unsupported-runtime"/);
});

test("validateArgs rejects invalid capability scopes", () => {
  const err = validateArgs({
    name: "Plugin",
    id: "test.plugin",
    output: "dir",
    runtime: "iframe",
    capabilities: ["dashboard:read", "invalid:scope"],
  });
  assert.match(err, /Invalid capability scope "invalid:scope"/);
});

test("buildManifest generates valid manifest with capability permissions", () => {
  const manifest = buildManifest({
    id: "community.demo-plugin",
    name: "Demo Plugin",
    runtime: "iframe",
    capabilities: ["dashboard:read", "storage:write", "dashboard:read"], // duplicate test
  });

  assert.equal(manifest.id, "community.demo-plugin");
  assert.equal(manifest.name, "Demo Plugin");
  assert.deepEqual(manifest.permissions, ["dashboard:read", "storage:write"]);
  assert.equal(manifest.runtime.mode, "iframe");
  assert.equal(manifest.widgets[0].kind, "iframe");
});

test("ALLOWED_CAPABILITY_SCOPES contains all standard platform capability scopes", () => {
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("dashboard:read"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("dashboard:write"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("data:read"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("data:write"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("notifications:write"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("network:request"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("storage:read"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("storage:write"));
  assert.ok(ALLOWED_CAPABILITY_SCOPES.includes("window:open"));
});
