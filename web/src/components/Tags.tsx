import { Tag } from 'antd';
import {
  STATUS_COLOR, STATUS_LABEL, TASK_STATUS_COLOR, TASK_STATUS_LABEL,
  TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, TICKET_TYPE_LABEL, TYPE_COLOR, TYPE_LABEL,
  KIND_COLOR, KIND_LABEL,
} from '../dict';
import { CreativeKind, SubmissionStatus, SubmissionType, TaskStatus, TicketStatus, TicketType } from '../types';

export const SubStatusTag = ({ s }: { s: SubmissionStatus }) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>;
export const SubTypeTag = ({ t }: { t: SubmissionType }) => <Tag color={TYPE_COLOR[t]}>{TYPE_LABEL[t]}</Tag>;
export const TaskStatusTag = ({ s }: { s: TaskStatus }) => <Tag color={TASK_STATUS_COLOR[s]}>{TASK_STATUS_LABEL[s]}</Tag>;
export const TicketStatusTag = ({ s }: { s: TicketStatus }) => <Tag color={TICKET_STATUS_COLOR[s]}>{TICKET_STATUS_LABEL[s]}</Tag>;
export const TicketTypeTag = ({ t }: { t: TicketType }) => <Tag color="volcano">{TICKET_TYPE_LABEL[t]}</Tag>;
export const KindTag = ({ k }: { k: CreativeKind }) => <Tag color={KIND_COLOR[k]}>{KIND_LABEL[k]}</Tag>;
