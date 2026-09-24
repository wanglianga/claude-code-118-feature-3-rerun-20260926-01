import { useState } from 'react';
import { Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useStore } from '../store';
import { STATUS_LABEL, TYPE_LABEL } from '../dict';
import { Submission, SubmissionStatus, SubmissionType } from '../types';
import { SubStatusTag, SubTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';

/** 排期总览：六方围绕同一排期查看进度（只读） */
export default function SchedulePage() {
  const { submissions, tasks, tickets } = useStore();
  const [detail, setDetail] = useState<Submission | null>(null);
  const [kw, setKw] = useState('');
  const [typeFilter, setTypeFilter] = useState<SubmissionType | undefined>();
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | undefined>();

  const filtered = submissions.filter(s => {
    if (kw && !`${s.code}${s.title}${s.roadSegment}${s.siteName}`.includes(kw)) return false;
    if (typeFilter && s.type !== typeFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <Typography.Title level={4}>排期总览</Typography.Title>
      <Card size="small">
        <Space style={{ marginBottom: 12 }} wrap>
          <Input.Search placeholder="搜索单号 / 标题 / 路段 / 工地" style={{ width: 280 }} allowClear onSearch={setKw} onChange={e => !e.target.value && setKw('')} />
          <Select placeholder="类型" allowClear style={{ width: 150 }} onChange={v => setTypeFilter(v)}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select placeholder="状态" allowClear style={{ width: 130 }} onChange={v => setStatusFilter(v)}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </Space>
        <Table
          rowKey="id" size="small" dataSource={filtered}
          columns={[
            { title: '单号', dataIndex: 'code', width: 115 },
            { title: '标题', dataIndex: 'title', render: (v, s) => <a onClick={() => setDetail(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
            { title: '提交单位', dataIndex: 'submitterOrg', width: 140 },
            { title: '路段', dataIndex: 'roadSegment', width: 120 },
            { title: '围挡规模', width: 110, render: (_, s) => `${s.hoardingLength}m×${s.height}m` },
            { title: '公益比例', dataIndex: 'publicRatio', width: 85, render: v => `${v}%` },
            { title: '展示时段', width: 190, render: (_, s) => `${s.displayStart} ~ ${s.displayEnd}` },
            {
              title: '安装进度', width: 110,
              render: (_, s) => {
                const ts = tasks.filter(t => t.submissionId === s.id);
                if (!ts.length) return '—';
                const done = ts.filter(t => t.status === 'reported').length;
                return <Tag color={done === ts.length ? 'success' : 'processing'}>{done}/{ts.length}</Tag>;
              },
            },
            {
              title: '异常工单', width: 90,
              render: (_, s) => {
                const n = tickets.filter(t => t.submissionId === s.id && t.status !== 'closed').length;
                return n ? <Tag color="error">{n}</Tag> : '—';
              },
            },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <SubStatusTag s={v} /> },
          ]}
        />
      </Card>
      <SubmissionDetail submission={detail} open={!!detail} onClose={() => setDetail(null)} />
    </div>
  );
}
