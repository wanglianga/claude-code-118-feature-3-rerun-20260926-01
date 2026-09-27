import { useState } from 'react';
import { Button, Card, Col, Descriptions, Drawer, Modal, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { Acceptance, Replan } from '../types';
import { REPLAN_REASON_LABEL, RESPONSIBILITY_COLOR, RESPONSIBILITY_LABEL, ROLE_LABEL } from '../dict';

/** 结算中心：财务确认结算；广告公司查看可结算面积与扣款明细 */
export default function SettlementPage() {
  const { user, acceptances, submissions, replans, act } = useStore();
  const [detail, setDetail] = useState<Acceptance | null>(null);
  const [busy, setBusy] = useState(false);

  const isFinance = user?.role === 'finance';
  const mySubs = submissions.filter(s => s.submitterId === user?.id).map(s => s.id);
  const visible = isFinance ? acceptances : acceptances.filter(a => mySubs.includes(a.submissionId));
  // 拆装费用单独结算：财务看全部，广告公司看自家排期（含责任说明）
  const costReplans = (isFinance ? replans : replans.filter(r => mySubs.includes(r.submissionId)))
    .filter(r => r.status === 'confirmed' && r.costSettlement);

  const subOf = (a: Acceptance) => submissions.find(s => s.id === a.submissionId);
  const subOfReplan = (r: Replan) => submissions.find(s => s.id === r.submissionId);

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

  const settleCost = (r: Replan) => {
    Modal.confirm({
      title: '单独结算拆装费用？',
      content: `${r.code} 拆装费 ¥${r.costSettlement?.amount}，责任方：${RESPONSIBILITY_LABEL[r.costSettlement?.bearer || 'construction']}。该费用单独结算，不并入广告合同扣款。`,
      okText: '确认结算',
      onOk: async () => {
        setBusy(true);
        try {
          await act(() => api.settleReplanCost(r.id));
          message.success('拆装费用已单独结算');
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

      <Card
        size="small" style={{ marginTop: 16 }}
        title={`围挡重排拆装费用（单独结算，不并入广告合同扣款）${costReplans.length ? `（${costReplans.length}）` : ''}`}
      >
        <Table
          rowKey="id" size="small" dataSource={costReplans}
          locale={{ emptyText: '暂无重排拆装费用' }}
          columns={[
            { title: '重排单号', dataIndex: 'code', width: 115 },
            {
              title: '关联排期', ellipsis: true,
              render: (_, r: Replan) => { const s = subOfReplan(r); return s ? `${s.code} ${s.title}` : r.submissionId; },
            },
            { title: '变更原因', dataIndex: 'reason', width: 130, render: v => REPLAN_REASON_LABEL[v as keyof typeof REPLAN_REASON_LABEL] },
            {
              title: '责任方', width: 100,
              render: (_, r) => <Tag color={RESPONSIBILITY_COLOR[r.costSettlement!.bearer]}>{RESPONSIBILITY_LABEL[r.costSettlement!.bearer]}</Tag>,
            },
            { title: '责任说明', dataIndex: 'responsibilityStatement', ellipsis: true },
            {
              title: '拆装费用', width: 110,
              render: (_, r) => <b style={{ color: '#cf1322' }}>¥{r.costSettlement!.amount}</b>,
            },
            {
              title: '结算状态', width: 150,
              render: (_, r) => r.costSettlement!.status === 'settled'
                ? <Tag color="success">已结算（{r.costSettlement!.settledBy}）</Tag>
                : <Tag color="gold">待单独结算</Tag>,
            },
            {
              title: '操作', width: 110,
              render: (_, r) => isFinance && r.costSettlement!.status === 'pending'
                ? <Button size="small" type="primary" loading={busy} onClick={() => settleCost(r)}>单独结算</Button>
                : null,
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
