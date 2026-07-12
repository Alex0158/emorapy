import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { adminApi } from "@/services/api/admin";
import type { AdminAIStreamSessionListData } from "@/types/admin";
import AIStreamDetailSheet from "./AIStreamDetailSheet";
import AIStreamSessionsPanel from "./AIStreamSessionsPanel";
import AIStreamsReportSummary from "./AIStreamsReportSummary";

const PAGE_SIZE = 20;
const SENSITIVE_REPORT_PERMISSION = ["reports:sensitive:read"];

export default function AIStreamsPanel() {
	const [days, setDays] = useState(7);
	const [source, setSource] =
		useState<AdminAIStreamSessionListData["source"]>("all");
	const [status, setStatus] = useState<string | undefined>(undefined);
	const [offset, setOffset] = useState(0);
	const [selectedStreamId, setSelectedStreamId] = useState("");
	const [showSensitiveText, setShowSensitiveText] = useState(false);
	const { hasPermission: canReadSensitive } = useAdminAccess(
		SENSITIVE_REPORT_PERMISSION,
	);

	const overviewQuery = useQuery({
		queryKey: ["admin", "reports", "ai-streams", days],
		queryFn: () => adminApi.getReportAIStreams({ days, limit: 10 }),
	});
	const sessionsQuery = useQuery({
		queryKey: [
			"admin",
			"reports",
			"ai-streams",
			"sessions",
			days,
			source,
			status,
			offset,
		],
		queryFn: () =>
			adminApi.listReportAIStreamSessions({
				days,
				source,
				status,
				limit: PAGE_SIZE,
				offset,
			}),
	});
	const detailQuery = useQuery({
		queryKey: [
			"admin",
			"reports",
			"ai-streams",
			"detail",
			selectedStreamId,
			source,
		],
		queryFn: () =>
			adminApi.getReportAIStreamDetail(selectedStreamId, {
				source,
				eventLimit: 100,
			}),
		enabled: Boolean(selectedStreamId),
	});

	const sessions = sessionsQuery.data?.items ?? [];
	const total = sessionsQuery.data?.total ?? 0;

	const refreshAll = () => {
		void overviewQuery.refetch();
		void sessionsQuery.refetch();
		if (selectedStreamId) void detailQuery.refetch();
	};

	return (
		<div className="space-y-6 pt-4">
			<AIStreamsReportSummary
				days={days}
				source={source}
				status={status}
				overview={overviewQuery.data}
				loading={overviewQuery.isLoading}
				error={Boolean(overviewQuery.error)}
				refreshing={overviewQuery.isFetching || sessionsQuery.isFetching}
				onDaysChange={(value) => {
					setDays(value);
					setOffset(0);
				}}
				onSourceChange={(value) => {
					setSource(value);
					setOffset(0);
					setSelectedStreamId("");
				}}
				onStatusChange={(value) => {
					setStatus(value);
					setOffset(0);
				}}
				onRefresh={refreshAll}
				onRetry={() => void overviewQuery.refetch()}
			/>

			<AIStreamSessionsPanel
				sessions={sessions}
				total={total}
				offset={offset}
				pageSize={PAGE_SIZE}
				loading={sessionsQuery.isLoading}
				error={Boolean(sessionsQuery.error)}
				onRetry={() => void sessionsQuery.refetch()}
				onSelect={(streamId) => {
					setSelectedStreamId(streamId);
					setShowSensitiveText(false);
				}}
				onPrevious={() =>
					setOffset((current) => Math.max(0, current - PAGE_SIZE))
				}
				onNext={() => setOffset((current) => current + PAGE_SIZE)}
			/>

			<AIStreamDetailSheet
				streamId={selectedStreamId}
				detail={detailQuery.data}
				loading={detailQuery.isLoading}
				error={Boolean(detailQuery.error)}
				canReadSensitive={canReadSensitive}
				showSensitiveText={showSensitiveText}
				onClose={() => {
					setSelectedStreamId("");
					setShowSensitiveText(false);
				}}
				onRetry={() => void detailQuery.refetch()}
				onToggleSensitiveText={() =>
					setShowSensitiveText((current) => !current)
				}
			/>
		</div>
	);
}
