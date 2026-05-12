import { analyzeRepo } from './dist/index.js';

const repoRoot = 'C:/Users/jayra/Desktop/Archlens/sample-projects/internshipPortal-main';
const ir = await analyzeRepo(repoRoot, { repoName: 'internshipPortal' });

const grade = ir.grade;
const sb = ir.scoreBreakdown;

console.log('='.repeat(72));
console.log('REPO     :', ir.name);
console.log('LANGUAGES:', ir.languages);
console.log('GRADE    :', grade);
console.log();
console.log('Score breakdown:');
console.log('  complexity  :', sb.complexity);
console.log('  duplication :', sb.duplication);
console.log('  coupling    :', sb.coupling);
console.log('  cohesion    :', sb.cohesion);
console.log('  smells      :', sb.smells);
console.log('  overall     :', sb.overall);
console.log();

console.log('Modules:', ir.modules.length);
console.log();
console.log(
  'Module                          Files   LOC  Classes  Funcs    In   Out  Cohesion  Instab  D-main  Smells'
);
console.log(
  '------------------------------- ----- ----- -------  -----  ----  ---- --------  ------  ------  ------'
);

for (const m of ir.modules) {
  const files = String(m.files.length).padStart(5);
  let loc = 0;
  let classes = 0;
  let funcs = 0;
  let smellCount = 0;
  for (const f of m.files) {
    loc += f.loc;
    classes += f.classes.length;
    smellCount += f.smells.length;
    funcs += f.functions.length;
    for (const c of f.classes) {
      funcs += c.methods.length;
      smellCount += c.smells.length;
      for (const meth of c.methods) smellCount += meth.smells.length;
    }
    for (const fn of f.functions) smellCount += fn.smells.length;
  }
  const ratio = (v) => (v === undefined ? '   —  ' : `${Math.round(v * 100).toString().padStart(4)}%`);
  const opt = (v) => (v === undefined ? '  — ' : String(v).padStart(4));
  console.log(
    `${m.id.padEnd(31)} ${files} ${String(loc).padStart(5)} ${String(classes).padStart(7)}  ${String(funcs).padStart(5)}  ${opt(m.fanIn)}  ${opt(m.fanOut)}  ${ratio(m.cohesionRatio).padStart(8)}  ${ratio(m.instability).padStart(6)}  ${ratio(m.martinDistance).padStart(6)}  ${String(smellCount).padStart(6)}`
  );
}

console.log();
console.log('Edges (cross-module imports):', ir.edges.length);
for (const e of ir.edges.slice(0, 15)) {
  console.log(`  ${e.from} → ${e.to}  weight=${e.weight}  kind=${e.kind}`);
}
if (ir.edges.length > 15) console.log(`  …and ${ir.edges.length - 15} more`);

console.log();

// Smells summary
const smellsByRule = new Map();
const smellsBySeverity = new Map();
for (const m of ir.modules) {
  for (const f of m.files) {
    for (const s of f.smells) bumpSmell(s);
    for (const c of f.classes) {
      for (const s of c.smells) bumpSmell(s);
      for (const meth of c.methods) for (const s of meth.smells) bumpSmell(s);
    }
    for (const fn of f.functions) for (const s of fn.smells) bumpSmell(s);
  }
}
function bumpSmell(s) {
  smellsByRule.set(s.ruleId, (smellsByRule.get(s.ruleId) ?? 0) + 1);
  smellsBySeverity.set(s.severity, (smellsBySeverity.get(s.severity) ?? 0) + 1);
}

console.log('Smells by rule:');
for (const [rule, n] of [...smellsByRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rule.padEnd(20)} ${n}`);
}
console.log();
console.log('Smells by severity:');
for (const sev of ['critical', 'major', 'minor', 'info']) {
  if (smellsBySeverity.has(sev)) console.log(`  ${sev.padEnd(10)} ${smellsBySeverity.get(sev)}`);
}

console.log();
console.log('IR version:', ir.ir_version);
console.log('Scanned at:', ir.scannedAt);
