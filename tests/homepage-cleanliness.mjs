import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.ok(!html.includes("https://img.youtube.com/vi/mrsdksvK0uE/hqdefault.jpg"),
  "homepage must not request the known-broken YouTube thumbnail");
console.log(JSON.stringify({ ok: true, contract: "homepage-no-known-404s" }));
