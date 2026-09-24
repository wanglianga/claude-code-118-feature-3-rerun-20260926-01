import { useState } from 'react';
import {
  Alert, Button, Card, Form, Image, Input, InputNumber, Modal, Space, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd';
import { useStore } from '../store';
import { api } from '../api';
import { InstallTask } from '../types';
import { TaskStatusTag } from '../components/Tags';
import PhotoUpload from '../components/PhotoUpload';

/** 施工队：按路段 + 围挡编号领取任务，上报安装前后照片与现场情况 */
export default function TasksPage() {
  const { user, tasks, submissions, act } = useStore();
  const [reportTask, setReportTask] = useState<InstallTask | null>(null);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const mine = tasks.filter(t => t.teamId === user?.id);
  const subOf = (t: InstallTask) => submissions.find(s => s.id === t.submissionId);

  const claim = async (t: InstallTask) => {
    try {
      await act(() => api.claimTask(t.id));
      message.success(`已领取 ${t.hoardingNo}，请按期安装并上报`);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const submitReport = async () => {
    if (!reportTask) return;
    const values = await form.validateFields();
    setBusy(true);
    try {
      await act(() => api.reportTask(reportTask.id, values));
      message.success('安装情况已上报');
      setReportTask(null);
      form.resetFields();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const baseColumns = [
    { title: '任务号', dataIndex: 'code', width: 110 },
    { title: '排期单', render: (_: unknown, t: InstallTask) => { const s = subOf(t); return s ? `${s.code} ${s.title}` : t.submissionId; }, ellipsis: true },
    { title: '路段', dataIndex: 'roadSegment', width: 120 },
    { title: '围挡编号', dataIndex: 'hoardingNo', width: 90 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: any) => <TaskStatusTag s={v} /> },
  ];

  const pendingCols = [...baseColumns, {
    title: '操作', width: 90,
    render: (_: unknown, t: InstallTask) => <Button type="primary" size="small" onClick={() => claim(t)}>领取任务</Button>,
  }];
  const claimedCols = [...baseColumns, {
    title: '操作', width: 110,
    render: (_: unknown, t: InstallTask) => <Button type="primary" size="small" onClick={() => { setReportTask(t); form.resetFields(); }}>上报安装情况</Button>,
  }];
  const reportedCols = [...baseColumns,
    { title: '实际长度', render: (_: unknown, t: InstallTask) => `${t.report?.actualLength}m`, width: 90 },
    { title: '缺口', render: (_: unknown, t: InstallTask) => t.report?.gaps || '—', width: 120, ellipsis: true },
    { title: '遮挡交通标识', width: 100, render: (_: unknown, t: InstallTask) => t.report?.blocksTrafficSign ? <Tag color="error">是</Tag> : '否' },
    { title: '影响行人', width: 80, render: (_: unknown, t: InstallTask) => t.report?.affectsPedestrians ? <Tag color="error">是</Tag> : '否' },
    {
      title: '照片', width: 170,
      render: (_: unknown, t: InstallTask) => (
        <Image.PreviewGroup>
          <Space>
            {(t.report?.afterPhotos || []).slice(0, 2).map(p => <Image key={p} src={p} width={56} height={40} style={{ objectFit: 'cover' }} />)}
          </Space>
        </Image.PreviewGroup>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>安装任务（按路段与围挡编号领取）</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="领取后请按计划安装；上报需包含安装前/后照片、实际长度、缺口情况、是否遮挡交通标识、是否影响行人通行。" />
      <Card size="small">
        <Tabs
          items={[
            { key: 'pending', label: `可领取（${mine.filter(t => t.status === 'pending').length}）`, children: <Table rowKey="id" size="small" dataSource={mine.filter(t => t.status === 'pending')} columns={pendingCols as any} /> },
            { key: 'claimed', label: `已领取待上报（${mine.filter(t => t.status === 'claimed').length}）`, children: <Table rowKey="id" size="small" dataSource={mine.filter(t => t.status === 'claimed')} columns={claimedCols as any} /> },
            { key: 'reported', label: `已上报（${mine.filter(t => t.status === 'reported').length}）`, children: <Table rowKey="id" size="small" dataSource={mine.filter(t => t.status === 'reported')} columns={reportedCols as any} /> },
          ]}
        />
      </Card>

      <Modal
        title={reportTask ? `上报安装情况：${reportTask.roadSegment} ${reportTask.hoardingNo}` : ''}
        open={!!reportTask} onCancel={() => setReportTask(null)} onOk={submitReport}
        confirmLoading={busy} width={640} okText="提交上报"
      >
        <Form form={form} layout="vertical" initialValues={{ gaps: '无缺口', blocksTrafficSign: false, affectsPedestrians: false }}>
          <Form.Item name="beforePhotos" label="安装前照片" rules={[{ required: true, message: '请上传安装前照片' }]}>
            <PhotoUpload max={3} label="安装前" />
          </Form.Item>
          <Form.Item name="afterPhotos" label="安装后照片" rules={[{ required: true, message: '请上传安装后照片' }]}>
            <PhotoUpload max={3} label="安装后" />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="actualLength" label="实际长度（米）" rules={[{ required: true, message: '请填写实际长度' }]}>
              <InputNumber min={0.1} step={0.5} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="gaps" label="缺口情况" style={{ minWidth: 260 }}>
              <Input placeholder="如：与配电箱交接处留 0.5m 缺口" />
            </Form.Item>
          </Space>
          <Space size="large">
            <Form.Item name="blocksTrafficSign" label="是否遮挡交通标识" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="affectsPedestrians" label="是否影响行人通行" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="现场其他情况说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
