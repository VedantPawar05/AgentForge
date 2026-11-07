const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve(__dirname, '..', 'docs', 'assets', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('OutDir:', outDir);
console.log('Chrome exists:', fs.existsSync(chromePath));

const os = require('os');
const tmpDir = path.join(os.tmpdir(), 'chrome_ss_' + Date.now());
const target = path.join(outDir, 'landing.png');
const cmd = `"${chromePath}" --headless --disable-gpu --no-sandbox --hide-scrollbars --user-data-dir="${tmpDir}" --run-all-compositor-stages-before-draw --virtual-time-budget=3000 --window-size=1440,900 --screenshot="${target}" http://localhost:3000/`;
console.log('Running:', cmd);

try {
  const res = execSync(cmd, { stdio: 'pipe', timeout: 15000 });
  console.log('Done. Output:', res.toString());
} catch (e) {
  console.log('Exec caught:', e.message);
  if (e.stderr) console.log('Stderr:', e.stderr.toString());
  if (e.stdout) console.log('Stdout:', e.stdout.toString());
}

console.log('File created?', fs.existsSync(target));
if (fs.existsSync(target)) {
  console.log('File size:', fs.statSync(target).size);
}
