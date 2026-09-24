import { useMemo, useState } from 'react';
import {
  Button, Card, DatePicker, Form, Input, Modal, Select, Space, Table, Tabs, Typography, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useStore } from '../store';
import { api } from '../api';
import { ROLE_TICKET_TYPES, TICKET_TYPE_LABEL } from '../dict';
import { Ticket } from '../types';
import { TicketStatusTag, TicketTypeTag } from '../components/Tags';
import TicketDrawer from '../components/TicketDrawer';
import PhotoUpload from '../components/PhotoUpload';

/** 异常工单：六类异常围绕同一排期协同处理 */
export default function TicketsPage() {
  const { user, tickets, submissions, act } = useStore();
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const allowedTypes = user ? ROLE_TICKET_TYPES[user.role] : [];

  // 与当前角色相关的工单：我发起的 / 我单位提交的排期 / 管理类角色看全部
  const visible = useMemo(() => {
    if (!user) return [];
    if (['reviewer', 'street', 'finance', 'inspector'].includes(user.role)) return tickets;
    if (user.role === 'ad_company') {
      const mySubs = submissions.filter(s => s.submitterId === user.id).map(s => s.id);
      return tickets.filter(t => mySubs.includes(t.submissionId) || t.raisedBy === user.id);
    }
    if (user.role === 'construction') {
      const mySubs = submissions.filter(s => s.constructionTeamId === user.id).map(s => s.id);
      return tickets.filter(t => mySubs.includes(t.submissionId) || t.raisedBy === user.id);
    }
    return tickets.filter(t => t.raisedBy === user.id || submissions.find(s => s.id === t.submissionId)?.merchantId === user.id);
  }, [user, tickets, submissions]);

  const byStatus = (status?: string) => status ? visible.filter(t => t.status === status) : visible;

  const create = async () => {
    const values = await form.validateFields();
    setBusy(true);
    try {
      await act(() => api.createTicket({
        ...values,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : undefined,
      }));
      message.success('工单已发起，相关方已可见');
      setCreating(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { title: '工单号', dataIndex: 'code', width: 115 },
    { title: '类型', dataIndex: 'type', width: 160, render: (v: any) => <TicketTypeTag t={v} /> },
    { title: '标题', dataIndex: 'title', render: (v: string, t: Ticket) => <a onClick={() => setDetail(t)}>{v}</a> },
    {
      title: '关联排期', width: 200, ellipsis: true,
      render: (_: unknown, t: Ticket) => {
        const s = submissions.find(x => x.id === t.submissionId);
        return s ? `${s.code} ${s.title}` : t.submissionId;
      },
    },
    { title: '发起方', dataIndex: 'raisedByName', width: 90 },
    { title: '状态', dataIndex: 'status', width: 85, render: (v: any) => <TicketStatusTag s={v} /> },
    { title: '扣款', dataIndex: 'deductionAmount', width: 90, render: (v: number) => v > 0 ? <span style={{ color: '#cf1322' }}>¥{v}</span> : '—' },
    { title: '发起时间', dataIndex: 'createdAt', width: 150 },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>异常工单协同</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>发起工单</Button>
      </Space>
      <Card size="small">
        <Tabs
          items={[
            { key: 'all', label: `全部（${visible.length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus()} columns={columns as any} /> },
            { key: 'open', label: `待处理（${byStatus('open').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('open')} columns={columns as any} /> },
            { key: 'processing', label: `处理中（${byStatus('processing').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('processing')} columns={columns as any} /> },
            { key: 'resolved', label: `待确认（${byStatus('resolved').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('resolved')} columns={columns as any} /> },
            { key: 'closed', label: `已关闭（${byStatus('closed').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('closed')} columns={columns as any} /> },
          ]}
        />
      </Card>

      <Modal
        title="发起异常工单" open={creating} onCancel={() => setCreating(false)}
        onOk={create} confirmLoading={busy} width={600} okText="发起"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="异常类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={allowedTypes.map(t => ({ value: t, label: TICKET_TYPE_LABEL[t] }))} placeholder="选择异常类型" />
          </Form.Item>
          <Form.Item name="submissionId" label="关联排期单" rules={[{ required: true, message: '请选择排期单' }]}>
            <Select
              showSearch optionFilterProp="label"
              options={submissions.filter(s => s.status !== 'rejected').map(s => ({ value: s.id, label: `${s.code} ${s.title}（${s.roadSegment}）` }))}
            />
          </Form.Item>
          <Form.Item name="title" label="工单标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="如：LG-03 画面被大风吹破" />
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true, message: '请填写描述' }]}>
            <Input.TextArea rows={3} placeholder="时间、位置、现场情况、影响范围" />
          </Form.Item>
          <Form.Item name="rectification" label="整改要求">
            <Input placeholder="如：48 小时内更换破损画面" />
          </Form.Item>
          <Form.Item name="deadline" label="整改期限">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="photos" label="现场照片">
            <PhotoUpload max={4} />
          </Form.Item>
        </Form>
      </Modal>

      <TicketDrawer ticket={detail} open={!!detail} onClose={() => setDetail(null)} />
    </div>
  );
}
