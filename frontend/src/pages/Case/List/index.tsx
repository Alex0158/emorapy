/**
 * 案件列表頁面
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
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
import type { Case } from '@/types/case';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useDebounce } from '@/hooks/usePerformance';
import { formatDate } from '@/utils/formatDate';
import { getCaseStatusTag, getCaseTypeTag } from '@/utils/statusTags';
import { CASE_TYPES, CASE_TYPE_I18N_KEYS } from '@/utils/caseType';
import AdaptiveDashboard from '@/pages/Home/components/AdaptiveDashboard';
import { t } from '@/utils/i18n';
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
  const [fetchKey, setFetchKey] = useState(0);

  const staleRef = useRef(false);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        status?: string;
        type?: string;
        search?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
      } = {
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
      if (staleRef.current) return;
      setCases(response.cases ?? []);
      setPagination(response.pagination ?? { page: 1, page_size: 10, total: 0, total_pages: 0 });
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { message?: string };
      message.error(err?.message || t('message.getCaseListFail'));
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleFilterChange = useCallback((setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  useEffect(() => {
    staleRef.current = false;
    fetchCases();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依篩選/分頁/fetchKey 變化拉取
  }, [pagination.page, pagination.page_size, statusFilter, typeFilter, sortBy, fetchKey]);

  const isInitialMount = useRef(true);
  const debouncedSearch = useDebounce(
    useCallback(() => {
      if (pagination.page === 1) {
        setFetchKey((k) => k + 1);
      } else {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, [pagination.page]),
    500
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    debouncedSearch();
  }, [searchText, debouncedSearch]);

  // 使用useMemo優化案件列表渲染
  const caseCards = useMemo(
    () =>
      cases.map((case_, index) => (
        <Col xs={24} sm={12} lg={8} key={case_.id}>
          <AnimatedWrapper
            animation="slide"
            direction="up"
            delay={index * 50}
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
                    {getCaseStatusTag(case_.status)}
                    {getCaseTypeTag(case_.type)}
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
                    aria-label={t('caseList.viewDetailAria').replace('{title}', case_.title)}
                  >
                    {t('caseList.viewDetail')}
                  </Button>
                </div>
            </Card>
          </AnimatedWrapper>
        </Col>
      )),
    [cases, navigate]
  );

  return (
    <>
      <SEO
        title={t('caseList.title')}
        description={t('caseList.description')}
        keywords={t('caseList.keywords')}
      />
      <div className="case-list-page" role="main" aria-label={t('caseList.pageLabel')}>
        <div className="adaptive-hero-section mb-12 bg-gradient-to-br from-background to-gray-50 rounded-b-[40px] shadow-sm">
          <AdaptiveDashboard />
        </div>

        <div className="container mx-auto px-6">
          <AnimatedWrapper animation="fade" delay={100}>
            <div className="page-header flex justify-between items-end mb-8" aria-labelledby="page-title">
              <div className="header-left">
                <Title level={2} id="page-title" className="font-heading font-bold m-0">
                  {t('caseList.heading')}
                </Title>
                <Text type="secondary" aria-live="polite" className="mt-2 block">
                  {t('caseList.totalCount').replace('{count}', String(pagination.total))}
                </Text>
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/case/create')}
                size="large"
                shape="round"
                className="shadow-md hover:shadow-lg transition-all"
                aria-label={t('caseList.createNew')}
              >
                {t('caseList.createNew')}
              </Button>
            </div>
          </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
          <div className="filters-section" role="group" aria-label={t('caseList.filtersLabel')}>
            <Space wrap>
              <Select
                value={statusFilter}
                onChange={handleFilterChange(setStatusFilter)}
                style={{ width: 120 }}
                aria-label={t('caseList.ariaStatusFilter')}
              >
                <Option value="all">{t('caseList.statusAll')}</Option>
                <Option value="draft">{t('caseList.statusDraft')}</Option>
                <Option value="submitted">{t('caseList.statusSubmitted')}</Option>
                <Option value="in_progress">{t('caseList.statusInProgress')}</Option>
                <Option value="completed">{t('caseList.statusCompleted')}</Option>
                <Option value="judgment_failed">{t('caseList.statusJudgmentFailed')}</Option>
                <Option value="cancelled">{t('caseList.statusCancelled')}</Option>
              </Select>

              <Select
                value={typeFilter}
                onChange={handleFilterChange(setTypeFilter)}
                style={{ width: 150 }}
                aria-label={t('caseList.ariaTypeFilter')}
              >
                <Option value="all">{t('caseList.typeAll')}</Option>
                {CASE_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(CASE_TYPE_I18N_KEYS[type])}
                  </Option>
                ))}
              </Select>

              <Select
                value={sortBy}
                onChange={handleFilterChange(setSortBy)}
                style={{ width: 120 }}
                aria-label={t('caseList.ariaSort')}
              >
                <Option value="latest">{t('caseList.sortLatest')}</Option>
                <Option value="oldest">{t('caseList.sortOldest')}</Option>
                <Option value="status">{t('caseList.sortStatus')}</Option>
              </Select>

              <Search
                placeholder={t('caseList.searchPlaceholder')}
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                onSearch={() => fetchCases()}
                aria-label={t('caseList.ariaSearch')}
              />
            </Space>
          </div>
        </AnimatedWrapper>

        <Spin spinning={loading} description={t('common.loading')}>
          {cases.length === 0 ? (
            <AnimatedWrapper animation="fade" delay={300}>
              <Empty
                description={t('caseList.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                aria-label={t('caseList.empty')}
              >
                <Button
                  type="primary"
                  onClick={() => navigate('/case/create')}
                  aria-label={t('caseList.createFirst')}
                >
                  {t('caseList.createFirst')}
                </Button>
              </Empty>
            </AnimatedWrapper>
          ) : (
            <AnimatedWrapper animation="fade" delay={300}>
              <Row gutter={[24, 24]} role="list" aria-label={t('caseList.ariaList')}>
                {caseCards}
              </Row>
            </AnimatedWrapper>
          )}
        </Spin>

        {cases.length > 0 && (
          <AnimatedWrapper animation="fade" delay={400}>
            <div className="pagination-wrapper" role="navigation" aria-label={t('caseList.ariaPagination')}>
              <Pagination
                current={pagination.page}
                total={pagination.total}
                pageSize={pagination.page_size}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => t('caseList.paginationTotal').replace('{total}', String(total))}
                onChange={(page, pageSize) => {
                  setPagination((prev) => ({
                    ...prev,
                    page,
                    page_size: pageSize,
                  }));
                }}
                aria-label={t('caseList.ariaPaginationNav')}
              />
            </div>
          </AnimatedWrapper>
        )}
        </div>
      </div>
    </>
  );
};

export default CaseList;
