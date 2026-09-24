import { useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useStore } from '../store';
import { api } from '../api';
import { Submission } from '../types';
import { SubStatusTag, SubTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';

/** 验收中心：核对实际安装长度，生成可结算面积、扣款、整改项与后续巡检计划 */
export default function AcceptancePage() {
  const { submissions, tasks, tickets, users, act } = useStore();
  const [current, setCurrent] = useState<Submission | null>(null);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const pending = submissions.filter(s => s.status === 'pending_acceptance');
  const inspectors = users.filter(u => u.role === 'inspector');

  const openAccept = (s: Submission) => {
    const myTasks = tasks.filter(t => t.submissionId === s.id);
    const actual = myTasks.reduce((sum, t) => sum + (t.report?.actualLength || 0), 0);
    setCurrent(s);
    form.setFieldsValue({
      acceptedLength: actual,
      inspectionIntervalDays: 7,
      inspectionCount: 4,
      inspectorId: inspectors[0]?.id,
      rectifications: [],
      comment: '',
    });
  };

  const doAccept = async () => {
    if (!current) return;
    const values = await form.validateFields();
    setBusy(true);
    try {
      const r: any = await act(() => api.accept(current.id, values));
      message.success(`验收完成：可结算面积 ${r.acceptance.settleableArea}m²，扣款 ¥${r.acceptance.totalDeduction}，已生成巡检计划`);
      setCurrent(null);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const curTasks = current ? tasks.filter(t => t.submissionId === current.id) : [];
  const curActual = curTasks.reduce((sum, t) => sum + (t.report?.actualLength || 0), 0);
  const curOpenTickets = current ? tickets.filter(t => t.submissionId === current.id && t.status !== 'closed') : [];

  return (
    <div>
      <Typography.Title level={4}>验收中心</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="验收将汇总安装实际上报长度，自动核算可结算面积与扣款（含验收长度与合同不符的违约扣款），并生成整改项与后续巡检计划。" />
      <Card title={`待验收（${pending.length}）`} size="small">
        <Table
          rowKey="id" size="small" dataSource={pending}
          columns={[
            { title: '单号', dataIndex: 'code', width: 120 },
            { title: '标题', dataIndex: 'title', render: (v, s) => <a onClick={() => setDetail(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
            { title: '路段', dataIndex: 'roadSegment', width: 120 },
            { title: '合同长度', dataIndex: 'contractLength', width: 90, render: v => `${v}m` },
            {
              title: '实际上报', width: 100,
              render: (_, s) => {
                const actual = tasks.filter(t => t.submissionId === s.id).reduce((sum, t) => sum + (t.report?.actualLength || 0), 0);
                return <span style={{ color: Math.abs(actual - s.contractLength) > 0.5 ? '#cf1322' : undefined }}>{actual}m</span>;
              },
            },
            {
              title: '未闭环工单', width: 100,
              render: (_, s) => {
                const n = tickets.filter(t => t.submissionId === s.id && t.status !== 'closed').length;
                return n ? <Tag color="error">{n} 件</Tag> : '无';
              },
            },
            { title: '操作', width: 110, render: (_, s) => <Button type="primary" size="small" onClick={() => openAccept(s)}>办理验收</Button> },
          ]}
        />
      </Card>

      <Card title="已验收 / 结算中的排期" size="small" style={{ marginTop: 16 }}>
        <Table
          rowKey="id" size="small"
          dataSource={submissions.filter(s => ['accepted', 'settled'].includes(s.status))}
          columns={[
            { title: '单号', dataIndex: 'code', width: 120 },
            { title: '标题', dataIndex: 'title', render: (v, s) => <a onClick={() => setDetail(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
            { title: '路段', dataIndex: 'roadSegment', width: 120 },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <SubStatusTag s={v} /> },
          ]}
        />
      </Card>

      <Modal
        title={current ? `办理验收：${current.code} ${current.title}` : ''}
        open={!!current} onCancel={() => setCurrent(null)} onOk={doAccept}
        confirmLoading={busy} width={720} okText="确认验收并生成结算"
      >
        {current && (
          <>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={6}><Statistic title="合同长度" value={current.contractLength} suffix="m" /></Col>
              <Col span={6}><Statistic title="实际上报" value={curActual} suffix="m" valueStyle={{ color: Math.abs(curActual - current.contractLength) > 0.5 ? '#cf1322' : '#3f8600' }} /></Col>
              <Col span={6}><Statistic title="围挡高度" value={current.height} suffix="m" /></Col>
              <Col span={6}><Statistic title="未闭环工单" value={curOpenTickets.length} suffix="件" valueStyle={{ color: curOpenTickets.length ? '#cf1322' : '#3f8600' }} /></Col>
            </Row>
            {Math.abs(curActual - current.contractLength) > 0.5 && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={`验收长度与合同不符（差 ${(current.contractLength - curActual).toFixed(1)}m），将自动生成「验收长度与合同不符」工单并按 1.2 倍违约系数扣款。`} />
            )}
            {curOpenTickets.length > 0 && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={`存在 ${curOpenTickets.length} 件未闭环工单，其整改要求将自动并入验收整改项。`} />
            )}
            <Form form={form} layout="vertical">
              <Space size="large" wrap>
                <Form.Item name="acceptedLength" label="验收长度（米）" rules={[{ required: true, message: '请填写验收长度' }]}>
                  <InputNumberSafe />
                </Form.Item>
                <Form.Item name="inspectorId" label="后续巡检员" rules={[{ required: true }]}>
                  <Select style={{ width: 200 }} options={inspectors.map(i => ({ value: i.id, label: `${i.name}（${i.org}）` }))} />
                </Form.Item>
                <Form.Item name="inspectionIntervalDays" label="巡检间隔（天）" rules={[{ required: true }]}>
                  <InputNumber min={1} max={30} style={{ width: 110 }} />
                </Form.Item>
                <Form.Item name="inspectionCount" label="巡检次数" rules={[{ required: true }]}>
                  <InputNumber min={1} max={12} style={{ width: 90 }} />
                </Form.Item>
              </Space>
              <Form.Item name="comment" label="验收意见">
                <Input.TextArea rows={2} placeholder="画面质量、照明、现场遗留问题等" />
              </Form.Item>
              <Form.List name="rectifications">
                {(fields, { add, remove }) => (
                  <>
                    <Typography.Text strong>补充整改项（未闭环工单会自动并入）</Typography.Text>
                    {fields.map(field => (
                      <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 8 }}>
                        <Form.Item name={[field.name, 'desc']} rules={[{ required: true, message: '整改内容' }]} noStyle>
                          <Input placeholder="整改内容" style={{ width: 380 }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'deadline']} initialValue="2026-10-01" noStyle>
                          <Input placeholder="期限 YYYY-MM-DD" style={{ width: 160 }} />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(field.name)} />
                      </Space>
                    ))}
                    <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => add()}>添加整改项</Button>
                  </>
                )}
              </Form.List>
            </Form>
            <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
              <Descriptions.Item label="验收要求">{current.acceptanceRequirements}</Descriptions.Item>
              <Descriptions.Item label="公益比例">{current.publicRatio}%</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      <SubmissionDetail submission={detail} open={!!detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/** InputNumber 的受控封装（避免 Form 注入 warning） */
function InputNumberSafe(props: { value?: number; onChange?: (v: number | null) => void }) {
  return <InputNumber min={0.1} step={0.5} style={{ width: 140 }} value={props.value} onChange={props.onChange} />;
}
