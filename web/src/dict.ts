import { Role, SubmissionStatus, SubmissionType, TicketStatus, TicketType, TaskStatus, CreativeKind } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  ad_company: '广告公司', street: '街道', reviewer: '审核人员',
  construction: '施工队', inspector: '巡检员', merchant: '商户', finance: '财务',
};

export const TYPE_LABEL: Record<SubmissionType, string> = {
  public_welfare: '街道公益宣传', commercial: '商业广告',
  safety: '工地安全提示', temporary_mod: '临时围挡改造',
};

export const TYPE_COLOR: Record<SubmissionType, string> = {
  public_welfare: 'green', commercial: 'gold', safety: 'geekblue', temporary_mod: 'purple',
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending_review: '待审核', rejected: '已驳回', approved: '待安装',
  installing: '安装中', pending_acceptance: '待验收', accepted: '待结算', settled: '已结算',
};

export const STATUS_COLOR: Record<SubmissionStatus, string> = {
  pending_review: 'processing', rejected: 'error', approved: 'cyan',
  installing: 'geekblue', pending_acceptance: 'warning', accepted: 'gold', settled: 'success',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待领取', claimed: '已领取', reported: '已上报',
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: 'default', claimed: 'processing', reported: 'success',
};

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  temporary_change: '工地临时改围挡', wind_damage: '画面被风吹破',
  ratio_violation: '公益时段未按比例展示', early_removal: '商户要求提前撤换',
  dirty: '巡检发现脏污', length_mismatch: '验收长度与合同不符',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: '待处理', processing: '处理中', resolved: '待确认', closed: '已关闭',
};

export const TICKET_STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'error', processing: 'processing', resolved: 'warning', closed: 'success',
};

export const KIND_LABEL: Record<CreativeKind, string> = {
  public: '公益画面', commercial: '商业画面', safety: '安全提示',
};

export const KIND_COLOR: Record<CreativeKind, string> = {
  public: 'green', commercial: 'gold', safety: 'geekblue',
};

export const RISK_LABEL: Record<'none' | 'low' | 'high', string> = {
  none: '无', low: '低', high: '高',
};

export const RISK_COLOR: Record<'none' | 'low' | 'high', string> = {
  none: 'success', low: 'warning', high: 'error',
};

export const INSPECTION_RESULT_LABEL: Record<string, string> = {
  ok: '正常', dirty: '脏污', damaged: '破损', ratio_issue: '公益比例异常',
};

/** 各排期类型的审批要求差异说明 */
export const TYPE_APPROVAL_HINT: Record<SubmissionType, string> = {
  public_welfare: '街道公益宣传：审批单位为街道市容办，公益比例固定 100%，无需商户与合同金额。',
  commercial: '商业广告：审批单位为市城管局，公益比例不得低于 30%，需关联商户并填写合同单价。',
  safety: '工地安全提示：审批单位为区住建委安全监督站，需说明夜间警示照明，公益比例按实际情况填写。',
  temporary_mod: '临时围挡改造：审批单位为区城管局，需说明改造原因与恢复期限，可走简易审批。',
};

/** 各类型默认审批单位 */
export const TYPE_APPROVAL_UNIT: Record<SubmissionType, string> = {
  public_welfare: '街道市容办', commercial: '市城管局审批中心',
  safety: '区住建委安全监督站', temporary_mod: '区城管局市容科',
};

/** 各角色可发起的工单类型 */
export const ROLE_TICKET_TYPES: Record<Role, TicketType[]> = {
  ad_company: ['temporary_change', 'wind_damage', 'ratio_violation', 'early_removal'],
  street: ['temporary_change', 'wind_damage', 'ratio_violation', 'dirty', 'early_removal'],
  reviewer: ['temporary_change', 'ratio_violation', 'length_mismatch'],
  construction: ['temporary_change', 'wind_damage'],
  inspector: ['wind_damage', 'dirty', 'ratio_violation'],
  merchant: ['early_removal'],
  finance: ['length_mismatch'],
};
