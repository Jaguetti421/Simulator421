import { ESLint } from 'eslint';
import parser from '@typescript-eslint/parser';
import { rule } from './no-bare-int-arithmetic.ts'; // run with: npx tsx tools/eslint/no-bare-int-arithmetic.check.ts (from the tools/eslint directory, or adjust the fixture path)
import path from 'node:path';
const root = path.resolve('fixture');
const eslint = new ESLint({
  cwd: root, overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.ts'],
    languageOptions: { parser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: root } },
    plugins: { lastclan: { rules: { 'no-bare-int-arithmetic': rule } } },
    rules: { 'lastclan/no-bare-int-arithmetic': 'error' },
  }],
});
const results = await eslint.lintFiles(['packages/**/*.ts']);
for (const r of results) {
  console.log(path.relative(root, r.filePath), 'errors:', r.errorCount);
  for (const m of r.messages) console.log('  line', m.line, m.message.slice(0, 60));
}
const bad = results.find(r => r.filePath.endsWith('bad.ts'))!;
const lines = bad.messages.map(m => m.line).sort((a,b)=>a-b);
console.log('flagged lines:', lines.join(','));
const expected = [7,8,9,10,11,12,13,14,15];
const ok = JSON.stringify([...new Set(lines)]) === JSON.stringify(expected) && results.every(r => r.filePath.endsWith('bad.ts') || r.errorCount === 0);
console.log(ok ? 'RULE TEST PASS' : 'RULE TEST FAIL (expected lines ' + expected.join(',') + ')');
process.exit(ok ? 0 : 1);
