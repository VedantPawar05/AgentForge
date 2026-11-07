const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');
const sf = ts.createSourceFile('page.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

sf.statements.forEach((stmt, idx) => {
  const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
  const { line: endLine } = sf.getLineAndCharacterOfPosition(stmt.getEnd());
  console.log(`Stmt ${idx}: ${ts.SyntaxKind[stmt.kind]} at lines ${line + 1}-${endLine + 1}`);
});

