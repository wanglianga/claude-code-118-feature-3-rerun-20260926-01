import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Layout, Menu, Space, Tag, Typography, message } from 'antd';
import {
  DashboardOutlined, FileAddOutlined, AuditOutlined, ToolOutlined, CheckSquareOutlined,
  AlertOutlined, AccountBookOutlined, EnvironmentOutlined, ShopOutlined, ScheduleOutlined,
  LogoutOutlined, ReloadOutlined, UserOutlined,
} from '@ant-design/icons';
import { useStore } from './store';
import { ROLE_LABEL } from './dict';
import { Role } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SubmitPage from './pages/Submit';
import ReviewPage from './pages/Review';
import TasksPage from './pages/Tasks';
import AcceptancePage from './pages/Acceptance';
import TicketsPage from './pages/Tickets';
import SettlementPage from './pages/Settlement';
import InspectionPage from './pages/Inspection';
import StreetView from './pages/StreetView';
import MerchantPage from './pages/Merchant';
import SchedulePage from './pages/Schedule';

interface MenuDef { key: string; label: string; icon: React.ReactNode; roles: Role[] }

const MENUS: MenuDef[] = [
  { key: '/', label: '工作台', icon: <DashboardOutlined />, roles: ['ad_company', 'street', 'reviewer', 'construction', 'inspector', 'merchant', 'finance'] },
  { key: '/schedule', label: '排期总览', icon: <ScheduleOutlined />, roles: ['ad_company', 'street', 'reviewer', 'construction', 'inspector', 'merchant', 'finance'] },
  { key: '/submit', label: '提交画面', icon: <FileAddOutlined />, roles: ['ad_company', 'street'] },
  { key: '/review', label: '审核中心', icon: <AuditOutlined />, roles: ['reviewer'] },
  { key: '/tasks', label: '安装任务', icon: <ToolOutlined />, roles: ['construction'] },
  { key: '/acceptance', label: '验收中心', icon: <CheckSquareOutlined />, roles: ['reviewer', 'street'] },
  { key: '/inspection', label: '巡检中心', icon: <EnvironmentOutlined />, roles: ['inspector'] },
  { key: '/settlement', label: '结算中心', icon: <AccountBookOutlined />, roles: ['finance', 'ad_company'] },
  { key: '/street', label: '市容与公益', icon: <EnvironmentOutlined />, roles: ['street'] },
  { key: '/merchant', label: '我的广告', icon: <ShopOutlined />, roles: ['merchant'] },
  { key: '/tickets', label: '异常工单', icon: <AlertOutlined />, roles: ['ad_company', 'street', 'reviewer', 'construction', 'inspector', 'merchant', 'finance'] },
];

function Shell() {
  const { user, logout, refresh } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // 轮询刷新，保持三端状态同步
  useEffect(() => {
    refresh().catch(() => undefined);
    const timer = setInterval(() => refresh().catch(() => undefined), 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  const menus = MENUS.filter(m => m.roles.includes(user.role));
  const selected = menus.some(m => m.key === location.pathname)
    ? location.pathname
    : (menus.find(m => m.key !== '/' && location.pathname.startsWith(m.key))?.key || '/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider theme="dark" width={220}>
        <div style={{ color: '#fff', padding: '18px 16px', fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>
          城市工地围挡<br />公益广告排期与验收
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[selected]}
          items={menus.map(m => ({ key: m.key, icon: m.icon, label: m.label }))}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text type="secondary">工地围挡画面排期 · 审核 · 安装 · 验收 · 结算 · 巡检 一体化协同</Typography.Text>
          <Space size="middle">
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refresh().then(() => message.success('已同步最新状态'))}>同步</Button>
            <span>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 6 }} />
              {user.name}（{user.org}）
            </span>
            <Tag color="blue">{ROLE_LABEL[user.role]}</Tag>
            <Button size="small" icon={<LogoutOutlined />} onClick={logout}>退出</Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ padding: 20, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/acceptance" element={<AcceptancePage />} />
            <Route path="/inspection" element={<InspectionPage />} />
            <Route path="/settlement" element={<SettlementPage />} />
            <Route path="/street" element={<StreetView />} />
            <Route path="/merchant" element={<MerchantPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  const user = useStore(s => s.user);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
}
