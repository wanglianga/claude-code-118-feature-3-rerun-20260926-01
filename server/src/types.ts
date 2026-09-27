// ============ 领域模型：城市工地围挡公益广告排期与验收 ============

export type Role =
  | 'ad_company'   // 广告公司
  | 'street'       // 街道
  | 'reviewer'     // 审核人员
  | 'construction' // 责任施工队
  | 'inspector'    // 巡检员
  | 'merchant'     // 商户
  | 'finance';     // 财务

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  org: string;
  phone?: string;
}

export type SafeUser = Omit<User, 'password'>;

/** 排期单类型：街道公益宣传 / 商业广告 / 工地安全提示 / 临时围挡改造 */
export type SubmissionType = 'public_welfare' | 'commercial' | 'safety' | 'temporary_mod';

export type SubmissionStatus =
  | 'pending_review'      // 待审核
  | 'rejected'            // 已驳回
  | 'approved'            // 审核通过（待领取安装）
  | 'installing'          // 安装中（部分任务已领取/上报）
  | 'pending_acceptance'  // 待验收（全部安装上报完成）
  | 'accepted'            // 验收完成（待财务结算）
  | 'settled';            // 已结算

export type CreativeKind = 'public' | 'commercial' | 'safety';

export interface Creative {
  id: string;
  kind: CreativeKind;
  title: string;
  sizeSpec: string;      // 画面尺寸，如 6m×2.5m
  textContent: string;   // 画面文字
  theme: string;         // 公益主题（公益画面）
  brandName?: string;    // 品牌露出（商业画面）
  imageUrl?: string;     // 效果图
  sensitiveRisk: 'none' | 'low' | 'high'; // 敏感内容自评
  sightImpact: 'none' | 'low' | 'high';   // 道路视线影响自评
}

export interface ReviewChecklist {
  dimensionOk: boolean;  // 画面尺寸合规
  textOk: boolean;       // 文字内容合规
  sensitiveOk: boolean;  // 无敏感内容
  themeOk: boolean;      // 公益主题符合要求
  brandOk: boolean;      // 品牌露出合规
  sightOk: boolean;      // 不影响道路视线
}

export interface Review {
  reviewerId: string;
  checklist: ReviewChecklist;
  comment: string;
  decision: 'approved' | 'rejected';
  time: string;
}

export interface HistoryItem {
  time: string;
  by: string;
  byName: string;
  action: string;
  note?: string;
}

export interface Submission {
  id: string;
  code: string;                 // 排期单号 GG-2026-XXXX
  type: SubmissionType;
  title: string;
  submitterId: string;
  submitterOrg: string;
  // 工地与围挡
  siteName: string;             // 工地名称
  location: string;             // 工地位置
  roadSegment: string;          // 路段
  hoardingNos: string[];        // 围挡编号
  hoardingLength: number;       // 围挡长度（米）
  height: number;               // 围挡高度（米）
  // 画面与比例
  publicRatio: number;          // 公益比例 %
  creatives: Creative[];
  // 审批与施工
  approvalUnit: string;         // 审批单位
  plannedInstallDate: string;   // 计划安装时间
  displayStart: string;         // 展示开始
  displayEnd: string;           // 展示结束
  publicSlots: string;          // 公益时段说明
  nightLighting: boolean;       // 夜间照明
  lightingDesc?: string;
  constructionTeamId: string;   // 责任施工队
  acceptanceRequirements: string; // 验收要求
  // 商业合同
  merchantId?: string;
  contractLength: number;       // 合同长度（米）
  unitPrice: number;            // 商业面积单价（元/m²，整个展示期）
  // 状态
  status: SubmissionStatus;
  review?: Review;
  createdAt: string;
  history: HistoryItem[];
  contractChanges: ContractChange[];  // 合同变更记录（围挡重排确认后写入）
}

export type TaskStatus = 'pending' | 'claimed' | 'reported' | 'cancelled';

/** 任务类型：install=常规安装；reinstall=围挡重排产生的拆装任务 */
export type TaskKind = 'install' | 'reinstall';

export interface InstallReport {
  beforePhotos: string[];       // 安装前照片
  afterPhotos: string[];        // 安装后照片
  actualLength: number;         // 实际长度（米）
  gaps: string;                 // 缺口情况
  blocksTrafficSign: boolean;   // 是否遮挡交通标识
  affectsPedestrians: boolean;  // 是否影响行人通行
  note: string;
  time: string;
  by: string;
  byName: string;
}

export interface InstallTask {
  id: string;
  code: string;                 // 任务号 RW-...
  submissionId: string;
  roadSegment: string;
  hoardingNo: string;
  teamId: string;
  status: TaskStatus;
  kind: TaskKind;               // install / reinstall（拆装任务）
  replanId?: string;            // 来源重排单（拆装任务）
  affectedCreatives?: string;   // 拆装涉及画面（拆装任务）
  cost?: number;                // 拆装费用（元，拆装任务）
  costBearer?: ReplanResponsibility; // 拆装费用责任方
  claimedAt?: string;
  report?: InstallReport;
}

/** 异常工单类型 */
export type TicketType =
  | 'temporary_change'  // 工地临时改围挡
  | 'wind_damage'       // 画面被风吹破
  | 'ratio_violation'   // 公益时段未按比例展示
  | 'early_removal'     // 商户要求提前撤换
  | 'dirty'             // 巡检发现脏污
  | 'length_mismatch';  // 验收长度与合同不符

// ============ 工地改围挡重排 ============

/** 重排变更原因（决定拆装费用责任方） */
export type ReplanReason =
  | 'construction_adjust'  // 施工方临时调整（责任：施工方）
  | 'ad_company_request'   // 广告公司要求调整（责任：广告公司）
  | 'merchant_request'     // 商户需求变更（责任：商户）
  | 'force_majeure';      // 不可抗力/市政要求（责任：双方分担）

