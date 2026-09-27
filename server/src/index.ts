import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getDb, save, nextCode, uid, UPLOAD_DIR } from './store';
import {
  Acceptance, AffectedCreative, ContractChange, Creative, Inspection, InstallTask,
  ReinstallSettlement, Relayout, RelayoutReason, Role, SafeUser, Submission, SubmissionStatus,
  Ticket, TicketType, User,
} from './types';

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ---------------- 鉴权（HMAC 签名令牌，演示级） ----------------
function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token: string): { uid: string } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: User }
  }
}

function auth(req: Request, res: Response, next: NextFunction): void {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const payload = token ? verify(token) : null;
  const user = payload ? getDb().users.find(u => u.id === payload.uid) : undefined;
  if (!user) { res.status(401).json({ error: '未登录或登录已过期' }); return; }
  req.user = user;
  next();
}

function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: '当前角色无权执行此操作' });
      return;
    }
    next();
  };
}

const safe = (u: User): SafeUser => {
  const { password, ...rest } = u;
  return rest;
};

const now = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const today = (): string => now().slice(0, 10);

function findSubmission(req: Request, res: Response): Submission | undefined {
  const s = getDb().submissions.find(x => x.id === req.params.id);
  if (!s) res.status(404).json({ error: '排期单不存在' });
  return s;
}

function pushHistory(s: Submission, u: User, action: string, note?: string): void {
  s.history.push({ time: now(), by: u.id, byName: u.name, action, note });
}

