/**
 * 案件列表頁面
 *
 * 遷移: Ant Alert/Button/Typography/Select/Input.Search/Pagination/Empty/Spin/message/Icons
 *       → shadcn Button + Select + Input + Tailwind + sonner + Lucide
 * 保留: getCaseStatusTag/getCaseTypeTag（仍返回 Ant Tag，共存期間保留）
 * 保留: 所有業務邏輯（fetch, filter, search debounce, pagination, stale guard）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Clock, ChevronRight, Loader2, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCaseList } from '@/services/api/case';
import type { Case } from '@/types/case';
import SEO from '@/components/common/SEO';
import { StaggerContainer, StaggerItem } from '@/components/common/PageTransition';
import { EmptyState } from '@/components/common/EmptyState';
import { useDebounce } from '@/hooks/usePerformance';
import { formatDate } from '@/utils/formatDate';
import { getCaseStatusTag, getCaseTypeTag } from '@/utils/statusTags';
import { CASE_TYPES, CASE_TYPE_I18N_KEYS } from '@/utils/caseType';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

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

      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (searchText) params.search = searchText;

      if (sortBy === 'latest') { params.sort_by = 'created_at'; params.sort_order = 'desc'; }
      else if (sortBy === 'oldest') { params.sort_by = 'created_at'; params.sort_order = 'asc'; }
      else if (sortBy === 'status') { params.sort_by = 'status'; params.sort_order = 'asc'; }

      const response = await getCaseList(params);
      if (staleRef.current) return;
      setCases(Array.isArray(response.cases) ? response.cases : []);
      setPagination(response.pagination ?? { page: 1, page_size: 10, total: 0, total_pages: 0 });
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getCaseListFail');
      toast.error(msg);
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
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.page_size, statusFilter, typeFilter, sortBy, fetchKey]);

  const isInitialMount = useRef(true);
  const debouncedSearch = useDebounce(
    useCallback(() => {
      if (pagination.page === 1) setFetchKey((k) => k + 1);
      else setPagination((prev) => ({ ...prev, page: 1 }));
    }, [pagination.page]),
    500,
  );

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    debouncedSearch();
  }, [searchText, debouncedSearch]);

  const showFilters = cases.length > 0 || loadError;

  return (
    <>
      <SEO title={t('caseList.title')} description={t('caseList.description')} keywords={t('caseList.keywords')} />

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6" role="main" aria-label={t('caseList.pageLabel')}>
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading" id="case-list-page-title">
              {t('caseList.heading')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {t('caseList.totalCount').replace('{count}', String(pagination.total))}
            </p>
          </div>
          <Button
            onClick={() => navigate('/case/create')}
            className="gap-2"
            aria-label={t('caseList.createNew')}
          >
            <Plus className="size-4" />
            {t('caseList.createNew')}
          </Button>
        </header>

        {/* Error */}
        {loadError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{loadError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCases()}
              disabled={loading}
              data-testid="case-list-load-retry"
            >
              {loading && <Loader2 className="size-3 animate-spin" />}
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-3" role="group" aria-label={t('caseList.filtersLabel')}>
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-[130px]" aria-label={t('caseList.ariaStatusFilter')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('caseList.statusAll')}</SelectItem>
                <SelectItem value="draft">{t('caseList.statusDraft')}</SelectItem>
                <SelectItem value="submitted">{t('caseList.statusSubmitted')}</SelectItem>
                <SelectItem value="in_progress">{t('caseList.statusInProgress')}</SelectItem>
                <SelectItem value="completed">{t('caseList.statusCompleted')}</SelectItem>
                <SelectItem value="judgment_failed">{t('caseList.statusJudgmentFailed')}</SelectItem>
                <SelectItem value="cancelled">{t('caseList.statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
              <SelectTrigger className="w-[160px]" aria-label={t('caseList.ariaTypeFilter')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('caseList.typeAll')}</SelectItem>
                {CASE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(CASE_TYPE_I18N_KEYS[type])}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={handleFilterChange(setSortBy)}>
              <SelectTrigger className="w-[120px]" aria-label={t('caseList.ariaSort')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">{t('caseList.sortLatest')}</SelectItem>
                <SelectItem value="oldest">{t('caseList.sortOldest')}</SelectItem>
                <SelectItem value="status">{t('caseList.sortStatus')}</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('caseList.searchPlaceholder')}
                className="pl-9"
                aria-label={t('caseList.ariaSearch')}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {cases.length === 0 && !loading && !loadError && (
          <EmptyState
            variant="cases"
            actionLabel={t('caseList.createFirst')}
            onAction={() => navigate('/case/create')}
          />
        )}

        {/* Case List */}
        {cases.length > 0 && !loading && (
          <StaggerContainer className="space-y-2">
            {cases.map((case_) => (
              <StaggerItem key={case_.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/case/${case_.id}`)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm active:scale-[0.995]"
                  aria-label={t('caseList.viewDetailAria').replace('{title}', case_.title)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {case_.title}
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {getCaseStatusTag(case_.status)}
                      {getCaseTypeTag(case_.type)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="size-3" aria-hidden />
                      {formatDate(case_.created_at)}
                    </span>
                    <ChevronRight className="size-4" aria-hidden />
                  </div>
                </button>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-between" role="navigation" aria-label={t('caseList.ariaPagination')}>
            <p className="text-xs text-muted-foreground">
              {t('caseList.paginationTotal').replace('{total}', String(pagination.total))}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t('common.prev') || '上一頁'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagination.page} / {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t('common.next') || '下一頁'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CaseList;
