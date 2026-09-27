import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space,
  Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { useStore } from '../store';
import { api } from '../api';
import {
  REASON_RESPONSIBILITY, REPLAN_REASON_LABEL, REPLAN_STATUS_COLOR, REPLAN_STATUS_LABEL,
  RESPONSIBILITY_COLOR, RESPONSIBILITY_LABEL,
} from '../dict';
import { Replan, ReplanReason, Submission } from '../types';
import { computeReplanPreview, REINSTALL_UNIT_PRICE, todayStr } from '../replan';
import { KindTag } from '../components/Tags';

const REPLAN_ALLOWED_STATUS = ['approved', 'installing', 'pending_acceptance', 'accepted'];

/** 工地改围挡重排：施工方调整边界 → 页面重算 → 广告公司确认 → 合同/任务/验收同步，拆装费按责任单独结算 */
export default function ReplansPage() {
  const { user, replans, submissions, tasks, act } = useStore();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Replan | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  // 与当前角色相关的重排单
  const visible = useMemo(() => {
    if (!user) return [];
    if (['reviewer', 'street', 'finance', 'inspector'].includes(user.role)) return replans;
    if (user.role === 'construction') {
      const mySubs = submissions.filter(s => s.constructionTeamId === user.id).map(s => s.id);
      return replans.filter(r => mySubs.includes(r.submissionId) || r.raisedBy === user.id);
    }
    if (user.role === 'ad_company') {
      const mySubs = submissions.filter(s => s.submitterId === user.id).map(s => s.id);
      return replans.filter(r => mySubs.includes(r.submissionId));
    }
    return replans.filter(r => submissions.find(s => s.id === r.submissionId)?.merchantId === user.id);
  }, [user, replans, submissions]);

  const pendingCost = visible.filter(r => r.costSettlement?.status === 'pending');
  const settledCost = visible.filter(r => r.costSettlement?.status === 'settled');

  // ---------- 发起重排（施工队） ----------
  const watchSubId: string | undefined = Form.useWatch('submissionId', form);
  const watchNewLength: number | undefined = Form.useWatch('newLength', form);
  const watchNos: string[] | undefined = Form.useWatch('newHoardingNos', form);
  const watchReason: ReplanReason | undefined = Form.useWatch('reason', form);

  const candidateSubs = submissions.filter(s =>
    s.constructionTeamId === user?.id && REPLAN_ALLOWED_STATUS.includes(s.status)
    && !replans.some(r => r.submissionId === s.id && r.status === 'pending_confirm'));
  const watchSub = candidateSubs.find(s => s.id === watchSubId);

  const preview = useMemo(() => {
    if (!watchSub || !(Number(watchNewLength) > 0)) return null;
    return computeReplanPreview(
      watchSub,
      tasks.filter(t => t.submissionId === watchSub.id),
      Number(watchNewLength),
      watchNos,
      todayStr(),
    );
  }, [watchSub, watchNewLength, watchNos, tasks]);

  const openCreate = () => {
    form.resetFields();
    setCreating(true);
  };

  const onSubChange = (id: string) => {
    const s = candidateSubs.find(x => x.id === id);
    if (s) form.setFieldsValue({ newLength: s.hoardingLength, newHoardingNos: s.hoardingNos });
  };

  const onLengthChange = (v: number | null) => {
    if (!watchSub || !(v && v > 0)) return;
    // 边界长度变化时自动建议围挡编号（可再手工调整）
    const seg = watchSub.hoardingLength / watchSub.hoardingNos.length;
    const keep = Math.max(1, Math.ceil(v / seg - 1e-9));
    const suggested = v >= watchSub.hoardingLength ? watchSub.hoardingNos : watchSub.hoardingNos.slice(0, keep);
    form.setFieldsValue({ newHoardingNos: suggested });
  };

  const create = async () => {
    const values = await form.validateFields();
    setBusy(true);
    try {
      await act(() => api.createReplan(values.submissionId, {
        newLength: values.newLength,
        newHoardingNos: values.newHoardingNos,
        reason: values.reason,
        responsibilityStatement: values.responsibilityStatement,
      }));
      message.success('重排单已发起，待广告公司确认；页面已重算可用广告长度、受影响画面与安装时间');
      setCreating(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- 详情操作 ----------
  const subOf = (r: Replan) => submissions.find(s => s.id === r.submissionId);
  const canConfirm = (r: Replan) => user?.role === 'ad_company' && r.status === 'pending_confirm' && subOf(r)?.submitterId === user.id;
  const canSettle = (r: Replan) => user?.role === 'finance' && r.status === 'confirmed' && r.costSettlement?.status === 'pending';

  const confirm = (r: Replan) => {
    Modal.confirm({
      title: '确认围挡重排？',
      content: `确认后合同面积、安装任务与验收清单将同步更新；已安装受影响画面生成拆装任务，责任说明进入合同变更记录。`,
      okText: '确认重排',
      onOk: async () => {
        try {
          await act(() => api.confirmReplan(r.id));
          message.success('重排已确认：合同面积、安装任务、验收清单已同步更新');
          setDetail(null);
        } catch (e: any) {
          message.error(e.message);
        }
      },
    });
  };

  const reject = (r: Replan) => {
    let note = '';
    Modal.confirm({
      title: '驳回围挡重排',
      content: <Input.TextArea rows={3} placeholder="驳回说明（必填）" onChange={e => { note = e.target.value; }} />,
      okText: '驳回',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!note.trim()) { message.error('请填写驳回说明'); return Promise.reject(); }
        try {
          await act(() => api.rejectReplan(r.id, note.trim()));
          message.success('已驳回该重排单');
          setDetail(null);
        } catch (e: any) {
          message.error(e.message);
          return Promise.reject();
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
        try {
          await act(() => api.settleReplanCost(r.id));
          message.success('拆装费用已单独结算');
        } catch (e: any) {
          message.error(e.message);
        }
      },
    });
  };

  const taskOf = (id: string) => tasks.find(t => t.id === id);

  const columns = [
    { title: '重排单号', dataIndex: 'code', width: 115, render: (v: string, r: Replan) => <a onClick={() => setDetail(r)}>{v}</a> },
    {
      title: '关联排期', ellipsis: true,
      render: (_: unknown, r: Replan) => { const s = subOf(r); return s ? `${s.code} ${s.title}` : r.submissionId; },
    },
    { title: '变更原因', dataIndex: 'reason', width: 130, render: (v: ReplanReason) => REPLAN_REASON_LABEL[v] },
    {
      title: '边界调整', width: 130,
      render: (_: unknown, r: Replan) => <span>{r.oldLength}m <SwapOutlined /> <b>{r.newLength}m</b></span>,
    },
    {
      title: '受影响画面', width: 110,
      render: (_: unknown, r: Replan) => r.affectedCreatives.length ? <Tag color="orange">{r.affectedCreatives.length} 幅</Tag> : '无',
    },
    {
      title: '拆装费/责任方', width: 150,
      render: (_: unknown, r: Replan) => r.reinstallCost > 0
        ? <span>¥{r.reinstallCost} <Tag color={RESPONSIBILITY_COLOR[r.responsibility]}>{RESPONSIBILITY_LABEL[r.responsibility]}</Tag></span>
        : '—',
    },
    {
      title: '状态', dataIndex: 'status', width: 125,
      render: (v: Replan['status']) => <Tag color={REPLAN_STATUS_COLOR[v]}>{REPLAN_STATUS_LABEL[v]}</Tag>,
    },
    { title: '发起', width: 140, render: (_: unknown, r: Replan) => `${r.raisedByName} ${r.createdAt.slice(5)}` },
    {
      title: '操作', width: 150,
      render: (_: unknown, r: Replan) => (
        <Space>
          <Button size="small" onClick={() => setDetail(r)}>详情</Button>
          {canConfirm(r) && <Button size="small" type="primary" onClick={() => confirm(r)}>确认</Button>}
          {canSettle(r) && <Button size="small" type="primary" onClick={() => settleCost(r)}>结算费用</Button>}
        </Space>
      ),
    },
  ];

  const byStatus = (st?: string) => st ? visible.filter(r => r.status === st) : visible;

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>工地改围挡重排</Typography.Title>
        {user?.role === 'construction' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>发起围挡重排</Button>
        )}
      </Space>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="施工方临时调整围挡边界时，页面自动重算可用广告长度、受影响画面与安装时间；广告公司确认后，合同面积、安装任务与验收清单同步更新，已安装受影响画面生成拆装任务，费用按变更原因确定责任方，责任说明进入合同变更记录；施工方原因造成的拆装费由财务单独结算。"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="待确认重排" value={visible.filter(r => r.status === 'pending_confirm').length} suffix="单" valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已确认重排" value={visible.filter(r => r.status === 'confirmed').length} suffix="单" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待结算拆装费" value={pendingCost.reduce((s, r) => s + (r.costSettlement?.amount || 0), 0)} prefix="¥" valueStyle={{ color: pendingCost.length ? '#cf1322' : '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已结算拆装费" value={settledCost.reduce((s, r) => s + (r.costSettlement?.amount || 0), 0)} prefix="¥" valueStyle={{ color: '#1677ff' }} /></Card></Col>
      </Row>
      <Card size="small">
        <Tabs
          items={[
            { key: 'all', label: `全部（${visible.length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus()} columns={columns as any} /> },
            { key: 'pending_confirm', label: `待确认（${byStatus('pending_confirm').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('pending_confirm')} columns={columns as any} /> },
            { key: 'confirmed', label: `已确认（${byStatus('confirmed').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('confirmed')} columns={columns as any} /> },
            { key: 'rejected', label: `已驳回（${byStatus('rejected').length}）`, children: <Table rowKey="id" size="small" dataSource={byStatus('rejected')} columns={columns as any} /> },
          ]}
        />
      </Card>

      {/* 发起重排 */}
      <Modal
        title="发起围挡重排（施工方临时调整围挡边界）" open={creating} onCancel={() => setCreating(false)}
        onOk={create} confirmLoading={busy} width={720} okText="发起重排"
      >
        <Form form={form} layout="vertical" initialValues={{ reason: 'construction_adjust' }}>
          <Form.Item name="submissionId" label="选择排期单（本队负责的工地）" rules={[{ required: true, message: '请选择排期单' }]}>
            <Select
              showSearch optionFilterProp="label" placeholder="选择需要调整围挡边界的排期单" onChange={onSubChange}
              options={candidateSubs.map(s => ({ value: s.id, label: `${s.code} ${s.title}（${s.roadSegment}，现 ${s.hoardingLength}m）` }))}
            />
          </Form.Item>
          <Space size="large" wrap align="start">
            <Form.Item name="newLength" label="调整后围挡边界长度（米）" rules={[{ required: true, message: '请填写调整后长度' }]}>
              <InputNumber min={1} step={1} style={{ width: 180 }} onChange={onLengthChange} />
            </Form.Item>
            <Form.Item name="reason" label="变更原因（决定拆装费用责任方）" rules={[{ required: true }]} style={{ minWidth: 280 }}>
              <Select options={Object.entries(REPLAN_REASON_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            {watchReason && (
              <Form.Item label="拆装费用责任方">
                <Tag color={RESPONSIBILITY_COLOR[REASON_RESPONSIBILITY[watchReason]]} style={{ marginTop: 6 }}>
                  {RESPONSIBILITY_LABEL[REASON_RESPONSIBILITY[watchReason]]}承担
                </Tag>
              </Form.Item>
            )}
          </Space>
          <Form.Item name="newHoardingNos" label="调整后围挡编号（按长度自动建议，可修改）" rules={[{ required: true, message: '请确认调整后围挡编号' }]}>
            <Select mode="tags" placeholder="围挡编号" open={false} suffixIcon={null} />
          </Form.Item>
          <Form.Item name="responsibilityStatement" label="责任说明（将进入合同变更记录）" rules={[{ required: true, message: '请填写责任说明' }, { min: 5, message: '不少于 5 个字' }]}>
            <Input.TextArea rows={2} placeholder="如：施工方因地下管线迁改，围挡内收 20 米；已安装画面拆装费用由施工方承担并单独结算" />
          </Form.Item>
        </Form>
        {preview && watchSub && (
          <Alert
            type="warning" showIcon message="页面重算结果（确认后以服务端重算为准）"
            description={
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={6}><Statistic title="可用广告长度" value={preview.availableLength} suffix="m" /></Col>
                <Col span={6}>
                  <Statistic title="受影响画面" value={preview.affectedCreatives.length} suffix="幅"
                    valueStyle={{ color: preview.affectedCreatives.length ? '#cf1322' : '#3f8600' }} />
                  {preview.affectedCreatives.length > 0 && (
                    <div style={{ marginTop: 4 }}>{preview.affectedCreatives.map(c => <KindTag key={c.id} k={c.kind} />)}</div>
                  )}
                </Col>
                <Col span={6}><Statistic title="预计安装完成" value={preview.estimatedInstallDate} suffix={`(${preview.estimatedDays}天)`} /></Col>
                <Col span={6}>
                  <Statistic title={`预计拆装费（¥${REINSTALL_UNIT_PRICE}/m²）`} value={preview.reinstallCost} prefix="¥"
                    valueStyle={{ color: preview.reinstallCost > 0 ? '#cf1322' : '#3f8600' }} />
                  {preview.affectedInstalledLength > 0 && <div style={{ fontSize: 12, color: '#999' }}>已安装受影响 {preview.affectedInstalledLength}m</div>}
                </Col>
              </Row>
            }
          />
        )}
      </Modal>

      {/* 重排详情 */}
      <Drawer width={760} open={!!detail} onClose={() => setDetail(null)}
        title={detail ? <Space>{detail.code}<Tag color={REPLAN_STATUS_COLOR[detail.status]}>{REPLAN_STATUS_LABEL[detail.status]}</Tag></Space> : ''}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="关联排期单">{(() => { const s = subOf(detail); return s ? `${s.code} ${s.title}` : detail.submissionId; })()}</Descriptions.Item>
              <Descriptions.Item label="发起方">{detail.raisedByName}（{detail.createdAt}）</Descriptions.Item>
              <Descriptions.Item label="变更原因">{REPLAN_REASON_LABEL[detail.reason]}</Descriptions.Item>
              <Descriptions.Item label="拆装费用责任方">
                <Tag color={RESPONSIBILITY_COLOR[detail.responsibility]}>{RESPONSIBILITY_LABEL[detail.responsibility]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="围挡边界">{detail.oldLength}m → <b>{detail.newLength}m</b></Descriptions.Item>
              <Descriptions.Item label="围挡编号">{detail.oldHoardingNos.join('、')} → {detail.newHoardingNos.join('、')}</Descriptions.Item>
              <Descriptions.Item label="责任说明（合同变更记录）" span={2}>
                <Typography.Text strong>{detail.responsibilityStatement}</Typography.Text>
              </Descriptions.Item>
              {detail.rejectNote && <Descriptions.Item label="驳回说明" span={2}><Typography.Text type="danger">{detail.rejectNote}</Typography.Text></Descriptions.Item>}
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 20 }}>页面重算结果</Typography.Title>
            <Row gutter={16}>
              <Col span={6}><Statistic title="可用广告长度" value={detail.availableLength} suffix="m" /></Col>
              <Col span={6}><Statistic title="已安装受影响长度" value={detail.affectedInstalledLength} suffix="m" valueStyle={{ color: detail.affectedInstalledLength ? '#cf1322' : '#3f8600' }} /></Col>
              <Col span={6}><Statistic title="预计安装完成" value={detail.estimatedInstallDate} suffix={`(${detail.estimatedDays}天)`} /></Col>
              <Col span={6}><Statistic title="拆装费用" value={detail.reinstallCost} prefix="¥" valueStyle={{ color: detail.reinstallCost ? '#cf1322' : '#3f8600' }} /></Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Typography.Text strong>受影响画面（{detail.affectedCreatives.length} 幅）：</Typography.Text>
              {detail.affectedCreatives.length
                ? <Space wrap style={{ marginLeft: 8 }}>{detail.affectedCreatives.map(c => <span key={c.id}><KindTag k={c.kind} />{c.title}</span>)}</Space>
                : <span> 无</span>}
            </div>
            {detail.affectedPanels.length > 0 && (
              <Table
                rowKey={(p: any) => `${p.creativeId}-${p.start}`} size="small" style={{ marginTop: 8 }} pagination={false}
                dataSource={detail.affectedPanels}
                columns={[
                  { title: '画面', dataIndex: 'title' },
                  { title: '类型', dataIndex: 'kind', width: 90, render: (v: any) => <KindTag k={v} /> },
                  { title: '占位区间', width: 140, render: (_: unknown, p: any) => `${p.start}m ~ ${p.end}m` },
                ]}
              />
            )}

            {detail.status === 'confirmed' && (
              <>
                <Typography.Title level={5} style={{ marginTop: 20 }}>确认后同步结果</Typography.Title>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="合同面积">
                    合同长度 {detail.oldLength}m → {detail.newLength}m（合同面积同步更新）
                  </Descriptions.Item>
                  <Descriptions.Item label={`拆装任务（${detail.reinstallTaskIds.length}）`}>
                    {detail.reinstallTaskIds.length ? detail.reinstallTaskIds.map(id => {
                      const t = taskOf(id);
                      return t ? <div key={id}>· {t.code} {t.roadSegment} {t.hoardingNo}：{t.affectedCreatives}，费用 ¥{t.cost}（{RESPONSIBILITY_LABEL[t.costBearer || 'construction']}承担）</div> : null;
                    }) : '无已安装受影响画面，未生成拆装任务'}
                  </Descriptions.Item>
                  <Descriptions.Item label={`取消的安装任务（${detail.cancelledTaskIds.length}）`}>
                    {detail.cancelledTaskIds.length ? detail.cancelledTaskIds.map(id => {
                      const t = taskOf(id);
                      return t ? <span key={id} style={{ marginRight: 12 }}>{t.code}（{t.hoardingNo}）</span> : null;
                    }) : '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label={`新增的安装任务（${detail.newTaskIds.length}）`}>
                    {detail.newTaskIds.length ? detail.newTaskIds.map(id => {
                      const t = taskOf(id);
                      return t ? <span key={id} style={{ marginRight: 12 }}>{t.code}（{t.hoardingNo}）</span> : null;
                    }) : '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="拆装费用单独结算">
                    {detail.costSettlement
                      ? <Space>
                          ¥{detail.costSettlement.amount}（{RESPONSIBILITY_LABEL[detail.costSettlement.bearer]}承担）
                          {detail.costSettlement.status === 'settled'
                            ? <Tag color="success">已结算（{detail.costSettlement.settledBy} {detail.costSettlement.settledAt}）</Tag>
                            : <Tag color="gold">待财务单独结算</Tag>}
                        </Space>
                      : '无拆装费用'}
                  </Descriptions.Item>
                  <Descriptions.Item label="确认信息">
                    {detail.confirmedByName} 于 {detail.confirmedAt} 确认；责任说明已进入合同变更记录
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            {(canConfirm(detail) || canSettle(detail)) && (
              <Space style={{ marginTop: 20 }}>
                {canConfirm(detail) && (
                  <>
                    <Button type="primary" onClick={() => confirm(detail)}>确认重排（同步合同/任务/验收）</Button>
                    <Button danger onClick={() => reject(detail)}>驳回</Button>
                  </>
                )}
                {canSettle(detail) && <Button type="primary" onClick={() => settleCost(detail)}>单独结算拆装费 ¥{detail.costSettlement?.amount}</Button>}
              </Space>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
