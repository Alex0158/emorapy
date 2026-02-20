/**
 * 註冊頁面
 */

import {
	CheckCircleOutlined,
	EyeInvisibleOutlined,
	EyeTwoTone,
	LockOutlined,
	MailOutlined,
	UserOutlined,
} from "@ant-design/icons";
import {
	Button,
	Card,
	Form,
	Input,
	message,
	Space,
	Steps,
	Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BearJudge from "@/components/business/BearJudge";
import AnimatedWrapper from "@/components/common/AnimatedWrapper";
import PublicRoute from "@/components/common/PublicRoute";
import SEO from "@/components/common/SEO";
import { sendVerificationCode, verifyEmail } from "@/services/api/auth";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import "./Register.less";

const { Title, Text } = Typography;

const CODE_LENGTH = 6;

const Register = () => {
	const navigate = useNavigate();
	const { register, isLoading } = useAuthStore();
	const [form] = Form.useForm();
	const [currentStep, setCurrentStep] = useState(0);
	const [email, setEmail] = useState("");
	const [nickname, setNickname] = useState("");
	const [verificationCode, setVerificationCode] = useState<string[]>(
		Array(CODE_LENGTH).fill(""),
	);
	const [countdown, setCountdown] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
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

		try {
			await sendVerificationCode(emailValue, "register");
			if (!email) {
				setEmail(emailValue);
				setNickname(form.getFieldValue("nickname") || "");
			}
			startCountdown();
			message.success(t("message.codeSent"));
			setCurrentStep(1);
		} catch (error: unknown) {
			message.error(getErrorMessage(error, "message.sendCodeFail"));
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

	const handleVerifyCode = async () => {
		const code = verificationCode.join("");
		if (code.length !== CODE_LENGTH) {
			message.error(t("message.codeFull"));
			return;
		}

		try {
			const verified = await verifyEmail(email, code, "register");
			if (verified) {
				message.success(t("message.verifySuccess"));
				setCurrentStep(2);
			} else {
				message.error(t("message.codeError"));
				setVerificationCode(Array(CODE_LENGTH).fill(""));
				codeInputRefs.current[0]?.focus();
			}
		} catch (error: unknown) {
			message.error(getErrorMessage(error, "message.verifyFail"));
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

		try {
			await register(email, values.password, nickname || undefined);
			message.success(t("message.registerSuccess"));
			setCurrentStep(3);
			redirectTimerRef.current = setTimeout(() => {
				navigate("/profile/pairing");
			}, 3000);
		} catch (error: unknown) {
			message.error(getErrorMessage(error, "message.registerFail"));
		}
	};

	const formatCountdown = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<PublicRoute>
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
				<AnimatedWrapper animation="scale" delay={100}>
					<Card className="auth-card">
						<div className="auth-header">
							<BearJudge size="medium" animated />
							<Title level={2} className="auth-title">
								{t("auth.register.welcome")}
							</Title>
							<Text type="secondary" className="auth-subtitle">
								{t("auth.register.subtitle")}
							</Text>
						</div>

						<Steps
							current={currentStep}
							className="register-steps"
							items={[
								{ title: t("auth.register.stepEmail") },
								{ title: t("auth.register.stepVerify") },
								{ title: t("auth.register.stepPassword") },
								{ title: t("auth.register.stepDone") },
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
									label={t("auth.register.email")}
									rules={[
										{
											required: true,
											message: t("auth.register.emailRequired"),
										},
										{ type: "email", message: t("auth.register.emailInvalid") },
									]}
								>
									<Input
										prefix={<MailOutlined />}
										placeholder={t("auth.register.emailPlaceholder")}
										autoComplete="email"
									/>
								</Form.Item>

								<Form.Item name="nickname" label={t("auth.register.nickname")}>
									<Input
										prefix={<UserOutlined />}
										placeholder={t("auth.register.nicknamePlaceholder")}
										maxLength={20}
									/>
								</Form.Item>

								<Form.Item>
									<Button
										type="primary"
										htmlType="submit"
										block
										loading={isLoading}
										className="auth-submit-button"
									>
										{t("auth.register.sendCode")}
									</Button>
								</Form.Item>
							</Form>
						)}

						{currentStep === 1 && (
							<div className="verification-step">
								<div className="verification-info">
									<Text>{t("auth.register.codeSentTo")}</Text>
									<Text strong>{email}</Text>
								</div>

								<div className="code-input-group">
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
											className="code-input"
											aria-label={`${t("auth.register.stepVerify")} ${index + 1}`}
											autoFocus={index === 0}
										/>
									))}
								</div>

								<div className="countdown-info">
									<Text type="secondary">
										{t("auth.register.codeExpiry")} {formatCountdown(countdown)}
									</Text>
								</div>

								<Button
									type="link"
									onClick={handleResendCode}
									disabled={countdown > 0}
									className="resend-code-link"
								>
									{t("auth.register.resendCode")}
								</Button>

								<Button
									type="primary"
									block
									onClick={handleVerifyCode}
									disabled={verificationCode.join("").length !== CODE_LENGTH}
									className="auth-submit-button"
									style={{ marginTop: 16 }}
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
									label={t("auth.register.setPassword")}
									rules={[
										{
											required: true,
											message: t("auth.login.passwordRequired"),
										},
										{ min: 8, message: t("auth.register.passwordMin") },
										{
											pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
											message: t("auth.register.passwordPattern"),
										},
									]}
								>
									<Input.Password
										prefix={<LockOutlined />}
										placeholder={t("auth.register.passwordPlaceholder")}
										iconRender={(visible) =>
											visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
										}
										autoComplete="new-password"
									/>
								</Form.Item>

								<Form.Item
									name="confirmPassword"
									label={t("auth.register.confirmPassword")}
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
										prefix={<LockOutlined />}
										placeholder={t("auth.register.confirmPlaceholder")}
										iconRender={(visible) =>
											visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
										}
										autoComplete="new-password"
									/>
								</Form.Item>

								<Form.Item>
									<Button
										type="primary"
										htmlType="submit"
										block
										loading={isLoading}
										className="auth-submit-button"
									>
										{t("auth.register.finishRegister")}
									</Button>
								</Form.Item>
							</Form>
						)}

						{currentStep === 3 && (
							<div className="success-step">
								<CheckCircleOutlined className="success-icon" />
								<Title level={3}>{t("auth.register.successTitle")}</Title>
								<Text type="secondary">{t("auth.register.welcomeText")}</Text>
								<Text
									type="secondary"
									style={{ display: "block", marginTop: 8 }}
								>
									{t("auth.register.readyToUse")}
								</Text>
								<Space style={{ marginTop: 24 }}>
									<Button
										type="primary"
										onClick={() => {
											if (redirectTimerRef.current)
												clearTimeout(redirectTimerRef.current);
											navigate("/profile/pairing");
										}}
									>
										{t("auth.register.startPairing")}
									</Button>
									<Button
										onClick={() => {
											if (redirectTimerRef.current)
												clearTimeout(redirectTimerRef.current);
											navigate("/");
										}}
									>
										{t("register.action.later")}
									</Button>
								</Space>
							</div>
						)}

						<div className="auth-divider">
							<Text type="secondary">{t("auth.register.hasAccount")}</Text>
						</div>

						<Button
							type="link"
							block
							onClick={() => navigate("/auth/login")}
							className="auth-switch-link"
						>
							{t("auth.register.loginNow")}
						</Button>
					</Card>
				</AnimatedWrapper>
			</div>
		</PublicRoute>
	);
};

export default Register;
