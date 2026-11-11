// Run: npm test (builds with tsc, then `node --test lib/notificationLogic.test.js`).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isHouseholdMuted,
  isPreferenceEnabled,
  joinItemNames,
  recurringItemsToRemind,
} from "./notificationLogic";

test("every notification is off until the user turns it on", () => {
  for (const key of ["itemAdded", "urgentItem", "shoppingComplete", "memberJoined", "recurringDue"] as const) {
    assert.equal(isPreferenceEnabled(undefined, key), false);
    assert.equal(isPreferenceEnabled({}, key), false);
  }
});

test("an explicit choice always wins over the default", () => {
  assert.equal(isPreferenceEnabled({ urgentItem: true }, "urgentItem"), true);
  assert.equal(isPreferenceEnabled({ itemAdded: false }, "itemAdded"), false);
  assert.equal(isPreferenceEnabled({ urgentItem: "yes" }, "urgentItem"), false);
});

test("per-home mute", () => {
  assert.equal(isHouseholdMuted(["h1", "h2"], "h2"), true);
  assert.equal(isHouseholdMuted(["h1"], "h2"), false);
  assert.equal(isHouseholdMuted(undefined, "h2"), false);
});

test("batched item names are deduplicated and capped", () => {
  assert.equal(joinItemNames(["חלב", "לחם", "חלב"], "he"), "חלב, לחם");
  assert.equal(joinItemNames(["a", "b", "c", "d", "e", "f"], "en"), "a, b, c, d +2 more");
  assert.equal(joinItemNames(["a", "b", "c", "d", "e"], "he"), "a, b, c, d ועוד 1");
  assert.equal(joinItemNames([" ", "x"], "fr"), "x");
});

test("recurring reminders skip items already on the list", () => {
  assert.deepEqual(
    recurringItemsToRemind(
      [{ name: "חלב", normalizedName: "חלב" }, { name: "Bread" }, { name: "Eggs" }],
      ["חלב", "bread "]
    ),
    ["Eggs"]
  );
});
