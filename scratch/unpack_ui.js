const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const filePath = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/AgentForge UI.html';
const content = fs.readFileSync(filePath, 'utf8');

const manifestMatch = content.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
const pageOrderMatch = content.match(/<script type="__bundler\/page_order">([\s\S]*?)<\/script>/);

if (pageOrderMatch) {
  console.log('Page order:', pageOrderMatch[1]);
}

if (manifestMatch) {
  const manifest = JSON.parse(manifestMatch[1]);
  console.log('Manifest entries count:', Object.keys(manifest).length);
  const outDir = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [key, val] of Object.entries(manifest)) {
    console.log(key, val.mime, 'compressed:', val.compressed);
    if (!val.mime) continue;
    let ext = 'bin';
    if (val.mime.includes('html')) ext = 'html';
    else if (val.mime.includes('javascript')) ext = 'js';
    else if (val.mime.includes('json')) ext = 'json';
    else if (val.mime.includes('css')) ext = 'css';
    else if (val.mime.includes('text')) ext = 'txt';

    if (ext !== 'bin') {
      let buf = Buffer.from(val.data, 'base64');
      if (val.compressed) {
        try { buf = zlib.gunzipSync(buf); } catch (e) { console.error('Gunzip error', e.message); }
      }
      const outPath = path.join(outDir, `${key}.${ext}`);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved ${outPath} (${buf.length} bytes)`);
    }
  }
}

