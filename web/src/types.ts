// 领域类型（与 server/src/types.ts 保持一致）

export type Role = 'ad_company' | 'street' | 'reviewer' | 'construction' | 'inspector' | 'merchant' | 'finance';

export interface SafeUser {
  id: string; username: string; name: string; role: Role; org: string; phone?: string;
}

export type SubmissionType = 'public_welfare' | 'commercial' | 'safety' | 'temporary_mod';

export type SubmissionStatus =
  | 'pending_review' | 'rejected' | 'approved' | 'installing'
  | 'pending_acceptance' | 'accepted' | 'settled';

export type CreativeKind = 'public' | 'commercial' | 'safety';

export interface Creative {
  id: string; kind: CreativeKind; title: string; sizeSpec: string; textContent: string;
  theme: string; brandName?: string; imageUrl?: string;
  sensitiveRisk: 'none' | 'low' | 'high'; sightImpact: 'none' | 'low' | 'high';
}

export interface ReviewChecklist {
  dimensionOk: boolean; textOk: boolean; sensitiveOk: boolean;
  themeOk: boolean; brandOk: boolean; sightOk: boolean;
}

export interface Review {
  reviewerId: string; checklist: ReviewChecklist; comment: string;
  decision: 'approved' | 'rejected'; time: string;
}

export interface HistoryItem { time: string; by: string; byName: string; action: string; note?: string }

export interface Submission {
  id: string; code: string; type: SubmissionType; title: string;
  submitterId: string; submitterOrg: string;
  siteName: string; location: string; roadSegment: string;
  hoardingNos: string[]; hoardingLength: number; height: number;
  publicRatio: number; creatives: Creative[];
  approvalUnit: string; plannedInstallDate: string;
  displayStart: string; displayEnd: string; publicSlots: string;
  nightLighting: boolean; lightingDesc?: string;
  constructionTeamId: string; acceptanceRequirements: string;
  merchantId?: string; contractLength: number; unitPrice: number;
  status: SubmissionStatus; review?: Review; createdAt: string; history: HistoryItem[];
  contractChanges: ContractChange[];
}

export type TaskStatus = 'pending' | 'claimed' | 'reported' | 'cancelled';
export type TaskKind = 'install' | 'reinstall';

export interface InstallReport {
  beforePhotos: string[]; afterPhotos: string[]; actualLength: number; gaps: string;
  blocksTrafficSign: boolean; affectsPedestrians: boolean;
  note: string; time: string; by: string; byName: string;
}

export interface InstallTask {
  id: string; code: string; submissionId: string; roadSegment: string; hoardingNo: string;
  teamId: string; status: TaskStatus; kind: TaskKind;
  replanId?: string; affectedCreatives?: string; cost?: number; costBearer?: ReplanResponsibility;
  claimedAt?: string; report?: InstallReport;
}

// ============ 工地改围挡重排 ============

export type ReplanReason = 'construction_adjust' | 'ad_company_request' | 'merchant_request' | 'force_majeure';
export type ReplanResponsibility = 'construction' | 'ad_company' | 'merchant' | 'shared';
export type ReplanStatus = 'pending_confirm' | 'confirmed' | 'rejected';

export interface ReplanPanel { creativeId: string; title: string; kind: CreativeKind; start: number; end: number }
export interface AffectedCreative { id: string; title: string; kind: CreativeKind }

export interface ReplanCostSettlement {
  amount: number; bearer: ReplanResponsibility;
  status: 'pending' | 'settled'; settledAt?: string; settledBy?: string;
}

export interface Replan {
  id: string; code: string; submissionId: string;
  reason: ReplanReason; responsibility: ReplanResponsibility; responsibilityStatement: string;
  oldLength: number; newLength: number;
  oldHoardingNos: string[]; newHoardingNos: string[];
  availableLength: number;
  affectedCreatives: AffectedCreative[];
  affectedPanels: ReplanPanel[];
  affectedHoardingNos: string[];
  affectedInstalledLength: number;
  estimatedDays: number; estimatedInstallDate: string;
  reinstallCost: number;
  status: ReplanStatus;
  raisedBy: string; raisedByName: string; createdAt: string;
  confirmedAt?: string; confirmedBy?: string; confirmedByName?: string;
  rejectNote?: string;
  reinstallTaskIds: string[]; cancelledTaskIds: string[]; newTaskIds: string[];
  costSettlement?: ReplanCostSettlement;
}

export interface ContractChange {
  id: string; time: string; replanId: string; replanCode: string;
  reason: ReplanReason; responsibility: ReplanResponsibility; statement: string;
  oldContractLength: number; newContractLength: number;
  oldContractArea: number; newContractArea: number;
  reinstallCost: number; by: string; byName: string;
}

export type TicketType = 'temporary_change' | 'wind_damage' | 'ratio_violation' | 'early_removal' | 'dirty' | 'length_mismatch';
export type TicketStatus = 'open' | 'processing' | 'resolved' | 'closed';

export interface TicketAction { time: string; by: string; byName: string; role: Role; action: string; note?: string }

export interface Ticket {
  id: string; code: string; type: TicketType; submissionId: string;
  title: string; description: string; photos: string[];
  raisedBy: string; raisedByName: string; raisedRole: Role;
  status: TicketStatus; deductionAmount: number;
  rectification?: string; deadline?: string;
  actions: TicketAction[]; createdAt: string;
}

export interface Deduction { reason: string; amount: number; ticketId?: string }
export interface Rectification { id: string; desc: string; assigneeRole: Role; deadline: string; status: 'open' | 'done'; ticketId?: string }
export interface InspectionPlanItem { id: string; date: string; inspectorId: string; focus: string; status: 'planned' | 'done' }

export interface Acceptance {
  id: string; code: string; submissionId: string;
  acceptedLength: number; contractLength: number; height: number;
  settleableArea: number; publicArea: number; commercialArea: number;
  unitPrice: number; grossAmount: number;
  deductions: Deduction[]; totalDeduction: number; settleAmount: number;
  rectifications: Rectification[]; inspectionPlan: InspectionPlanItem[];
  status: 'pending_finance' | 'settled';
  comment: string; acceptedBy: string; acceptedByName: string;
  createdAt: string; settledAt?: string; settledBy?: string;
}

export interface Inspection {
  id: string; planItemId: string; acceptanceId: string; submissionId: string;
  date: string; inspectorId: string; focus: string;
  status: 'planned' | 'done';
  result?: 'ok' | 'dirty' | 'damaged' | 'ratio_issue';
  note?: string; photos?: string[]; ticketId?: string; completedAt?: string;
}

export interface Bootstrap {
  users: SafeUser[]; submissions: Submission[]; tasks: InstallTask[];
  tickets: Ticket[]; acceptances: Acceptance[]; inspections: Inspection[];
  replans: Replan[];
}
