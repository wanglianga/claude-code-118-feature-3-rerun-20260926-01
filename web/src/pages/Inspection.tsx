import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Radio, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { INSPECTION_RESULT_LABEL } from '../dict';
import { Inspection } from '../types';
import PhotoUpload from '../components/PhotoUpload';

const RESULT_COLOR: Record<string, string> = { ok: 'success', dirty: 'warning', damaged: 'error', ratio_issue: 'volcano' };

/** 巡检中心：执行验收后生成的巡检计划，异常结果自动生成工单 */
export default function InspectionPage() {
  const { user, inspections, submissions, act } = useStore();
  const [current, setCurrent] = useState<Inspection | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const result = Form.useWatch('result', form);

  const mine = inspections.filter(i => i.inspectorId === user?.id);
  const planned = mine.filter(i => i.status === 'planned');
  const done = mine.filter(i => i.status === 'done');

  const complete = async () => {
    if (!current) return;
    const values = await form.validateFields();
    setBusy(true);
    try {
      const r: any = await act(() => api.completeInspection(current.id, values));
      message.success(r.ticket ? `巡检完成，已自动生成工单 ${r.ticket.code}` : '巡检完成，现场正常');
      setCurrent(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const subOf = (i: Inspection) => submissions.find(s => s.id === i.submissionId);

  return (
    <div>
      <Typography.Title level={4}>巡检中心</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="巡检计划由验收环节自动生成；巡检发现脏污 / 破损 / 公益比例异常时，系统将自动生成异常工单并通知责任方。" />
      <Card size="small">
        <Tabs
          items={[
            {
              key: 'planned', label: `待巡检（${planned.length}）`,
              children: (
                <Table
                  rowKey="id" size="small" dataSource={planned}
                  columns={[
                    { title: '计划日期', dataIndex: 'date', width: 110 },
                    { title: '排期单', render: (_, i) => { const s = subOf(i); return s ? `${s.code} ${s.title}` : i.submissionId; } },
                    { title: '路段', render: (_, i) => subOf(i)?.roadSegment || '—', width: 130 },
                    { title: '巡检重点', dataIndex: 'focus', width: 180 },
                    { title: '操作', width: 110, render: (_, i) => <Button type="primary" size="small" onClick={() => { setCurrent(i); form.resetFields(); }}>执行巡检</Button> },
                  ]}
                />
              ),
            },
            {
              key: 'done', label: `已完成（${done.length}）`,
              children: (
                <Table
                  rowKey="id" size="small" dataSource={done}
                  columns={[
                    { title: '完成时间', dataIndex: 'completedAt', width: 150 },
                    { title: '排期单', render: (_, i) => { const s = subOf(i); return s ? `${s.code} ${s.title}` : i.submissionId; } },
                    { title: '巡检重点', dataIndex: 'focus', width: 160 },
                    { title: '结果', dataIndex: 'result', width: 120, render: v => v ? <Tag color={RESULT_COLOR[v]}>{INSPECTION_RESULT_LABEL[v]}</Tag> : '—' },
                    { title: '备注', dataIndex: 'note', ellipsis: true },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={current ? `执行巡检：${subOf(current)?.title || ''}（${current.date}）` : ''}
        open={!!current} onCancel={() => setCurrent(null)} onOk={complete}
        confirmLoading={busy} okText="提交巡检结果"
      >
        <Form form={form} layout="vertical" initialValues={{ result: 'ok' }}>
          <Form.Item name="result" label="巡检结果" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { value: 'ok', label: '正常' },
                { value: 'dirty', label: '画面脏污' },
                { value: 'damaged', label: '画面破损' },
                { value: 'ratio_issue', label: '公益比例异常' },
              ]}
              optionType="button" buttonStyle="solid"
            />
          </Form.Item>
          {result && result !== 'ok' && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="异常结果提交后将自动生成异常工单（脏污/破损/公益时段未按比例展示）。" />
          )}
          <Form.Item name="note" label="巡检备注">
            <Input.TextArea rows={3} placeholder="现场情况描述" />
          </Form.Item>
          <Form.Item name="photos" label="现场照片">
            <PhotoUpload max={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
