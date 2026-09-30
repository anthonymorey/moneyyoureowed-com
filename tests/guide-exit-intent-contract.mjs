import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const targetPath = "guides/medicare-glp1-bridge.html";
const target = await readFile(new URL(targetPath, root), "utf8");
const script = await readFile(new URL("guide-exit-intent.js", root), "utf8");
const stylesheet = await readFile(new URL("guide-exit-intent.css", root), "utf8");

assert.match(target, /href="\/guide-exit-intent\.css"/);
assert.match(target, /src="\/guide-exit-intent\.js"/);
assert.match(target, /role="dialog"/);
assert.match(target, /aria-modal="true"/);
assert.match(target, /Free GLP-1 Coverage Checklist/i);
assert.match(target, /not medical advice/i);

assert.match(script, /["']\/api\/subscribe["']/);
assert.match(script, /193450189555500253/);
assert.match(script, /14\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
assert.match(script, /localStorage/);
assert.match(script, /mouseleave/);
assert.match(script, /pointer:\s*coarse/);
assert.match(script, /Escape/);
assert.match(script, /focus/);
assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/);

const excludedTerms = /\b(limited time|act now|last chance|spots? (?:are )?limited|before it'?s gone|hurry)\b/i;
assert.doesNotMatch(`${target}\n${script}`, excludedTerms);

async function htmlFiles(directory, prefix = "") {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const relative = join(prefix, entry.name);
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await htmlFiles(absolute, relative));
    if (entry.isFile() && entry.name.endsWith(".html")) paths.push(relative);
  }
  return paths;
}

const files = await htmlFiles(new URL(".", root).pathname);
const includes = [];
for (const file of files) {
  const html = await readFile(new URL(file, root), "utf8");
  if (html.includes("guide-exit-intent.js") || html.includes("guide-exit-intent.css")) includes.push(file);
}
assert.deepEqual(includes, [targetPath], "exit-intent assets must load on exactly the target guide");
assert.ok(includes.every((file) => !/(checkout|thank|thanks|delivery|\/d\/)/i.test(file)));

console.log(JSON.stringify({
  ok: true,
  api: "/api/subscribe",
  group: "193450189555500253",
  suppressionDays: 14,
  includes,
}));
