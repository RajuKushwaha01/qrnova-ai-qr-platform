const fs = require('fs');
const path = require('path');
const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const file = path.join(dir, 'db.json');
fs.mkdirSync(dir, { recursive: true });

let db = { users: [], sessions: [], qrs: [], messages: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = file + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), (e) => { if (!e) fs.rename(tmp, file, () => {}); });
  }, 150);
}
function flush() { try { fs.writeFileSync(file, JSON.stringify(db)); } catch {} process.exit(); }
process.on('SIGINT', flush);
process.on('SIGTERM', flush);

module.exports = { db, save, file, dir, flush };