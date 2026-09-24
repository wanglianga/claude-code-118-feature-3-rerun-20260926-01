import { useState } from 'react';
import { Button, Card, Checkbox, Col, Drawer, Descriptions, Form, Image, Input, Row, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { KIND_COLOR, KIND_LABEL, RISK_COLOR, RISK_LABEL, TYPE_LABEL } from '../dict';
import { Submission } from '../types';
import { SubStatusTag, SubTypeTag } from '../components/Tags';

const CHECK_ITEMS: { key: string; label: string }[] = [
  { key: 'dimensionOk', label: '画面尺寸合规' },
  { key: 'textOk', label: '文字内容合规' },
  { key: 'sensitiveOk', label: '无敏感内容' },
  { key: 'themeOk', label: '公益主题符合要求' },
  { key: 'brandOk', label: '品牌露出合规' },
  { key: 'sightOk', label: '不影响道路视线' },
];

/** 审核中心：审核画面尺寸、文字、敏感内容、公益主题、品牌露出、道路视线影响 */
export default function ReviewPage() {
  const { submissions, users, act } = useStore();
  const [current, setCurrent] = useState<Submission | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const pending = submissions.filter(s => s.status === 'pending_review');
  const done = submissions.filter(s => ['approved', 'installing', 'pending_acceptance', 'accepted', 'settled', 'rejected'].includes(s.status) && s.review);

  const submit = async (decision: 'approved' | 'rejected') => {
    const values = await form.validateFields();
    if (!current) return;
    setBusy(true);
    try {
      await act(() => api.review(current.id, { decision, checklist: values.checklist || {}, comment: values.comment || '' }));
      message.success(decision === 'approved' ? '已通过，安装任务已按围挡编号生成' : '已驳回');
      setCurrent(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { title: '单号', dataIndex: 'code', width: 120 },
    { title: '标题', dataIndex: 'title' },
    { title: '类型', dataIndex: 'type', width: 110, render: (v: any) => <SubTypeTag t={v} /> },
    { title: '提交单位', dataIndex: 'submitterOrg', width: 150 },
    { title: '路段', dataIndex: 'roadSegment', width: 120 },
    { title: '公益比例', dataIndex: 'publicRatio', width: 90, render: (v: number, s: Submission) => <Tag color={s.type === 'commercial' && v < 30 ? 'error' : 'green'}>{v}%</Tag> },
    { title: '提交时间', dataIndex: 'createdAt', width: 150 },
    {
      title: '操作', width: 100,
      render: (_: unknown, s: Submission) => <Button type="link" onClick={() => { setCurrent(s); form.resetFields(); }}>审核</Button>,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>审核中心</Typography.Title>
      <Card size="small">
        <Tabs
          items={[
            {
              key: 'pending',
              label: `待审核（${pending.length}）`,
              children: <Table rowKey="id" size="small" dataSource={pending} columns={columns as any} />,
            },
            {
              key: 'done',
              label: `已审核（${done.length}）`,
              children: (
                <Table
                  rowKey="id" size="small" dataSource={done}
                  columns={[
                    { title: '单号', dataIndex: 'code', width: 120 },
                    { title: '标题', dataIndex: 'title' },
                    { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
                    { title: '审核结论', width: 90, render: (_, s: Submission) => s.review ? <Tag color={s.review.decision === 'approved' ? 'success' : 'error'}>{s.review.decision === 'approved' ? '通过' : '驳回'}</Tag> : '—' },
                    { title: '当前状态', dataIndex: 'status', width: 100, render: v => <SubStatusTag s={v} /> },
                    { title: '审核意见', render: (_, s: Submission) => s.review?.comment || '—', ellipsis: true },
                    { title: '操作', width: 90, render: (_, s: Submission) => <Button type="link" onClick={() => { setCurrent(s); form.resetFields(); }}>查看</Button> },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        width={860} open={!!current} onClose={() => setCurrent(null)}
        title={current ? <Space>审核：{current.title}<SubTypeTag t={current.type} /></Space> : ''}
      >
        {current && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="单号">{current.code}</Descriptions.Item>
              <Descriptions.Item label="类型">{TYPE_LABEL[current.type]}</Descriptions.Item>
              <Descriptions.Item label="提交单位">{current.submitterOrg}</Descriptions.Item>
              <Descriptions.Item label="审批单位">{current.approvalUnit}</Descriptions.Item>
              <Descriptions.Item label="工地">{current.siteName}（{current.location}）</Descriptions.Item>
              <Descriptions.Item label="路段 / 编号">{current.roadSegment} / {current.hoardingNos.join('、')}</Descriptions.Item>
              <Descriptions.Item label="围挡规模">{current.hoardingLength}m × {current.height}m</Descriptions.Item>
              <Descriptions.Item label="公益比例"><Tag color={current.type === 'commercial' && current.publicRatio < 30 ? 'error' : 'green'}>{current.publicRatio}%</Tag></Descriptions.Item>
              <Descriptions.Item label="计划安装">{current.plannedInstallDate}</Descriptions.Item>
              <Descriptions.Item label="展示时段">{current.displayStart} ~ {current.displayEnd}</Descriptions.Item>
              <Descriptions.Item label="公益时段" span={2}>{current.publicSlots || '—'}</Descriptions.Item>
              <Descriptions.Item label="夜间照明" span={2}>{current.nightLighting ? `有（${current.lightingDesc || '未说明'}）` : '无'}</Descriptions.Item>
              <Descriptions.Item label="责任施工队" span={2}>
                {users.find(u => u.id === current.constructionTeamId)?.org || current.constructionTeamId}
              </Descriptions.Item>
              <Descriptions.Item label="验收要求" span={2}>{current.acceptanceRequirements}</Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 16 }}>画面审查</Typography.Title>
            <Row gutter={[12, 12]}>
              {current.creatives.map(c => (
                <Col span={12} key={c.id}>
                  <Card size="small" title={<Space><Tag color={KIND_COLOR[c.kind]}>{KIND_LABEL[c.kind]}</Tag>{c.title}</Space>}>
                    {c.imageUrl && <Image src={c.imageUrl} height={110} style={{ width: '100%', objectFit: 'cover' }} />}
                    <Descriptions size="small" column={1} style={{ marginTop: 6 }}>
                      <Descriptions.Item label="尺寸">{c.sizeSpec}</Descriptions.Item>
                      <Descriptions.Item label="文字">{c.textContent || '—'}</Descriptions.Item>
                      {c.theme && <Descriptions.Item label="公益主题">{c.theme}</Descriptions.Item>}
                      {c.brandName && <Descriptions.Item label="品牌">{c.brandName}</Descriptions.Item>}
                      <Descriptions.Item label="敏感自评"><Tag color={RISK_COLOR[c.sensitiveRisk]}>{RISK_LABEL[c.sensitiveRisk]}</Tag></Descriptions.Item>
                      <Descriptions.Item label="视线影响"><Tag color={RISK_COLOR[c.sightImpact]}>{RISK_LABEL[c.sightImpact]}</Tag></Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              ))}
            </Row>

            {current.status === 'pending_review' ? (
              <Card title="审核结论" size="small" style={{ marginTop: 16 }}>
                <Form form={form} layout="vertical">
                  <Form.Item name="checklist" label="逐项核查">
                    <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                      options={CHECK_ITEMS.map(i => ({ label: i.label, value: i.key }))} />
                  </Form.Item>
                  <Form.Item name="comment" label="审核意见">
                    <Input.TextArea rows={3} placeholder="通过可留空；驳回必须说明原因" />
                  </Form.Item>
                  <Space>
                    <Button type="primary" loading={busy} onClick={() => submit('approved')}>审核通过（生成安装任务）</Button>
                    <Button danger loading={busy} onClick={() => submit('rejected')}>驳回</Button>
                  </Space>
                </Form>
              </Card>
            ) : current.review && (
              <Card title="审核结论" size="small" style={{ marginTop: 16 }}>
                <Descriptions size="small" column={2}>
                  {CHECK_ITEMS.map(i => (
                    <Descriptions.Item key={i.key} label={i.label}>
                      {(current.review!.checklist as any)[i.key] ? <Tag color="success">符合</Tag> : <Tag color="error">不符合</Tag>}
                    </Descriptions.Item>
                  ))}
                  <Descriptions.Item label="结论">
                    <Tag color={current.review.decision === 'approved' ? 'success' : 'error'}>{current.review.decision === 'approved' ? '通过' : '驳回'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="意见">{current.review.comment || '—'}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
