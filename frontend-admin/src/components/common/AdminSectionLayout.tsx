import { useMemo, useState } from "react";
import {
	Link,
	Navigate,
	Outlet,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useAdminMe } from "@/hooks/useAdminMe";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useAdminToken } from "@/hooks/useAdminToken";
import { deriveAdminTokenStatus } from "@/utils/adminTokenState";
import {
	getPermittedAdminRoutes,
	type AdminNavigationGroup,
	type AdminNavigationItem,
} from "@/config/adminNavigation";
import { env } from "@/config/env";
import { t } from "@/utils/i18n";
import { cn } from "@/lib/utils";
import VersionPopover from "@/components/common/VersionPopover";
import { formatAdminDateTime, humanizeAdminKey } from "@/utils/adminFormat";

const NAVIGATION_GROUPS: Array<{ id: AdminNavigationGroup; labelKey: string }> =
	[
		{ id: "monitor", labelKey: "admin.nav.group.monitor" },
		{ id: "operate", labelKey: "admin.nav.group.operate" },
		{ id: "govern", labelKey: "admin.nav.group.govern" },
	];

function NavigationLinks({
	items,
	currentPath,
	onNavigate,
}: {
	items: AdminNavigationItem[];
	currentPath: string;
	onNavigate?: () => void;
}) {
	return (
		<nav aria-label={t("admin.nav.title")} className="space-y-5">
			{NAVIGATION_GROUPS.map((group) => {
				const groupItems = items.filter((item) => item.group === group.id);
				if (groupItems.length === 0) return null;
				return (
					<div key={group.id}>
						<p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{t(group.labelKey)}
						</p>
						<div className="space-y-0.5">
							{groupItems.map(({ path, icon: Icon, labelKey }) => {
								const isActive =
									currentPath === path || currentPath.startsWith(`${path}/`);
								return (
									<Link
										key={path}
										to={path}
										aria-current={isActive ? "page" : undefined}
										onClick={onNavigate}
										className={cn(
											"flex min-h-10 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors",
											isActive
												? "border-primary/15 bg-primary/10 text-primary-hover"
												: "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
									>
										<Icon className="size-4" aria-hidden="true" />
										{t(labelKey)}
									</Link>
								);
							})}
						</div>
					</div>
				);
			})}
		</nav>
	);
}

export default function AdminSectionLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const token = useAdminToken();
	const { logout } = useAdminSession();
	const { tokenPresent, tokenReady } = deriveAdminTokenStatus(token);
	const adminMeQuery = useAdminMe(tokenReady);
	const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

	const permissions = adminMeQuery.data?.admin.permissions ?? [];
	const permittedRoutes = useMemo(
		() => getPermittedAdminRoutes(permissions),
		[permissions],
	);
	const environmentLabel = env.isProduction
		? t("admin.shell.production")
		: t("admin.shell.development");

	if (!tokenPresent || !tokenReady) {
		return (
			<Navigate
				to="/admin/login"
				replace
				state={{
					from: `${location.pathname}${location.search}${location.hash}`,
				}}
			/>
		);
	}

	const handleLogout = () => {
		logout();
		navigate("/admin/login", { replace: true });
	};

	return (
		<div className="min-h-screen bg-background">
			<a
				href="#admin-main-content"
				className="sr-only z-[100] rounded-md bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
			>
				{t("admin.shell.skipToContent")}
			</a>

			<header className="sticky top-0 z-40 border-b bg-background">
				<div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4 sm:px-6">
					<Sheet
						open={mobileNavigationOpen}
						onOpenChange={setMobileNavigationOpen}
					>
						<SheetTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="lg:hidden"
								aria-label={t("admin.shell.openNavigation")}
							>
								<Menu className="size-4" />
							</Button>
						</SheetTrigger>
						<SheetContent
							side="left"
							className="w-[19rem] p-0 sm:max-w-[19rem]"
						>
							<SheetHeader className="border-b p-5 text-left">
								<SheetTitle>Emorapy Admin</SheetTitle>
								<SheetDescription>{t("admin.nav.subtitle")}</SheetDescription>
							</SheetHeader>
							<div className="flex-1 overflow-y-auto p-4">
								<NavigationLinks
									items={permittedRoutes}
									currentPath={location.pathname}
									onNavigate={() => setMobileNavigationOpen(false)}
								/>
							</div>
							<div className="border-t p-4">
								<SheetClose asChild>
									<Button
										variant="outline"
										className="w-full"
										onClick={handleLogout}
									>
										<LogOut className="size-4" /> {t("admin.shell.logout")}
									</Button>
								</SheetClose>
							</div>
						</SheetContent>
					</Sheet>

					<Link
						to="/admin"
						className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
							<ShieldCheck className="size-4" aria-hidden="true" />
						</span>
						<span>
							<span className="block text-sm font-semibold leading-4 tracking-[-0.01em]">
								Emorapy
							</span>
							<span className="block text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
								Admin
							</span>
						</span>
					</Link>

					<div className="ml-auto flex items-center gap-2">
						<Badge
							variant="outline"
							className="hidden rounded-md sm:inline-flex"
						>
							{environmentLabel}
						</Badge>
						<VersionPopover />
						<div className="hidden border-l pl-3 md:block">
							<p className="max-w-48 truncate text-xs font-medium text-foreground">
								{adminMeQuery.data?.admin.email ??
									t("admin.shell.verifyingIdentity")}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{adminMeQuery.data?.admin.roleKey
									? humanizeAdminKey(adminMeQuery.data.admin.roleKey)
									: t("common.loading")}
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="hidden md:inline-flex"
							onClick={handleLogout}
							aria-label={t("admin.shell.logout")}
						>
							<LogOut className="size-4" />
						</Button>
					</div>
				</div>
			</header>

			<div className="mx-auto grid max-w-[1680px] lg:grid-cols-[15.5rem_minmax(0,1fr)]">
				<aside className="hidden min-h-[calc(100vh-4rem)] border-r px-4 py-6 lg:flex lg:flex-col">
					{adminMeQuery.isLoading ? (
						<p className="px-3 text-sm text-muted-foreground" role="status">
							{t("admin.shell.verifyingIdentity")}
						</p>
					) : (
						<NavigationLinks
							items={permittedRoutes}
							currentPath={location.pathname}
						/>
					)}
					<div className="mt-auto border-t px-3 pt-4 text-xs text-muted-foreground">
						<p>{environmentLabel}</p>
						{adminMeQuery.dataUpdatedAt > 0 && (
							<p className="mt-1">
								{t("admin.shell.identityChecked")}:{" "}
								{formatAdminDateTime(adminMeQuery.dataUpdatedAt)}
							</p>
						)}
					</div>
				</aside>

				<main
					id="admin-main-content"
					tabIndex={-1}
					className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
				>
					{adminMeQuery.error ? (
						<div
							className="mx-auto max-w-xl rounded-xl border border-destructive/25 bg-surface p-6 text-center"
							role="alert"
						>
							<h1 className="text-lg font-semibold">
								{t("admin.ops.identityFailed")}
							</h1>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("admin.shell.identityRecovery")}
							</p>
							<div className="mt-4 flex justify-center gap-2">
								<Button
									variant="outline"
									onClick={() => void adminMeQuery.refetch()}
								>
									{t("common.retry")}
								</Button>
								<Button onClick={handleLogout}>
									{t("admin.shell.signInAgain")}
								</Button>
							</div>
						</div>
					) : (
						<Outlet />
					)}
				</main>
			</div>
		</div>
	);
}
