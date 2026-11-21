import test from "node:test";
import assert from "node:assert/strict";
import { fee, date, money, percent } from "../lib/format.ts";

test("fees are computed in sen and rounded half-up for each side", () => {
  assert.equal(fee(10000, 300), 300);
  assert.equal(fee(12900, 300), 387);
  assert.equal(fee(150, 300), 5);
  assert.equal(money(10300), "RM103");
  assert.equal(money(13287), "RM132.87");
  assert.equal(money(0), "RM0");
  assert.equal(percent(325), "3.25%");
});

test("event dates use Kuala Lumpur time across UTC midnight", () => {
  assert.equal(date(new Date("2027-02-06T18:00:00Z"), { day: "numeric", month: "short" }), "7 Feb");
});
