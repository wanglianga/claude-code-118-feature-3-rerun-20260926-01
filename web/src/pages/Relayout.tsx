import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal,
  Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import {
  COST_BEARER_LABEL, COST_BEARER_SHORT, RELAYOUT_REASON_LABEL, RELAYOUT_STATUS_COLOR, RELAYOUT_STATUS_LABEL,
} from '../dict';
import { Relayout, RelayoutPreview, Submission } from '../types';
import { KindTag } from '../components/Tags';

const ELIGIBLE_STATUS = ['approved', 'installing', 'pending_acceptance', 'accepted'];

/** 围挡重排：施工方调整边界 → 页面重算 → 广告公司确认 → 合同/任务/验收同步 + 合同变更记录 */
export default function RelayoutPage() {
  const { user, submissions, relayouts, contractChanges, tasks, act } = useStore();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Relayout | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RelayoutPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const subOf = (r: Relayout) => submissions.find(s => s.id === r.submissionId);

  // 角色可见范围：施工队看自己工地的，广告公司/街道看自己提交的，财务看全部
  const visible = useMemo(() => {
    if (!user) return [];
    if (user.role === 'finance' || user.role === 'reviewer') return relayouts;
    if (user.role === 'construction') {
      const mySubs = submissions.filter(s => s.constructionTeamId === user.id).map(s => s.id);
      return relayouts.filter(r => mySubs.includes(r.submissionId));
    }
    const mySubs = submissions.filter(s => s.submitterId === user.id).map(s => s.id);
    return relayouts.filter(r => mySubs.includes(r.submissionId));
  }, [user, relayouts, submissions]);

  const visibleChanges = useMemo(() => {
    const ids = new Set(visible.map(r => r.id));
    return contractChanges.filter(c => ids.has(c.relayoutId));
  }, [visible, contractChanges]);

  // 可发起重排的排期单：本施工队负责、审核通过后且未结算、无待确认重排
  const candidates = useMemo(() => {
    if (!user) return [];
    return submissions.filter(s =>
      s.constructionTeamId === user.id &&
      ELIGIBLE_STATUS.includes(s.status) &&
      !relayouts.some(r => r.submissionId === s.id && r.status === 'pending_confirm'));
  }, [user, submissions, relayouts]);

  const onSelectSubmission = (id: string) => {
    const s = submissions.find(x => x.id === id);
    setPreview(null);
    if (s) {
      form.setFieldsValue({
        newHoardingNos: [...s.hoardingNos],
        newLength: s.hoardingLength,
        newInstallDate: dayjs(s.plannedInstallDate),
      });
    }
  };

  const runPreview = async () => {
    const values = await form.validateFields(['submissionId', 'newHoardingNos', 'newLength', 'reason']);
    setPreviewing(true);
    try {
      const r = await api.previewRelayout({
        submissionId: values.submissionId,
        newHoardingNos: values.newHoardingNos,
        newLength: values.newLength,
        reason: values.reason,
      });
      setPreview(r.preview);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    setBusy(true);
    try {
      await act(() => api.createRelayout({
        submissionId: values.submissionId,
        newHoardingNos: values.newHoardingNos,
        newLength: values.newLength,
        newInstallDate: values.newInstallDate.format('YYYY-MM-DD'),
        reason: values.reason,
        responsibility: values.responsibility,
        note: values.note,
      }));
      message.success('重排单已发起，待广告公司确认');
      setCreating(false);
      setPreview(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = (r: Relayout) => {
    Modal.confirm({
      title: '确认围挡重排？',
      content: `确认后合同长度 ${r.oldLength}→${r.newLength} 米，安装任务与验收清单同步更新，责任说明进入合同变更记录。`,
      okText: '确认重排',
      onOk: async () => {
        try {
          await act(() => api.confirmRelayout(r.id));
          message.success('已确认：合同面积、安装任务、验收清单已同步更新');
          setDetail(null);
        } catch (e: any) {
          message.error(e.message);
        }
      },
    });
  };

  const reject = (r: Relayout) => {
    let note = '';
    Modal.confirm({
      title: '驳回围挡重排',
      content: <Input.TextArea rows={2} placeholder="驳回原因（可选）" onChange={e => { note = e.target.value; }} />,
      okText: '确认驳回',
      onOk: async () => {
        try {
          await act(() => api.rejectRelayout(r.id, note));
          message.success('已驳回该重排单');
          setDetail(null);
        } catch (e: any) {
          message.error(e.message);
        }
      },
    });
  };

  const columns = [
    { title: '重排单号', dataIndex: 'code', width: 115 },
    {
      title: '关联排期', ellipsis: true,
      render: (_: unknown, r: Relayout) => { const s = subOf(r); return s ? `${s.code} ${s.title}` : r.submissionId; },
    },
    { title: '变更原因', dataIndex: 'reason', width: 110, render: (v: Relayout['reason']) => <Tag color="volcano">{RELAYOUT_REASON_LABEL[v]}</Tag> },
    { title: '边界长度', width: 110, render: (_: unknown, r: Relayout) => `${r.oldLength}→${r.newLength}m` },
    { title: '受影响画面', dataIndex: 'affectedCreatives', width: 100, render: (v: Relayout['affectedCreatives']) => v.length ? <Tag color="warning">{v.length} 幅</Tag> : '无' },
    { title: '拆装任务', dataIndex: 'reinstallTaskCount', width: 85, render: (v: number) => v ? `${v} 个` : '—' },
    { title: '拆装费用', dataIndex: 'reinstallCost', width: 100, render: (v: number) => v > 0 ? `¥${v}` : '—' },
    { title: '费用承担', dataIndex: 'costBearer', width: 90, render: (v: Relayout['costBearer']) => COST_BEARER_SHORT[v] },
    { title: '状态', dataIndex: 'status', width: 120, render: (v: Relayout['status']) => <Tag color={RELAYOUT_STATUS_COLOR[v]}>{RELAYOUT_STATUS_LABEL[v]}</Tag> },
    { title: '发起', width: 140, render: (_: unknown, r: Relayout) => `${r.raisedByName} ${r.createdAt}` },
    { title: '操作', width: 90, render: (_: unknown, r: Relayout) => <Button size="small" onClick={() => setDetail(r)}>详情</Button> },
  ];

  const canConfirm = (r: Relayout) => {
    const s = subOf(r);
    return r.status === 'pending_confirm' && s && s.submitterId === user?.id;
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>工地改围挡重排</Typography.Title>
        {user?.role === 'construction' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreating(true); setPreview(null); form.resetFields(); }}>发起重排</Button>
        )}
      </Space>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="施工方临时调整围挡边界时，页面自动重算可用广告长度、受影响画面与安装时间；广告公司确认后，合同面积、安装任务与验收清单同步更新，已安装受影响画面生成拆装任务，费用由变更原因决定，责任说明进入合同变更记录。" />
      <Card size="small">
        <Tabs
          items={[
            {
              key: 'relayouts',
              label: `重排单（${visible.length}）`,
              children: <Table rowKey="id" size="small" dataSource={visible} columns={columns as any} />,
            },
            {
              key: 'changes',
              label: `合同变更记录（${visibleChanges.length}）`,
              children: (
                <Table
                  rowKey="id" size="small" dataSource={visibleChanges}
                  columns={[
                    { title: '变更编号', dataIndex: 'code', width: 115 },
                    {
                      title: '关联排期', ellipsis: true,
                      render: (_, c) => { const s = submissions.find(x => x.id === c.submissionId); return s ? `${s.code} ${s.title}` : c.submissionId; },
                    },
                    { title: '合同长度', width: 110, render: (_, c) => `${c.oldContractLength}→${c.newContractLength}m` },
                    { title: '合同面积', width: 130, render: (_, c) => `${c.oldContractArea}→${c.newContractArea}m²` },
                    { title: '费用承担', dataIndex: 'costBearer', width: 90, render: v => COST_BEARER_SHORT[v as keyof typeof COST_BEARER_SHORT] },
                    { title: '拆装费用', dataIndex: 'reinstallCost', width: 95, render: v => v > 0 ? `¥${v}` : '—' },
                    { title: '广告公司扣款', dataIndex: 'adCompanyDeduction', width: 105, render: v => v > 0 ? <span style={{ color: '#cf1322' }}>¥{v}</span> : '—' },
                    { title: '单独结算', dataIndex: 'separateAmount', width: 95, render: v => v > 0 ? <span style={{ color: '#1677ff' }}>¥{v}</span> : '—' },
                    { title: '责任说明', dataIndex: 'responsibility', ellipsis: true },
                    { title: '确认', width: 150, render: (_, c) => `${c.confirmedByName} ${c.time}` },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 发起重排 */}
      <Modal
        title="发起围挡重排（临时调整围挡边界）" open={creating}
        onCancel={() => { setCreating(false); setPreview(null); }} onOk={create}
        confirmLoading={busy} width={720} okText="提交重排单"
      >
        <Form form={form} layout="vertical" initialValues={{ reason: 'construction' }}>
          <Form.Item name="submissionId" label="选择排期单（本队负责、审核通过后且未结算）" rules={[{ required: true, message: '请选择排期单' }]}>
            <Select
              showSearch optionFilterProp="label" placeholder="选择工地排期单" onChange={onSelectSubmission}
              options={candidates.map(s => ({ value: s.id, label: `${s.code} ${s.title}（${s.roadSegment}，${s.hoardingLength}m）` }))}
            />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="newHoardingNos" label="新围挡编号（调整后）" rules={[{ required: true, message: '请填写新围挡编号' }]} style={{ minWidth: 320 }}>
              <Select mode="tags" placeholder="如 WJ-01，回车添加多个" open={false} suffixIcon={null} />
            </Form.Item>
            <Form.Item name="newLength" label="新边界长度（米）" rules={[{ required: true, message: '请填写新边界长度' }]}>
              <InputNumber min={0.5} step={0.5} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="newInstallDate" label="重排后安装/拆装时间" rules={[{ required: true, message: '请选择时间' }]}>
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="reason" label="变更原因（决定拆装费用责任）" rules={[{ required: true }]} style={{ minWidth: 280 }}>
              <Select options={Object.entries(RELAYOUT_REASON_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item label=" " style={{ marginBottom: 0 }}>
              <Button icon={<SwapOutlined />} loading={previewing} onClick={runPreview}>重算预览</Button>
            </Form.Item>
          </Space>
          <Form.Item name="responsibility" label="责任说明（将进入合同变更记录，广告公司可查看）" rules={[{ required: true, message: '请填写责任说明' }]}>
            <Input.TextArea rows={2} placeholder="如：地铁管线迁改导致围挡内缩，拆装费用由施工方承担，单独结算" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="现场其他说明（可选）" />
          </Form.Item>
        </Form>
        {preview && <PreviewBlock preview={preview} />}
      </Modal>

      {/* 重排单详情 / 确认 */}
      <Drawer width={680} open={!!detail} onClose={() => setDetail(null)}
        title={detail ? <Space>{detail.code}<Tag color={RELAYOUT_STATUS_COLOR[detail.status]}>{RELAYOUT_STATUS_LABEL[detail.status]}</Tag></Space> : ''}>
        {detail && (
          <>
            <Typography.Title level={5}>一、调整内容</Typography.Title>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="关联排期">{(() => { const s = subOf(detail); return s ? `${s.code} ${s.title}` : detail.submissionId; })()}</Descriptions.Item>
              <Descriptions.Item label="变更原因"><Tag color="volcano">{RELAYOUT_REASON_LABEL[detail.reason]}</Tag></Descriptions.Item>
              <Descriptions.Item label="原围挡编号">{detail.oldHoardingNos.join('、')}</Descriptions.Item>
              <Descriptions.Item label="新围挡编号">{detail.newHoardingNos.join('、')}</Descriptions.Item>
              <Descriptions.Item label="边界长度">{detail.oldLength} → <b>{detail.newLength}</b> 米</Descriptions.Item>
              <Descriptions.Item label="重排后安装时间">{detail.newInstallDate}</Descriptions.Item>
              {detail.removedNos.length > 0 && <Descriptions.Item label="移除编号"><Tag color="error">{detail.removedNos.join('、')}</Tag></Descriptions.Item>}
              {detail.addedNos.length > 0 && <Descriptions.Item label="新增编号"><Tag color="success">{detail.addedNos.join('、')}</Tag></Descriptions.Item>}
              {detail.note && <Descriptions.Item label="备注" span={2}>{detail.note}</Descriptions.Item>}
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 20 }}>二、页面重算结果</Typography.Title>
            <Row gutter={16}>
              <Col span={8}><Statistic title="重排后可用广告长度" value={detail.availableLength} suffix="m" /></Col>
              <Col span={8}><Statistic title="受影响画面" value={detail.affectedCreatives.length} suffix="幅" valueStyle={{ color: detail.affectedCreatives.length ? '#faad14' : '#3f8600' }} /></Col>
              <Col span={8}><Statistic title="拆装费用" value={detail.reinstallCost} prefix="¥" valueStyle={{ color: detail.reinstallCost ? '#cf1322' : '#3f8600' }} /></Col>
            </Row>
            <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
              <Descriptions.Item label="受影响画面" span={2}>
                {detail.affectedCreatives.length ? detail.affectedCreatives.map(c => (
                  <div key={c.id}>· <KindTag k={c.kind} />{c.title}（{c.width}m，{c.reason}）</div>
                )) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="将取消的未安装任务">{detail.cancelTaskCount} 个</Descriptions.Item>
              <Descriptions.Item label="已安装受影响 → 拆装任务">{detail.reinstallTaskCount} 个</Descriptions.Item>
              <Descriptions.Item label="费用承担" span={2}>{COST_BEARER_LABEL[detail.costBearer]}</Descriptions.Item>
              {detail.adCompanyDeduction > 0 && (
                <Descriptions.Item label="广告公司扣款" span={2}><Typography.Text type="danger">¥{detail.adCompanyDeduction}（计入合同扣款）</Typography.Text></Descriptions.Item>
              )}
              {detail.separateAmount > 0 && (
                <Descriptions.Item label="单独结算金额" span={2}><Typography.Text style={{ color: '#1677ff' }}>¥{detail.separateAmount}（不占广告公司合同款）</Typography.Text></Descriptions.Item>
              )}
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 20 }}>三、责任说明（进入合同变更记录）</Typography.Title>
            <Alert type="warning" showIcon message={detail.responsibility} />

            <Typography.Title level={5} style={{ marginTop: 20 }}>四、流转信息</Typography.Title>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="发起方">{detail.raisedByName}</Descriptions.Item>
              <Descriptions.Item label="发起时间">{detail.createdAt}</Descriptions.Item>
              {detail.confirmedByName && <Descriptions.Item label="确认方">{detail.confirmedByName}</Descriptions.Item>}
              {detail.confirmedAt && <Descriptions.Item label="确认时间">{detail.confirmedAt}</Descriptions.Item>}
              {detail.rejectNote && <Descriptions.Item label="驳回原因" span={2}>{detail.rejectNote}</Descriptions.Item>}
            </Descriptions>

            {canConfirm(detail) && (
              <Space style={{ marginTop: 20 }}>
                <Button type="primary" onClick={() => confirm(detail)}>确认重排（同步合同/任务/验收）</Button>
                <Button danger onClick={() => reject(detail)}>驳回</Button>
              </Space>
            )}
            {detail.status === 'pending_confirm' && !canConfirm(detail) && (
              <Alert style={{ marginTop: 20 }} type="info" showIcon message="等待排期单提交单位（广告公司/街道）确认" />
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

/** 重算预览结果块（发起前） */
function PreviewBlock({ preview }: { preview: RelayoutPreview }) {
  return (
    <Card size="small" title="重算预览（提交后以服务端重算为准）" style={{ background: '#fafafa' }}>
      <Row gutter={16}>
        <Col span={6}><Statistic title="可用广告长度" value={preview.availableLength} suffix="m" /></Col>
        <Col span={6}><Statistic title="受影响画面" value={preview.affectedCreatives.length} suffix="幅" valueStyle={{ color: preview.affectedCreatives.length ? '#faad14' : '#3f8600' }} /></Col>
        <Col span={6}><Statistic title="拆装任务" value={preview.reinstallTaskCount} suffix="个" /></Col>
        <Col span={6}><Statistic title="拆装费用" value={preview.reinstallCost} prefix="¥" valueStyle={{ color: preview.reinstallCost ? '#cf1322' : '#3f8600' }} /></Col>
      </Row>
      <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
        {preview.affectedCreatives.length > 0 && (
          <Descriptions.Item label="受影响画面">
            {preview.affectedCreatives.map(c => c.title).join('、')}
          </Descriptions.Item>
        )}
        {preview.removedNos.length > 0 && <Descriptions.Item label="移除编号">{preview.removedNos.join('、')}</Descriptions.Item>}
        {preview.addedNos.length > 0 && <Descriptions.Item label="新增编号">{preview.addedNos.join('、')}</Descriptions.Item>}
        {preview.cancelTaskCount > 0 && <Descriptions.Item label="将取消任务">{preview.cancelTaskCount} 个（未安装）</Descriptions.Item>}
        <Descriptions.Item label="费用承担">{COST_BEARER_LABEL[preview.bearer]}</Descriptions.Item>
        {preview.adCompanyDeduction > 0 && <Descriptions.Item label="广告公司扣款">¥{preview.adCompanyDeduction}</Descriptions.Item>}
        {preview.separateAmount > 0 && <Descriptions.Item label="单独结算">¥{preview.separateAmount}</Descriptions.Item>}
      </Descriptions>
    </Card>
  );
}
