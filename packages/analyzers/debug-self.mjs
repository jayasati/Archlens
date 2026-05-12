import { analyzeRepo } from './dist/index.js';

const repoRoot = 'C:/Users/jayra/Desktop/Archlens';
const ir = await analyzeRepo(repoRoot, { repoName: 'archlens' });

console.log('LANGUAGES :', ir.languages);
console.log('GRADE     :', ir.grade);
console.log('SCORES    :', ir.scoreBreakdown);
console.log('MODULES   :', ir.modules.length);
console.log();
console.log('Module                              Files   LOC    Smells');
console.log('----------------------------------- ------- ------ ------');

const smellCounts = new Map();
for (const m of ir.modules) {
  let n = 0;
  for (const f of m.files) {
    n += f.smells.length;
    for (const fn of f.functions) n += fn.smells.length;
    for (const cls of f.classes) {
      n += cls.smells.length;
      for (const meth of cls.methods) n += meth.smells.length;
    }
  }
  smellCounts.set(m.id, n);
}

for (const m of ir.modules) {
  const loc = m.files.reduce((sum, f) => sum + f.loc, 0);
  const id = m.id.padEnd(35);
  const files = String(m.files.length).padStart(6);
  const locStr = String(loc).padStart(6);
  const smells = String(smellCounts.get(m.id) ?? 0).padStart(6);
  console.log(`${id} ${files} ${locStr} ${smells}`);
}

// Check explicitly for the A1 bug signature: duplicate IDs in the modules array
const seen = new Set();
const dupes = [];
for (const m of ir.modules) {
  if (seen.has(m.id)) dupes.push(m.id);
  seen.add(m.id);
}
console.log();
if (dupes.length > 0) {
  console.log('!! DUPLICATE MODULE IDS STILL PRESENT:', dupes);
} else {
  console.log('OK: every module ID is unique in the merged IR.');
}

// Highlight modules whose IDs carry a language suffix — the disambiguation marker.
const renamed = ir.modules.filter((m) => /__(python|typescript|javascript|java)$/.test(m.id));
if (renamed.length > 0) {
  console.log();
  console.log('Disambiguated modules (would have collided pre-fix):');
  for (const m of renamed) {
    console.log(`  ${m.id}  (display: "${m.name}")`);
  }
} else {
  console.log('No collision-renamed modules — that means no language pair shared a module ID.');
}
