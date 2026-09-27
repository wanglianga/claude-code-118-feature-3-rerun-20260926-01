// 端到端验证：工地改围挡重排全流程（针对本地已启动的服务）
// 用法：BASE=http://localhost:3100 node scripts/e2e-replan.mjs
const BASE = process.env.BASE || 'http://localhost:3100';

let passed = 0;
let failed = 0;
const ok = (cond, name) => {
  if (cond) { passed += 1; console.log(`  ✔ ${name}`); }
  else { failed += 1; console.error(`  ✘ ${name}`); }
};

const tokens = {};
async function api(path, { method = 'GET', body, user } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (user) headers['Authorization'] = `Bearer ${tokens[user]}`;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
async function login(username, password = '123456') {
  const r = await api('/login', { method: 'POST', body: { username, password } });
  if (r.status !== 200) throw new Error(`登录失败 ${username}: ${JSON.stringify(r.data)}`);
  tokens[username] = r.data.token;
}
const boot = async (user) => (await api('/bootstrap', { user })).data;

console.log(`目标服务：${BASE}`);

// ---------- 0. 健康检查与登录 ----------
console.log('\n[0] 健康检查与登录');
const health = await fetch(`${BASE}/api/health`).then(r => r.json());
ok(health.ok === true, 'GET /api/health 返回 ok');
for (const u of ['ad001', 'team01', 'team02', 'finance', 'reviewer']) await login(u);
ok(Object.keys(tokens).length === 5, '五个角色登录成功');

// ---------- 1. 种子重排单：CP-2026-0001（已确认，待结算拆装费） ----------
console.log('\n[1] 种子数据：CP-2026-0001 已确认重排（S5 150m→100m）');
let b = await boot('ad001');
const rp1 = b.replans.find(r => r.code === 'CP-2026-0001');
ok(!!rp1, '重排单 CP-2026-0001 存在');
ok(rp1.status === 'confirmed', 'CP-2026-0001 状态为已确认');
ok(rp1.oldLength === 150 && rp1.newLength === 100 && rp1.availableLength === 100, '可用广告长度重算为 100m');
ok(rp1.affectedCreatives.length === 2, `受影响画面 2 幅（实际 ${rp1.affectedCreatives.length}）`);
ok(rp1.affectedHoardingNos.join(',') === 'LG-05,LG-06', '受影响围挡编号 LG-05、LG-06');
ok(rp1.affectedInstalledLength === 50 && rp1.reinstallCost === 5625, `拆装费 5625 元（50m×2.5m×45，实际 ${rp1.reinstallCost}）`);
ok(rp1.responsibility === 'construction' && rp1.responsibilityStatement.includes('施工方'), '责任方为施工方且责任说明可见（广告公司可查看）');
ok(rp1.costSettlement && rp1.costSettlement.status === 'pending' && rp1.costSettlement.amount === 5625, '拆装费待单独结算 5625 元');
const s5 = b.submissions.find(s => s.id === 'sub_000005');
ok(s5.contractLength === 100 && s5.hoardingLength === 100 && s5.hoardingNos.length === 4, 'S5 合同长度/围挡边界已同步为 100m');
ok(s5.contractChanges.length === 1 && s5.contractChanges[0].replanCode === 'CP-2026-0001', '责任说明已进入合同变更记录');
ok(s5.contractChanges[0].oldContractArea === 375 && s5.contractChanges[0].newContractArea === 250, '合同面积 375m²→250m² 同步更新');
const acc1 = b.acceptances.find(a => a.id === 'acc_000001');
ok(acc1.contractLength === 100 && acc1.acceptedLength === 100 && acc1.settleableArea === 250, '验收清单同步：验收长度/可结算面积重算');
ok(acc1.settleAmount === 27200, `验收单应结算 27200（实际 ${acc1.settleAmount}）`);
ok(acc1.rectifications.some(r => r.desc.includes('CP-2026-0001')), '验收整改项包含重排复核项');
const reinstalls1 = b.tasks.filter(t => t.kind === 'reinstall' && t.replanId === rp1.id);
ok(reinstalls1.length === 2 && reinstalls1.every(t => t.status === 'pending' && t.cost === 2812.5), '已安装受影响画面生成 2 个拆装任务（各 ¥2812.5）');

// ---------- 2. 施工队发起重排（S3 200m→170m） ----------
console.log('\n[2] 施工队发起重排：页面重算可用长度/受影响画面/安装时间');
let r = await api('/submissions/sub_000003/replans', {
  method: 'POST', user: 'team01',
  body: { newLength: 170, reason: 'construction_adjust', responsibilityStatement: '施工方因地铁出入口施工，围挡边界内收 30 米，拆装费用施工方承担。' },
});
ok(r.status === 200, 'team01 发起重排成功');
const rp3 = r.data.replan;
ok(rp3.code.startsWith('CP-'), `生成重排单号 ${rp3.code}`);
ok(rp3.availableLength === 170, '可用广告长度重算为 170m');
ok(rp3.affectedHoardingNos.join(',') === 'WJ-07,WJ-08', `受影响编号 WJ-07、WJ-08（实际 ${rp3.affectedHoardingNos}）`);
ok(rp3.affectedCreatives.length === 2, `受影响画面 2 幅（实际 ${rp3.affectedCreatives.length}）`);
ok(rp3.reinstallCost === 0 && rp3.affectedInstalledLength === 0, '受影响编号均未安装 → 拆装费 0');
ok(rp3.estimatedDays >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(rp3.estimatedInstallDate), `安装时间重算：${rp3.estimatedDays} 天 → ${rp3.estimatedInstallDate}`);
ok(rp3.status === 'pending_confirm' && rp3.responsibility === 'construction', '状态待确认，责任方施工方');

// ---------- 3. 权限与校验 ----------
console.log('\n[3] 权限与参数校验');
r = await api('/submissions/sub_000003/replans', { method: 'POST', user: 'ad001', body: { newLength: 150, reason: 'construction_adjust', responsibilityStatement: '广告公司越权发起测试' } });
ok(r.status === 403, '广告公司不能发起重排（403）');
r = await api('/submissions/sub_000003/replans', { method: 'POST', user: 'team02', body: { newLength: 150, reason: 'construction_adjust', responsibilityStatement: '非责任施工队发起测试' } });
ok(r.status === 403, '非责任施工队不能发起（403）');
r = await api('/submissions/sub_000003/replans', { method: 'POST', user: 'team01', body: { newLength: 150, reason: 'construction_adjust', responsibilityStatement: '重复发起测试' } });
ok(r.status === 400, '同一排期已有待确认重排 → 400');
r = await api('/submissions/sub_000002/replans', { method: 'POST', user: 'team02', body: { newLength: 80, reason: 'construction_adjust', responsibilityStatement: '边界未变化测试' } });
ok(r.status === 400 && r.data.error.includes('未发生变化'), '边界无变化 → 400');
r = await api('/submissions/sub_000002/replans', { method: 'POST', user: 'team02', body: { newLength: 60, reason: 'bad_reason', responsibilityStatement: '原因不合法测试' } });
ok(r.status === 400, '变更原因不合法 → 400');
r = await api('/submissions/sub_000002/replans', { method: 'POST', user: 'team02', body: { newLength: 60, reason: 'construction_adjust', responsibilityStatement: '短' } });
ok(r.status === 400, '责任说明过短 → 400');
r = await api('/submissions/sub_000006/replans', { method: 'POST', user: 'team02', body: { newLength: 30, reason: 'construction_adjust', responsibilityStatement: '已驳回排期重排测试' } });
ok(r.status === 400, '已驳回排期不可重排 → 400');
r = await api(`/replans/${rp3.id}/confirm`, { method: 'POST', user: 'team01' });
ok(r.status === 403, '施工队不能确认重排（403）');
r = await api(`/replans/${rp3.id}/settle-cost`, { method: 'POST', user: 'ad001' });
ok(r.status === 403, '广告公司不能结算拆装费（403）');

// ---------- 4. 广告公司确认重排：合同/任务/验收同步 ----------
console.log('\n[4] 广告公司确认重排：合同面积、安装任务、验收清单同步更新');
r = await api(`/replans/${rp3.id}/confirm`, { method: 'POST', user: 'ad001' });
ok(r.status === 200, 'ad001 确认重排成功');
b = await boot('ad001');
const s3 = b.submissions.find(s => s.id === 'sub_000003');
ok(s3.hoardingLength === 170 && s3.contractLength === 170 && s3.hoardingNos.length === 7, 'S3 合同长度/边界同步为 170m、7 个编号');
ok(s3.contractChanges.length === 1 && s3.contractChanges[0].statement.includes('地铁出入口'), '责任说明进入合同变更记录');
ok(s3.contractChanges[0].oldContractArea === 600 && s3.contractChanges[0].newContractArea === 510, '合同面积 600m²→510m²');
const wj08 = b.tasks.find(t => t.submissionId === 'sub_000003' && t.hoardingNo === 'WJ-08');
ok(wj08.status === 'cancelled', '被移除编号 WJ-08 的安装任务已取消');
const rp3After = b.replans.find(x => x.id === rp3.id);
ok(rp3After.status === 'confirmed' && rp3After.cancelledTaskIds.length === 1 && rp3After.reinstallTaskIds.length === 0, '同步结果：取消 1 个任务、无拆装任务');
ok(!rp3After.costSettlement, '无拆装费 → 不生成单独结算单');
ok(s3.history.some(h => h.action === '确认围挡重排'), '排期流转记录包含确认重排');

// ---------- 5. 种子待确认单 CP-2026-0002：确认后生成拆装任务 ----------
console.log('\n[5] CP-2026-0002（S4 100m→80m）确认：已安装受影响画面生成拆装任务');
const rp2 = b.replans.find(x => x.code === 'CP-2026-0002');
ok(!!rp2 && rp2.status === 'pending_confirm', 'CP-2026-0002 待确认');
ok(rp2.affectedInstalledLength === 18.5 && rp2.reinstallCost === 2081.25, `预计算拆装费 2081.25（实际 ${rp2.reinstallCost}）`);
r = await api(`/replans/${rp2.id}/confirm`, { method: 'POST', user: 'ad001' });
ok(r.status === 200, '确认 CP-2026-0002 成功');
b = await boot('ad001');
const s4 = b.submissions.find(s => s.id === 'sub_000004');
ok(s4.contractLength === 80 && s4.hoardingNos.join(',') === 'FT-01,FT-02,FT-03,FT-04', 'S4 合同长度同步为 80m');
ok(s4.contractChanges.length === 1 && s4.contractChanges[0].responsibility === 'construction', 'S4 合同变更记录已写入');
const reinstalls2 = b.tasks.filter(t => t.kind === 'reinstall' && t.replanId === rp2.id);
ok(reinstalls2.length === 1 && reinstalls2[0].hoardingNo === 'FT-05' && reinstalls2[0].cost === 2081.25, 'FT-05 生成拆装任务 ¥2081.25');
ok(reinstalls2[0].costBearer === 'construction' && reinstalls2[0].affectedCreatives.includes('悦茶'), '拆装任务含责任方与受影响画面');
const rp2After = b.replans.find(x => x.id === rp2.id);
ok(rp2After.costSettlement && rp2After.costSettlement.status === 'pending' && rp2After.costSettlement.amount === 2081.25, '拆装费 2081.25 待单独结算');

// ---------- 6. 拆装任务领取与上报（已验收排期状态不回退） ----------
console.log('\n[6] 拆装任务执行：领取 → 上报，已验收排期状态不回退');
const rt = reinstalls2[0];
r = await api(`/tasks/${rt.id}/claim`, { method: 'POST', user: 'team01' });
ok(r.status === 200 && r.data.task.status === 'claimed', '拆装任务可领取');
r = await api(`/tasks/${rt.id}/report`, {
  method: 'POST', user: 'team01',
  body: { beforePhotos: ['/uploads/seed-before-a.svg'], afterPhotos: ['/uploads/seed-after-a.svg'], actualLength: 18.5, gaps: 'FT-05 段已拆除并清运', note: '重排拆装完成' },
});
ok(r.status === 200 && r.data.task.status === 'reported', '拆装任务可上报');
b = await boot('ad001');
const s4b = b.submissions.find(s => s.id === 'sub_000004');
ok(s4b.status === 'pending_acceptance', 'S4 保持待验收（未错误回退）');
// 已验收的 S5 上拆装任务上报不回退状态
const rt5 = b.tasks.find(t => t.kind === 'reinstall' && t.replanId === rp1.id && t.hoardingNo === 'LG-05');
await api(`/tasks/${rt5.id}/claim`, { method: 'POST', user: 'team01' });
r = await api(`/tasks/${rt5.id}/report`, {
  method: 'POST', user: 'team01',
  body: { beforePhotos: ['/uploads/seed-before-a.svg'], afterPhotos: ['/uploads/seed-after-a.svg'], actualLength: 25, gaps: 'LG-05 段已拆除', note: '重排拆装' },
});
ok(r.status === 200, 'S5 拆装任务上报成功');
b = await boot('ad001');
ok(b.submissions.find(s => s.id === 'sub_000005').status === 'accepted', 'S5 保持已验收（拆装上报不回退状态）');

// ---------- 7. 财务单独结算拆装费 ----------
console.log('\n[7] 施工方原因拆装费用单独结算');
r = await api(`/replans/${rp1.id}/settle-cost`, { method: 'POST', user: 'finance' });
ok(r.status === 200 && r.data.replan.costSettlement.status === 'settled', 'CP-2026-0001 拆装费 5625 单独结算成功');
r = await api(`/replans/${rp2.id}/settle-cost`, { method: 'POST', user: 'finance' });
ok(r.status === 200 && r.data.replan.costSettlement.status === 'settled', 'CP-2026-0002 拆装费 2081.25 单独结算成功');
r = await api(`/replans/${rp1.id}/settle-cost`, { method: 'POST', user: 'finance' });
ok(r.status === 400, '重复结算 → 400');
b = await boot('ad001');
const rp1Final = b.replans.find(x => x.id === rp1.id);
ok(rp1Final.costSettlement.settledBy === '吴会计', '广告公司可见结算人与责任说明');
ok(b.acceptances.find(a => a.id === 'acc_000001').totalDeduction === 800, '拆装费未并入广告合同扣款（仍为 800）');

// ---------- 8. 驳回到账 ----------
console.log('\n[8] 重排驳回流程');
r = await api('/submissions/sub_000003/replans', {
  method: 'POST', user: 'team01',
  body: { newLength: 160, reason: 'force_majeure', responsibilityStatement: '市政道路拓宽要求围挡再内收 10 米，费用双方分担。' },
});
ok(r.status === 200 && r.data.replan.responsibility === 'shared', '不可抗力原因 → 责任双方分担');
const rp4 = r.data.replan;
r = await api(`/replans/${rp4.id}/reject`, { method: 'POST', user: 'ad001', body: { note: '市政文件未下达，暂不调整' } });
ok(r.status === 200 && r.data.replan.status === 'rejected', '广告公司驳回成功');
b = await boot('ad001');
ok(b.submissions.find(s => s.id === 'sub_000003').contractLength === 170, '驳回后合同长度不变');
ok(b.replans.find(x => x.id === rp4.id).rejectNote.includes('市政文件'), '驳回说明已记录');

// ---------- 9. 既有流程回归：验收 ----------
console.log('\n[9] 回归：重排后验收按新合同长度执行');
r = await api('/submissions/sub_000004/accept', {
  method: 'POST', user: 'reviewer',
  body: { acceptedLength: 80, comment: '按重排后边界验收', inspectorId: 'u_in' },
});
ok(r.status === 200, 'S4 验收成功');
ok(r.data.acceptance.contractLength === 80 && r.data.acceptance.settleableArea === 200, '验收清单按新合同长度 80m 生成（面积 200m²）');
ok(!b.tickets.some(t => t.type === 'length_mismatch' && t.submissionId === 'sub_000004'), '长度一致 → 无长度不符工单');

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
