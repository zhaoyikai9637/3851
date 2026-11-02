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
test("skills accept applicant-entered names and deduplicate them case-insensitively", () => {
  assert.deepEqual(canonicalSkills(["React", "SQL", "react", "Stakeholder engagement"]), ["React", "SQL", "Stakeholder engagement"]);
  assert.throws(() => canonicalSkills("react, sql"));
  assert.throws(() => canonicalSkills(["invalid<script>"]));
  assert.throws(() => canonicalSkills(Array.from({ length: 51 }, (_, index) => `Skill ${index + 1}`)));
});
