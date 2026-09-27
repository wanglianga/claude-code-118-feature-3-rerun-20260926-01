import { useMemo, useState } from 'react';
import { Alert, Card, Col, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ROLE_LABEL, STATUS_LABEL, TICKET_TYPE_LABEL } from '../dict';
import { SubStatusTag, SubTypeTag, TicketStatusTag, TicketTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';
import TicketDrawer from '../components/TicketDrawer';
import { Submission, Ticket } from '../types';

interface StatItem { title: string; value: number | string; suffix?: string; prefix?: string; to?: string; precision?: number }

/** 角色工作台：巡检员看现场安装与破损整改，广告公司看可结算面积与扣款，街道看公益比例与市容风险 */
export default function Dashboard() {
  const { user, submissions, tasks, tickets, acceptances, inspections, replans } = useStore();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Submission | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const stats = useMemo<StatItem[] | null>(() => {
    if (!user) return null;
    const openTickets = tickets.filter(t => t.status !== 'closed');
    switch (user.role) {
      case 'reviewer':
        return [
          { title: '待审核排期单', value: submissions.filter(s => s.status === 'pending_review').length, suffix: '单', to: '/review' },
          { title: '待验收排期单', value: submissions.filter(s => s.status === 'pending_acceptance').length, suffix: '单', to: '/acceptance' },
          { title: '未闭环工单', value: openTickets.length, suffix: '件', to: '/tickets' },
        ];
      case 'construction': {
        const mine = tasks.filter(t => t.teamId === user.id);
        return [
          { title: '可领取任务', value: mine.filter(t => t.status === 'pending').length, suffix: '个', to: '/tasks' },
          { title: '安装中（已领取）', value: mine.filter(t => t.status === 'claimed').length, suffix: '个', to: '/tasks' },
          { title: '已上报待验收', value: mine.filter(t => t.status === 'reported').length, suffix: '个', to: '/tasks' },
          { title: '待我整改工单', value: openTickets.filter(t => ['wind_damage', 'dirty'].includes(t.type)).length, suffix: '件', to: '/tickets' },
          { title: '我发起的重排', value: replans.filter(r => r.raisedBy === user.id).length, suffix: '单', to: '/replans' },
        ];
      }
      case 'inspector':
        return [
          { title: '待巡检计划', value: inspections.filter(i => i.status === 'planned' && i.inspectorId === user.id).length, suffix: '次', to: '/inspection' },
          { title: '现场安装进行中', value: submissions.filter(s => s.status === 'installing').length, suffix: '处', to: '/schedule' },
          { title: '破损/脏污未闭环', value: openTickets.filter(t => ['wind_damage', 'dirty'].includes(t.type)).length, suffix: '件', to: '/tickets' },
        ];
      case 'ad_company': {
        const mine = submissions.filter(s => s.submitterId === user.id);
        const myAccIds = mine.map(s => s.id);
        const myAccs = acceptances.filter(a => myAccIds.includes(a.submissionId));
        return [
          { title: '我的排期单', value: mine.length, suffix: '单', to: '/submit' },
          { title: '可结算面积', value: myAccs.reduce((sum, a) => sum + a.commercialArea, 0), suffix: 'm²', to: '/settlement', precision: 1 },
          { title: '扣款合计', value: myAccs.reduce((sum, a) => sum + a.totalDeduction, 0), prefix: '¥', to: '/settlement' },
          { title: '待结算金额', value: myAccs.filter(a => a.status === 'pending_finance').reduce((sum, a) => sum + a.settleAmount, 0), prefix: '¥', to: '/settlement' },
          { title: '待确认重排', value: replans.filter(r => r.status === 'pending_confirm' && myAccIds.includes(r.submissionId)).length, suffix: '单', to: '/replans' },
        ];
      }
      case 'street': {
        const displaying = submissions.filter(s => ['installing', 'pending_acceptance', 'accepted', 'settled'].includes(s.status));
        const okRatio = displaying.filter(s => s.publicRatio >= 30 || s.type !== 'commercial').length;
        return [
          { title: '在展排期单', value: displaying.length, suffix: '单', to: '/street' },
          { title: '公益比例达标', value: `${okRatio}/${displaying.length}`, suffix: '', to: '/street' },
          { title: '市容风险工单', value: openTickets.length, suffix: '件', to: '/street' },
          { title: '待验收', value: submissions.filter(s => s.status === 'pending_acceptance').length, suffix: '单', to: '/acceptance' },
        ];
      }
      case 'merchant': {
        const mine = submissions.filter(s => s.merchantId === user.id);
        return [
          { title: '我的广告排期', value: mine.length, suffix: '单', to: '/merchant' },
          { title: '展示中', value: mine.filter(s => ['installing', 'pending_acceptance', 'accepted', 'settled'].includes(s.status)).length, suffix: '单', to: '/merchant' },
          { title: '我的撤换/工单', value: tickets.filter(t => t.raisedBy === user.id && t.status !== 'closed').length, suffix: '件', to: '/tickets' },
        ];
      }
      case 'finance':
        return [
          { title: '待结算验收单', value: acceptances.filter(a => a.status === 'pending_finance').length, suffix: '单', to: '/settlement' },
          { title: '已结算金额', value: acceptances.filter(a => a.status === 'settled').reduce((sum, a) => sum + a.settleAmount, 0), prefix: '¥', to: '/settlement' },
          { title: '扣款合计', value: acceptances.reduce((sum, a) => sum + a.totalDeduction, 0), prefix: '¥', to: '/settlement' },
          { title: '待核定扣款工单', value: tickets.filter(t => t.status !== 'closed' && t.deductionAmount === 0).length, suffix: '件', to: '/tickets' },
          { title: '待结算拆装费', value: replans.filter(r => r.costSettlement?.status === 'pending').length, suffix: '笔', to: '/settlement' },
        ];
      default:
        return [];
    }
  }, [user, submissions, tasks, tickets, acceptances, inspections, replans]);

  if (!user) return null;
  const recentTickets = tickets.filter(t => t.status !== 'closed').slice(0, 6);
  const activeSubs = submissions.filter(s => !['rejected', 'settled'].includes(s.status)).slice(0, 6);

  return (
    <div>
      <Typography.Title level={4}>{ROLE_LABEL[user.role]}工作台 · {user.name}</Typography.Title>
      <Row gutter={[16, 16]}>
        {stats?.map((s, i) => (
          <Col span={6} key={i}>
            <Card hoverable onClick={() => navigate(s.to || '/')}>
              <Statistic title={s.title} value={s.value} suffix={s.suffix} prefix={s.prefix} precision={s.precision || 0} />
            </Card>
          </Col>
        ))}
      </Row>

      {user.role === 'street' && (
        <Alert style={{ marginTop: 16 }} type="warning" showIcon
          message="市容风险提示"
          description={`当前有 ${tickets.filter(t => t.status !== 'closed').length} 件未闭环异常工单，涉及公益比例、画面破损、脏污等市容风险，请到「市容与公益」跟进。`}
        />
      )}
      {user.role === 'inspector' && (
        <Alert style={{ marginTop: 16 }} type="info" showIcon
          message="现场视角"
          description="您可关注「现场安装进行中」的工地与破损/脏污整改工单；验收后生成的巡检计划请在「巡检中心」按期执行。"
        />
      )}
      {user.role === 'ad_company' && (
        <Alert style={{ marginTop: 16 }} type="info" showIcon
          message="结算视角"
          description="「可结算面积」= 验收长度 × 围挡高度 ×（1 − 公益比例）；扣款来自异常工单核定与验收长度差异，明细见「结算中心」。"
        />
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="进行中的排期" size="small">
            <List
              size="small"
              dataSource={activeSubs}
              renderItem={s => (
                <List.Item style={{ cursor: 'pointer' }} onClick={() => setSub(s)}>
                  <Space><SubTypeTag t={s.type} />{s.title}</Space>
                  <Space><Typography.Text type="secondary">{STATUS_LABEL[s.status]}</Typography.Text><SubStatusTag s={s.status} /></Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="未闭环异常工单" size="small">
            <List
              size="small"
              dataSource={recentTickets}
              locale={{ emptyText: '暂无未闭环工单' }}
              renderItem={t => (
                <List.Item style={{ cursor: 'pointer' }} onClick={() => setTicket(t)}>
                  <Space><TicketTypeTag t={t.type} />{t.title}</Space>
                  <TicketStatusTag s={t.status} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <SubmissionDetail submission={sub} open={!!sub} onClose={() => setSub(null)} />
      <TicketDrawer ticket={ticket} open={!!ticket} onClose={() => setTicket(null)} />
    </div>
  );
}
