// 工地改围挡重排：前端实时预览计算（与 server/src/replan.ts 逻辑保持一致，服务端为权威结果）
import { AffectedCreative, Creative, InstallTask, ReplanPanel, Submission } from './types';

export const REINSTALL_UNIT_PRICE = 45;      // 拆装综合单价（元/m²）
export const INSTALL_RATE_PER_DAY = 25;      // 现场拆装/新装效率（米/天）

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function parsePanelWidth(sizeSpec: string): number {
  const m = String(sizeSpec || '').match(/(\d+(?:\.\d+)?)/);
  const w = m ? Number(m[1]) : 0;
  return w > 0 ? w : 6;
}

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

export function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 按新边界长度建议围挡编号：收缩时从尾部裁减，扩展时保留原编号 */
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
  newHoardingNos: string[];
}

/** 重排预览：可用广告长度、受影响画面、安装时间、拆装费用 */
export function computeReplanPreview(
  s: Pick<Submission, 'hoardingLength' | 'hoardingNos' | 'height' | 'creatives'>,
  tasks: Pick<InstallTask, 'hoardingNo' | 'status' | 'report'>[],
  newLength: number,
  newHoardingNos: string[] | undefined,
  today: string,
): ReplanPreview {
  const oldLength = s.hoardingLength;
  const nos = newHoardingNos && newHoardingNos.length ? newHoardingNos : suggestHoardingNos(s.hoardingNos, oldLength, newLength);

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

  const seg = oldLength / Math.max(1, s.hoardingNos.length);
  const affectedHoardingNos = s.hoardingNos.filter((no, i) => {
    if (!nos.includes(no)) return true;
    return (i + 1) * seg > newLength + 1e-9;
  });

  const affectedInstalledLength = round2(
    tasks
      .filter(t => t.status === 'reported' && affectedHoardingNos.includes(t.hoardingNo))
      .reduce((sum, t) => sum + (t.report?.actualLength || 0), 0),
  );

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
