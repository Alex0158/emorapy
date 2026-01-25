/**
 * 案件列表頁面
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Input,
  Select,
  Pagination,
  Row,
  Col,
  Empty,
  Spin,
  message,
} from 'antd';
import {
  PlusOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { getCaseList } from '@/services/api/case';
import type { Case, CaseStatus } from '@/types/case';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useDebounce } from '@/hooks/usePerformance';
import { formatDate } from '@/utils/formatDate';
import './List.less';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const CaseList = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0,
    total_pages: 0,
  });

  // 篩選和排序狀態
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [searchText, setSearchText] = useState('');

  // 獲取案件列表
  const fetchCases = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        page_size: pagination.page_size,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (searchText) {
        params.search = searchText;
      }

      // 排序
      if (sortBy === 'latest') {
        params.sort_by = 'created_at';
        params.sort_order = 'desc';
      } else if (sortBy === 'oldest') {
        params.sort_by = 'created_at';
        params.sort_order = 'asc';
      } else if (sortBy === 'status') {
        params.sort_by = 'status';
        params.sort_order = 'asc';
      }

      const response = await getCaseList(params);
      setCases(response.cases);
      setPagination(response.pagination);
    } catch (error: any) {
      message.error(error.message || '獲取案件列表失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [pagination.page, statusFilter, typeFilter, sortBy]);

  // 搜索處理（使用防抖Hook）
  const debouncedSearch = useDebounce(
    useCallback(() => {
      if (pagination.page === 1) {
        fetchCases();
      } else {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, [pagination.page]),
    500
  );

  useEffect(() => {
    if (searchText !== undefined) {
      debouncedSearch();
    }
  }, [searchText, debouncedSearch]);

  const getStatusTag = (status: CaseStatus) => {
    const statusMap = {
      draft: { color: 'default', text: '草稿' },
      submitted: { color: 'processing', text: '已提交' },
      in_progress: { color: 'warning', text: '審理中' },
      completed: { color: 'success', text: '已完成' },
      cancelled: { color: 'error', text: '已取消' },
      judgment_failed: { color: 'error', text: '判決失敗' },
    };
    const config = statusMap[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeTag = (type: string) => {
    return <Tag color="orange">{type}</Tag>;
  };

  // 使用useMemo優化案件列表渲染
  const caseCards = useMemo(
    () =>
      cases.map((case_, index) => (
        <Col xs={24} sm={12} lg={8} key={case_.id}>
          <AnimatedWrapper
            animation="slide"
            direction="up"
            delay={index * 50}
            trigger="intersection"
          >
            <Card
              className="case-card"
              hoverable
              onClick={() => navigate(`/case/${case_.id}`)}
              role="article"
              aria-labelledby={`case-title-${case_.id}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/case/${case_.id}`);
                }
              }}
            >
                <div className="case-card-header">
                  <Title level={4} id={`case-title-${case_.id}`} className="case-title">
                    {case_.title}
                  </Title>
                  <Space>
                    {getStatusTag(case_.status)}
                    {getTypeTag(case_.type)}
                  </Space>
                </div>
                <div className="case-card-content">
                  <Text type="secondary" className="case-time">
                    <ClockCircleOutlined /> {formatDate(case_.created_at)}
                  </Text>
                </div>
                <div className="case-card-actions">
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/case/${case_.id}`);
                    }}
                    aria-label={`查看案件 ${case_.title} 的詳情`}
                  >
                    查看詳情
                  </Button>
                </div>
            </Card>
          </AnimatedWrapper>
        </Col>
      )),
    [cases, navigate]
  );

  return (
    <ProtectedRoute>
      <SEO
        title="我的案件 - 熊媽媽法庭"
        description="查看和管理您的所有案件"
        keywords="案件列表,我的案件"
      />
      <div className="case-list-page" role="main" aria-label="案件列表頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="page-title">
            <div className="header-left">
              <Title level={2} id="page-title">
                我的案件
              </Title>
              <Text type="secondary" aria-live="polite">
                共 {pagination.total} 個案件
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/case/create')}
              size="large"
              aria-label="創建新案件"
            >
              創建新案件
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
          <div className="filters-section" role="group" aria-label="篩選和搜索">
            <Space wrap>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                aria-label="篩選案件狀態"
              >
                <Option value="all">全部狀態</Option>
                <Option value="draft">草稿</Option>
                <Option value="submitted">已提交</Option>
                <Option value="in_progress">審理中</Option>
                <Option value="completed">已完成</Option>
                <Option value="cancelled">已取消</Option>
              </Select>

              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 150 }}
                aria-label="篩選案件類型"
              >
                <Option value="all">全部類型</Option>
                <Option value="生活習慣">生活習慣</Option>
                <Option value="消費決策">消費決策</Option>
                <Option value="社交關係">社交關係</Option>
                <Option value="價值觀">價值觀</Option>
                <Option value="情感需求">情感需求</Option>
                <Option value="其他">其他</Option>
              </Select>

              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: 120 }}
                aria-label="排序方式"
              >
                <Option value="latest">最新</Option>
                <Option value="oldest">最舊</Option>
                <Option value="status">狀態</Option>
              </Select>

              <Search
                placeholder="搜索案件標題或內容"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                onSearch={() => fetchCases()}
                aria-label="搜索案件"
              />
            </Space>
          </div>
        </AnimatedWrapper>

        <Spin spinning={loading} tip="加載中...">
          {cases.length === 0 ? (
            <AnimatedWrapper animation="fade" delay={300}>
              <Empty
                description="還沒有案件"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                aria-label="空狀態：還沒有案件"
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/case/create')}
                  aria-label="創建第一個案件"
                >
                  創建第一個案件
                </Button>
              </Empty>
            </AnimatedWrapper>
          ) : (
            <AnimatedWrapper animation="fade" delay={300} trigger="intersection">
              <Row gutter={[24, 24]} role="list" aria-label="案件列表">
                {caseCards}
              </Row>
            </AnimatedWrapper>
          )}
        </Spin>

        {cases.length > 0 && (
          <AnimatedWrapper animation="fade" delay={400} trigger="intersection">
            <div className="pagination-wrapper" role="navigation" aria-label="分頁導航">
              <Pagination
                current={pagination.page}
                total={pagination.total}
                pageSize={pagination.page_size}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 條`}
                onChange={(page, pageSize) => {
                  setPagination((prev) => ({
                    ...prev,
                    page,
                    page_size: pageSize,
                  }));
                }}
                aria-label="案件分頁"
              />
            </div>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default CaseList;
