import { useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useStore } from '../store';
import { ROLE_LABEL } from '../dict';
import { Role } from '../types';

const DEMO_ACCOUNTS: { username: string; name: string; role: Role; org: string }[] = [
  { username: 'ad001', name: '李明辉', role: 'ad_company', org: '诚信广告有限公司' },
  { username: 'street01', name: '王秀兰', role: 'street', org: '朝阳街道办事处' },
  { username: 'reviewer', name: '陈正审', role: 'reviewer', org: '市城管局审批中心' },
  { username: 'team01', name: '赵铁柱', role: 'construction', org: '宏基围挡施工队' },
  { username: 'inspector', name: '刘巡检', role: 'inspector', org: '市容环境巡检中心' },
  { username: 'merchant01', name: '周悦', role: 'merchant', org: '悦茶餐饮连锁' },
  { username: 'finance', name: '吴会计', role: 'finance', org: '市广告结算中心' },
];

export default function Login() {
  const login = useStore(s => s.login);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username.trim(), values.password);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f3d6e 0%,#1677ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: 880, boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        <Row gutter={32}>
          <Col span={10}>
            <Typography.Title level={3} style={{ marginTop: 8 }}>城市工地围挡<br />公益广告排期与验收系统</Typography.Title>
            <Typography.Paragraph type="secondary">
              画面提交 · 审核 · 安装领取 · 现场上报 · 验收结算 · 异常工单 · 巡检计划，广告公司 / 街道 / 施工队 / 巡检员 / 商户 / 财务围绕同一排期协同。
            </Typography.Paragraph>
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ username: 'ad001', password: '123456' }}>
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>登 录</Button>
            </Form>
          </Col>
          <Col span={14}>
            <Typography.Title level={5}>演示账号（密码均为 123456，点击填入）</Typography.Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {DEMO_ACCOUNTS.map(a => (
                <Card
                  key={a.username} size="small" hoverable
                  onClick={() => form.setFieldsValue({ username: a.username, password: '123456' })}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span><b>{a.name}</b>　{ROLE_LABEL[a.role]} · {a.org}</span>
                    <Typography.Text code>{a.username}</Typography.Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
