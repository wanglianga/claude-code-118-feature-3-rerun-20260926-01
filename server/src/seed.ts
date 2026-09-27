import fs from 'fs';
import path from 'path';
import {
  Acceptance, DB, InstallTask, Inspection, Replan, Submission, Ticket, User,
} from './types';
import { computeReplanPreview } from './replan';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

/** 生成演示用占位图（SVG），返回可访问路径 */
function seedImage(file: string, label: string, bg: string, fg = '#ffffff'): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const p = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(p)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="${bg}"/>
  <rect x="16" y="16" width="608" height="328" fill="none" stroke="${fg}" stroke-width="4" stroke-dasharray="14 10" opacity="0.7"/>
  <text x="320" y="178" font-size="34" fill="${fg}" text-anchor="middle" font-family="sans-serif" font-weight="bold">${label}</text>
  <text x="320" y="222" font-size="18" fill="${fg}" text-anchor="middle" font-family="sans-serif" opacity="0.85">围挡现场演示照片 · 种子数据</text>
</svg>`;
    fs.writeFileSync(p, svg);
  }
  return `/uploads/${file}`;
}

export function buildSeed(): DB {
  const users: User[] = [
    { id: 'u_ad',  username: 'ad001',      password: '123456', name: '李明辉', role: 'ad_company',   org: '诚信广告有限公司',   phone: '13800000001' },
    { id: 'u_st',  username: 'street01',   password: '123456', name: '王秀兰', role: 'street',       org: '朝阳街道办事处',     phone: '13800000002' },
    { id: 'u_rv',  username: 'reviewer',   password: '123456', name: '陈正审', role: 'reviewer',     org: '市城管局审批中心',   phone: '13800000003' },
    { id: 'u_tm',  username: 'team01',     password: '123456', name: '赵铁柱', role: 'construction', org: '宏基围挡施工队',     phone: '13800000004' },
    { id: 'u_tm2', username: 'team02',     password: '123456', name: '钱二宝', role: 'construction', org: '安达安装队',         phone: '13800000005' },
    { id: 'u_in',  username: 'inspector',  password: '123456', name: '刘巡检', role: 'inspector',    org: '市容环境巡检中心',   phone: '13800000006' },
    { id: 'u_mc',  username: 'merchant01', password: '123456', name: '周悦',   role: 'merchant',     org: '悦茶餐饮连锁',       phone: '13800000007' },
    { id: 'u_mc2', username: 'merchant02', password: '123456', name: '吴恒',   role: 'merchant',     org: '恒信家居城',         phone: '13800000008' },
    { id: 'u_fn',  username: 'finance',    password: '123456', name: '吴会计', role: 'finance',      org: '市广告结算中心',     phone: '13800000009' },
  ];

  const imgBeforeA = seedImage('seed-before-a.svg', '安装前 · 裸围挡', '#8a8f98');
  const imgAfterA = seedImage('seed-after-a.svg', '安装后 · 公益+商业画面', '#1f6f4a');
  const imgAfterB = seedImage('seed-after-b.svg', '安装后 · 安全提示画面', '#2456a6');
  const imgDamage = seedImage('seed-damage.svg', '画面被风吹破 · 现场', '#a63a24');
  const imgDirty = seedImage('seed-dirty.svg', '画面脏污 · 巡检发现', '#7a5c1e');
  const imgCreative1 = seedImage('seed-creative-tea.svg', '悦茶春日限定 · 效果图', '#0e7a5f');
  const imgCreative2 = seedImage('seed-creative-civil.svg', '文明出行 · 公益效果图', '#2b6cb0');
  const imgCreative3 = seedImage('seed-creative-safety.svg', '安全生产 · 提示效果图', '#b7791f');

  const submissions: Submission[] = [
    {
      id: 'sub_000001', code: 'GG-2026-0001', type: 'commercial',
      title: '悦茶春季新品上市围挡广告',
      submitterId: 'u_ad', submitterOrg: '诚信广告有限公司',
      siteName: '朝阳大悦城二期工地', location: '朝阳北路与青年路交叉口东北角',
      roadSegment: '朝阳北路东段', hoardingNos: ['CB-01', 'CB-02', 'CB-03', 'CB-04', 'CB-05', 'CB-06'],
      hoardingLength: 120, height: 2.5, publicRatio: 30,
      creatives: [
        { id: 'cr_0001', kind: 'public', title: '文明出行公益画面', sizeSpec: '6m×2.5m', textContent: '文明出行 礼让斑马线', theme: '文明交通', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative2 },
        { id: 'cr_0002', kind: 'commercial', title: '悦茶春日限定主视觉', sizeSpec: '6m×2.5m', textContent: '春日限定 第二杯半价', theme: '', brandName: '悦茶', sensitiveRisk: 'none', sightImpact: 'low', imageUrl: imgCreative1 },
        { id: 'cr_0003', kind: 'commercial', title: '悦茶门店导视画面', sizeSpec: '3m×2.5m', textContent: '前方 200 米 悦茶大悦城店', theme: '', brandName: '悦茶', sensitiveRisk: 'none', sightImpact: 'low', imageUrl: imgCreative1 },
      ],
      approvalUnit: '市城管局审批中心',
      plannedInstallDate: '2026-09-28', displayStart: '2026-10-01', displayEnd: '2026-12-31',
      publicSlots: '每日 7:00-9:00、17:00-19:00 轮播公益画面，公益面积占比不低于 30%',
      nightLighting: true, lightingDesc: 'LED 灯带，每日 18:30-22:00 开启',
      constructionTeamId: 'u_tm',
      acceptanceRequirements: '画面平整无气泡，接缝≤3mm，夜间照明可正常开启，不遮挡路口视线',
      merchantId: 'u_mc', contractLength: 120, unitPrice: 180,
      status: 'pending_review',
      createdAt: '2026-09-22 09:30',
      history: [
        { time: '2026-09-22 09:30', by: 'u_ad', byName: '李明辉', action: '提交画面审核', note: '商业广告，公益比例 30%' },
      ],
      contractChanges: [],
    },
    {
      id: 'sub_000002', code: 'GG-2026-0002', type: 'public_welfare',
      title: '文明城市建设公益宣传围挡',
      submitterId: 'u_st', submitterOrg: '朝阳街道办事处',
      siteName: '三丰里老旧小区改造工地', location: '三丰里社区周边',
      roadSegment: '三丰里西街', hoardingNos: ['SF-01', 'SF-02', 'SF-03', 'SF-04'],
      hoardingLength: 80, height: 2.2, publicRatio: 100,
      creatives: [
        { id: 'cr_0004', kind: 'public', title: '垃圾分类公益画面', sizeSpec: '8m×2.2m', textContent: '垃圾分类 从我做起', theme: '垃圾分类', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative2 },
        { id: 'cr_0005', kind: 'public', title: '文明养犬公益画面', sizeSpec: '8m×2.2m', textContent: '文明养犬 牵绳清便', theme: '文明养犬', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative2 },
      ],
      approvalUnit: '街道市容办',
      plannedInstallDate: '2026-09-26', displayStart: '2026-10-01', displayEnd: '2027-03-31',
      publicSlots: '全时段公益展示',
      nightLighting: false,
      constructionTeamId: 'u_tm2',
      acceptanceRequirements: '画面完整无破损，公益内容占比 100%',
      merchantId: undefined, contractLength: 80, unitPrice: 0,
      status: 'approved',
      review: {
        reviewerId: 'u_rv',
        checklist: { dimensionOk: true, textOk: true, sensitiveOk: true, themeOk: true, brandOk: true, sightOk: true },
        comment: '纯公益宣传，内容合规，同意安装。',
        decision: 'approved', time: '2026-09-23 10:12',
      },
      createdAt: '2026-09-21 14:05',
      history: [
        { time: '2026-09-21 14:05', by: 'u_st', byName: '王秀兰', action: '提交画面审核' },
        { time: '2026-09-23 10:12', by: 'u_rv', byName: '陈正审', action: '审核通过', note: '已生成 4 个安装任务' },
      ],
      contractChanges: [],
    },
    {
      id: 'sub_000003', code: 'GG-2026-0005', type: 'safety',
      title: '地铁17号线工地安全提示画面',
      submitterId: 'u_ad', submitterOrg: '诚信广告有限公司',
      siteName: '地铁17号线望京西站工地', location: '望京西路与广顺北大街交口',
      roadSegment: '望京西路', hoardingNos: ['WJ-01', 'WJ-02', 'WJ-03', 'WJ-04', 'WJ-05', 'WJ-06', 'WJ-07', 'WJ-08'],
      hoardingLength: 200, height: 3, publicRatio: 50,
      creatives: [
        { id: 'cr_0006', kind: 'safety', title: '高空作业警示画面', sizeSpec: '6m×3m', textContent: '高空作业 请勿靠近 注意安全', theme: '施工安全', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative3 },
        { id: 'cr_0007', kind: 'public', title: '安全生产月公益画面', sizeSpec: '6m×3m', textContent: '人人讲安全 个个会应急', theme: '安全生产', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative3 },
      ],
      approvalUnit: '区住建委安全监督站',
      plannedInstallDate: '2026-09-20', displayStart: '2026-09-25', displayEnd: '2027-06-30',
      publicSlots: '安全提示与公益画面间隔悬挂，各占 50%',
      nightLighting: true, lightingDesc: '警示爆闪灯 + 轮廓灯带，彻夜开启',
      constructionTeamId: 'u_tm',
      acceptanceRequirements: '警示画面朝向机动车道，夜间警示灯必须全部点亮',
      merchantId: undefined, contractLength: 200, unitPrice: 0,
      status: 'installing',
      review: {
        reviewerId: 'u_rv',
        checklist: { dimensionOk: true, textOk: true, sensitiveOk: true, themeOk: true, brandOk: true, sightOk: true },
        comment: '安全提示类画面，符合工地围挡安全规范。',
        decision: 'approved', time: '2026-09-19 16:40',
      },
      createdAt: '2026-09-18 11:20',
      history: [
        { time: '2026-09-18 11:20', by: 'u_ad', byName: '李明辉', action: '提交画面审核' },
        { time: '2026-09-19 16:40', by: 'u_rv', byName: '陈正审', action: '审核通过', note: '已生成 8 个安装任务' },
      ],
      contractChanges: [],
    },
    {
      id: 'sub_000004', code: 'GG-2026-0008', type: 'commercial',
      title: '悦茶周年庆商业画面更换',
      submitterId: 'u_ad', submitterOrg: '诚信广告有限公司',
      siteName: '望京SOHO东侧工地', location: '阜通东大街与望京街交口东南角',
      roadSegment: '阜通东大街', hoardingNos: ['FT-01', 'FT-02', 'FT-03', 'FT-04', 'FT-05'],
      hoardingLength: 100, height: 2.5, publicRatio: 30,
      creatives: [
        { id: 'cr_0008', kind: 'public', title: '节约用水公益画面', sizeSpec: '6m×2.5m', textContent: '节约用水 从点滴做起', theme: '节约用水', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative2 },
        { id: 'cr_0009', kind: 'commercial', title: '悦茶周年庆主视觉', sizeSpec: '6m×2.5m', textContent: '悦茶五周年 全场 8 折', theme: '', brandName: '悦茶', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative1 },
      ],
      approvalUnit: '市城管局审批中心',
      plannedInstallDate: '2026-09-10', displayStart: '2026-09-15', displayEnd: '2026-11-30',
      publicSlots: '每日 7:00-9:00、17:00-19:00 公益画面',
      nightLighting: true, lightingDesc: 'LED 灯带 18:30-22:00',
      constructionTeamId: 'u_tm',
      acceptanceRequirements: '画面平整，周年庆主题与审批稿一致',
      merchantId: 'u_mc', contractLength: 100, unitPrice: 180,
      status: 'pending_acceptance',
      review: {
        reviewerId: 'u_rv',
        checklist: { dimensionOk: true, textOk: true, sensitiveOk: true, themeOk: true, brandOk: true, sightOk: true },
        comment: '画面内容合规，同意更换。',
        decision: 'approved', time: '2026-09-08 09:15',
      },
      createdAt: '2026-09-06 10:00',
      history: [
        { time: '2026-09-06 10:00', by: 'u_ad', byName: '李明辉', action: '提交画面审核' },
        { time: '2026-09-08 09:15', by: 'u_rv', byName: '陈正审', action: '审核通过', note: '已生成 5 个安装任务' },
        { time: '2026-09-14 18:20', by: 'u_tm', byName: '赵铁柱', action: '全部安装上报完成', note: '实际安装合计 98.5 米' },
        { time: '2026-09-25 08:40', by: 'u_tm', byName: '赵铁柱', action: '发起围挡重排', note: 'CP-2026-0002：围挡边界 100m → 80m，待广告公司确认' },
      ],
      contractChanges: [],
    },
    {
      id: 'sub_000005', code: 'GG-2026-0012', type: 'commercial',
      title: '恒信家居城国庆促销画面',
      submitterId: 'u_ad', submitterOrg: '诚信广告有限公司',
      siteName: '恒信家居城东广场工地', location: '来广营东路北侧',
      roadSegment: '来广营东路', hoardingNos: ['LG-01', 'LG-02', 'LG-03', 'LG-04'],
      hoardingLength: 100, height: 2.5, publicRatio: 30,
      creatives: [
        { id: 'cr_0010', kind: 'public', title: '消防安全公益画面', sizeSpec: '6m×2.5m', textContent: '关注消防 生命至上', theme: '消防安全', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative2 },
        { id: 'cr_0011', kind: 'commercial', title: '恒信国庆促销画面', sizeSpec: '6m×2.5m', textContent: '国庆大放价 满 10000 减 1500', theme: '', brandName: '恒信家居', sensitiveRisk: 'none', sightImpact: 'none', imageUrl: imgCreative1 },
      ],
      approvalUnit: '市城管局审批中心',
      plannedInstallDate: '2026-09-01', displayStart: '2026-09-05', displayEnd: '2026-11-05',
      publicSlots: '每日 7:00-9:00、17:00-19:00 公益画面',
      nightLighting: true, lightingDesc: 'LED 灯带 18:30-22:00',
      constructionTeamId: 'u_tm',
      acceptanceRequirements: '画面平整无破损，促销内容与时效一致',
      merchantId: 'u_mc2', contractLength: 100, unitPrice: 160,
      status: 'accepted',
      review: {
        reviewerId: 'u_rv',
        checklist: { dimensionOk: true, textOk: true, sensitiveOk: true, themeOk: true, brandOk: true, sightOk: true },
        comment: '内容合规。', decision: 'approved', time: '2026-08-30 15:00',
      },
      createdAt: '2026-08-28 09:00',
      history: [
        { time: '2026-08-28 09:00', by: 'u_ad', byName: '李明辉', action: '提交画面审核' },
        { time: '2026-08-30 15:00', by: 'u_rv', byName: '陈正审', action: '审核通过', note: '已生成 6 个安装任务' },
        { time: '2026-09-04 17:30', by: 'u_tm', byName: '赵铁柱', action: '全部安装上报完成', note: '实际安装合计 150 米' },
        { time: '2026-09-06 10:30', by: 'u_rv', byName: '陈正审', action: '验收完成', note: '验收长度 150 米，扣款 800 元，待财务结算' },
        { time: '2026-09-20 09:10', by: 'u_tm', byName: '赵铁柱', action: '发起围挡重排', note: 'CP-2026-0001：围挡边界 150m → 100m，待广告公司确认' },
        { time: '2026-09-21 10:25', by: 'u_ad', byName: '李明辉', action: '确认围挡重排', note: '合同长度 150m→100m，生成 2 个拆装任务，拆装费 ¥5625 由施工方承担单独结算' },
      ],
      contractChanges: [
        {
          id: 'change_000001', time: '2026-09-21 10:25', replanId: 'replan_000001', replanCode: 'CP-2026-0001',
          reason: 'construction_adjust', responsibility: 'construction',
          statement: '施工方因地下管线迁改，需将 LG-05、LG-06 段围挡内收 50 米；已安装画面拆装费用由施工方承担并单独结算，不影响广告公司原合同结算。',
          oldContractLength: 150, newContractLength: 100,
          oldContractArea: 375, newContractArea: 250,
          reinstallCost: 5625,
          by: 'u_ad', byName: '李明辉',
        },
      ],
    },
    {
      id: 'sub_000006', code: 'GG-2026-0015', type: 'commercial',
      title: '某楼盘开盘倒计时广告',
      submitterId: 'u_ad', submitterOrg: '诚信广告有限公司',
      siteName: '崔各庄安置房工地', location: '来广营北路西侧',
      roadSegment: '来广营北路', hoardingNos: ['CG-01', 'CG-02'],
      hoardingLength: 40, height: 2.5, publicRatio: 20,
      creatives: [
        { id: 'cr_0012', kind: 'commercial', title: '楼盘开盘倒计时', sizeSpec: '8m×2.5m', textContent: '绝版地段 最后 88 席 错过再无', theme: '', brandName: '某楼盘', sensitiveRisk: 'high', sightImpact: 'low', imageUrl: imgCreative1 },
      ],
      approvalUnit: '市城管局审批中心',
      plannedInstallDate: '2026-09-30', displayStart: '2026-10-05', displayEnd: '2026-12-05',
      publicSlots: '公益比例仅 20%，未达 30% 下限',
      nightLighting: false,
      constructionTeamId: 'u_tm2',
      acceptanceRequirements: '按审批稿安装',
      merchantId: 'u_mc2', contractLength: 40, unitPrice: 200,
      status: 'rejected',
      review: {
        reviewerId: 'u_rv',
        checklist: { dimensionOk: true, textOk: false, sensitiveOk: false, themeOk: false, brandOk: false, sightOk: true },
        comment: '文案含绝对化用语与诱导性表述；公益比例 20% 低于商业广告 30% 下限；品牌露出超版。驳回修改后重新提交。',
        decision: 'rejected', time: '2026-09-20 11:00',
      },
      createdAt: '2026-09-19 16:00',
      history: [
        { time: '2026-09-19 16:00', by: 'u_ad', byName: '李明辉', action: '提交画面审核' },
        { time: '2026-09-20 11:00', by: 'u_rv', byName: '陈正审', action: '审核驳回', note: '文案违规 + 公益比例不足' },
      ],
      contractChanges: [],
    },
  ];

  // ============ 安装任务 ============
  const tasks: InstallTask[] = [];
  let rwSeq = 0;
  const mkTask = (submissionId: string, roadSegment: string, hoardingNo: string, teamId: string, status: InstallTask['status'], report?: InstallTask['report'], claimedAt?: string): InstallTask => {
    rwSeq += 1;
    return {
      id: `task_${String(rwSeq).padStart(6, '0')}`,
      code: `RW-2026-${String(rwSeq).padStart(4, '0')}`,
      submissionId, roadSegment, hoardingNo, teamId, status, claimedAt, report,
      kind: 'install',
    };
  };
  const rep = (len: number, by: string, byName: string, time: string, extra?: Partial<InstallTask['report']>): NonNullable<InstallTask['report']> => ({
    beforePhotos: [imgBeforeA], afterPhotos: [imgAfterA],
    actualLength: len, gaps: '无缺口', blocksTrafficSign: false, affectsPedestrians: false,
    note: '', time, by, byName, ...extra,
  });

  // S2：4 个待领取
  for (const no of ['SF-01', 'SF-02', 'SF-03', 'SF-04']) tasks.push(mkTask('sub_000002', '三丰里西街', no, 'u_tm2', 'pending'));
  // S3：4 已上报、1 已领取、3 待领取
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-01', 'u_tm', 'reported', rep(25, 'u_tm', '赵铁柱', '2026-09-21 10:00'), '2026-09-20 08:30'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-02', 'u_tm', 'reported', rep(25, 'u_tm', '赵铁柱', '2026-09-21 15:40'), '2026-09-20 08:30'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-03', 'u_tm', 'reported', rep(24.5, 'u_tm', '赵铁柱', '2026-09-22 09:10', { gaps: '与既有围挡交接处留 0.5m 缺口，已用警示带封闭' }), '2026-09-20 08:30'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-04', 'u_tm', 'reported', rep(25, 'u_tm', '赵铁柱', '2026-09-22 16:00'), '2026-09-20 08:30'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-05', 'u_tm', 'claimed', undefined, '2026-09-23 09:00'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-06', 'u_tm', 'pending'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-07', 'u_tm', 'pending'));
  tasks.push(mkTask('sub_000003', '望京西路', 'WJ-08', 'u_tm', 'pending'));
  // S4：5 个全部上报（合计 98.5m，与合同 100m 有差异）
  const s4Lens = [20, 20, 20, 20, 18.5];
  ['FT-01', 'FT-02', 'FT-03', 'FT-04', 'FT-05'].forEach((no, i) => {
    tasks.push(mkTask('sub_000004', '阜通东大街', no, 'u_tm', 'reported',
      rep(s4Lens[i], 'u_tm', '赵铁柱', `2026-09-1${i} 17:00`, i === 4 ? { gaps: 'FT-05 与绿化带交界处缩短 1.5m，现场有配电箱无法覆盖' } : undefined),
      `2026-09-1${i} 08:00`));
  });
  // S5：6 个全部上报（合计 150m）
  ['LG-01', 'LG-02', 'LG-03', 'LG-04', 'LG-05', 'LG-06'].forEach((no, i) => {
    tasks.push(mkTask('sub_000005', '来广营东路', no, 'u_tm', 'reported',
      rep(25, 'u_tm', '赵铁柱', `2026-09-0${i + 1} 16:30`), `2026-09-0${i + 1} 08:00`));
  });
  // S5 重排拆装任务（重排单 CP-2026-0001 确认后生成）：LG-05、LG-06 已安装画面拆装，费用施工方承担
  const reinstallTasks: InstallTask[] = ['LG-05', 'LG-06'].map(no => {
    rwSeq += 1;
    return {
      id: `task_${String(rwSeq).padStart(6, '0')}`,
      code: `RW-2026-${String(rwSeq).padStart(4, '0')}`,
      submissionId: 'sub_000005', roadSegment: '来广营东路', hoardingNo: no, teamId: 'u_tm',
      status: 'pending', kind: 'reinstall', replanId: 'replan_000001',
      affectedCreatives: '消防安全公益画面、恒信国庆促销画面',
      cost: 2812.5, costBearer: 'construction',
    };
  });
  tasks.push(...reinstallTasks);

  // ============ 异常工单 ============
  const tickets: Ticket[] = [
    {
      id: 'ticket_000001', code: 'GD-2026-0001', type: 'wind_damage',
      submissionId: 'sub_000005', title: 'LG-03 画面被大风吹破',
      description: '9月12日夜间大风，LG-03 商业画面右下角撕裂约 1.2m，需更换。',
      photos: [imgDamage], raisedBy: 'u_in', raisedByName: '刘巡检', raisedRole: 'inspector',
      status: 'resolved', deductionAmount: 800,
      rectification: '48 小时内更换破损画面', deadline: '2026-09-15',
      actions: [
        { time: '2026-09-13 09:20', by: 'u_in', byName: '刘巡检', role: 'inspector', action: '发起工单', note: '现场照片已上传' },
        { time: '2026-09-13 10:05', by: 'u_tm', byName: '赵铁柱', role: 'construction', action: '开始处理' },
        { time: '2026-09-14 16:40', by: 'u_tm', byName: '赵铁柱', role: 'construction', action: '提交处理结果', note: '已重新喷绘并更换 LG-03 画面' },
        { time: '2026-09-14 18:00', by: 'u_fn', byName: '吴会计', role: 'finance', action: '核定扣款', note: '按合同违约条款扣款 800 元' },
      ],
      createdAt: '2026-09-13 09:20',
    },
    {
      id: 'ticket_000002', code: 'GD-2026-0002', type: 'dirty',
      submissionId: 'sub_000005', title: 'LG-02 画面泥水脏污',
      description: '巡检发现 LG-02 公益画面下半幅被泥水泼溅，影响市容，需清洗。',
      photos: [imgDirty], raisedBy: 'u_in', raisedByName: '刘巡检', raisedRole: 'inspector',
      status: 'open', deductionAmount: 0,
      rectification: '24 小时内清洗保洁', deadline: '2026-09-25',
      actions: [
        { time: '2026-09-23 15:10', by: 'u_in', byName: '刘巡检', role: 'inspector', action: '发起工单', note: '来源于例行巡检' },
      ],
      createdAt: '2026-09-23 15:10',
    },
    {
      id: 'ticket_000003', code: 'GD-2026-0003', type: 'ratio_violation',
      submissionId: 'sub_000004', title: '公益时段未按比例展示',
      description: '街道抽查发现 9月16日 晚高峰 17:00-19:00 未按要求轮播公益画面，全天均为商业画面。',
      photos: [], raisedBy: 'u_st', raisedByName: '王秀兰', raisedRole: 'street',
      status: 'open', deductionAmount: 0,
      rectification: '立即恢复公益时段轮播，并提交整改说明', deadline: '2026-09-26',
      actions: [
        { time: '2026-09-17 10:30', by: 'u_st', byName: '王秀兰', role: 'street', action: '发起工单', note: '现场抽查记录已存档' },
      ],
      createdAt: '2026-09-17 10:30',
    },
    {
      id: 'ticket_000004', code: 'GD-2026-0004', type: 'early_removal',
      submissionId: 'sub_000004', title: '商户申请提前撤换周年庆画面',
      description: '门店周年庆活动提前至 10月10日 结束，申请 10月15日 提前撤换商业画面，望街道与广告公司确认结算口径。',
      photos: [], raisedBy: 'u_mc', raisedByName: '周悦', raisedRole: 'merchant',
      status: 'processing', deductionAmount: 0,
      rectification: '广告公司评估提前撤换对排期的影响并给出方案', deadline: '2026-09-30',
      actions: [
        { time: '2026-09-18 14:00', by: 'u_mc', byName: '周悦', role: 'merchant', action: '发起工单', note: '附门店活动调整函' },
        { time: '2026-09-19 09:40', by: 'u_ad', byName: '李明辉', role: 'ad_company', action: '开始处理', note: '正与商户核对撤换日期与费用' },
      ],
      createdAt: '2026-09-18 14:00',
    },
  ];

  // ============ 验收单（S5 已验收，待财务结算；重排 CP-2026-0001 确认后已同步更新） ============
  const acceptances: Acceptance[] = [
    {
      id: 'acc_000001', code: 'YS-2026-0001', submissionId: 'sub_000005',
      acceptedLength: 100, contractLength: 100, height: 2.5,
      settleableArea: 250, publicArea: 75, commercialArea: 175,
      unitPrice: 160, grossAmount: 28000,
      deductions: [{ reason: '画面被风吹破（GD-2026-0001）', amount: 800, ticketId: 'ticket_000001' }],
      totalDeduction: 800, settleAmount: 27200,
      rectifications: [
        { id: 'rect_000001', desc: '更换 LG-03 破损画面（GD-2026-0001）', assigneeRole: 'construction', deadline: '2026-09-15', status: 'done', ticketId: 'ticket_000001' },
        { id: 'rect_000002', desc: '清洗 LG-02 脏污画面（GD-2026-0002）', assigneeRole: 'construction', deadline: '2026-09-25', status: 'open', ticketId: 'ticket_000002' },
        { id: 'rect_000003', desc: '重排单 CP-2026-0001：按新边界复核画面安装与验收长度（LG-05、LG-06 拆装后复查）', assigneeRole: 'construction', deadline: '2026-09-28', status: 'open' },
      ],
      inspectionPlan: [
        { id: 'insp_000001', date: '2026-09-18', inspectorId: 'u_in', focus: '画面完整性与公益比例', status: 'done' },
        { id: 'insp_000002', date: '2026-09-25', inspectorId: 'u_in', focus: '脏污整改复查', status: 'planned' },
        { id: 'insp_000003', date: '2026-10-02', inspectorId: 'u_in', focus: '画面完整性与照明', status: 'planned' },
        { id: 'insp_000004', date: '2026-10-09', inspectorId: 'u_in', focus: '撤换前综合检查', status: 'planned' },
      ],
      status: 'pending_finance',
      comment: '安装长度与合同一致，画面质量合格；存在 1 起破损已整改，扣款 800 元。2026-09-21 围挡重排 CP-2026-0001 确认：合同长度 150m→100m，验收清单已同步更新。',
      acceptedBy: 'u_rv', acceptedByName: '陈正审', createdAt: '2026-09-06 10:30',
    },
  ];

  // ============ 巡检记录 ============
  const inspections: Inspection[] = [
    {
      id: 'insp_rec_000001', planItemId: 'insp_000001', acceptanceId: 'acc_000001', submissionId: 'sub_000005',
      date: '2026-09-18', inspectorId: 'u_in', focus: '画面完整性与公益比例',
      status: 'done', result: 'dirty', note: 'LG-02 画面泥水脏污，已生成工单 GD-2026-0002。',
      photos: [imgDirty], ticketId: 'ticket_000002', completedAt: '2026-09-18 15:10',
    },
    { id: 'insp_rec_000002', planItemId: 'insp_000002', acceptanceId: 'acc_000001', submissionId: 'sub_000005', date: '2026-09-25', inspectorId: 'u_in', focus: '脏污整改复查', status: 'planned' },
    { id: 'insp_rec_000003', planItemId: 'insp_000003', acceptanceId: 'acc_000001', submissionId: 'sub_000005', date: '2026-10-02', inspectorId: 'u_in', focus: '画面完整性与照明', status: 'planned' },
    { id: 'insp_rec_000004', planItemId: 'insp_000004', acceptanceId: 'acc_000001', submissionId: 'sub_000005', date: '2026-10-09', inspectorId: 'u_in', focus: '撤换前综合检查', status: 'planned' },
  ];

  // ============ 围挡重排单 ============
  // CP-2026-0001：S5 已确认（150m→100m，LG-05/LG-06 拆装，费用施工方单独结算）
  const s5 = submissions.find(x => x.id === 'sub_000005')!;
  const rp1Preview = computeReplanPreview(
    { hoardingLength: 150, hoardingNos: ['LG-01', 'LG-02', 'LG-03', 'LG-04', 'LG-05', 'LG-06'], height: s5.height, creatives: s5.creatives },
    tasks.filter(t => t.submissionId === 'sub_000005' && t.kind === 'install'),
    100, ['LG-01', 'LG-02', 'LG-03', 'LG-04'], '2026-09-20',
  );
  // CP-2026-0002：S4 待广告公司确认（100m→80m，FT-05 已安装 18.5m 需拆装）
  const s4 = submissions.find(x => x.id === 'sub_000004')!;
  const rp2Preview = computeReplanPreview(
    s4, tasks.filter(t => t.submissionId === 'sub_000004'), 80, undefined, '2026-09-25',
  );
  const replans: Replan[] = [
    {
      id: 'replan_000001', code: 'CP-2026-0001', submissionId: 'sub_000005',
      reason: 'construction_adjust', responsibility: 'construction',
      responsibilityStatement: '施工方因地下管线迁改，需将 LG-05、LG-06 段围挡内收 50 米；已安装画面拆装费用由施工方承担并单独结算，不影响广告公司原合同结算。',
      oldLength: 150, newLength: 100,
      oldHoardingNos: ['LG-01', 'LG-02', 'LG-03', 'LG-04', 'LG-05', 'LG-06'],
      newHoardingNos: ['LG-01', 'LG-02', 'LG-03', 'LG-04'],
      availableLength: rp1Preview.availableLength,
      affectedCreatives: rp1Preview.affectedCreatives,
      affectedPanels: rp1Preview.affectedPanels,
      affectedHoardingNos: rp1Preview.affectedHoardingNos,
      affectedInstalledLength: rp1Preview.affectedInstalledLength,
      estimatedDays: rp1Preview.estimatedDays,
      estimatedInstallDate: rp1Preview.estimatedInstallDate,
      reinstallCost: rp1Preview.reinstallCost,
      status: 'confirmed',
      raisedBy: 'u_tm', raisedByName: '赵铁柱', createdAt: '2026-09-20 09:10',
      confirmedAt: '2026-09-21 10:25', confirmedBy: 'u_ad', confirmedByName: '李明辉',
      reinstallTaskIds: reinstallTasks.map(t => t.id), cancelledTaskIds: [], newTaskIds: [],
      costSettlement: { amount: rp1Preview.reinstallCost, bearer: 'construction', status: 'pending' },
    },
    {
      id: 'replan_000002', code: 'CP-2026-0002', submissionId: 'sub_000004',
      reason: 'construction_adjust', responsibility: 'construction',
      responsibilityStatement: '施工方临时调整：FT-05 段临近配电箱与绿化带无法继续覆盖，围挡内收 20 米；FT-05 已安装画面拆装费用由施工方承担并单独结算。',
      oldLength: 100, newLength: 80,
      oldHoardingNos: ['FT-01', 'FT-02', 'FT-03', 'FT-04', 'FT-05'],
      newHoardingNos: rp2Preview.newHoardingNos,
      availableLength: rp2Preview.availableLength,
      affectedCreatives: rp2Preview.affectedCreatives,
      affectedPanels: rp2Preview.affectedPanels,
      affectedHoardingNos: rp2Preview.affectedHoardingNos,
      affectedInstalledLength: rp2Preview.affectedInstalledLength,
      estimatedDays: rp2Preview.estimatedDays,
      estimatedInstallDate: rp2Preview.estimatedInstallDate,
      reinstallCost: rp2Preview.reinstallCost,
      status: 'pending_confirm',
      raisedBy: 'u_tm', raisedByName: '赵铁柱', createdAt: '2026-09-25 08:40',
      reinstallTaskIds: [], cancelledTaskIds: [], newTaskIds: [],
    },
  ];

  return {
    users, submissions, tasks, tickets, acceptances, inspections, replans,
    seq: {
      code_GG: 15, code_GD: 4, code_YS: 1, code_RW: rwSeq, code_CP: 2,
      id_sub: 6, id_task: rwSeq, id_ticket: 4, id_acc: 1, id_insp_rec: 4, id_rect: 3, id_insp: 4, id_cr: 12,
      id_replan: 2, id_change: 1,
    },
  };
}
