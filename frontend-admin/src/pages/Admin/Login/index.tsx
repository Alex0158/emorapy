import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
	Activity,
	AlertCircle,
	FileClock,
	Loader2,
	ShieldCheck,
	Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/common/SEO";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useAdminToken } from "@/hooks/useAdminToken";
import { useAdminMe } from "@/hooks/useAdminMe";
import { deriveAdminTokenStatus } from "@/utils/adminTokenState";
import { getSafeAdminDestination } from "@/config/adminNavigation";
import { env } from "@/config/env";
import { t } from "@/utils/i18n";

function getRequestedPath(state: unknown): string | undefined {
	if (!state || typeof state !== "object") return undefined;
	const from = (state as { from?: unknown }).from;
	return typeof from === "string" ? from : undefined;
}

export default function AdminLoginPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const token = useAdminToken();
	const tokenState = deriveAdminTokenStatus(token);
	const adminMeQuery = useAdminMe(tokenState.tokenReady);
	const { loginMutation, logout } = useAdminSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loginError, setLoginError] = useState<string | null>(null);
	const requestedPath = getRequestedPath(location.state);

	if (adminMeQuery.data) {
		return (
			<Navigate
				to={getSafeAdminDestination(
					adminMeQuery.data.admin.permissions,
					requestedPath,
				)}
				replace
			/>
		);
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoginError(null);
		try {
			const result = await loginMutation.mutateAsync({ email, password });
			toast.success(t("admin.login.success"));
			navigate(
				getSafeAdminDestination(result.admin.permissions, requestedPath),
				{ replace: true },
			);
		} catch {
			const message = t("admin.login.failed");
			setLoginError(message);
			toast.error(message);
		}
	};

	const environmentLabel = env.isProduction
		? t("admin.shell.production")
		: t("admin.shell.development");

	return (
		<>
			<SEO
				title={t("admin.login.title")}
				description={t("admin.login.subtitle")}
			/>
			<main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(20rem,0.8fr)_minmax(32rem,1.2fr)]">
				<section className="flex min-h-56 flex-col justify-between bg-foreground p-6 text-background sm:p-10 lg:min-h-screen lg:p-12 xl:p-16">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<span className="flex size-10 items-center justify-center rounded-xl bg-background text-foreground">
								<ShieldCheck className="size-5" aria-hidden="true" />
							</span>
							<div>
								<p className="font-heading text-lg font-semibold tracking-[-0.02em]">
									Emorapy
								</p>
								<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-background/60">
									Admin
								</p>
							</div>
						</div>
						<Badge
							variant="outline"
							className="border-background/20 bg-transparent text-background"
						>
							{environmentLabel}
						</Badge>
					</div>

					<div className="hidden max-w-md lg:block">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/55">
							{t("admin.login.workspaceLabel")}
						</p>
						<h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.04em]">
							{t("admin.login.workspaceHeading")}
						</h1>
						<ul className="mt-8 space-y-4 text-sm text-background/75">
							<li className="flex items-center gap-3">
								<Activity className="size-4" /> {t("admin.login.scopeHealth")}
							</li>
							<li className="flex items-center gap-3">
								<Wrench className="size-4" /> {t("admin.login.scopeJobs")}
							</li>
							<li className="flex items-center gap-3">
								<FileClock className="size-4" /> {t("admin.login.scopeAudit")}
							</li>
						</ul>
					</div>

					<p className="hidden text-xs text-background/45 lg:block">
						{t("admin.login.identitySeparated")}
					</p>
				</section>

				<section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:py-16">
					<div className="w-full max-w-md">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							{environmentLabel}
						</p>
						<h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground">
							{t("admin.login.heading")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("admin.login.formHint")}
						</p>

						{(tokenState.tokenFormatInvalid || adminMeQuery.error) && (
							<div
								className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4"
								role="alert"
							>
								<div className="flex items-start gap-3">
									<AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
									<div>
										<p className="text-sm font-medium text-foreground">
											{t("admin.login.sessionRecoveryTitle")}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{t("admin.login.sessionRecoveryHint")}
										</p>
										<Button
											variant="link"
											size="sm"
											className="mt-1 h-auto px-0"
											onClick={logout}
										>
											{t("admin.shell.signInAgain")}
										</Button>
									</div>
								</div>
							</div>
						)}

						{tokenState.tokenReady && adminMeQuery.isLoading ? (
							<div
								className="mt-8 flex min-h-44 items-center justify-center gap-2 rounded-xl border bg-surface text-sm text-muted-foreground"
								role="status"
							>
								<Loader2 className="size-4 animate-spin" />{" "}
								{t("admin.shell.verifyingIdentity")}
							</div>
						) : (
							<form
								onSubmit={handleSubmit}
								className="mt-8 space-y-5"
								aria-describedby={loginError ? "admin-login-error" : undefined}
							>
								{loginError && (
									<div
										id="admin-login-error"
										role="alert"
										aria-live="assertive"
										className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
									>
										<AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
										<p>{loginError}</p>
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="email">{t("admin.login.email")}</Label>
									<Input
										id="email"
										type="email"
										inputMode="email"
										autoComplete="email"
										required
										value={email}
										onChange={(event) => {
											setEmail(event.target.value);
											setLoginError(null);
										}}
										className="h-11 bg-surface"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="password">{t("admin.login.password")}</Label>
									<Input
										id="password"
										type="password"
										autoComplete="current-password"
										required
										value={password}
										onChange={(event) => {
											setPassword(event.target.value);
											setLoginError(null);
										}}
										className="h-11 bg-surface"
									/>
								</div>
								<Button
									type="submit"
									size="lg"
									className="w-full"
									disabled={loginMutation.isPending}
								>
									{loginMutation.isPending && (
										<Loader2 className="size-4 animate-spin" />
									)}
									{t("admin.login.submit")}
								</Button>
								<p className="text-center text-xs text-muted-foreground">
									{t("admin.login.securityHint")}
								</p>
							</form>
						)}
					</div>
				</section>
			</main>
		</>
	);
}
