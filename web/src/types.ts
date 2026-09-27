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
}

export type TaskStatus = 'pending' | 'claimed' | 'reported' | 'cancelled';

export interface InstallReport {
  beforePhotos: string[]; afterPhotos: string[]; actualLength: number; gaps: string;
  blocksTrafficSign: boolean; affectsPedestrians: boolean;
  note: string; time: string; by: string; byName: string;
}

export interface InstallTask {
  id: string; code: string; submissionId: string; roadSegment: string; hoardingNo: string;
  teamId: string; status: TaskStatus; claimedAt?: string; report?: InstallReport;
  kind?: 'install' | 'reinstall'; relayoutId?: string; fromHoardingNo?: string; cost?: number;
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
  relayouts: Relayout[]; contractChanges: ContractChange[]; reinstallSettlements: ReinstallSettlement[];
}

// ============ 工地改围挡重排 ============

export type RelayoutReason = 'construction' | 'ad_company' | 'street' | 'force_majeure';
export type CostBearer = 'construction' | 'ad_company' | 'street' | 'shared';
export type RelayoutStatus = 'pending_confirm' | 'confirmed' | 'rejected';

export interface AffectedCreative {
  id: string; title: string; kind: CreativeKind; width: number; reason: string;
}

export interface Relayout {
  id: string; code: string; submissionId: string;
  reason: RelayoutReason; responsibility: string;
  oldHoardingNos: string[]; newHoardingNos: string[];
  oldLength: number; newLength: number; newInstallDate: string; note?: string;
  availableLength: number; affectedCreatives: AffectedCreative[];
  removedNos: string[]; addedNos: string[];
  cancelTaskCount: number; reinstallTaskCount: number; reinstallCost: number;
  costBearer: CostBearer; adCompanyDeduction: number; separateAmount: number;
  status: RelayoutStatus;
  raisedBy: string; raisedByName: string; createdAt: string;
  confirmedBy?: string; confirmedByName?: string; confirmedAt?: string;
  rejectNote?: string; contractChangeId?: string;
}

export interface ContractChange {
  id: string; code: string; submissionId: string; relayoutId: string;
  reason: RelayoutReason; responsibility: string;
  oldContractLength: number; newContractLength: number;
  oldContractArea: number; newContractArea: number;
  costBearer: CostBearer; reinstallCost: number;
  adCompanyDeduction: number; separateAmount: number;
  separateSettlementId?: string;
  confirmedBy: string; confirmedByName: string; time: string;
}

export interface ReinstallSettlement {
  id: string; code: string; submissionId: string; relayoutId: string; contractChangeId: string;
  bearerRole: 'construction' | 'street'; bearerName: string;
  amount: number; responsibility: string;
  status: 'pending' | 'settled';
  createdAt: string; settledAt?: string; settledBy?: string;
}

/** 重排试算结果（/api/relayouts/preview） */
export interface RelayoutPreview {
  availableLength: number; affectedCreatives: AffectedCreative[];
  removedNos: string[]; addedNos: string[];
  cancelTaskCount: number; reinstallTaskCount: number; reinstallCost: number;
  bearer: CostBearer; adCompanyDeduction: number; separateAmount: number;
}
