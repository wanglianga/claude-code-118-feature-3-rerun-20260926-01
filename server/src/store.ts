import fs from 'fs';
import path from 'path';
import { DB } from './types';
import { buildSeed } from './seed';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DB;
      migrate(db);
      return db;
    } catch (e) {
      console.error('db.json 解析失败，使用种子数据重建', e);
    }
  }
  db = buildSeed();
  save();
  console.log('[store] 已写入种子数据 ->', DB_FILE);
  return db;
}

export function save(): void {
  if (!db) return;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/** 旧版本数据兼容：补齐围挡重排相关集合与任务字段 */
function migrate(d: DB): void {
  d.relayouts = d.relayouts || [];
  d.contractChanges = d.contractChanges || [];
  d.reinstallSettlements = d.reinstallSettlements || [];
  for (const t of d.tasks || []) {
    if (!t.kind) t.kind = 'install';
  }
}

/** 业务单号生成：GG-2026-0001 */
export function nextCode(prefix: string): string {
  const d = getDb();
  const key = `code_${prefix}`;
  d.seq[key] = (d.seq[key] || 0) + 1;
  return `${prefix}-2026-${String(d.seq[key]).padStart(4, '0')}`;
}

export function uid(prefix: string): string {
  const d = getDb();
  const key = `id_${prefix}`;
  d.seq[key] = (d.seq[key] || 0) + 1;
  return `${prefix}_${String(d.seq[key]).padStart(6, '0')}`;
}
