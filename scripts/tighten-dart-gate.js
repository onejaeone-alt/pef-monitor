const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'api', 'signals.js');
if (!fs.existsSync(target)) process.exit(0);

const original = fs.readFileSync(target, 'utf8');
let next = original;

const anchor = "  const genericRepeat = /같은 유형의 공시가 다시 나왔습니다|두 원문의 조건과 숫자를 비교해야 합니다/.test(clue.changed_fact || '');\n\n  if (routineOwnership) return false;";
const replacement = "  const genericRepeat = /같은 유형의 공시가 다시 나왔습니다|두 원문의 조건과 숫자를 비교해야 합니다/.test(clue.changed_fact || '');\n  const correction = /정정/.test(text);\n  const hasComparablePrevious = (clue.sources || []).length >= 2 && !/정정 전 원문 확인 필요|정정 공시 여부 확인/.test(`${clue.previous_state || ''} ${(clue.confirmed_facts || []).join(' ')}`);\n\n  if (routineOwnership) return false;\n  if (correction && !hasComparablePrevious && !concreteDelta) return false;";
if (next.includes(anchor)) next = next.replace(anchor, replacement);

const oldSelect = `function selectDartClues(disclosures, limit = 5) {
  return detectDartChanges(disclosures)
    .filter((clue) => !/투자설명서\\(집합투자증권\\)|ETF|인덱스/.test((clue.confirmed_facts || []).join(' ')))
    .filter(materialDartClue)
    .sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')))
    .slice(0, limit);
}`;
const newSelect = `function selectDartClues(disclosures, limit = 5) {
  const seen = new Set();
  return detectDartChanges(disclosures)
    .filter((clue) => !/투자설명서\\(집합투자증권\\)|ETF|인덱스/.test((clue.confirmed_facts || []).join(' ')))
    .filter(materialDartClue)
    .sort((a, b) => String(b.sort_date || '').localeCompare(String(a.sort_date || '')))
    .filter((clue) => {
      const entity = (clue.entities || [])[0] || String(clue.headline || '').split('·')[0].trim();
      const event = String(clue.headline || '').split('·').slice(1).join('·').trim() || clue.detector_label || 'DART';
      const key = entity + '|' + event;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}`;
if (next.includes(oldSelect)) next = next.replace(oldSelect, newSelect);

if (next !== original) fs.writeFileSync(target, next, 'utf8');
