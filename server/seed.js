'use strict';

// 用 data/seed.json 重置运行数据 data/db.json
//   node seed.js          仅在 db.json 不存在时写入
//   node seed.js --force  强制覆盖

const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

const force = process.argv.includes('--force');

if (fs.existsSync(db.DB_FILE) && !force) {
  console.log(`[seed] 已存在运行数据：${db.DB_FILE}`);
  console.log('[seed] 如需重置请运行：npm run reset');
  process.exit(0);
}

const seed = fs.readFileSync(db.SEED_FILE, 'utf-8');
JSON.parse(seed); // 校验 JSON 合法
fs.mkdirSync(path.dirname(db.DB_FILE), { recursive: true });
fs.writeFileSync(db.DB_FILE, seed);
console.log(`[seed] 示例数据已写入：${db.DB_FILE}`);
