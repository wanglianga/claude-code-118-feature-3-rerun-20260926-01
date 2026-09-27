import { Card, Col, Descriptions, Drawer, Image, Row, Space, Statistic, Table, Tag, Timeline, Typography } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { useStore } from '../store';
import { Submission } from '../types';
import { REPLAN_REASON_LABEL, RESPONSIBILITY_COLOR, RESPONSIBILITY_LABEL, RISK_COLOR, RISK_LABEL, ROLE_LABEL, TYPE_LABEL } from '../dict';
import { KindTag, SubStatusTag, SubTypeTag, TaskStatusTag, TicketStatusTag, TicketTypeTag } from './Tags';

const Check = ({ ok }: { ok: boolean }) =>
  ok ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : <CloseCircleFilled style={{ color: '#ff4d4f' }} />;

/** 排期单全景详情：提交信息 / 画面 / 审核 / 安装 / 工单 / 验收结算 / 流转记录 */
export default function SubmissionDetail({ submission, open, onClose }: { submission: Submission | null; open: boolean; onClose: () => void }) {
  const { users, tasks, tickets, acceptances } = useStore();
  if (!submission) return null;
  const s = submission;
  const team = users.find(u => u.id === s.constructionTeamId);
  const merchant = users.find(u => u.id === s.merchantId);
  const myTasks = tasks.filter(t => t.submissionId === s.id);
  const myTickets = tickets.filter(t => t.submissionId === s.id);
  const acc = acceptances.find(a => a.submissionId === s.id);
  const actualTotal = myTasks.reduce((sum, t) => sum + (t.report?.actualLength || 0), 0);

  return (
    <Drawer
      width={860} open={open} onClose={onClose}
      title={<Space>{s.title}<SubTypeTag t={s.type} /><SubStatusTag s={s.status} /></Space>}
    >
      <Typography.Title level={5}>一、提交信息（广告公司/街道填报）</Typography.Title>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="排期单号">{s.code}</Descriptions.Item>
        <Descriptions.Item label="类型">{TYPE_LABEL[s.type]}</Descriptions.Item>
        <Descriptions.Item label="提交单位">{s.submitterOrg}</Descriptions.Item>
        <Descriptions.Item label="提交时间">{s.createdAt}</Descriptions.Item>
        <Descriptions.Item label="工地名称">{s.siteName}</Descriptions.Item>
        <Descriptions.Item label="工地位置">{s.location}</Descriptions.Item>
        <Descriptions.Item label="路段">{s.roadSegment}</Descriptions.Item>
        <Descriptions.Item label="围挡编号">{s.hoardingNos.join('、')}</Descriptions.Item>
        <Descriptions.Item label="围挡长度">{s.hoardingLength} 米</Descriptions.Item>
        <Descriptions.Item label="围挡高度">{s.height} 米</Descriptions.Item>
        <Descriptions.Item label="公益比例"><Tag color="green">{s.publicRatio}%</Tag></Descriptions.Item>
        <Descriptions.Item label="审批单位">{s.approvalUnit}</Descriptions.Item>
        <Descriptions.Item label="计划安装时间">{s.plannedInstallDate}</Descriptions.Item>
        <Descriptions.Item label="展示时段">{s.displayStart} ~ {s.displayEnd}</Descriptions.Item>
        <Descriptions.Item label="公益时段说明" span={2}>{s.publicSlots || '—'}</Descriptions.Item>
        <Descriptions.Item label="夜间照明">
          {s.nightLighting ? <Tag color="blue">有</Tag> : <Tag>无</Tag>}
          {s.lightingDesc || ''}
        </Descriptions.Item>
        <Descriptions.Item label="责任施工队">{team ? `${team.org}（${team.name}）` : s.constructionTeamId}</Descriptions.Item>
        <Descriptions.Item label="验收要求" span={2}>{s.acceptanceRequirements}</Descriptions.Item>
        {merchant && <Descriptions.Item label="商户">{merchant.org}（{merchant.name}）</Descriptions.Item>}
        {s.unitPrice > 0 && (
          <>
            <Descriptions.Item label="合同长度">{s.contractLength} 米</Descriptions.Item>
            <Descriptions.Item label="商业单价">{s.unitPrice} 元/m²</Descriptions.Item>
          </>
        )}
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 24 }}>二、画面清单（{s.creatives.length} 幅）</Typography.Title>
      <Row gutter={[12, 12]}>
        {s.creatives.map(c => (
          <Col span={12} key={c.id}>
            <Card size="small" title={<Space><KindTag k={c.kind} />{c.title}</Space>}>
              {c.imageUrl && <Image src={c.imageUrl} height={120} style={{ objectFit: 'cover', width: '100%' }} />}
              <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                <Descriptions.Item label="画面尺寸">{c.sizeSpec}</Descriptions.Item>
                <Descriptions.Item label="画面文字">{c.textContent || '—'}</Descriptions.Item>
                {c.theme && <Descriptions.Item label="公益主题">{c.theme}</Descriptions.Item>}
                {c.brandName && <Descriptions.Item label="品牌露出">{c.brandName}</Descriptions.Item>}
                <Descriptions.Item label="敏感内容自评"><Tag color={RISK_COLOR[c.sensitiveRisk]}>{RISK_LABEL[c.sensitiveRisk]}</Tag></Descriptions.Item>
                <Descriptions.Item label="道路视线影响"><Tag color={RISK_COLOR[c.sightImpact]}>{RISK_LABEL[c.sightImpact]}</Tag></Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        ))}
      </Row>

      {s.review && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>三、审核结论</Typography.Title>
          <Descriptions bordered size="small" column={3}>
            <Descriptions.Item label="画面尺寸合规"><Check ok={s.review.checklist.dimensionOk} /></Descriptions.Item>
            <Descriptions.Item label="文字内容合规"><Check ok={s.review.checklist.textOk} /></Descriptions.Item>
            <Descriptions.Item label="无敏感内容"><Check ok={s.review.checklist.sensitiveOk} /></Descriptions.Item>
            <Descriptions.Item label="公益主题符合"><Check ok={s.review.checklist.themeOk} /></Descriptions.Item>
            <Descriptions.Item label="品牌露出合规"><Check ok={s.review.checklist.brandOk} /></Descriptions.Item>
            <Descriptions.Item label="不影响道路视线"><Check ok={s.review.checklist.sightOk} /></Descriptions.Item>
            <Descriptions.Item label="审核结果" span={2}>
              <Tag color={s.review.decision === 'approved' ? 'success' : 'error'}>{s.review.decision === 'approved' ? '通过' : '驳回'}</Tag>
              {s.review.time}
            </Descriptions.Item>
            <Descriptions.Item label="审核意见" span={3}>{s.review.comment || '—'}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {myTasks.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>四、安装任务（按路段 + 围挡编号领取）</Typography.Title>
          <Table
            size="small" rowKey="id" pagination={false}
            dataSource={myTasks}
            columns={[
              { title: '任务号', dataIndex: 'code', width: 110 },
              { title: '类型', dataIndex: 'kind', width: 60, render: v => v === 'reinstall' ? <Tag color="orange">拆装</Tag> : <Tag>安装</Tag> },
              { title: '路段', dataIndex: 'roadSegment' },
              { title: '围挡编号', dataIndex: 'hoardingNo', width: 90 },
              { title: '状态', dataIndex: 'status', width: 80, render: v => <TaskStatusTag s={v} /> },
              { title: '实际长度', width: 90, render: (_, t) => t.report ? `${t.report.actualLength}m` : '—' },
              { title: '缺口', width: 120, render: (_, t) => t.report?.gaps || '—' },
              { title: '遮挡交通标识', width: 100, render: (_, t) => t.report ? (t.report.blocksTrafficSign ? <Tag color="error">是</Tag> : '否') : '—' },
              { title: '影响行人', width: 80, render: (_, t) => t.report ? (t.report.affectsPedestrians ? <Tag color="error">是</Tag> : '否') : '—' },
            ]}
          />
          {actualTotal > 0 && <Typography.Text type="secondary">实际上报合计：{actualTotal} 米（合同 {s.contractLength} 米）</Typography.Text>}
        </>
      )}

      {myTickets.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>五、关联异常工单</Typography.Title>
          <Table
            size="small" rowKey="id" pagination={false}
            dataSource={myTickets}
            columns={[
              { title: '工单号', dataIndex: 'code', width: 110 },
              { title: '类型', dataIndex: 'type', width: 150, render: v => <TicketTypeTag t={v} /> },
              { title: '标题', dataIndex: 'title' },
              { title: '状态', dataIndex: 'status', width: 80, render: v => <TicketStatusTag s={v} /> },
              { title: '扣款', dataIndex: 'deductionAmount', width: 90, render: v => v > 0 ? `¥${v}` : '—' },
            ]}
          />
        </>
      )}

      {acc && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>六、验收与结算（{acc.code}）</Typography.Title>
          <Row gutter={16}>
            <Col span={6}><Statistic title="可结算面积" value={acc.settleableArea} suffix="m²" /></Col>
            <Col span={6}><Statistic title="其中公益面积" value={acc.publicArea} suffix="m²" valueStyle={{ color: '#3f8600' }} /></Col>
            <Col span={6}><Statistic title="扣款合计" value={acc.totalDeduction} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Col>
            <Col span={6}><Statistic title="应结算金额" value={acc.settleAmount} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Col>
          </Row>
          <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
            <Descriptions.Item label="验收长度">{acc.acceptedLength} 米</Descriptions.Item>
            <Descriptions.Item label="合同长度">{acc.contractLength} 米</Descriptions.Item>
            <Descriptions.Item label="验收人">{acc.acceptedByName}</Descriptions.Item>
            <Descriptions.Item label="验收时间">{acc.createdAt}</Descriptions.Item>
            <Descriptions.Item label="结算状态">
              {acc.status === 'settled'
                ? <Tag color="success">已结算（{acc.settledBy} {acc.settledAt}）</Tag>
                : <Tag color="gold">待财务结算</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="验收意见">{acc.comment || '—'}</Descriptions.Item>
            <Descriptions.Item label="扣款明细" span={2}>
              {acc.deductions.length ? acc.deductions.map((d, i) => (
                <div key={i}>· {d.reason}：<Typography.Text type="danger">¥{d.amount}</Typography.Text></div>
              )) : '无扣款'}
            </Descriptions.Item>
            <Descriptions.Item label="整改项" span={2}>
              {acc.rectifications.length ? acc.rectifications.map(r => (
                <div key={r.id}>· [{r.status === 'done' ? '已完成' : '待整改'}] {r.desc}（{ROLE_LABEL[r.assigneeRole]}，限 {r.deadline}）</div>
              )) : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="后续巡检计划" span={2}>
              {acc.inspectionPlan.map(p => (
                <div key={p.id}>· {p.date} {p.focus}（{p.status === 'done' ? '已完成' : '待巡检'}）</div>
              ))}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}

      {s.contractChanges && s.contractChanges.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>七、合同变更记录（围挡重排）</Typography.Title>
          <Table
            size="small" rowKey="id" pagination={false}
            dataSource={s.contractChanges}
            columns={[
              { title: '时间', dataIndex: 'time', width: 140 },
              { title: '重排单', dataIndex: 'replanCode', width: 115 },
              { title: '变更原因', dataIndex: 'reason', width: 130, render: v => REPLAN_REASON_LABEL[v as keyof typeof REPLAN_REASON_LABEL] },
              {
                title: '合同面积', width: 170,
                render: (_, c) => <span>{c.oldContractLength}m/{c.oldContractArea}m² → <b>{c.newContractLength}m/{c.newContractArea}m²</b></span>,
              },
              {
                title: '拆装费', width: 130,
                render: (_, c) => c.reinstallCost > 0
                  ? <span>¥{c.reinstallCost} <Tag color={RESPONSIBILITY_COLOR[c.responsibility]}>{RESPONSIBILITY_LABEL[c.responsibility]}</Tag></span>
                  : '—',
              },
              { title: '责任说明', dataIndex: 'statement', ellipsis: true },
              { title: '确认人', dataIndex: 'byName', width: 80 },
            ]}
          />
        </>
      )}

      <Typography.Title level={5} style={{ marginTop: 24 }}>流转记录</Typography.Title>
      <Timeline
        items={s.history.map(h => ({
          children: <span><b>{h.time}</b>　{h.byName}：{h.action}{h.note ? `（${h.note}）` : ''}</span>,
        }))}
      />
    </Drawer>
  );
}
