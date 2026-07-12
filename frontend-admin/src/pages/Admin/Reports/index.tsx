import { useState } from "react";
import { Activity, Coins, Filter, Gauge } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/common/SEO";
import { AdminPageHeader } from "@/components/common/AdminPage";
import { t } from "@/utils/i18n";
import AIStreamsPanel from "./AIStreamsPanel";
import CostsPanel from "./CostsPanel";
import FunnelPanel from "./FunnelPanel";
import OverviewPanel from "./OverviewPanel";

type ReportTab = "overview" | "funnel" | "costs" | "ai-streams";

export default function AdminReportsPage() {
	const [activeTab, setActiveTab] = useState<ReportTab>("overview");
	return (
		<>
			<SEO
				title={t("admin.reports.heading")}
				description={t("admin.reports.subtitle")}
			/>
			<div className="space-y-6">
				<AdminPageHeader
					eyebrow={t("admin.nav.group.monitor")}
					title={t("admin.reports.heading")}
					description={t("admin.reports.subtitle")}
				/>
				<Tabs
					value={activeTab}
					onValueChange={(value: string) => setActiveTab(value as ReportTab)}
				>
					<div className="overflow-x-auto border-b">
						<TabsList variant="line" className="min-w-max pb-2">
							<TabsTrigger value="overview">
								<Gauge className="size-4" />
								{t("admin.reports.overview")}
							</TabsTrigger>
							<TabsTrigger value="funnel">
								<Filter className="size-4" />
								{t("admin.reports.funnel")}
							</TabsTrigger>
							<TabsTrigger value="costs">
								<Coins className="size-4" />
								{t("admin.reports.costs")}
							</TabsTrigger>
							<TabsTrigger value="ai-streams">
								<Activity className="size-4" />
								{t("admin.reports.aiStreams")}
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="overview">
						{activeTab === "overview" && <OverviewPanel />}
					</TabsContent>
					<TabsContent value="funnel">
						{activeTab === "funnel" && <FunnelPanel />}
					</TabsContent>
					<TabsContent value="costs">
						{activeTab === "costs" && <CostsPanel />}
					</TabsContent>
					<TabsContent value="ai-streams">
						{activeTab === "ai-streams" && <AIStreamsPanel />}
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
