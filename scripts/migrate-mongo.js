'use strict';
require('../lib/env');
const fs = require('fs');
const path = require('path');
const { db, dir } = require('../lib/db');
const schema = require('../lib/schema');

const data = schema.collections(db);
const exportOnly = process.argv.includes('--export');

(async () => {
  if (exportOnly) { // no driver needed: writes JSON files you can load with mongoimport
    const out = path.join(dir, 'mongo-export');
    fs.mkdirSync(out, { recursive: true });
    Object.entries(data).forEach(([c, docs]) => { fs.writeFileSync(path.join(out, c + '.json'), JSON.stringify(docs.map(schema.extJson))); console.log(`  ${c.padEnd(14)} ${String(docs.length).padStart(6)} documents`); });
    console.log('\n✅ Exported to', out, '\n   Load with:  mongoimport --db qrnova --collection <name> --jsonArray --file <name>.json');
    console.log('   Then create indexes by running the migration without --export (it is idempotent).');
    return process.exit(0);
  }
  let MongoClient;
  try { ({ MongoClient } = require('mongodb')); } catch (e) { console.error('The MongoDB driver is not installed. Run:  npm install mongodb --no-save\n(or use  npm run export:mongo  to write plain JSON files instead)'); process.exit(1); }
  const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017', name = process.env.MONGO_DB || 'qrnova', drop = process.argv.includes('--drop');
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 6000 });
  try {
    await client.connect();
    const m = client.db(name);
    console.log(`Connected to ${url.replace(/\/\/[^@]*@/, '//***@')} → database "${name}"${drop ? ' (collections will be recreated)' : ''}\n`);
    for (const [c, docs] of Object.entries(data)) {
      if (drop) await m.collection(c).drop().catch(() => {});
      const exists = (await m.listCollections({ name: c }).toArray()).length > 0;
      if (!exists) await m.createCollection(c, schema.VALIDATORS[c] ? { validator: { $jsonSchema: schema.VALIDATORS[c] }, validationLevel: 'moderate' } : {});
      for (let i = 0; i < docs.length; i += 500) {
        await m.collection(c).bulkWrite(docs.slice(i, i + 500).map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: schema.dates(d), upsert: true } })), { ordered: false });
      }
      for (const { key, ...opts } of schema.INDEXES[c] || []) await m.collection(c).createIndex(key, opts);
      console.log(`  ${c.padEnd(14)} ${String(docs.length).padStart(6)} documents · ${(schema.INDEXES[c] || []).length} indexes`);
    }
    console.log('\n✅ Migration complete (safe to run again: documents are upserted by _id).');
  } catch (e) { console.error('\n❌ Migration failed:', e.message); process.exitCode = 1; }
  finally { await client.close().catch(() => {}); process.exit(process.exitCode || 0); }
})();