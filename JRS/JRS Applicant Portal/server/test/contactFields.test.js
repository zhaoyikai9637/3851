import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalPhone, canonicalSkills, locationLabel } from "../../shared/contactFields.js";
import { canonicalLocation } from "../data/locationFields.js";
test("phone numbers store E.164, rejecting invalid national-only numbers", () => {
  assert.equal(canonicalPhone("+65 8123 4567"), "+6581234567");
  assert.throws(() => canonicalPhone("81234567"));
  assert.throws(() => canonicalPhone("+65 123"));
});
test("location rejects incompatible country/state/city tuples", () => {
  assert.equal(canonicalLocation('["SG","",""]'), '["SG","",""]');
  assert.equal(locationLabel('["SG","",""]'), "Singapore");
  assert.throws(() => canonicalLocation('["XX","",""]'));
  assert.throws(() => canonicalLocation('["SG","CA","Los Angeles"]'));
  assert.throws(() => canonicalLocation('["US","CA","Invented city"]'));
});
test("skills store a deduplicated code array, never comma-separated text", () => {
  assert.deepEqual(canonicalSkills(["REACT", "SQL", "REACT"]), ["REACT", "SQL"]);
  assert.throws(() => canonicalSkills("react, sql"));
  assert.throws(() => canonicalSkills(["anything"]));
});
