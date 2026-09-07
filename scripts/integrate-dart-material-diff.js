const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'api', 'signals.js');
if (!fs.existsSync(target)) process.exit(0);

const original = fs.readFileSync(target, 'utf8');
let next = original;

const importAnchor = "const { buildCanonicalClues, SNAPSHOT_DATE } = require('../lib/canonical-clues');";
const materialImport = "const { enrichDartCluesWithMaterialDiff } = require('../lib/dart-material-diff');";
const documentImport = "const { enrichDartCluesWithDocumentDiff } = require('../lib/dart-document-diff');";
if (!next.includes(materialImport) && next.includes(importAnchor)) {
  next = next.replace(importAnchor, `${importAnchor}\n${materialImport}`);
}
if (!next.includes(documentImport) && next.includes(materialImport)) {
  next = next.replace(materialImport, `${materialImport}\n${documentImport}`);
}

const handoffOld = `  const selected = balancedClues({ disclosures, leads, groups, gpStats });\n  const clues = selected.items;`;
const handoffNew = `  const selected = balancedClues({ disclosures, leads, groups, gpStats });\n  const dartCandidates = selectDartClues(disclosures, 8);\n  const dartMaterialDiff = await enrichDartCluesWithMaterialDiff(dartCandidates, disclosures, { concurrency: 4 });\n  const structuredIds = new Set(dartMaterialDiff.items.map((clue) => clue.clue_id));\n  const dartDocumentDiff = await enrichDartCluesWithDocumentDiff(\n    dartCandidates.filter((clue) => !structuredIds.has(clue.clue_id)),\n    { concurrency: 3 }\n  );\n  const dartVerifiedMap = new Map();\n  for (const clue of [...dartMaterialDiff.items, ...dartDocumentDiff.items]) {\n    if (clue?.clue_id && !dartVerifiedMap.has(clue.clue_id)) dartVerifiedMap.set(clue.clue_id, clue);\n  }\n  const dartVerified = [...dartVerifiedMap.values()]\n    .sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')))\n    .slice(0, 3);\n  const nonDartClues = selected.items.filter((clue) => clue.detector !== 'dart_change');\n  const clues = sortClues([...nonDartClues, ...dartVerified])\n    .slice(0, 10)\n    .map(sanitizeDiscoveryClue);`;
if (next.includes(handoffOld)) next = next.replace(handoffOld, handoffNew);

const diagAnchor = `      detector_candidates: selected.detector_candidates,`;
const materialDiag = `      dart_material_diff: dartMaterialDiff.diagnostics,`;
const documentDiag = `      dart_document_diff: dartDocumentDiff.diagnostics,`;
if (!next.includes(materialDiag) && next.includes(diagAnchor)) {
  next = next.replace(diagAnchor, `${diagAnchor}\n${materialDiag}`);
}
if (!next.includes(documentDiag) && next.includes(materialDiag)) {
  next = next.replace(materialDiag, `${materialDiag}\n${documentDiag}`);
}

const sourceCountAnchor = `      disclosures: disclosures.length,`;
const sourceCountLine = `      dart_material_verified: dartVerified.length,`;
if (!next.includes(sourceCountLine) && next.includes(sourceCountAnchor)) {
  next = next.replace(sourceCountAnchor, `${sourceCountAnchor}\n${sourceCountLine}`);
}

if (next !== original) fs.writeFileSync(target, next, 'utf8');
