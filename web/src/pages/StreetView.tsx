import { useState } from 'react';
import { Alert, Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useStore } from '../store';
import { TICKET_TYPE_LABEL } from '../dict';
import { Submission, Ticket } from '../types';
import { SubStatusTag, SubTypeTag, TicketStatusTag, TicketTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';
import TicketDrawer from '../components/TicketDrawer';

/** 街道视角：公益比例达成 + 市容风险监控 */
export default function StreetView() {
  const { submissions, tickets, tasks } = useStore();
  const [sub, setSub] = useState<Submission | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const displaying = submissions.filter(s => ['installing', 'pending_acceptance', 'accepted', 'settled'].includes(s.status));
  const commercial = displaying.filter(s => s.type === 'commercial');
  const ratioOk = commercial.filter(s => s.publicRatio >= 30).length;
  const ratioViolations = tickets.filter(t => t.type === 'ratio_violation' && t.status !== 'closed').length;
  const openTickets = tickets.filter(t => t.status !== 'closed');

  // 市容风险点：遮挡交通标识 / 影响行人 的现场上报
  const riskReports = tasks.filter(t => t.report && (t.report.blocksTrafficSign || t.report.affectsPedestrians));

  const ticketTypeCount = openTickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <Typography.Title level={4}>市容与公益监控（街道视角）</Typography.Title>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="在展排期单" value={displaying.length} suffix="单" /></Card></Col>
        <Col span={6}>
          <Card>
            <Statistic title="商业广告公益比例达标" value={commercial.length ? `${ratioOk}/${commercial.length}` : '—'} />
            <Progress percent={commercial.length ? Math.round(ratioOk / commercial.length * 100) : 100} size="small" status={ratioViolations ? 'exception' : 'active'} />
          </Card>
        </Col>
        <Col span={6}><Card><Statistic title="市容风险工单（未闭环）" value={openTickets.length} suffix="件" valueStyle={{ color: openTickets.length ? '#cf1322' : '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="现场风险上报" value={riskReports.length} suffix="处" valueStyle={{ color: riskReports.length ? '#faad14' : '#3f8600' }} /></Card></Col>
      </Row>

      {ratioViolations > 0 && (
        <Alert style={{ marginTop: 16 }} type="error" showIcon
          message={`发现 ${ratioViolations} 起「公益时段未按比例展示」未闭环工单，请督促广告公司整改。`} />
      )}

      <Card title="在展排期公益比例" size="small" style={{ marginTop: 16 }}>
        <Table
          rowKey="id" size="small" dataSource={displaying}
          columns={[
            { title: '单号', dataIndex: 'code', width: 115 },
            { title: '标题', dataIndex: 'title', render: (v, s) => <a onClick={() => setSub(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
            { title: '路段', dataIndex: 'roadSegment', width: 120 },
            {
              title: '公益比例', dataIndex: 'publicRatio', width: 200,
              render: (v, s) => (
                <span>
                  <Progress percent={v} size="small" style={{ width: 120, display: 'inline-block', marginRight: 8 }} />
                  {s.type === 'commercial' && v < 30 ? <Tag color="error">不达标</Tag> : <Tag color="success">达标</Tag>}
                </span>
              ),
            },
            { title: '公益时段', dataIndex: 'publicSlots', ellipsis: true },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <SubStatusTag s={v} /> },
          ]}
        />
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title="市容风险工单" size="small">
            <Table
              rowKey="id" size="small" dataSource={openTickets}
              columns={[
                { title: '工单号', dataIndex: 'code', width: 110 },
                { title: '类型', dataIndex: 'type', width: 160, render: v => <TicketTypeTag t={v} /> },
                { title: '标题', dataIndex: 'title', render: (v, t) => <a onClick={() => setTicket(t)}>{v}</a>, ellipsis: true },
                { title: '状态', dataIndex: 'status', width: 80, render: v => <TicketStatusTag s={v} /> },
              ]}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="风险类型分布" size="small">
            {Object.entries(ticketTypeCount).length ? Object.entries(ticketTypeCount).map(([type, count]) => (
              <div key={type} style={{ marginBottom: 8 }}>
                <Tag color="volcano">{TICKET_TYPE_LABEL[type as keyof typeof TICKET_TYPE_LABEL]}</Tag>
                <b>{count}</b> 件未闭环
              </div>
            )) : <Typography.Text type="success">当前无未闭环市容风险</Typography.Text>}
            {riskReports.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginTop: 12 }}>现场风险上报</Typography.Title>
                {riskReports.map(t => (
                  <div key={t.id} style={{ marginBottom: 6 }}>
                    · {t.roadSegment} {t.hoardingNo}：
                    {t.report!.blocksTrafficSign && <Tag color="error">遮挡交通标识</Tag>}
                    {t.report!.affectsPedestrians && <Tag color="error">影响行人通行</Tag>}
                  </div>
                ))}
              </>
            )}
          </Card>
        </Col>
      </Row>

      <SubmissionDetail submission={sub} open={!!sub} onClose={() => setSub(null)} />
      <TicketDrawer ticket={ticket} open={!!ticket} onClose={() => setTicket(null)} />
    </div>
  );
}
