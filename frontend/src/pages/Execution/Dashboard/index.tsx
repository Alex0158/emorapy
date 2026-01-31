import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const ExecutionDashboard = () => {
  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>執行儀表板（占位）</Title>
        <Text type="secondary">此頁為占位組件，用於滿足路由引用。後續可替換為真實內容。</Text>
      </Card>
    </div>
  );
};

export default ExecutionDashboard;
