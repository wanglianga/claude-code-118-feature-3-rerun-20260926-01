import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { Submission } from '../types';
import { SubStatusTag, SubTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';

/** 商户视角：查看自家广告投放状态，可申请提前撤换 */
export default function MerchantPage() {
  const { user, submissions, acceptances, act } = useStore();
  const [detail, setDetail] = useState<Submission | null>(null);
  const [removal, setRemoval] = useState<Submission | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const mine = submissions.filter(s => s.merchantId === user?.id);

  const applyRemoval = async () => {
    if (!removal) return;
    const values = await form.validateFields();
    setBusy(true);
    try {
      await act(() => api.createTicket({
        type: 'early_removal',
        submissionId: removal.id,
        title: `商户申请提前撤换：${removal.title}`,
        description: values.reason,
        rectification: '广告公司评估提前撤换对排期与结算的影响并给出方案',
      }));
      message.success('提前撤换申请已提交，街道与广告公司将在工单中协同处理');
      setRemoval(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>我的广告投放</Typography.Title>
      <Card size="small">
        <Table
          rowKey="id" size="small" dataSource={mine}
          columns={[
            { title: '单号', dataIndex: 'code', width: 115 },
            { title: '广告排期', dataIndex: 'title', render: (v, s) => <a onClick={() => setDetail(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 100, render: v => <SubTypeTag t={v} /> },
            { title: '路段', dataIndex: 'roadSegment', width: 130 },
            { title: '展示时段', width: 200, render: (_, s) => `${s.displayStart} ~ ${s.displayEnd}` },
            {
              title: '结算情况', width: 140,
              render: (_, s) => {
                const acc = acceptances.find(a => a.submissionId === s.id);
                return acc ? <span>应结算 ¥{acc.settleAmount}{acc.status === 'settled' ? <Tag color="success" style={{ marginLeft: 4 }}>已结算</Tag> : <Tag color="gold" style={{ marginLeft: 4 }}>待结算</Tag>}</span> : '未验收';
              },
            },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <SubStatusTag s={v} /> },
            {
              title: '操作', width: 130,
              render: (_, s) => (
                <Space>
                  <Button size="small" onClick={() => setDetail(s)}>详情</Button>
                  {['installing', 'pending_acceptance', 'accepted'].includes(s.status) && (
                    <Button size="small" danger onClick={() => setRemoval(s)}>申请提前撤换</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={removal ? `申请提前撤换：${removal.title}` : ''}
        open={!!removal} onCancel={() => setRemoval(null)} onOk={applyRemoval}
        confirmLoading={busy} okText="提交申请"
      >
        <Typography.Paragraph type="secondary">
          提交后将生成「商户要求提前撤换」工单，广告公司、街道与财务将围绕该排期协同处理，结算口径以验收与工单核定为准。
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item name="reason" label="撤换原因" rules={[{ required: true, message: '请填写撤换原因' }]}>
            <Input.TextArea rows={3} placeholder="如：门店活动提前结束，申请 10 月 15 日撤换画面" />
          </Form.Item>
        </Form>
      </Modal>

      <SubmissionDetail submission={detail} open={!!detail} onClose={() => setDetail(null)} />
    </div>
  );
}
