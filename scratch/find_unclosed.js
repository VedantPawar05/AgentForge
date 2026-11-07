const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');
const sf = ts.createSourceFile('page.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, depth = 0) {
  if (ts.isJsxElement(node)) {
    const tagName = node.openingElement.tagName.getText(sf);
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    // check if closingElement exists
    if (!node.closingElement) {
      console.log('Unclosed JSX Element <' + tagName + '> starting at line ' + (line + 1));
    }
  }
  ts.forEachChild(node, child => walk(child, depth + 1));
}

walk(sf);
console.log('Done walking AST.');

