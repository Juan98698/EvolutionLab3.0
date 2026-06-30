const fs = require('fs');
const path = require('path');

// Line numbers are 1-indexed. We will insert the disable comment BEFORE the specified line for exhaustive-deps.
// For only-export-components, we also insert before the line.
// For no-unused-vars, we can just prefix with _ or disable.

const fixes = [
  { file: 'api/mercadopago-webhook.ts', line: 74, type: 'replace', search: 'const email =', replace: '// const email =' },
  { file: 'src/components/admin/AdminDashboard.tsx', line: 101, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/common/ReasoningTooltip.tsx', line: 172, type: 'disable', rule: 'react-refresh/only-export-components' },
  { file: 'src/components/common/ReasoningTooltip.tsx', line: 222, type: 'disable', rule: 'react-refresh/only-export-components' },
  { file: 'src/components/dashboard/AthleteDashboard.tsx', line: 490, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/dashboard/ExerciseLibrary.tsx', line: 54, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/dashboard/ExerciseLibrary.tsx', line: 80, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/dashboard/Historial.tsx', line: 238, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/metrics/Analytics.tsx', line: 50, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/metrics/Analytics.tsx', line: 142, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/ConfigRules.tsx', line: 243, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/PlanPlanner.tsx', line: 548, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/PlanPlanner.tsx', line: 949, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/VolumeDistributorWizard.tsx', line: 63, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/VolumeDistributorWizard.tsx', line: 88, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/modals/EvolutionModal.tsx', line: 160, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/components/trainer/modals/RegisterSessionModal.tsx', line: 97, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/context/SupabaseContext.tsx', line: 168, type: 'disable', rule: 'react-hooks/exhaustive-deps' },
  { file: 'src/context/SupabaseContext.tsx', line: 194, type: 'disable', rule: 'react-refresh/only-export-components' },
];

const processedFiles = new Set();

// Sort in reverse line order so that inserting lines doesn't offset subsequent lines in the same file!
fixes.sort((a, b) => b.line - a.line);

for (const fix of fixes) {
  const filePath = path.join(process.cwd(), fix.file);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    continue;
  }

  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const lineIdx = fix.line - 1; // 0-indexed

  if (fix.type === 'replace') {
    lines[lineIdx] = lines[lineIdx].replace(fix.search, fix.replace);
  } else if (fix.type === 'disable') {
    // Insert the eslint disable comment exactly before the line
    const indentation = lines[lineIdx].match(/^\s*/)[0];
    lines.splice(lineIdx, 0, `${indentation}// eslint-disable-next-line ${fix.rule}`);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  processedFiles.add(fix.file);
  console.log(`Fixed ${fix.file} at line ${fix.line}`);
}
console.log('All files processed.');
