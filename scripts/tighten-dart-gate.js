const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'api', 'signals.js');
if (!fs.existsSync(target)) process.exit(0);

const original = fs.readFileSync(target, 'utf8');
let next = original;
const anchor = "  const genericRepeat = /같은 유형의 공시가 다시 나왔습니다|두 원문의 조건과 숫자를 비교해야 합니다/.test(clue.changed_fact || '');\n\n  if (routineOwnership) return false;";
const replacement = "  const genericRepeat = /같은 유형의 공시가 다시 나왔습니다|두 원문의 조건과 숫자를 비교해야 합니다/.test(clue.changed_fact || '');\n  const correction = /정정/.test(text);\n  const hasComparablePrevious = (clue.sources || []).length >= 2 && !/정정 전 원문 확인 필요|정정 공시 여부 확인/.test(`${clue.previous_state || ''} ${(clue.confirmed_facts || []).join(' ')}`);\n\n  if (routineOwnership) return false;\n  if (correction && !hasComparablePrevious && !concreteDelta) return false;";

if (next.includes(anchor)) next = next.replace(anchor, replacement);
if (next !== original) fs.writeFileSync(target, next, 'utf8');
