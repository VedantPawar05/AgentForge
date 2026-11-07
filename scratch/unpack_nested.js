const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const file = 'C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/9fd042de-114f-4410-af79-ed994a27f9ec.html';
const html = fs.readFileSync(file, 'utf8');

const m = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
if (m) {
  const manifest = JSON.parse(m[1]);
  console.log('Nested manifest keys in 9fd042de:');
  for (const [k, v] of Object.entries(manifest)) {
    console.log(k, v.mime, 'compressed:', v.compressed, 'data len:', v.data ? v.data.length : 0);
    let buf = Buffer.from(v.data, 'base64');
    if (v.compressed) {
      try { buf = zlib.gunzipSync(buf); } catch (e) { console.log('err:', e); }
    }
    const str = buf.toString('utf8');
    console.log(`Key ${k} -> length: ${str.length}, snippet:\n`, str.slice(0, 300));
    fs.writeFileSync(`C:/Users/vedant/OneDrive/Desktop/AgentForge/Agent forge UI/unpacked/nested_${k.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`, str);
  }
}