/** 拆装费用责任方 */
export type ReplanResponsibility = 'construction' | 'ad_company' | 'merchant' | 'shared';

export type ReplanStatus = 'pending_confirm' | 'confirmed' | 'rejected';

/** 画面沿围挡的排布区间（米） */
export interface ReplanPanel {
  creativeId: string;
  title: string;
  kind: CreativeKind;
  start: number;
  end: number;
}

/** 受影响画面（去重后） */
export interface AffectedCreative {
  id: string;
  title: string;
  kind: CreativeKind;
}

/** 拆装费用单独结算记录 */
export interface ReplanCostSettlement {
  amount: number;                       // 拆装费用（元）
  bearer: ReplanResponsibility;          // 责任方
  status: 'pending' | 'settled';
  settledAt?: string;
  settledBy?: string;
}

/** 围挡重排单：施工方调整围挡边界 → 页面重算 → 广告公司确认 → 合同/任务/验收同步 */
export interface Replan {
  id: string;
  code: string;                       // 重排单号 CP-2026-XXXX
  submissionId: string;
  reason: ReplanReason;               // 变更原因
  responsibility: ReplanResponsibility; // 责任方（由变更原因决定）
  responsibilityStatement: string;    // 责任说明（进入合同变更记录）
  // 边界调整
  oldLength: number;
  newLength: number;                  // 调整后围挡边界长度（= 可用广告长度）
  oldHoardingNos: string[];
  newHoardingNos: string[];
  // 页面重算结果
  availableLength: number;            // 可用广告长度
  affectedCreatives: AffectedCreative[]; // 受影响画面
  affectedPanels: ReplanPanel[];      // 受影响画面排布明细
  affectedHoardingNos: string[];      // 受影响围挡编号
  affectedInstalledLength: number;    // 已安装但受影响的长度（米）
  estimatedDays: number;              // 预计重排工期（天）
  estimatedInstallDate: string;       // 重排后预计安装完成时间
  reinstallCost: number;              // 拆装费用（元）
  // 流转
  status: ReplanStatus;
  raisedBy: string;
  raisedByName: string;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  rejectNote?: string;
  // 确认后同步结果
  reinstallTaskIds: string[];         // 生成的拆装任务
  cancelledTaskIds: string[];         // 取消的安装任务
  newTaskIds: string[];               // 新增围挡编号产生的安装任务
  costSettlement?: ReplanCostSettlement; // 拆装费用单独结算（施工方原因等）
}

/** 合同变更记录（责任说明随重排确认进入） */
export interface ContractChange {
  id: string;
  time: string;
  replanId: string;
  replanCode: string;
  reason: ReplanReason;
  responsibility: ReplanResponsibility;
  statement: string;                  // 责任说明
  oldContractLength: number;
  newContractLength: number;
  oldContractArea: number;            // 合同面积 = 合同长度 × 高度
  newContractArea: number;
  reinstallCost: number;              // 拆装费用
  by: string;
  byName: string;
}


export type TicketStatus = 'open' | 'processing' | 'resolved' | 'closed';

export interface TicketAction {
  time: string;
  by: string;
  byName: string;
  role: Role;
  action: string;
  note?: string;
}

export interface Ticket {
  id: string;
  code: string;                 // 工单号 GD-...
  type: TicketType;
  submissionId: string;
  title: string;
  description: string;
  photos: string[];
  raisedBy: string;
  raisedByName: string;
  raisedRole: Role;
  status: TicketStatus;
  deductionAmount: number;      // 扣款金额（财务核定）
  rectification?: string;       // 整改要求
  deadline?: string;
  actions: TicketAction[];
  createdAt: string;
}

export interface Deduction {
  reason: string;
  amount: number;
  ticketId?: string;
}

export interface Rectification {
  id: string;
  desc: string;
  assigneeRole: Role;
  deadline: string;
  status: 'open' | 'done';
  ticketId?: string;
}

export interface InspectionPlanItem {
  id: string;
  date: string;
  inspectorId: string;
  focus: string;
  status: 'planned' | 'done';
}

export interface Acceptance {
  id: string;
  code: string;                 // 验收单号 YS-...
  submissionId: string;
  acceptedLength: number;       // 验收长度（米）
  contractLength: number;       // 合同长度（米）
  height: number;
  settleableArea: number;       // 可结算面积（m²）
  publicArea: number;           // 公益面积（m²）
  commercialArea: number;       // 商业可结算面积（m²）
  unitPrice: number;
  grossAmount: number;          // 商业面积 × 单价
  deductions: Deduction[];
  totalDeduction: number;
  settleAmount: number;         // 应结算金额
  rectifications: Rectification[];
  inspectionPlan: InspectionPlanItem[];
  status: 'pending_finance' | 'settled';
  comment: string;
  acceptedBy: string;
  acceptedByName: string;
  createdAt: string;
  settledAt?: string;
  settledBy?: string;
}

export interface Inspection {
  id: string;
  planItemId: string;
  acceptanceId: string;
  submissionId: string;
  date: string;
  inspectorId: string;
  focus: string;
  status: 'planned' | 'done';
  result?: 'ok' | 'dirty' | 'damaged' | 'ratio_issue';
  note?: string;
  photos?: string[];
  ticketId?: string;
  completedAt?: string;
}

export interface DB {
  users: User[];
  submissions: Submission[];
  tasks: InstallTask[];
  tickets: Ticket[];
  acceptances: Acceptance[];
  inspections: Inspection[];
  replans: Replan[];
  seq: Record<string, number>;
}
