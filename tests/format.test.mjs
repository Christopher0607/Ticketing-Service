import test from "node:test";
import assert from "node:assert/strict";
import { fee, formatters, markupBps, money, percent, posterUrl } from "../lib/format.ts";
import { en, zh } from "../lib/messages.ts";

test("fees are computed in sen and rounded half-up for each side", () => {
  assert.equal(fee(10000, 300), 300);
  assert.equal(fee(12900, 300), 387);
  assert.equal(fee(150, 300), 5);
  assert.equal(money(10300), "RM103");
  assert.equal(money(13287), "RM132.87");
  assert.equal(money(0), "RM0");
  assert.equal(percent(325), "3.25%");
});

test("event dates use Kuala Lumpur time across UTC midnight in both languages", () => {
  const value = new Date("2027-02-06T18:00:00Z");
  assert.equal(formatters("en").date(value, { day: "numeric", month: "short" }), "7 Feb");
  assert.equal(formatters("zh").date(value, { day: "numeric", month: "long" }), "2月7日");
  assert.equal(formatters("zh").month(value), "2月");
  assert.equal(formatters("en").day(value), "7");
});

test("markup over face value and poster fallbacks", () => {
  assert.equal(markupBps(11000, 10000), 1000);
  assert.equal(markupBps(9000, 10000), -1000);
  assert.equal(posterUrl({ poster_id: null, image: "concert" }), "/images/concert.webp");
  assert.equal(posterUrl({ poster_id: "abc", image: "concert" }), "/media/abc");
});

test("every English message has a Chinese translation", () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(zh)) assert.ok(value.trim(), `empty zh message ${key}`);
});
