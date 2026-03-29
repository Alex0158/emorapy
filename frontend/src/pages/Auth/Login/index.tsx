/**
 * 登錄頁面
 */

import {
	EyeInvisibleOutlined,
	EyeTwoTone,
	LockOutlined,
	UserOutlined,
} from "@ant-design/icons";
import {
	Button,
	Checkbox,
	Form,
	Input,
	message,
	Space,
	Typography,
} from "antd";
import { useState, useRef } from "react";
import { useMountedRef } from "@/hooks/useMountedRef";
import { useLocation, useNavigate } from "react-router-dom";
import AnimatedWrapper from "@/components/common/AnimatedWrapper";
import SEO from "@/components/common/SEO";
import { sendVerificationCode } from "@/services/api/auth";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import "./Login.less";

const { Title, Text } = Typography;

interface LocationState {
	from?: { pathname: string };
}

const Login = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { login, isLoading } = useAuthStore();
	const [form] = Form.useForm();
	const [rememberMe, setRememberMe] = useState(false);
	const mountedRef = useMountedRef();
	const loginLockRef = useRef(false);

	const VALID_REDIRECT_PREFIXES = [
		"/case", "/judgment", "/reconciliation", "/execution",
		"/profile", "/interview", "/quick-experience", "/chat",
	];
	const state = location.state as LocationState | null;
	const rawFrom = state?.from?.pathname || "/case/list";
	const isValidRedirect =
		rawFrom === "/" ||
		VALID_REDIRECT_PREFIXES.some((prefix) => rawFrom.startsWith(prefix));
	const from = isValidRedirect ? rawFrom : "/case/list";

	const handleSubmit = async (values: { email: string; password: string }) => {
		if (loginLockRef.current) return;
		loginLockRef.current = true;
		try {
			await login(values.email, values.password, rememberMe);
			if (!mountedRef.current) return;
			message.success(t("message.loginSuccess"));
			navigate(from, { replace: true });
		} catch (error: unknown) {
			const err =
				error && typeof error === "object"
					? (error as { code?: string; message?: string })
					: null;
			const code = err?.code;
			const msgStr = getErrorMessage(error, "message.loginFail");
			const looksLikeEmailNotVerified =
				code === "EMAIL_NOT_VERIFIED" ||
				/郵箱驗證|email verification|not verified/i.test(msgStr);

			if (!mountedRef.current) return;

			if (looksLikeEmailNotVerified) {
				message.warning(t("message.emailNotVerified"));
				try {
					await sendVerificationCode(values.email, "verify_email");
				} catch (sendErr: unknown) {
					if (!mountedRef.current) return;
					message.error(getErrorMessage(sendErr, "message.resendVerifyFail"));
				}
			} else {
				message.error(msgStr);
			}
		} finally {
			loginLockRef.current = false;
		}
	};

	return (
		<>
			<SEO
				title={t("auth.login.title")}
				description={t("auth.login.description")}
				keywords={t("auth.login.keywords")}
			/>
			<div
				className="auth-page login-page"
				role="main"
				aria-label={t("auth.login.pageLabel")}
			>
				<AnimatedWrapper animation="fade" delay={100}>
					<div className="auth-header mb-8" aria-labelledby="auth-title">
						<Title level={2} id="auth-title" className="auth-title font-heading">
							{t("auth.login.welcome")}
						</Title>
						<Text type="secondary" className="auth-subtitle text-lg">
							{t("auth.login.subtitle")}
						</Text>
					</div>

					<Form
						form={form}
						name="login"
						onFinish={handleSubmit}
						autoComplete="off"
						layout="vertical"
						size="large"
						className="auth-form"
						aria-label={t("auth.login.formLabel")}
					>
						<Form.Item
							name="email"
							rules={[
								{ required: true, message: t("auth.login.emailRequired") },
								{ type: "email", message: t("auth.login.emailInvalid") },
							]}
						>
							<Input
								prefix={<UserOutlined className="text-gray-400" />}
								placeholder={t("auth.login.email")}
								autoComplete="email"
								className="floating-input"
							/>
						</Form.Item>

						<Form.Item
							name="password"
							rules={[
								{ required: true, message: t("auth.login.passwordRequired") },
							]}
						>
							<Input.Password
								prefix={<LockOutlined className="text-gray-400" />}
								placeholder={t("auth.login.password")}
								iconRender={(visible) =>
									visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
								}
								autoComplete="current-password"
								className="floating-input"
							/>
						</Form.Item>

						<Form.Item className="mb-6">
							<Space
								style={{ width: "100%", justifyContent: "space-between" }}
							>
								<Checkbox
									checked={rememberMe}
									onChange={(e) => setRememberMe(e.target.checked)}
								>
									{t("auth.login.rememberMe")}
								</Checkbox>
								<Button
									type="link"
									onClick={() =>
										navigate("/auth/forgot-password", { state: { from: { pathname: from } } })
									}
									className="forgot-password-link px-0"
								>
									{t("auth.login.forgotPassword")}
								</Button>
							</Space>
						</Form.Item>

						<Form.Item className="mb-6">
							<Button
								type="primary"
								htmlType="submit"
								block
								loading={isLoading}
								className="auth-submit-button h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all"
							>
								{t("auth.login.submit")}
							</Button>
						</Form.Item>
					</Form>

					<div className="auth-divider my-6 text-center">
						<Text type="secondary">{t("auth.login.noAccount")}</Text>
					</div>

						<Button
							type="default"
							block
							onClick={() =>
								navigate("/auth/register", { state: { from: { pathname: from } } })
							}
							className="auth-switch-link h-12 text-lg rounded-full"
						>
							{t("auth.login.registerNow")}
						</Button>
				</AnimatedWrapper>
			</div>
		</>
	);
};

export default Login;
