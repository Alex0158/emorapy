/**
 * 註冊頁面
 */

import {
	EyeInvisibleOutlined,
	EyeTwoTone,
	LockOutlined,
	MailOutlined,
	UserOutlined,
} from "@ant-design/icons";
import {
	Button,
	Form,
	Input,
	message,
	Steps,
	Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMountedRef } from "@/hooks/useMountedRef";
import { useLocation, useNavigate } from "react-router-dom";
import AnimatedWrapper from "@/components/common/AnimatedWrapper";
import SEO from "@/components/common/SEO";
import { sendVerificationCode, verifyEmail } from "@/services/api/auth";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import "./Register.less";

const { Title, Text } = Typography;

const CODE_LENGTH = 6;

interface LocationState {
	from?: { pathname: string };
}

const Register = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { register, isLoading } = useAuthStore();
	const [form] = Form.useForm();
	const [currentStep, setCurrentStep] = useState(0);
	const [email, setEmail] = useState("");
	const [nickname, setNickname] = useState("");
	const [verificationCode, setVerificationCode] = useState<string[]>(
		Array(CODE_LENGTH).fill(""),
	);
	const [countdown, setCountdown] = useState(0);
	const [sendingCode, setSendingCode] = useState(false);
	const mountedRef = useMountedRef();
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
	const registerLockRef = useRef(false);
	const sendCodeLockRef = useRef(false);
	const VALID_REDIRECT_PREFIXES = [
		"/case", "/judgment", "/reconciliation", "/execution",
		"/profile", "/interview", "/quick-experience", "/chat",
	];
	const state = location.state as LocationState | null;
	const rawFrom = state?.from?.pathname || "/profile/pairing";
	const isValidRedirect =
		rawFrom === "/" ||
		VALID_REDIRECT_PREFIXES.some((prefix) => rawFrom.startsWith(prefix));
	const redirectTo = isValidRedirect ? rawFrom : "/profile/pairing";

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	const startCountdown = useCallback(() => {
		setCountdown(300);
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					if (timerRef.current) clearInterval(timerRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	}, []);

	const handleSendCode = async () => {
		const emailValue = email || form.getFieldValue("email");
		if (!emailValue) {
			message.error(t("message.emailFirst"));
			return;
		}
		if (sendCodeLockRef.current) return;
		sendCodeLockRef.current = true;
		setSendingCode(true);
		try {
			await sendVerificationCode(emailValue, "register");
			if (!mountedRef.current) return;
			if (!email) {
				setEmail(emailValue);
				setNickname(form.getFieldValue("nickname") || "");
			}
			startCountdown();
			message.success(t("message.codeSent"));
			setCurrentStep(1);
		} catch (error: unknown) {
			if (mountedRef.current) {
				message.error(getErrorMessage(error, "message.sendCodeFail"));
			}
		} finally {
			sendCodeLockRef.current = false;
			if (mountedRef.current) {
				setSendingCode(false);
			}
		}
	};

	const handleResendCode = () => {
		if (countdown > 0) {
			message.warning(
				t("message.waitCountdown").replace("{count}", String(countdown)),
			);
			return;
		}
		handleSendCode();
	};

	const handleCodeChange = (index: number, value: string) => {
		if (value && !/^\d$/.test(value)) return;
		const newCode = [...verificationCode];
		newCode[index] = value;
		setVerificationCode(newCode);

		if (value && index < CODE_LENGTH - 1) {
			codeInputRefs.current[index + 1]?.focus();
		}
	};

	const handleCodeKeyDown = (
		index: number,
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
			codeInputRefs.current[index - 1]?.focus();
		}
	};

	const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault();
		const pasted = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, CODE_LENGTH);
		if (!pasted) return;
		const newCode = Array(CODE_LENGTH).fill("");
		for (let i = 0; i < pasted.length; i++) {
			newCode[i] = pasted[i];
		}
		setVerificationCode(newCode);
		const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
		codeInputRefs.current[focusIndex]?.focus();
	};

	const [verifying, setVerifying] = useState(false);
	const handleVerifyCode = async () => {
		const code = verificationCode.join("");
		if (code.length !== CODE_LENGTH) {
			message.error(t("message.codeFull"));
			return;
		}

		setVerifying(true);
		try {
			const verified = await verifyEmail(email, code, "register");
			if (!mountedRef.current) return;
			if (verified) {
				message.success(t("message.verifySuccess"));
				setCurrentStep(2);
			} else {
				message.error(t("message.codeError"));
				setVerificationCode(Array(CODE_LENGTH).fill(""));
				codeInputRefs.current[0]?.focus();
			}
		} catch (error: unknown) {
			if (mountedRef.current) {
				message.error(getErrorMessage(error, "message.verifyFail"));
			}
		} finally {
			if (mountedRef.current) {
				setVerifying(false);
			}
		}
	};

	const handleSubmit = async (values: {
		password: string;
		confirmPassword: string;
	}) => {
		if (values.password !== values.confirmPassword) {
			message.error(t("message.passwordMismatch"));
			return;
		}
		if (registerLockRef.current) return;
		registerLockRef.current = true;
		try {
			await register(email, values.password, nickname || undefined);
			if (!mountedRef.current) return;
			message.success(t("message.registerSuccess"));
			navigate(redirectTo, { replace: true });
		} catch (error: unknown) {
			if (mountedRef.current) {
				message.error(getErrorMessage(error, "message.registerFail"));
			}
		} finally {
			registerLockRef.current = false;
		}
	};

	const formatCountdown = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<>
			<SEO
				title={t("auth.register.title")}
				description={t("auth.register.description")}
				keywords={t("auth.register.keywords")}
			/>
			<div
				className="auth-page register-page"
				role="main"
				aria-label={t("auth.register.pageLabel")}
			>
				<AnimatedWrapper animation="fade" delay={100}>
					<div className="auth-header mb-8">
						<Title level={2} className="auth-title font-heading">
							{t("auth.register.welcome")}
						</Title>
						<Text type="secondary" className="auth-subtitle text-lg">
							{t("auth.register.subtitle")}
						</Text>
					</div>

					<Steps
						current={currentStep}
						className="register-steps mb-8"
						items={[
							{ title: t("auth.register.stepEmail") },
							{ title: t("auth.register.stepVerify") },
							{ title: t("auth.register.stepPassword") },
						]}
					/>

					{currentStep === 0 && (
						<Form
							form={form}
							name="register-email"
							onFinish={handleSendCode}
							layout="vertical"
							size="large"
							className="auth-form"
						>
							<Form.Item
								name="email"
								rules={[
									{
										required: true,
										message: t("auth.register.emailRequired"),
									},
									{ type: "email", message: t("auth.register.emailInvalid") },
								]}
							>
								<Input
									prefix={<MailOutlined className="text-gray-400" />}
									placeholder={t("auth.register.emailPlaceholder")}
									autoComplete="email"
									className="floating-input"
								/>
							</Form.Item>

							<Form.Item name="nickname">
								<Input
									prefix={<UserOutlined className="text-gray-400" />}
									placeholder={t("auth.register.nicknamePlaceholder")}
									maxLength={20}
									className="floating-input"
								/>
							</Form.Item>

							<Form.Item className="mt-6">
								<Button
									type="primary"
									htmlType="submit"
									block
									loading={sendingCode}
									className="auth-submit-button h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all"
								>
									{t("auth.register.sendCode")}
								</Button>
							</Form.Item>
						</Form>
					)}

					{currentStep === 1 && (
						<div className="verification-step">
							<div className="verification-info text-center mb-6">
								<Text className="text-gray-500">{t("auth.register.codeSentTo")}</Text>
								<br />
								<Text strong className="text-lg">{email}</Text>
							</div>

							<div className="code-input-group flex justify-between gap-2 mb-6">
								{verificationCode.map((value, index) => (
									<input
										key={index}
										ref={(el) => {
											codeInputRefs.current[index] = el;
										}}
										type="text"
										inputMode="numeric"
										pattern="\d*"
										maxLength={1}
										value={value}
										onChange={(e) => handleCodeChange(index, e.target.value)}
										onKeyDown={(e) => handleCodeKeyDown(index, e)}
										onPaste={handleCodePaste}
										className="code-input w-12 h-14 text-center text-xl font-bold rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all bg-gray-50 focus:bg-white"
										aria-label={`${t("auth.register.stepVerify")} ${index + 1}`}
										autoFocus={index === 0}
									/>
								))}
							</div>

							<div className="countdown-info text-center mb-4">
								<Text type="secondary">
									{t("auth.register.codeExpiry")} {formatCountdown(countdown)}
								</Text>
							</div>

							<Button
								type="link"
								onClick={handleResendCode}
								disabled={countdown > 0}
								className="resend-code-link block w-full text-center mb-6"
							>
								{t("auth.register.resendCode")}
							</Button>

							<Button
								type="primary"
								block
								onClick={handleVerifyCode}
								disabled={verificationCode.join("").length !== CODE_LENGTH}
								loading={verifying}
								className="auth-submit-button h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all"
							>
								{t("auth.register.verifyAndContinue")}
							</Button>
						</div>
					)}

					{currentStep === 2 && (
						<Form
							name="register-password"
							onFinish={handleSubmit}
							layout="vertical"
							size="large"
							className="auth-form"
						>
							<Form.Item
								name="password"
								rules={[
									{
										required: true,
										message: t("auth.login.passwordRequired"),
									},
									{ min: 8, message: t("auth.register.passwordMin") },
									{ max: 128, message: t("auth.register.passwordMax") },
									{
										pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
										message: t("auth.register.passwordPattern"),
									},
								]}
							>
								<Input.Password
									prefix={<LockOutlined className="text-gray-400" />}
									placeholder={t("auth.register.passwordPlaceholder")}
									maxLength={128}
									iconRender={(visible) =>
										visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
									}
									autoComplete="new-password"
									className="floating-input"
								/>
							</Form.Item>

							<Form.Item
								name="confirmPassword"
								dependencies={["password"]}
								rules={[
									{
										required: true,
										message: t("auth.register.confirmRequired"),
									},
									({ getFieldValue }) => ({
										validator(_, value) {
											if (!value || getFieldValue("password") === value) {
												return Promise.resolve();
											}
											return Promise.reject(
												new Error(t("message.passwordMismatch")),
											);
										},
									}),
								]}
							>
								<Input.Password
									prefix={<LockOutlined className="text-gray-400" />}
									placeholder={t("auth.register.confirmPlaceholder")}
									iconRender={(visible) =>
										visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
									}
									autoComplete="new-password"
									className="floating-input"
								/>
							</Form.Item>

							<Form.Item className="mt-6">
								<Button
									type="primary"
									htmlType="submit"
									block
									loading={isLoading}
									className="auth-submit-button h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all"
								>
									{t("auth.register.finishRegister")}
								</Button>
							</Form.Item>
						</Form>
					)}

					<div className="auth-divider my-6 text-center">
						<Text type="secondary">{t("auth.register.hasAccount")}</Text>
					</div>

					<Button
						type="default"
						block
						onClick={() => navigate("/auth/login", { state: { from: { pathname: redirectTo } } })}
						className="auth-switch-link h-12 text-lg rounded-full"
					>
						{t("auth.register.loginNow")}
					</Button>
				</AnimatedWrapper>
			</div>
		</>
	);
};

export default Register;
