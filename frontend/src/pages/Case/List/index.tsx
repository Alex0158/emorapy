/**
 * 案件列表頁面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Typography,
  Space,
  Input,
  Select,
  Pagination,
  Empty,
  Spin,
  message,
} from 'antd';
import { PlusOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { getCaseList } from '@/services/api/case';
import type { Case } from '@/types/case';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useDebounce } from '@/hooks/usePerformance';
import { formatDate } from '@/utils/formatDate';
import { getCaseStatusTag, getCaseTypeTag } from '@/utils/statusTags';
import { CASE_TYPES, CASE_TYPE_I18N_KEYS } from '@/utils/caseType';
import { getErrorMessage } from '@/utils/apiError';
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

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [searchText, setSearchText] = useState('');
  const [fetchKey, setFetchKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const staleRef = useRef(false);
  const fetchLockRef = useRef(false);

  const fetchCases = async () => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
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
      setCases(Array.isArray(response.cases) ? response.cases : []);
      setPagination(response.pagination ?? { page: 1, page_size: 10, total: 0, total_pages: 0 });
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getCaseListFail');
      message.error(msg);
      setLoadError(msg);
      setCases([]);
    } finally {
      fetchLockRef.current = false;
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
    return () => {
      staleRef.current = true;
    };
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

  const showFilters = cases.length > 0 || loadError;

  return (
    <>
      <SEO
        title={t('caseList.title')}
        description={t('caseList.description')}
        keywords={t('caseList.keywords')}
      />
      <div className="case-list-page" role="main" aria-label={t('caseList.pageLabel')}>
        <div className="case-list-shell">
          <header className="case-list-header">
            <div className="case-list-header-text">
              <Title level={2} id="case-list-page-title" className="case-list-title">
                {t('caseList.heading')}
              </Title>
              <Text type="secondary" className="case-list-count" aria-live="polite">
                {t('caseList.totalCount').replace('{count}', String(pagination.total))}
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/case/create')}
              size="large"
              className="case-list-create-btn"
              aria-label={t('caseList.createNew')}
            >
              {t('caseList.createNew')}
            </Button>
          </header>

          {loadError ? (
            <Alert
              type="error"
              showIcon
              title={loadError}
              action={
                <Button size="small" loading={loading} onClick={() => fetchCases()} data-testid="case-list-load-retry">
                  {t('common.retry')}
                </Button>
              }
              className="case-list-alert"
            />
          ) : null}

          <AnimatedWrapper animation="slide" direction="down" delay={100} trigger="intersection">
            {showFilters ? (
              <div className="case-list-filters" role="group" aria-label={t('caseList.filtersLabel')}>
                <div className="case-list-filters-inner">
                  <Select
                    value={statusFilter}
                    onChange={handleFilterChange(setStatusFilter)}
                    className="case-list-filter-select"
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
                    className="case-list-filter-select case-list-filter-select--wide"
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
                    className="case-list-filter-select"
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
                    className="case-list-search"
                    onSearch={() => fetchCases()}
                    aria-label={t('caseList.ariaSearch')}
                  />
                </div>
              </div>
            ) : (
              <div className="case-list-filters-empty-hint" role="status">
                <Text type="secondary">{t('caseList.filtersEmptyHint')}</Text>
              </div>
            )}
          </AnimatedWrapper>

          <Spin spinning={loading} description={t('common.loading')}>
            {cases.length === 0 && !loading ? (
              <AnimatedWrapper animation="fade" delay={150}>
                <Empty
                  description={t('caseList.empty')}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  aria-label={t('caseList.empty')}
                  className="case-list-empty"
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
            ) : null}

            {cases.length > 0 ? (
              <AnimatedWrapper animation="fade" delay={150}>
                <ul className="case-list-rows" role="list" aria-labelledby="case-list-page-title">
                  {cases.map((case_) => (
                    <li key={case_.id} role="listitem">
                      <button
                        type="button"
                        className="case-list-row"
                        onClick={() => navigate(`/case/${case_.id}`)}
                        aria-label={t('caseList.viewDetailAria').replace('{title}', case_.title)}
                      >
                        <div className="case-list-row-start">
                          <span className="case-list-row-title">{case_.title}</span>
                          <div className="case-list-row-tags">
                            <Space size={[8, 4]} wrap>
                              {getCaseStatusTag(case_.status)}
                              {getCaseTypeTag(case_.type)}
                            </Space>
                          </div>
                        </div>
                        <div className="case-list-row-end">
                          <span className="case-list-row-time">
                            <ClockCircleOutlined aria-hidden />
                            {formatDate(case_.created_at)}
                          </span>
                          <RightOutlined className="case-list-row-chevron" aria-hidden />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </AnimatedWrapper>
            ) : null}
          </Spin>

          {cases.length > 0 ? (
            <AnimatedWrapper animation="fade" delay={200}>
              <div className="case-list-pagination" role="navigation" aria-label={t('caseList.ariaPagination')}>
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
          ) : null}
        </div>
      </div>
    </>
  );
};

export default CaseList;
