const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');
const sf = ts.createSourceFile('page.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diags = sf.parseDiagnostics;

console.log('Parse diagnostics count:', diags.length);
diags.forEach(d => {
  const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
  console.log('Line ' + (line + 1) + ':' + (character + 1) + ' - ' + d.messageText);
});

