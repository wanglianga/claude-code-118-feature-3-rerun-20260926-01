import { useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select,
  Slider, Space, Switch, Table, Typography, message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { api } from '../api';
import { STATUS_LABEL, TYPE_APPROVAL_HINT, TYPE_APPROVAL_UNIT, TYPE_LABEL } from '../dict';
import { Submission, SubmissionType } from '../types';
import { SubStatusTag, SubTypeTag } from '../components/Tags';
import SubmissionDetail from '../components/SubmissionDetail';
import PhotoUpload from '../components/PhotoUpload';

/** 提交画面（广告公司 / 街道）：四类排期适配不同审批要求 */
export default function SubmitPage() {
  const { user, users, submissions, act } = useStore();
  const [form] = Form.useForm();
  const [type, setType] = useState<SubmissionType>('commercial');
  const [nightLighting, setNightLighting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Submission | null>(null);

  const teams = users.filter(u => u.role === 'construction');
  const merchants = users.filter(u => u.role === 'merchant');
  const mine = submissions.filter(s => s.submitterId === user?.id);

  const onTypeChange = (t: SubmissionType) => {
    setType(t);
    form.setFieldsValue({
      approvalUnit: TYPE_APPROVAL_UNIT[t],
      publicRatio: t === 'public_welfare' ? 100 : t === 'commercial' ? 30 : t === 'safety' ? 50 : 0,
    });
  };

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        plannedInstallDate: values.plannedInstallDate.format('YYYY-MM-DD'),
        displayStart: values.displayRange[0].format('YYYY-MM-DD'),
        displayEnd: values.displayRange[1].format('YYYY-MM-DD'),
        hoardingNos: String(values.hoardingNos).split(/[,，\s]+/).filter(Boolean),
        creatives: values.creatives.map((c: any) => ({ ...c, imageUrl: c.imageUrl?.[0] })),
      };
      delete payload.displayRange;
      await act(() => api.createSubmission(payload));
      message.success('提交成功，已进入待审核队列');
      form.resetFields();
      onTypeChange(type);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>提交围挡画面排期</Typography.Title>
      <Alert type="info" showIcon message={TYPE_APPROVAL_HINT[type]} style={{ marginBottom: 16 }} />
      <Card>
        <Form
          form={form} layout="vertical" onFinish={onFinish}
          initialValues={{
            type: 'commercial', approvalUnit: TYPE_APPROVAL_UNIT.commercial, publicRatio: 30,
            nightLighting: false, hoardingLength: 100, height: 2.5, unitPrice: 180,
            plannedInstallDate: dayjs().add(3, 'day'),
            displayRange: [dayjs().add(7, 'day'), dayjs().add(90, 'day')],
            creatives: [{ kind: 'public', sensitiveRisk: 'none', sightImpact: 'none' }],
          }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="type" label="排期类型" rules={[{ required: true }]}>
                <Select onChange={onTypeChange} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="title" label="排期标题" rules={[{ required: true, message: '请填写标题' }]}>
                <Input placeholder="如：悦茶春季新品上市围挡广告" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="approvalUnit" label="审批单位" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="siteName" label="工地名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={9}><Form.Item name="location" label="工地位置" rules={[{ required: true }]}><Input placeholder="路口 / 门牌号" /></Form.Item></Col>
            <Col span={4}><Form.Item name="roadSegment" label="路段" rules={[{ required: true }]}><Input placeholder="如：朝阳北路东段" /></Form.Item></Col>
            <Col span={5}>
              <Form.Item name="hoardingNos" label="围挡编号（逗号分隔）" rules={[{ required: true, message: '请填写围挡编号' }]}>
                <Input placeholder="如：CB-01,CB-02,CB-03" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={4}><Form.Item name="hoardingLength" label="围挡长度（米）" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={4}><Form.Item name="height" label="围挡高度（米）" rules={[{ required: true }]}><InputNumber min={1} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}>
              <Form.Item name="publicRatio" label={`公益比例（%）${type === 'commercial' ? '，商业广告不得低于 30%' : ''}`} rules={[{ required: true }]}>
                <Slider min={0} max={100} disabled={type === 'public_welfare'} marks={{ 0: '0', 30: '30', 50: '50', 100: '100' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="nightLighting" label="夜间照明" valuePropName="checked">
                <Switch onChange={setNightLighting} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="contractLength" label="合同长度（米）" tooltip="默认等于围挡长度">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="默认同围挡长度" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={5}><Form.Item name="plannedInstallDate" label="计划安装时间" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={7}><Form.Item name="displayRange" label="展示起止" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="publicSlots" label="公益时段说明"><Input placeholder="如：每日 7-9、17-19 点轮播公益画面" /></Form.Item></Col>
            {nightLighting && (
              <Col span={6}><Form.Item name="lightingDesc" label="照明说明"><Input placeholder="如：LED 灯带 18:30-22:00" /></Form.Item></Col>
            )}
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="constructionTeamId" label="责任施工队" rules={[{ required: true, message: '请选择施工队' }]}>
                <Select options={teams.map(t => ({ value: t.id, label: `${t.org}（${t.name}）` }))} />
              </Form.Item>
            </Col>
            {type === 'commercial' && (
              <>
                <Col span={6}>
                  <Form.Item name="merchantId" label="商户" rules={[{ required: true, message: '商业广告需关联商户' }]}>
                    <Select options={merchants.map(m => ({ value: m.id, label: `${m.org}（${m.name}）` }))} />
                  </Form.Item>
                </Col>
                <Col span={6}><Form.Item name="unitPrice" label="商业单价（元/m²·期）" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </>
            )}
            <Col span={type === 'commercial' ? 6 : 18}>
              <Form.Item name="acceptanceRequirements" label="验收要求" rules={[{ required: true, message: '请填写验收要求' }]}>
                <Input placeholder="如：画面平整无气泡，接缝≤3mm，夜间照明正常" />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Title level={5}>画面清单（尺寸 / 文字 / 公益主题 / 品牌露出 / 风险自评）</Typography.Title>
          <Form.List name="creatives">
            {(fields, { add, remove }) => (
              <>
                {fields.map(field => (
                  <Card
                    key={field.key} size="small" style={{ marginBottom: 12 }}
                    title={`画面 ${field.name + 1}`}
                    extra={fields.length > 1 && <MinusCircleOutlined onClick={() => remove(field.name)} />}
                  >
                    <Row gutter={12}>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'kind']} label="画面类别" rules={[{ required: true }]}>
                          <Select options={[
                            { value: 'public', label: '公益画面' },
                            { value: 'commercial', label: '商业画面' },
                            { value: 'safety', label: '安全提示' },
                          ]} />
                        </Form.Item>
                      </Col>
                      <Col span={6}><Form.Item name={[field.name, 'title']} label="画面标题" rules={[{ required: true }]}><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item name={[field.name, 'sizeSpec']} label="画面尺寸" rules={[{ required: true }]}><Input placeholder="6m×2.5m" /></Form.Item></Col>
                      <Col span={5}><Form.Item name={[field.name, 'textContent']} label="画面文字"><Input /></Form.Item></Col>
                      <Col span={5}><Form.Item name={[field.name, 'theme']} label="公益主题"><Input placeholder="公益画面填写" /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={4}><Form.Item name={[field.name, 'brandName']} label="品牌露出"><Input placeholder="商业画面填写" /></Form.Item></Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'sensitiveRisk']} label="敏感内容自评" initialValue="none">
                          <Select options={[{ value: 'none', label: '无' }, { value: 'low', label: '低' }, { value: 'high', label: '高' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'sightImpact']} label="道路视线影响" initialValue="none">
                          <Select options={[{ value: 'none', label: '无' }, { value: 'low', label: '低' }, { value: 'high', label: '高' }]} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name={[field.name, 'imageUrl']} label="效果图（选填，1 张）" valuePropName="value">
                          <PhotoUpload max={1} label="上传效果图" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ kind: 'commercial', sensitiveRisk: 'none', sightImpact: 'none' })}>
                  添加画面
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginTop: 20 }}>
            <Button type="primary" htmlType="submit" size="large" loading={submitting}>提交审核</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="我提交的排期单" style={{ marginTop: 20 }} size="small">
        <Table
          rowKey="id" size="small" dataSource={mine}
          columns={[
            { title: '单号', dataIndex: 'code', width: 120 },
            { title: '标题', dataIndex: 'title', render: (v, s) => <a onClick={() => setDetail(s)}>{v}</a> },
            { title: '类型', dataIndex: 'type', width: 110, render: v => <SubTypeTag t={v} /> },
            { title: '路段', dataIndex: 'roadSegment', width: 120 },
            { title: '公益比例', dataIndex: 'publicRatio', width: 90, render: v => `${v}%` },
            { title: '状态', dataIndex: 'status', width: 90, render: v => <SubStatusTag s={v} /> },
            { title: '状态说明', render: (_, s) => STATUS_LABEL[s.status] },
          ]}
        />
      </Card>
      <SubmissionDetail submission={detail} open={!!detail} onClose={() => setDetail(null)} />
    </div>
  );
}
