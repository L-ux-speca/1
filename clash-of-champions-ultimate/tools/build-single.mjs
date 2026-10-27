import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(project, '..', 'Clash_of_Champions_Ultimate.html');
let html = fs.readFileSync(path.join(project, 'index.html'), 'utf8');

for (const name of ['styles.css', 'portraits.css']) {
  const style = fs.readFileSync(path.join(project, name), 'utf8');
  html = html.replace(`<link rel="stylesheet" href="${name}">`, `<style>\n${style}\n</style>`);
}

html = html.replace(/<script src="src\/(.*?)"><\/script>/g, (_, name) => {
  let source = fs.readFileSync(path.join(project, 'src', name), 'utf8');
  if (name === 'portraits.js') {
    for (const file of fs.readdirSync(path.join(project, 'assets', 'portraits'))) {
      const media = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const original = fs.readFileSync(path.join(project, 'assets', 'portraits', file));
      // Base64 is byte-preserving transport, not image recompression.
      source = source.replaceAll(`assets/portraits/${file}`, `data:${media};base64,${original.toString('base64')}`);
    }
  }
  if (source.toLowerCase().includes('</script>')) throw Error(`Unexpected script-closing token in ${name}`);
  return `<script>\n${source}\n</script>`;
});

if (html.includes('src/boot.js') || html.includes('assets/portraits/'))
  throw Error('The standalone file still has local game dependencies');
fs.writeFileSync(target, html);
console.log(`Standalone HTML created: ${target} (${(html.length / 1024 / 1024).toFixed(2)} MiB)`);
