const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'api', 'signals.js');
if (!fs.existsSync(target)) process.exit(0);

const original = fs.readFileSync(target, 'utf8');
let next = original;

const importAnchor = "const { buildCanonicalClues, SNAPSHOT_DATE } = require('../lib/canonical-clues');";
const importLine = "const { enrichDartCluesWithMaterialDiff } = require('../lib/dart-material-diff');";
if (!next.includes(importLine) && next.includes(importAnchor)) {
  next = next.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const handoffOld = `  const selected = balancedClues({ disclosures, leads, groups, gpStats });\n  const clues = selected.items;`;
const handoffNew = `  const selected = balancedClues({ disclosures, leads, groups, gpStats });\n  const dartMaterialDiff = await enrichDartCluesWithMaterialDiff(selectDartClues(disclosures, 8), disclosures, { concurrency: 4 });\n  const nonDartClues = selected.items.filter((clue) => clue.detector !== 'dart_change');\n  const clues = sortClues([...nonDartClues, ...dartMaterialDiff.items.slice(0, 3)])\n    .slice(0, 10)\n    .map(sanitizeDiscoveryClue);`;
if (next.includes(handoffOld)) next = next.replace(handoffOld, handoffNew);

const diagAnchor = `      detector_candidates: selected.detector_candidates,`;
const diagLine = `      dart_material_diff: dartMaterialDiff.diagnostics,`;
if (!next.includes(diagLine) && next.includes(diagAnchor)) {
  next = next.replace(diagAnchor, `${diagAnchor}\n${diagLine}`);
}

const sourceCountAnchor = `      disclosures: disclosures.length,`;
const sourceCountLine = `      dart_material_verified: dartMaterialDiff.items.length,`;
if (!next.includes(sourceCountLine) && next.includes(sourceCountAnchor)) {
  next = next.replace(sourceCountAnchor, `${sourceCountAnchor}\n${sourceCountLine}`);
}

if (next !== original) fs.writeFileSync(target, next, 'utf8');