// ---------------- 基础接口 ----------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'hoarding-ads', time: now() });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = getDb().users.find(u => u.username === username && u.password === password);
  if (!user) { res.status(401).json({ error: '用户名或密码错误' }); return; }
  const token = sign({ uid: user.id, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  res.json({ token, user: safe(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: safe(req.user!) }));

app.get('/api/bootstrap', auth, (_req, res) => {
  const db = getDb();
  res.json({
    users: db.users.map(safe),
    submissions: db.submissions,
    tasks: db.tasks,
    tickets: db.tickets,
    acceptances: db.acceptances,
    inspections: db.inspections,
    relayouts: db.relayouts,
    contractChanges: db.contractChanges,
    reinstallSettlements: db.reinstallSettlements,
  });
});

// ---------------- 照片上传 ----------------
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 10);
      cb(null, `up_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype) || file.originalname.endsWith('.svg')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: '未收到文件' }); return; }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------------- 画面提交（广告公司 / 街道） ----------------
app.post('/api/submissions', auth, requireRole('ad_company', 'street'), (req, res) => {
  const b = req.body || {};
  const required = ['type', 'title', 'siteName', 'location', 'roadSegment', 'hoardingLength', 'height', 'approvalUnit', 'plannedInstallDate', 'displayStart', 'displayEnd', 'constructionTeamId', 'acceptanceRequirements'];
  for (const k of required) {
    if (b[k] === undefined || b[k] === '' || b[k] === null) { res.status(400).json({ error: `缺少必填项：${k}` }); return; }
  }
  const hoardingNos: string[] = Array.isArray(b.hoardingNos)
    ? b.hoardingNos.map((x: string) => String(x).trim()).filter(Boolean)
    : String(b.hoardingNos || '').split(/[,，\s]+/).filter(Boolean);
  if (!hoardingNos.length) { res.status(400).json({ error: '请至少填写一个围挡编号' }); return; }
  const creatives: Creative[] = (Array.isArray(b.creatives) ? b.creatives : []).map((c: any, i: number) => ({
    id: uid('cr'),
    kind: c.kind === 'commercial' ? 'commercial' : c.kind === 'safety' ? 'safety' : 'public',
    title: String(c.title || `画面${i + 1}`),
    sizeSpec: String(c.sizeSpec || ''),
    textContent: String(c.textContent || ''),
    theme: String(c.theme || ''),
    brandName: c.brandName ? String(c.brandName) : undefined,
    imageUrl: c.imageUrl ? String(c.imageUrl) : undefined,
    sensitiveRisk: ['none', 'low', 'high'].includes(c.sensitiveRisk) ? c.sensitiveRisk : 'none',
    sightImpact: ['none', 'low', 'high'].includes(c.sightImpact) ? c.sightImpact : 'none',
  }));
  if (!creatives.length) { res.status(400).json({ error: '请至少添加一个画面' }); return; }

  const db = getDb();
  const s: Submission = {
    id: uid('sub'), code: nextCode('GG'),
    type: b.type, title: String(b.title),
    submitterId: req.user!.id, submitterOrg: req.user!.org,
    siteName: String(b.siteName), location: String(b.location), roadSegment: String(b.roadSegment),
    hoardingNos, hoardingLength: Number(b.hoardingLength), height: Number(b.height),
    publicRatio: Number(b.publicRatio ?? 0), creatives,
    approvalUnit: String(b.approvalUnit),
    plannedInstallDate: String(b.plannedInstallDate),
    displayStart: String(b.displayStart), displayEnd: String(b.displayEnd),
    publicSlots: String(b.publicSlots || ''),
    nightLighting: !!b.nightLighting, lightingDesc: b.lightingDesc ? String(b.lightingDesc) : undefined,
    constructionTeamId: String(b.constructionTeamId),
    acceptanceRequirements: String(b.acceptanceRequirements),
    merchantId: b.merchantId ? String(b.merchantId) : undefined,
    contractLength: Number(b.contractLength ?? b.hoardingLength),
    unitPrice: Number(b.unitPrice ?? 0),
    status: 'pending_review', createdAt: now(), history: [],
  };
  pushHistory(s, req.user!, '提交画面审核', `类型：${s.type}，公益比例 ${s.publicRatio}%`);
  db.submissions.unshift(s);
  save();
  res.json({ submission: s });
});

// ---------------- 审核（审核人员） ----------------
app.post('/api/submissions/:id/review', auth, requireRole('reviewer'), (req, res) => {
  const s = findSubmission(req, res); if (!s) return;
  if (s.status !== 'pending_review') { res.status(400).json({ error: '该排期单当前不在待审核状态' }); return; }
  const { decision, checklist, comment } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) { res.status(400).json({ error: 'decision 必须为 approved/rejected' }); return; }
  if (decision === 'rejected' && !comment) { res.status(400).json({ error: '驳回必须填写审核意见' }); return; }
  s.review = {
    reviewerId: req.user!.id,
    checklist: {
      dimensionOk: !!checklist?.dimensionOk, textOk: !!checklist?.textOk,
      sensitiveOk: !!checklist?.sensitiveOk, themeOk: !!checklist?.themeOk,
      brandOk: !!checklist?.brandOk, sightOk: !!checklist?.sightOk,
    },
    comment: String(comment || ''), decision, time: now(),
  };
  const db = getDb();
  if (decision === 'approved') {
    s.status = 'approved';
    for (const no of s.hoardingNos) {
      db.tasks.push({
        id: uid('task'), code: nextCode('RW'), submissionId: s.id,
        roadSegment: s.roadSegment, hoardingNo: no, teamId: s.constructionTeamId, status: 'pending',
      });
    }
    pushHistory(s, req.user!, '审核通过', `已生成 ${s.hoardingNos.length} 个安装任务`);
  } else {
    s.status = 'rejected';
    pushHistory(s, req.user!, '审核驳回', comment);
  }
  save();
  res.json({ submission: s });
});

// ---------------- 安装任务（施工队） ----------------
app.post('/api/tasks/:id/claim', auth, requireRole('construction'), (req, res) => {
  const db = getDb();
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) { res.status(404).json({ error: '任务不存在' }); return; }
  if (t.teamId !== req.user!.id) { res.status(403).json({ error: '该任务指派给其他施工队' }); return; }
  if (t.status !== 'pending') { res.status(400).json({ error: '任务已被领取' }); return; }
  t.status = 'claimed';
  t.claimedAt = now();
  const s = db.submissions.find(x => x.id === t.submissionId);
  if (s && s.status === 'approved') {
    s.status = 'installing';
    pushHistory(s, req.user!, '开始安装', `${t.hoardingNo} 已领取`);
  }
  save();
  res.json({ task: t });
});

app.post('/api/tasks/:id/report', auth, requireRole('construction'), (req, res) => {
  const db = getDb();
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) { res.status(404).json({ error: '任务不存在' }); return; }
  if (t.teamId !== req.user!.id) { res.status(403).json({ error: '该任务指派给其他施工队' }); return; }
  if (t.status !== 'claimed') { res.status(400).json({ error: '请先领取任务再上报' }); return; }
  const b = req.body || {};
  if (!Array.isArray(b.beforePhotos) || !b.beforePhotos.length) { res.status(400).json({ error: '请上传安装前照片' }); return; }
  if (!Array.isArray(b.afterPhotos) || !b.afterPhotos.length) { res.status(400).json({ error: '请上传安装后照片' }); return; }
  if (!(Number(b.actualLength) > 0)) { res.status(400).json({ error: '请填写实际长度' }); return; }
  t.report = {
    beforePhotos: b.beforePhotos.map(String), afterPhotos: b.afterPhotos.map(String),
    actualLength: Number(b.actualLength), gaps: String(b.gaps || '无'),
    blocksTrafficSign: !!b.blocksTrafficSign, affectsPedestrians: !!b.affectsPedestrians,
    note: String(b.note || ''), time: now(), by: req.user!.id, byName: req.user!.name,
  };
  t.status = 'reported';
  const s = db.submissions.find(x => x.id === t.submissionId);
  if (s) {
    pushHistory(s, req.user!, t.kind === 'reinstall' ? '上报拆装情况' : '上报安装情况', `${t.hoardingNo} 实际 ${t.report.actualLength} 米`);
    // 已取消任务与被重排移除编号的旧任务不计入验收进度；仅安装流程中的排期单才翻转到待验收
    const all = db.tasks.filter(x => x.submissionId === s.id && x.status !== 'cancelled' && s.hoardingNos.includes(x.hoardingNo));
    if (['approved', 'installing'].includes(s.status) && all.length > 0 && all.every(x => x.status === 'reported')) {
      s.status = 'pending_acceptance';
      const total = all.reduce((sum, x) => sum + (x.report?.actualLength || 0), 0);
      pushHistory(s, req.user!, '全部安装上报完成', `实际安装合计 ${total} 米`);
    }
  }
  save();
  res.json({ task: t });
});

// ---------------- 验收（审核人员 / 街道） ----------------
app.post('/api/submissions/:id/accept', auth, requireRole('reviewer', 'street'), (req, res) => {
  const db = getDb();
  const s = db.submissions.find(x => x.id === req.params.id);
  if (!s) { res.status(404).json({ error: '排期单不存在' }); return; }
  if (s.status !== 'pending_acceptance') { res.status(400).json({ error: '该排期单当前不在待验收状态' }); return; }
  const b = req.body || {};
  const acceptedLength = Number(b.acceptedLength);
  if (!(acceptedLength > 0)) { res.status(400).json({ error: '请填写验收长度' }); return; }

  const settleableArea = Math.round(acceptedLength * s.height * 100) / 100;
  const publicArea = Math.round(settleableArea * s.publicRatio / 100 * 100) / 100;
  const commercialArea = Math.round((settleableArea - publicArea) * 100) / 100;
  const grossAmount = Math.round(commercialArea * s.unitPrice * 100) / 100;

  // 扣款：已核定工单扣款 + 长度差异违约扣款
  const deductions: Acceptance['deductions'] = [];
  const related = db.tickets.filter(t => t.submissionId === s.id);
  for (const t of related) {
    if (t.deductionAmount > 0) deductions.push({ reason: `${t.title}（${t.code}）`, amount: t.deductionAmount, ticketId: t.id });
  }
  const lengthDiff = Math.round((s.contractLength - acceptedLength) * 100) / 100;
  let mismatchTicket: Ticket | undefined;
  if (lengthDiff > 0.5) {
    const breach = Math.round(lengthDiff * s.height * (1 - s.publicRatio / 100) * s.unitPrice * 1.2 * 100) / 100;
    mismatchTicket = {
      id: uid('ticket'), code: nextCode('GD'), type: 'length_mismatch',
      submissionId: s.id, title: `验收长度 ${acceptedLength}m 与合同 ${s.contractLength}m 不符`,
      description: `验收长度比合同长度少 ${lengthDiff} 米，按合同 1.2 倍违约系数扣款。`,
      photos: [], raisedBy: req.user!.id, raisedByName: req.user!.name, raisedRole: req.user!.role,
      status: 'open', deductionAmount: breach,
      rectification: '广告公司核对差异原因，必要时补装或确认扣款', deadline: b.rectDeadline || today(),
      actions: [{ time: now(), by: req.user!.id, byName: req.user!.name, role: req.user!.role, action: '验收自动生成工单', note: `差异 ${lengthDiff} 米` }],
      createdAt: now(),
    };
    db.tickets.unshift(mismatchTicket);
    deductions.push({ reason: `验收长度与合同不符（${mismatchTicket.code}，差异 ${lengthDiff}m ×1.2 违约系数）`, amount: breach, ticketId: mismatchTicket.id });
  }

  // 整改项：未闭环工单的整改要求 + 手工补充
  const rectifications: Acceptance['rectifications'] = related
    .filter(t => t.status !== 'closed' && t.status !== 'resolved' && t.rectification)
    .map(t => ({
      id: uid('rect'), desc: `${t.rectification}（${t.code}）`,
      assigneeRole: (t.type === 'dirty' || t.type === 'wind_damage' ? 'construction' : 'ad_company') as Role,
      deadline: t.deadline || today(), status: 'open' as const, ticketId: t.id,
    }));
  for (const r of Array.isArray(b.rectifications) ? b.rectifications : []) {
    if (r && r.desc) rectifications.push({
      id: uid('rect'), desc: String(r.desc), assigneeRole: 'construction',
      deadline: String(r.deadline || today()), status: 'open' as const,
    });
  }

  // 后续巡检计划
  const inspectorId = String(b.inspectorId || db.users.find(u => u.role === 'inspector')?.id || '');
  const intervalDays = Number(b.inspectionIntervalDays) > 0 ? Number(b.inspectionIntervalDays) : 7;
  const count = Number(b.inspectionCount) > 0 ? Number(b.inspectionCount) : 4;
  const accId = uid('acc');
  const inspectionPlan: Acceptance['inspectionPlan'] = [];
  const inspections: Inspection[] = [];
  const base = new Date(today());
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getTime() + i * intervalDays * 86400000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const planId = uid('insp');
    inspectionPlan.push({ id: planId, date, inspectorId, focus: i === 1 ? '画面完整性与公益比例' : '例行巡检', status: 'planned' });
    inspections.push({ id: uid('insp_rec'), planItemId: planId, acceptanceId: accId, submissionId: s.id, date, inspectorId, focus: inspectionPlan[i - 1].focus, status: 'planned' });
  }

  const totalDeduction = Math.round(deductions.reduce((sum, d) => sum + d.amount, 0) * 100) / 100;
  const acc: Acceptance = {
    id: accId, code: nextCode('YS'), submissionId: s.id,
    acceptedLength, contractLength: s.contractLength, height: s.height,
    settleableArea, publicArea, commercialArea, unitPrice: s.unitPrice,
    grossAmount, deductions, totalDeduction,
    settleAmount: Math.round((grossAmount - totalDeduction) * 100) / 100,
    rectifications, inspectionPlan,
    status: 'pending_finance', comment: String(b.comment || ''),
    acceptedBy: req.user!.id, acceptedByName: req.user!.name, createdAt: now(),
  };
  db.acceptances.unshift(acc);
  db.inspections.push(...inspections);
  s.status = 'accepted';
  pushHistory(s, req.user!, '验收完成', `验收长度 ${acceptedLength} 米，扣款 ${totalDeduction} 元，待财务结算`);
  save();
  res.json({ acceptance: acc, submission: s });
});

// ---------------- 异常工单 ----------------
const TICKET_TYPES: TicketType[] = ['temporary_change', 'wind_damage', 'ratio_violation', 'early_removal', 'dirty', 'length_mismatch'];

app.post('/api/tickets', auth, (req, res) => {
  const b = req.body || {};
  if (!TICKET_TYPES.includes(b.type)) { res.status(400).json({ error: '工单类型不合法' }); return; }
  const db = getDb();
  const s = db.submissions.find(x => x.id === b.submissionId);
  if (!s) { res.status(400).json({ error: '关联排期单不存在' }); return; }
  if (!b.title || !b.description) { res.status(400).json({ error: '请填写工单标题与描述' }); return; }
  const t: Ticket = {
    id: uid('ticket'), code: nextCode('GD'), type: b.type,
    submissionId: s.id, title: String(b.title), description: String(b.description),
    photos: Array.isArray(b.photos) ? b.photos.map(String) : [],
    raisedBy: req.user!.id, raisedByName: req.user!.name, raisedRole: req.user!.role,
    status: 'open', deductionAmount: 0,
    rectification: b.rectification ? String(b.rectification) : undefined,
    deadline: b.deadline ? String(b.deadline) : undefined,
    actions: [{ time: now(), by: req.user!.id, byName: req.user!.name, role: req.user!.role, action: '发起工单', note: b.note ? String(b.note) : undefined }],
    createdAt: now(),
  };
  db.tickets.unshift(t);
  pushHistory(s, req.user!, '发起异常工单', `${t.code} ${t.title}`);
  save();
  res.json({ ticket: t });
});

app.post('/api/tickets/:id/action', auth, (req, res) => {
  const db = getDb();
  const t = db.tickets.find(x => x.id === req.params.id);
  if (!t) { res.status(404).json({ error: '工单不存在' }); return; }
  const { action, note, deductionAmount } = req.body || {};
  const u = req.user!;
  const push = (act: string, customNote?: string) => t.actions.push({ time: now(), by: u.id, byName: u.name, role: u.role, action: act, note: customNote ?? (note ? String(note) : undefined) });

  if (action === 'set_deduction') {
    if (u.role !== 'finance') { res.status(403).json({ error: '仅财务可核定扣款' }); return; }
    t.deductionAmount = Math.max(0, Number(deductionAmount) || 0);
    push('核定扣款', `扣款金额 ${t.deductionAmount} 元${note ? '：' + note : ''}`);
  } else if (action === 'start') {
    if (t.status !== 'open') { res.status(400).json({ error: '工单不在待处理状态' }); return; }
    t.status = 'processing';
    push('开始处理');
  } else if (action === 'resolve') {
    if (t.status !== 'processing') { res.status(400).json({ error: '工单不在处理中状态' }); return; }
    t.status = 'resolved';
    push('提交处理结果');
  } else if (action === 'close') {
    if (t.status !== 'resolved') { res.status(400).json({ error: '工单需先提交处理结果' }); return; }
    t.status = 'closed';
    push('验收关闭');
    // 同步关闭验收单中对应整改项
    for (const acc of db.acceptances) {
      for (const r of acc.rectifications) {
        if (r.ticketId === t.id) r.status = 'done';
      }
    }
  } else if (action === 'reopen') {
    if (t.status !== 'resolved') { res.status(400).json({ error: '仅已解决工单可退回' }); return; }
    t.status = 'processing';
    push('退回重新处理');
  } else {
    res.status(400).json({ error: '不支持的操作' }); return;
  }
  save();
  res.json({ ticket: t });
});

// ---------------- 工地改围挡重排 ----------------
const REINSTALL_UNIT_PRICE = 25; // 拆装费单价（元/m²，按画面面积计）
const RELAYOUT_REASONS: RelayoutReason[] = ['construction', 'ad_company', 'street', 'force_majeure'];
const RELAYOUT_ALLOWED_STATUS: SubmissionStatus[] = ['approved', 'installing', 'pending_acceptance', 'accepted'];

/** 变更原因 → 费用承担方 */
const REASON_BEARER: Record<RelayoutReason, Relayout['costBearer']> = {
  construction: 'construction',   // 施工方原因 → 施工方承担，单独结算
  ad_company: 'ad_company',       // 广告公司要求 → 广告公司承担，计入合同扣款
  street: 'street',               // 街道/市政要求 → 街道承担，单独结算
  force_majeure: 'shared',        // 不可抗力 → 双方各半
};

function parseNos(v: unknown): string[] {
  const list = Array.isArray(v) ? v.map(x => String(x)) : String(v || '').split(/[,，\s]+/);
  return [...new Set(list.map(x => x.trim()).filter(Boolean))];
}

/** 从画面尺寸（如 6m×2.5m）解析宽度 */
function parseWidth(sizeSpec: string): number {
  const m = String(sizeSpec).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/**
 * 重排重算：可用广告长度、受影响画面、受影响任务与拆装费用。
 * 画面按顺序循环铺贴于围挡全长，超出新边界的画面受影响；
 * 被移除编号上「已安装（已上报）」的画面生成拆装任务，费用 = 实际长度 × 高度 × 拆装单价。
 */
function computeRelayout(s: Submission, allTasks: InstallTask[], newNos: string[], newLength: number) {
  const availableLength = newLength;
  const affected = new Map<string, AffectedCreative>();
  if (newLength < s.hoardingLength && s.creatives.length > 0) {
    const widths = s.creatives.map(c => parseWidth(c.sizeSpec) || 6);
    let pos = 0; let i = 0;
    while (pos < s.hoardingLength - 1e-9 && i < 10000) {
      const w = widths[i % widths.length] || 6;
      const c = s.creatives[i % s.creatives.length];
      if (pos + w > newLength + 1e-9 && !affected.has(c.id)) {
        affected.set(c.id, { id: c.id, title: c.title, kind: c.kind, width: w, reason: '超出新边界（尾部裁切）' });
      }
      pos += w; i += 1;
    }
  }
  const removedNos = s.hoardingNos.filter(n => !newNos.includes(n));
  const addedNos = newNos.filter(n => !s.hoardingNos.includes(n));
  const myTasks = allTasks.filter(t => t.submissionId === s.id && t.status !== 'cancelled');
  const affectedTasks = myTasks.filter(t => removedNos.includes(t.hoardingNo));
  const cancelTaskCount = affectedTasks.filter(t => t.status !== 'reported').length;
  const installed = affectedTasks.filter(t => t.status === 'reported');
  const reinstallTaskCount = installed.length;
  const reinstallCost = Math.round(
    installed.reduce((sum, t) => sum + (t.report?.actualLength || 0) * s.height * REINSTALL_UNIT_PRICE, 0) * 100,
  ) / 100;
  return { availableLength, affectedCreatives: [...affected.values()], removedNos, addedNos, cancelTaskCount, reinstallTaskCount, reinstallCost };
}

/** 拆装费用按变更原因拆分：广告公司扣款 / 单独结算 */
function costSplit(reason: RelayoutReason, cost: number) {
  const bearer = REASON_BEARER[reason];
  let adCompanyDeduction = 0;
  let separateAmount = 0;
  if (bearer === 'ad_company') adCompanyDeduction = cost;
  else if (bearer === 'shared') {
    adCompanyDeduction = Math.round(cost / 2 * 100) / 100;
    separateAmount = Math.round((cost - adCompanyDeduction) * 100) / 100;
  } else separateAmount = cost; // construction / street 全额单独结算
  return { bearer, adCompanyDeduction, separateAmount };
}

/** 重排试算（不落库）：施工队发起前在页面预览重算结果 */
app.post('/api/relayouts/preview', auth, (req, res) => {
  const b = req.body || {};
  const db = getDb();
  const s = db.submissions.find(x => x.id === b.submissionId);
  if (!s) { res.status(400).json({ error: '排期单不存在' }); return; }
  const newNos = parseNos(b.newHoardingNos);
  const newLength = Number(b.newLength);
  if (!newNos.length) { res.status(400).json({ error: '请填写新围挡编号' }); return; }
  if (!(newLength > 0)) { res.status(400).json({ error: '请填写有效的新边界长度' }); return; }
  const reason: RelayoutReason = RELAYOUT_REASONS.includes(b.reason) ? b.reason : 'construction';
  const calc = computeRelayout(s, db.tasks, newNos, newLength);
  res.json({ preview: { ...calc, ...costSplit(reason, calc.reinstallCost) } });
});

/** 发起围挡重排（责任施工队） */
app.post('/api/relayouts', auth, requireRole('construction'), (req, res) => {
  const b = req.body || {};
  const db = getDb();
  const s = db.submissions.find(x => x.id === b.submissionId);
  if (!s) { res.status(400).json({ error: '排期单不存在' }); return; }
  if (s.constructionTeamId !== req.user!.id) { res.status(403).json({ error: '仅该工地责任施工队可发起围挡重排' }); return; }
  if (!RELAYOUT_ALLOWED_STATUS.includes(s.status)) { res.status(400).json({ error: '当前状态不支持围挡重排（需审核通过后、结算前）' }); return; }
  if (db.relayouts.some(r => r.submissionId === s.id && r.status === 'pending_confirm')) { res.status(400).json({ error: '该排期单已有待确认的重排单，请先处理' }); return; }
  const newNos = parseNos(b.newHoardingNos);
  if (!newNos.length) { res.status(400).json({ error: '请填写新围挡编号' }); return; }
  const newLength = Number(b.newLength);
  if (!(newLength > 0)) { res.status(400).json({ error: '请填写有效的新边界长度' }); return; }
  if (!RELAYOUT_REASONS.includes(b.reason)) { res.status(400).json({ error: '变更原因不合法' }); return; }
  if (!b.responsibility || !String(b.responsibility).trim()) { res.status(400).json({ error: '请填写责任说明（将进入合同变更记录）' }); return; }
  if (!b.newInstallDate) { res.status(400).json({ error: '请填写重排后安装时间' }); return; }

  const calc = computeRelayout(s, db.tasks, newNos, newLength);
  const split = costSplit(b.reason, calc.reinstallCost);
  const r: Relayout = {
    id: uid('relayout'), code: nextCode('CP'), submissionId: s.id,
    reason: b.reason, responsibility: String(b.responsibility).trim(),
    oldHoardingNos: [...s.hoardingNos], newHoardingNos: newNos,
    oldLength: s.hoardingLength, newLength, newInstallDate: String(b.newInstallDate),
    note: b.note ? String(b.note) : undefined,
    ...calc,
    costBearer: split.bearer, adCompanyDeduction: split.adCompanyDeduction, separateAmount: split.separateAmount,
    status: 'pending_confirm', raisedBy: req.user!.id, raisedByName: req.user!.name, createdAt: now(),
  };
  db.relayouts.unshift(r);
  pushHistory(s, req.user!, '发起围挡重排', `${r.code}：长度 ${r.oldLength}→${r.newLength} 米，待广告公司确认`);
  save();
  res.json({ relayout: r });
});

/** 确认重排（排期单提交单位：广告公司/街道）→ 合同面积、安装任务、验收清单同步更新 */
app.post('/api/relayouts/:id/confirm', auth, (req, res) => {
  const db = getDb();
  const r = db.relayouts.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ error: '重排单不存在' }); return; }
  const s = db.submissions.find(x => x.id === r.submissionId);
  if (!s) { res.status(404).json({ error: '排期单不存在' }); return; }
  if (s.submitterId !== req.user!.id) { res.status(403).json({ error: '仅排期单提交单位（广告公司/街道）可确认重排' }); return; }
  if (r.status !== 'pending_confirm') { res.status(400).json({ error: '该重排单已处理' }); return; }

  // 1) 合同面积同步：围挡边界、合同长度、安装时间、验收要求更新
  s.hoardingNos = [...r.newHoardingNos];
  s.hoardingLength = r.newLength;
  s.contractLength = r.newLength;
  s.plannedInstallDate = r.newInstallDate;
  const moves = [
    r.removedNos.length ? `移除 ${r.removedNos.join('、')}` : '',
    r.addedNos.length ? `新增 ${r.addedNos.join('、')}` : '',
  ].filter(Boolean).join('，');
  s.acceptanceRequirements += `【重排验收基准】${today()} 围挡边界调整：${moves || '边界长度调整'}，长度 ${r.oldLength}→${r.newLength} 米，按新边界验收。`;

  // 2) 安装任务同步：移除编号上未安装任务取消；已安装受影响画面生成拆装任务；剩余新增编号生成安装任务
  const myTasks = db.tasks.filter(t => t.submissionId === s.id);
  const pool = [...r.addedNos]; // 新增编号优先分配给拆装任务
  let reinstallCount = 0;
  for (const t of myTasks) {
    if (t.status === 'cancelled' || !r.removedNos.includes(t.hoardingNo)) continue;
    if (t.status === 'reported') {
      const from = t.hoardingNo;
      const cost = Math.round((t.report?.actualLength || 0) * s.height * REINSTALL_UNIT_PRICE * 100) / 100;
      db.tasks.push({
        id: uid('task'), code: nextCode('RW'), submissionId: s.id,
        roadSegment: s.roadSegment, hoardingNo: pool.shift() || from, teamId: s.constructionTeamId,
        status: 'pending', kind: 'reinstall', relayoutId: r.id, fromHoardingNo: from, cost,
      });
      reinstallCount += 1;
    } else {
      t.status = 'cancelled';
    }
  }
  for (const no of pool) {
    db.tasks.push({
      id: uid('task'), code: nextCode('RW'), submissionId: s.id,
      roadSegment: s.roadSegment, hoardingNo: no, teamId: s.constructionTeamId,
      status: 'pending', kind: 'install', relayoutId: r.id,
    });
  }

  // 3) 费用由变更原因决定：广告公司承担部分生成扣款工单；验收清单（待结算验收单）同步合同基准与扣款
  let deductTicket: Ticket | undefined;
  if (r.adCompanyDeduction > 0) {
    deductTicket = {
      id: uid('ticket'), code: nextCode('GD'), type: 'temporary_change',
      submissionId: s.id, title: `围挡重排拆装费用（${r.code}）`,
      description: `重排单 ${r.code} 经确认，按变更原因责任划分，广告公司承担拆装费用 ¥${r.adCompanyDeduction}，计入合同扣款。责任说明：${r.responsibility}`,
      photos: [], raisedBy: req.user!.id, raisedByName: req.user!.name, raisedRole: req.user!.role,
      status: 'open', deductionAmount: r.adCompanyDeduction,
      rectification: '拆装费用计入合同扣款，验收结算时统一核减',
      actions: [{ time: now(), by: req.user!.id, byName: req.user!.name, role: req.user!.role, action: '重排确认自动生成工单', note: `按责任核定扣款 ¥${r.adCompanyDeduction}` }],
      createdAt: now(),
    };
    db.tickets.unshift(deductTicket);
  }
  const acc = db.acceptances.find(a => a.submissionId === s.id && a.status === 'pending_finance');
  if (acc) {
    acc.contractLength = r.newLength;
    acc.comment = `${acc.comment || ''}【重排同步】${r.code} 合同长度 ${r.oldLength}→${r.newLength} 米，验收基准已更新。`.trim();
    if (deductTicket) {
      acc.deductions.push({ reason: `围挡重排拆装费用（${deductTicket.code}，广告公司承担）`, amount: deductTicket.deductionAmount, ticketId: deductTicket.id });
      acc.totalDeduction = Math.round(acc.deductions.reduce((sum, d) => sum + d.amount, 0) * 100) / 100;
      acc.settleAmount = Math.round((acc.grossAmount - acc.totalDeduction) * 100) / 100;
    }
  }

  // 4) 合同变更记录：责任说明入档
  const change: ContractChange = {
    id: uid('change'), code: nextCode('BG'), submissionId: s.id, relayoutId: r.id,
    reason: r.reason, responsibility: r.responsibility,
    oldContractLength: r.oldLength, newContractLength: r.newLength,
    oldContractArea: Math.round(r.oldLength * s.height * 100) / 100,
    newContractArea: Math.round(r.newLength * s.height * 100) / 100,
    costBearer: r.costBearer, reinstallCost: r.reinstallCost,
    adCompanyDeduction: r.adCompanyDeduction, separateAmount: r.separateAmount,
    confirmedBy: req.user!.id, confirmedByName: req.user!.name, time: now(),
  };

  // 5) 施工方/街道原因的拆装费用 → 单独结算（不占广告公司合同款）
  if (r.separateAmount > 0) {
    const bearerRole = r.costBearer === 'street' ? 'street' : 'construction';
    const bearerUser = bearerRole === 'construction'
      ? db.users.find(u => u.id === s.constructionTeamId)
      : db.users.find(u => u.role === 'street');
    const rs: ReinstallSettlement = {
      id: uid('rsettle'), code: nextCode('DC'), submissionId: s.id,
      relayoutId: r.id, contractChangeId: change.id,
      bearerRole, bearerName: bearerUser?.org || (bearerRole === 'construction' ? '责任施工队' : '街道'),
      amount: r.separateAmount, responsibility: r.responsibility,
      status: 'pending', createdAt: now(),
    };
    db.reinstallSettlements.unshift(rs);
    change.separateSettlementId = rs.id;
  }

  db.contractChanges.unshift(change);
  r.status = 'confirmed';
  r.confirmedBy = req.user!.id; r.confirmedByName = req.user!.name; r.confirmedAt = now();
  r.contractChangeId = change.id;
  pushHistory(s, req.user!, '确认围挡重排', `合同长度 ${r.oldLength}→${r.newLength} 米，生成 ${reinstallCount} 个拆装任务，变更记录 ${change.code}`);
  save();
  res.json({ relayout: r, contractChange: change, submission: s });
});

/** 驳回重排（排期单提交单位） */
app.post('/api/relayouts/:id/reject', auth, (req, res) => {
  const db = getDb();
  const r = db.relayouts.find(x => x.id === req.params.id);
  if (!r) { res.status(404).json({ error: '重排单不存在' }); return; }
  const s = db.submissions.find(x => x.id === r.submissionId);
  if (!s) { res.status(404).json({ error: '排期单不存在' }); return; }
  if (s.submitterId !== req.user!.id) { res.status(403).json({ error: '仅排期单提交单位（广告公司/街道）可驳回重排' }); return; }
  if (r.status !== 'pending_confirm') { res.status(400).json({ error: '该重排单已处理' }); return; }
  r.status = 'rejected';
  r.rejectNote = String(req.body?.note || '');
  pushHistory(s, req.user!, '驳回围挡重排', r.rejectNote ? `${r.code}：${r.rejectNote}` : r.code);
  save();
  res.json({ relayout: r });
});

/** 拆装费用单独结算（财务） */
app.post('/api/reinstall-settlements/:id/settle', auth, requireRole('finance'), (req, res) => {
  const db = getDb();
  const rs = db.reinstallSettlements.find(x => x.id === req.params.id);
  if (!rs) { res.status(404).json({ error: '单独结算单不存在' }); return; }
  if (rs.status !== 'pending') { res.status(400).json({ error: '该结算单已结算' }); return; }
  rs.status = 'settled';
  rs.settledAt = now();
  rs.settledBy = req.user!.name;
  const s = db.submissions.find(x => x.id === rs.submissionId);
  if (s) pushHistory(s, req.user!, '拆装费用单独结算', `${rs.code}：¥${rs.amount}（${rs.bearerName}承担）`);
  save();
  res.json({ settlement: rs });
});

// ---------------- 财务结算 ----------------
app.post('/api/acceptances/:id/settle', auth, requireRole('finance'), (req, res) => {
  const db = getDb();
  const acc = db.acceptances.find(x => x.id === req.params.id);
  if (!acc) { res.status(404).json({ error: '验收单不存在' }); return; }
  if (acc.status !== 'pending_finance') { res.status(400).json({ error: '该验收单已结算' }); return; }
  acc.status = 'settled';
  acc.settledAt = now();
  acc.settledBy = req.user!.name;
  const s = db.submissions.find(x => x.id === acc.submissionId);
  if (s) {
    s.status = 'settled';
    pushHistory(s, req.user!, '财务结算完成', `结算金额 ${acc.settleAmount} 元（扣款 ${acc.totalDeduction} 元）`);
  }
  save();
  res.json({ acceptance: acc });
});

// ---------------- 巡检执行 ----------------
app.post('/api/inspections/:id/complete', auth, requireRole('inspector'), (req, res) => {
  const db = getDb();
  const insp = db.inspections.find(x => x.id === req.params.id);
  if (!insp) { res.status(404).json({ error: '巡检任务不存在' }); return; }
  if (insp.inspectorId !== req.user!.id) { res.status(403).json({ error: '该巡检任务指派给其他巡检员' }); return; }
  if (insp.status !== 'planned') { res.status(400).json({ error: '该巡检已完成' }); return; }
  const b = req.body || {};
  if (!['ok', 'dirty', 'damaged', 'ratio_issue'].includes(b.result)) { res.status(400).json({ error: '巡检结果不合法' }); return; }
  insp.status = 'done';
  insp.result = b.result;
  insp.note = String(b.note || '');
  insp.photos = Array.isArray(b.photos) ? b.photos.map(String) : [];
  insp.completedAt = now();

  const acc = db.acceptances.find(x => x.id === insp.acceptanceId);
  const planItem = acc?.inspectionPlan.find(p => p.id === insp.planItemId);
  if (planItem) planItem.status = 'done';

  // 异常结果自动生成工单
  let ticket: Ticket | undefined;
  if (b.result !== 'ok') {
    const typeMap: Record<string, TicketType> = { dirty: 'dirty', damaged: 'wind_damage', ratio_issue: 'ratio_violation' };
    const labelMap: Record<string, string> = { dirty: '巡检发现脏污', damaged: '巡检发现画面破损', ratio_issue: '公益时段未按比例展示' };
    const s = db.submissions.find(x => x.id === insp.submissionId);
    ticket = {
      id: uid('ticket'), code: nextCode('GD'), type: typeMap[b.result],
      submissionId: insp.submissionId, title: `${labelMap[b.result]}（巡检 ${insp.date}）`,
      description: insp.note || labelMap[b.result],
      photos: insp.photos || [], raisedBy: req.user!.id, raisedByName: req.user!.name, raisedRole: 'inspector',
      status: 'open', deductionAmount: 0,
      rectification: b.result === 'dirty' ? '24 小时内清洗保洁' : b.result === 'damaged' ? '48 小时内更换破损画面' : '立即恢复公益时段展示并提交说明',
      actions: [{ time: now(), by: req.user!.id, byName: req.user!.name, role: 'inspector', action: '巡检自动生成工单' }],
      createdAt: now(),
    };
    db.tickets.unshift(ticket);
    insp.ticketId = ticket.id;
    if (s) pushHistory(s, req.user!, '巡检异常', `${labelMap[b.result]}，生成工单 ${ticket.code}`);
  }
  save();
  res.json({ inspection: insp, ticket });
});

// ---------------- 静态资源与 SPA ----------------
app.use('/uploads', express.static(UPLOAD_DIR));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

// 统一错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  getDb();
  console.log(`[server] 城市工地围挡公益广告排期与验收系统已启动: http://0.0.0.0:${PORT}`);
});
