// ============ 工地改围挡重排：页面重算逻辑（服务端权威实现，前端预览保持一致） ============
import {
  AffectedCreative, Creative, InstallTask, ReplanPanel, ReplanReason, ReplanResponsibility, Submission,
} from './types';

/** 拆装综合单价（元/m²）：拆装费用 = 已安装受影响长度 × 围挡高度 × 单价 */
export const REINSTALL_UNIT_PRICE = 45;
/** 现场拆装/新装效率（米/天），用于重算安装时间 */
export const INSTALL_RATE_PER_DAY = 25;

/** 变更原因 → 拆装费用责任方（费用由施工变更原因决定） */
export const REASON_RESPONSIBILITY: Record<ReplanReason, ReplanResponsibility> = {
  construction_adjust: 'construction',  // 施工方临时调整 → 施工方承担，单独结算
  ad_company_request: 'ad_company',     // 广告公司要求 → 广告公司承担
  merchant_request: 'merchant',         // 商户需求变更 → 商户承担
  force_majeure: 'shared',              // 不可抗力/市政要求 → 双方分担
};

export const REASON_LABEL: Record<ReplanReason, string> = {
  construction_adjust: '施工方临时调整',
  ad_company_request: '广告公司要求调整',
  merchant_request: '商户需求变更',
  force_majeure: '不可抗力/市政要求',
};

export const RESPONSIBILITY_LABEL: Record<ReplanResponsibility, string> = {
  construction: '施工方',
  ad_company: '广告公司',
  merchant: '商户',
  shared: '双方分担',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 从画面尺寸（如 6m×2.5m）解析单幅宽度（米） */
export function parsePanelWidth(sizeSpec: string): number {
  const m = String(sizeSpec || '').match(/(\d+(?:\.\d+)?)/);
  const w = m ? Number(m[1]) : 0;
  return w > 0 ? w : 6;
}

/** 画面沿围挡顺序循环排布，覆盖 length 米，返回每幅画面的占位区间 */
export function layoutPanels(creatives: Creative[], length: number): ReplanPanel[] {
  const panels: ReplanPanel[] = [];
  if (!creatives.length || !(length > 0)) return panels;
  let pos = 0;
  let i = 0;
  while (pos < length - 1e-9) {
    const c = creatives[i % creatives.length];
    const w = parsePanelWidth(c.sizeSpec);
    panels.push({ creativeId: c.id, title: c.title, kind: c.kind, start: round2(pos), end: round2(pos + w) });
    pos += w;
    i += 1;
  }
  return panels;
}

/** 日期加天数，返回 YYYY-MM-DD */
export function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 按新边界长度建议围挡编号：收缩时从尾部裁减，扩展时保留原编号（可手工追加） */
export function suggestHoardingNos(oldNos: string[], oldLength: number, newLength: number): string[] {
  if (!oldNos.length || !(oldLength > 0)) return oldNos.slice();
  if (newLength >= oldLength) return oldNos.slice();
  const seg = oldLength / oldNos.length;
  const keep = Math.max(1, Math.ceil(newLength / seg - 1e-9));
  return oldNos.slice(0, keep);
}

export interface ReplanPreview {
  availableLength: number;
  affectedCreatives: AffectedCreative[];
  affectedPanels: ReplanPanel[];
  affectedHoardingNos: string[];
  affectedInstalledLength: number;
  estimatedDays: number;
  estimatedInstallDate: string;
  reinstallCost: number;
}

/**
 * 重排预览重算：可用广告长度、受影响画面、安装时间、拆装费用。
 * @param newHoardingNos 调整后围挡编号（缺省按长度自动建议）
 */
export function computeReplanPreview(
  s: Pick<Submission, 'hoardingLength' | 'hoardingNos' | 'height' | 'creatives'>,
  tasks: Pick<InstallTask, 'hoardingNo' | 'status' | 'report'>[],
  newLength: number,
  newHoardingNos: string[] | undefined,
  today: string,
): ReplanPreview & { newHoardingNos: string[] } {
  const oldLength = s.hoardingLength;
  const nos = (newHoardingNos && newHoardingNos.length ? newHoardingNos : suggestHoardingNos(s.hoardingNos, oldLength, newLength));

  // 受影响画面：原排布中超出新边界的画面
  const panels = layoutPanels(s.creatives, oldLength);
  const affectedPanels = panels.filter(p => p.end > newLength + 1e-9);
  const seen = new Set<string>();
  const affectedCreatives: AffectedCreative[] = [];
  for (const p of affectedPanels) {
    if (!seen.has(p.creativeId)) {
      seen.add(p.creativeId);
      affectedCreatives.push({ id: p.creativeId, title: p.title, kind: p.kind });
    }
  }

  // 受影响围挡编号：被移除的编号 + 分段与新边界之外相交的编号
  const seg = oldLength / Math.max(1, s.hoardingNos.length);
  const affectedHoardingNos = s.hoardingNos.filter((no, i) => {
    if (!nos.includes(no)) return true;
    return (i + 1) * seg > newLength + 1e-9; // 分段越出新边界
  });

  // 已安装但受影响的长度（以上报实际长度为准）→ 生成拆装任务与费用的依据
  const affectedInstalledLength = round2(
    tasks
      .filter(t => t.status === 'reported' && affectedHoardingNos.includes(t.hoardingNo))
      .reduce((sum, t) => sum + (t.report?.actualLength || 0), 0),
  );

  // 安装时间重算：拆装工作量 + 新装工作量，按 INSTALL_RATE_PER_DAY 米/天
  const addedLength = Math.max(0, newLength - oldLength);
  const workLength = affectedInstalledLength + addedLength;
  const estimatedDays = Math.max(1, Math.ceil(workLength / INSTALL_RATE_PER_DAY));
  const estimatedInstallDate = addDays(today, estimatedDays);

  const reinstallCost = round2(affectedInstalledLength * s.height * REINSTALL_UNIT_PRICE);

  return {
    availableLength: round2(newLength),
    affectedCreatives,
    affectedPanels,
    affectedHoardingNos,
    affectedInstalledLength,
    estimatedDays,
    estimatedInstallDate,
    reinstallCost,
    newHoardingNos: nos,
  };
}
