// Verifies every translation key used in src/ exists in both message files.
import fs from "node:fs";
import path from "node:path";
const msgs = { en: JSON.parse(fs.readFileSync("messages/en.json", "utf8")), vi: JSON.parse(fs.readFileSync("messages/vi.json", "utf8")) };
const get = (o, k) => k.split(".").reduce((x, p) => (x == null ? x : x[p]), o);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } })("src");
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const vars = {};
  for (const m of src.matchAll(/const (\w+) = (?:use|await get)Translations\(\s*(?:\{[^}]*namespace: )?"([\w.]+)"/g)) vars[m[1]] = m[2];
  for (const [v, ns] of Object.entries(vars)) {
    for (const m of src.matchAll(new RegExp(`\\b${v}\\(\\s*([\`"])([^\`"]+)\\1`, "g"))) {
      let key = m[2];
      const dyn = key.includes("${");
      if (dyn) key = key.slice(0, key.indexOf("${")).replace(/\.$/, "");
      for (const loc of ["en", "vi"]) {
        const val = get(msgs[loc], `${ns}.${key}`);
        if (val === undefined || (!dyn && typeof val !== "string")) { console.log(`${loc}: missing ${ns}.${key} (${f})`); bad++; }
      }
    }
  }
}
console.log(bad ? `${bad} problems` : "all keys present");
process.exit(bad ? 1 : 0);
