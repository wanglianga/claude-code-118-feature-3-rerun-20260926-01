import { useState } from 'react';
import { Button, Descriptions, Drawer, Form, Image, Input, InputNumber, Modal, Space, Tag, Timeline, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { Ticket } from '../types';
import { ROLE_LABEL, TICKET_TYPE_LABEL } from '../dict';
import { TicketStatusTag, TicketTypeTag } from './Tags';

/** 工单详情 + 各角色协同处理（开始处理 / 提交结果 / 关闭 / 退回 / 财务核定扣款） */
export default function TicketDrawer({ ticket, open, onClose }: { ticket: Ticket | null; open: boolean; onClose: () => void }) {
  const { user, submissions, act } = useStore();
  const [note, setNote] = useState('');
  const [deduction, setDeduction] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ticket || !user) return null;
  const t = ticket;
  const sub = submissions.find(s => s.id === t.submissionId);

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await act(() => api.ticketAction(t.id, { action, note, ...extra }));
      message.success('操作成功，状态已同步');
      setNote('');
      onClose();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = (title: string, action: string) => {
    Modal.confirm({ title, content: `工单：${t.code} ${t.title}`, onOk: () => doAction(action) });
  };

  // 处理责任方：破损/脏污→施工队；比例/撤换/临改→广告公司；长度不符→广告公司+财务
  const handlerRoles: Record<string, string[]> = {
    wind_damage: ['construction'], dirty: ['construction'],
    ratio_violation: ['ad_company'], early_removal: ['ad_company', 'street'],
    temporary_change: ['ad_company', 'construction'], length_mismatch: ['ad_company'],
  };
  const canHandle = handlerRoles[t.type]?.includes(user.role);
  const canClose = ['street', 'reviewer', 'inspector'].includes(user.role) || t.raisedBy === user.id;

  return (
    <Drawer width={640} open={open} onClose={onClose}
      title={<Space>{t.title}<TicketTypeTag t={t.type} /><TicketStatusTag s={t.status} /></Space>}>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="工单号">{t.code}</Descriptions.Item>
        <Descriptions.Item label="类型">{TICKET_TYPE_LABEL[t.type]}</Descriptions.Item>
        <Descriptions.Item label="关联排期单">{sub ? `${sub.code} ${sub.title}` : t.submissionId}</Descriptions.Item>
        <Descriptions.Item label="发起方">{t.raisedByName}（{ROLE_LABEL[t.raisedRole]}）</Descriptions.Item>
        <Descriptions.Item label="发起时间">{t.createdAt}</Descriptions.Item>
        <Descriptions.Item label="扣款金额">
          {t.deductionAmount > 0 ? <Typography.Text type="danger">¥{t.deductionAmount}</Typography.Text> : '未核定'}
        </Descriptions.Item>
        <Descriptions.Item label="问题描述" span={2}>{t.description}</Descriptions.Item>
        {t.rectification && <Descriptions.Item label="整改要求" span={2}>{t.rectification}{t.deadline ? `（限 ${t.deadline} 前）` : ''}</Descriptions.Item>}
        {t.photos.length > 0 && (
          <Descriptions.Item label="现场照片" span={2}>
            <Image.PreviewGroup>
              <Space>{t.photos.map(p => <Image key={p} src={p} width={110} height={80} style={{ objectFit: 'cover' }} />)}</Space>
            </Image.PreviewGroup>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 20 }}>协同处理</Typography.Title>
      <Form layout="vertical">
        <Form.Item label="处理备注">
          <Input.TextArea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="处理说明 / 关闭意见（可选）" />
        </Form.Item>
        <Space wrap>
          {t.status === 'open' && canHandle && (
            <Button type="primary" loading={busy} onClick={() => doAction('start')}>开始处理</Button>
          )}
          {t.status === 'processing' && canHandle && (
            <Button type="primary" loading={busy} onClick={() => doAction('resolve')}>提交处理结果</Button>
          )}
          {t.status === 'resolved' && canClose && (
            <>
              <Button type="primary" loading={busy} onClick={() => confirmAction('确认整改到位并关闭工单？', 'close')}>验收关闭</Button>
              <Button danger loading={busy} onClick={() => doAction('reopen')}>退回重新处理</Button>
            </>
          )}
          {user.role === 'finance' && t.status !== 'closed' && (
            <Space.Compact>
              <InputNumber min={0} placeholder="扣款金额" value={deduction} onChange={v => setDeduction(v)} addonBefore="¥" />
              <Button loading={busy} onClick={() => doAction('set_deduction', { deductionAmount: deduction ?? 0 })}>核定扣款</Button>
            </Space.Compact>
          )}
          {!canHandle && !canClose && user.role !== 'finance' && <Tag>当前状态无需贵方操作，等待责任方处理</Tag>}
        </Space>
      </Form>

      <Typography.Title level={5} style={{ marginTop: 20 }}>处理时间线</Typography.Title>
      <Timeline
        items={t.actions.map(a => ({
          children: <span><b>{a.time}</b>　{a.byName}（{ROLE_LABEL[a.role]}）：{a.action}{a.note ? ` — ${a.note}` : ''}</span>,
        }))}
      />
    </Drawer>
  );
}
