import { readFileSync } from "node:fs";

const path = process.argv[2];
const data = JSON.parse(readFileSync(path, "utf8"));
const weeks = data.weeks;

const allItems = [];
for (const w of weeks) {
  for (const d of w.days) {
    if (d.fruit) allItems.push({ w: w.weekStart, day: d.day, ...d.fruit });
    for (const b of d.breakfast) allItems.push({ w: w.weekStart, day: d.day, ...b });
    for (const l of d.lunch) allItems.push({ w: w.weekStart, day: d.day, ...l });
  }
}

console.log("=== run", data.run, "===");
console.log(
  "total placements",
  allItems.length,
  "distinct dishes",
  new Set(allItems.map((i) => i.dishId)).size,
);

const byRole = {};
for (const i of allItems) (byRole[i.role] ??= []).push(i);
console.log("\n-- distinct dishes per role --");
for (const [r, list] of Object.entries(byRole)) {
  const uniq = new Set(list.map((i) => i.dishId));
  console.log(
    `  ${r.padEnd(24)} placements ${String(list.length).padStart(4)}  distinct ${uniq.size}`,
  );
}

const count = {};
for (const i of allItems)
  count[`${i.dishId} ${i.name}`] = (count[`${i.dishId} ${i.name}`] ?? 0) + 1;
console.log("\n-- top 30 dishes by placements --");
Object.entries(count)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

console.log("\n-- fruit by week --");
for (const w of weeks) {
  console.log(
    `  ${w.weekStart} ${w.season.padEnd(8)} ${w.days.map((d) => (d.fruit ? d.fruit.name.replace(" bowl", "") : "-")).join(", ")}`,
  );
}

console.log("\n-- breakfast mains by week --");
for (const w of weeks) {
  console.log(
    `  ${w.weekStart} ${w.days
      .filter((d) => d.breakfast.length)
      .map((d) => d.breakfast[0].name)
      .join(" | ")}`,
  );
}

console.log("\n-- lunch leads by week (protein-main) --");
for (const w of weeks) {
  console.log(
    `  ${w.weekStart} ${w.days.map((d) => d.lunch.find((l) => l.role === "protein-main")?.name ?? "-").join(" | ")}`,
  );
}

console.log("\n-- exploration picks --");
for (const w of weeks) {
  const e = w.days.flatMap((d) => d.lunch.filter((l) => l.role === "exploration"));
  console.log(`  ${w.weekStart} ${e.map((x) => `${x.dishId}:${x.name}`).join(", ") || "none"}`);
}

console.log("\n-- week-over-week dish-set overlap (Jaccard on placed dish ids) --");
for (let i = 1; i < weeks.length; i += 1) {
  const setOf = (w) =>
    new Set(
      w.days.flatMap((d) => [
        ...(d.fruit ? [d.fruit.dishId] : []),
        ...d.breakfast.map((x) => x.dishId),
        ...d.lunch.map((x) => x.dishId),
      ]),
    );
  const a = setOf(weeks[i - 1]);
  const b = setOf(weeks[i]);
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  console.log(
    `  ${weeks[i].weekStart}  |a|=${a.size} |b|=${b.size} shared=${inter} jaccard=${(inter / union).toFixed(2)}`,
  );
}

console.log("\n-- item counts per day (cap check) --");
const overs = [];
for (const w of weeks)
  for (const d of w.days) {
    const cap = d.day === "Sat" ? 3 : 5;
    if (d.itemCount > cap) overs.push(`${w.weekStart} ${d.day} ${d.itemCount}/${cap}`);
  }
console.log("  over cap:", overs.length, overs.slice(0, 12).join("; "));

console.log("\n-- lunch item-count distribution --");
const dist = {};
for (const w of weeks)
  for (const d of w.days) dist[d.lunch.length] = (dist[d.lunch.length] ?? 0) + 1;
console.log(" ", JSON.stringify(dist));

console.log("\n-- distinct dishes introduced per week (never placed before in the run) --");
const seen = new Set();
for (const w of weeks) {
  const ids = w.days.flatMap((d) => [
    ...(d.fruit ? [d.fruit.dishId] : []),
    ...d.breakfast.map((x) => x.dishId),
    ...d.lunch.map((x) => x.dishId),
  ]);
  const fresh = [...new Set(ids)].filter((x) => !seen.has(x));
  fresh.forEach((x) => seen.add(x));
  console.log(`  ${w.weekStart} new=${fresh.length} cumulative=${seen.size}`);
}
