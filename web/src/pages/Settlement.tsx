import { useState } from 'react';
import { Button, Card, Col, Descriptions, Drawer, Modal, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { Acceptance } from '../types';
import { ROLE_LABEL } from '../dict';

/** 结算中心：财务确认结算；广告公司查看可结算面积与扣款明细 */
export default function SettlementPage() {
  const { user, acceptances, submissions, act } = useStore();
  const [detail, setDetail] = useState<Acceptance | null>(null);
  const [busy, setBusy] = useState(false);

  const isFinance = user?.role === 'finance';
  const mySubs = submissions.filter(s => s.submitterId === user?.id).map(s => s.id);
  const visible = isFinance ? acceptances : acceptances.filter(a => mySubs.includes(a.submissionId));

  const subOf = (a: Acceptance) => submissions.find(s => s.id === a.submissionId);

  const settle = (a: Acceptance) => {
    Modal.confirm({
      title: '确认结算？',
      content: `验收单 ${a.code}：应结算 ¥${a.settleAmount}（毛额 ¥${a.grossAmount} − 扣款 ¥${a.totalDeduction}）`,
      onOk: async () => {
        setBusy(true);
        try {
          await act(() => api.settle(a.id));
          message.success('结算完成，排期单已归档为「已结算」');
        } catch (e: any) {
          message.error(e.message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <div>
      <Typography.Title level={4}>结算中心{isFinance ? '（财务）' : '（广告公司）'}</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="可结算面积合计" value={visible.reduce((s, a) => s + a.commercialArea, 0)} suffix="m²" precision={1} /></Card></Col>
        <Col span={6}><Card><Statistic title="扣款合计" value={visible.reduce((s, a) => s + a.totalDeduction, 0)} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待结算金额" value={visible.filter(a => a.status === 'pending_finance').reduce((s, a) => s + a.settleAmount, 0)} prefix="¥" valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已结算金额" value={visible.filter(a => a.status === 'settled').reduce((s, a) => s + a.settleAmount, 0)} prefix="¥" valueStyle={{ color: '#3f8600' }} /></Card></Col>
      </Row>
      <Card size="small">
        <Table
          rowKey="id" size="small" dataSource={visible}
          columns={[
            { title: '验收单号', dataIndex: 'code', width: 115 },
            { title: '排期单', render: (_, a) => { const s = subOf(a); return s ? <a onClick={() => setDetail(a)}>{s.code} {s.title}</a> : a.submissionId; }, ellipsis: true },
            { title: '验收长度', dataIndex: 'acceptedLength', width: 90, render: (v, a) => `${v}/${a.contractLength}m` },
            { title: '可结算面积', dataIndex: 'settleableArea', width: 100, render: v => `${v}m²` },
            { title: '商业面积', dataIndex: 'commercialArea', width: 95, render: v => `${v}m²` },
            { title: '扣款', dataIndex: 'totalDeduction', width: 90, render: v => v > 0 ? <span style={{ color: '#cf1322' }}>¥{v}</span> : '无' },
            { title: '应结算', dataIndex: 'settleAmount', width: 110, render: v => <b>¥{v}</b> },
            { title: '状态', dataIndex: 'status', width: 95, render: v => v === 'settled' ? <Tag color="success">已结算</Tag> : <Tag color="gold">待结算</Tag> },
            {
              title: '操作', width: 150,
              render: (_, a) => (
                <Space>
                  <Button size="small" onClick={() => setDetail(a)}>明细</Button>
                  {isFinance && a.status === 'pending_finance' && (
                    <Button size="small" type="primary" loading={busy} onClick={() => settle(a)}>确认结算</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer width={680} open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `结算明细：${detail.code}` : ''}>
        {detail && (
          <>
            <Row gutter={16}>
              <Col span={8}><Statistic title="可结算面积" value={detail.settleableArea} suffix="m²" /></Col>
              <Col span={8}><Statistic title="公益面积（不结算）" value={detail.publicArea} suffix="m²" /></Col>
              <Col span={8}><Statistic title="商业结算面积" value={detail.commercialArea} suffix="m²" /></Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={8}><Statistic title="毛额（面积×单价）" value={detail.grossAmount} prefix="¥" /></Col>
              <Col span={8}><Statistic title="扣款合计" value={detail.totalDeduction} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Col>
              <Col span={8}><Statistic title="应结算金额" value={detail.settleAmount} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Col>
            </Row>
            <Descriptions bordered size="small" column={1} style={{ marginTop: 16 }}>
              <Descriptions.Item label="扣款明细">
                {detail.deductions.length ? detail.deductions.map((d, i) => (
                  <div key={i}>· {d.reason}：<Typography.Text type="danger">¥{d.amount}</Typography.Text></div>
                )) : '无扣款'}
              </Descriptions.Item>
              <Descriptions.Item label="整改项">
                {detail.rectifications.length ? detail.rectifications.map(r => (
                  <div key={r.id}>· [{r.status === 'done' ? '已完成' : '待整改'}] {r.desc}（{ROLE_LABEL[r.assigneeRole]}，限 {r.deadline}）</div>
                )) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="后续巡检计划">
                {detail.inspectionPlan.map(p => (
                  <div key={p.id}>· {p.date} {p.focus}（{p.status === 'done' ? '已完成' : '待巡检'}）</div>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="验收意见">{detail.comment || '—'}</Descriptions.Item>
              <Descriptions.Item label="结算状态">
                {detail.status === 'settled' ? `已结算（${detail.settledBy} ${detail.settledAt}）` : '待财务结算'}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
}
