/**
 * 忘記密碼頁面
 */

import {
	CheckCircleOutlined,
	EyeInvisibleOutlined,
	EyeTwoTone,
	LockOutlined,
	MailOutlined,
} from "@ant-design/icons";
import { Button, Card, Form, Input, message, Steps, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MediatorAvatar from "@/components/business/MediatorAvatar";
import AnimatedWrapper from "@/components/common/AnimatedWrapper";
import SEO from "@/components/common/SEO";
import { confirmResetPassword, resetPassword } from "@/services/api/auth";
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import "./ForgotPassword.less";

const { Title, Text } = Typography;

const CODE_LENGTH = 6;

const ForgotPassword = () => {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const [currentStep, setCurrentStep] = useState(0);
	const [email, setEmail] = useState("");
	const [verificationCode, setVerificationCode] = useState<string[]>(
		Array(CODE_LENGTH).fill(""),
	);
	const [countdown, setCountdown] = useState(0);
	const [loading, setLoading] = useState(false);
	const [resetDone, setResetDone] = useState(false);
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

	const handleSendResetEmail = async (values: { email: string }) => {
		try {
			setLoading(true);
			await resetPassword(values.email);
			setEmail(values.email);
			startCountdown();
			message.success(t("message.resetEmailSent"));
			setCurrentStep(1);
		} catch (error: unknown) {
			message.error(getErrorMessage(error, "message.sendResetFail"));
		} finally {
			setLoading(false);
		}
	};

	const handleResendCode = () => {
		if (countdown > 0) {
			message.warning(
				t("message.waitCountdown").replace("{count}", String(countdown)),
			);
			return;
		}
		handleSendResetEmail({ email });
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

	const handleResetPassword = async (values: {
		password: string;
		confirmPassword: string;
	}) => {
		if (values.password !== values.confirmPassword) {
			message.error(t("message.passwordMismatch"));
			return;
		}

		const code = verificationCode.join("");
		if (code.length !== CODE_LENGTH) {
			message.error(t("message.codeFull"));
			return;
		}

		try {
			setLoading(true);
			await confirmResetPassword(email, code, values.password);
			message.success(t("message.resetSuccess"));
			setResetDone(true);
			redirectTimerRef.current = setTimeout(() => {
				navigate("/auth/login");
			}, 2000);
		} catch (error: unknown) {
			message.error(getErrorMessage(error, "message.resetFail"));
		} finally {
			setLoading(false);
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
				title={t("auth.forgot.title")}
				description={t("auth.forgot.description")}
				keywords={t("auth.forgot.keywords")}
			/>
			<div
				className="auth-page forgot-password-page"
				role="main"
				aria-label={t("auth.forgot.pageLabel")}
			>
				<AnimatedWrapper animation="scale" delay={100}>
					<Card className="auth-card">
						<div className="auth-header" aria-labelledby="forgot-title">
							<MediatorAvatar size="medium" animated />
							<Title level={2} id="forgot-title" className="auth-title">
								{t("auth.forgot.heading")}
							</Title>
							<Text type="secondary" className="auth-subtitle">
								{t("auth.forgot.subtitle")}
							</Text>
						</div>

						<Steps
							current={currentStep}
							className="reset-steps"
							items={[
								{ title: t("auth.forgot.stepEmail") },
								{ title: t("auth.forgot.stepVerify") },
								{ title: t("auth.forgot.stepPassword") },
							]}
							aria-label={t("auth.forgot.stepsLabel")}
						/>

						{currentStep === 0 && (
							<Form
								form={form}
								name="forgot-password"
								onFinish={handleSendResetEmail}
								layout="vertical"
								size="large"
								className="auth-form"
							>
								<Form.Item
									name="email"
									label={t("auth.login.email")}
									rules={[
										{ required: true, message: t("auth.login.emailRequired") },
										{ type: "email", message: t("auth.login.emailInvalid") },
									]}
								>
									<Input
										prefix={<MailOutlined />}
										placeholder={t("auth.forgot.emailPlaceholder")}
										autoComplete="email"
									/>
								</Form.Item>

								<Form.Item>
									<Button
										type="primary"
										htmlType="submit"
										block
										loading={loading}
										className="auth-submit-button"
									>
										{t("auth.forgot.sendResetEmail")}
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
											aria-label={`${t("auth.forgot.stepVerify")} ${index + 1}`}
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
									onClick={() => setCurrentStep(2)}
									disabled={verificationCode.join("").length !== CODE_LENGTH}
									className="auth-submit-button"
									style={{ marginTop: 16 }}
								>
									{t("auth.register.verifyAndContinue")}
								</Button>
							</div>
						)}

						{currentStep === 2 && !resetDone && (
							<Form
								name="reset-password"
								onFinish={handleResetPassword}
								layout="vertical"
								size="large"
								className="auth-form"
							>
								<Form.Item
									name="password"
									label={t("auth.forgot.newPassword")}
									rules={[
										{
											required: true,
											message: t("auth.forgot.newPasswordRequired"),
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
										prefix={<LockOutlined />}
										placeholder={t("auth.forgot.newPasswordPlaceholder")}
										maxLength={128}
										iconRender={(visible) =>
											visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
										}
										autoComplete="new-password"
									/>
								</Form.Item>

								<Form.Item
									name="confirmPassword"
									label={t("auth.forgot.confirmNewPassword")}
									dependencies={["password"]}
									rules={[
										{
											required: true,
											message: t("auth.forgot.confirmNewRequired"),
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
										placeholder={t("auth.forgot.confirmNewPlaceholder")}
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
										loading={loading}
										className="auth-submit-button"
									>
										{t("auth.forgot.resetButton")}
									</Button>
								</Form.Item>
							</Form>
						)}

						{resetDone && (
							<div className="success-step">
								<CheckCircleOutlined className="success-icon" />
								<Title level={4}>{t("auth.forgot.successTitle")}</Title>
								<Text type="secondary">{t("auth.forgot.redirecting")}</Text>
							</div>
						)}

						<div className="auth-divider">
							<Text type="secondary">{t("auth.forgot.rememberPassword")}</Text>
						</div>

						<Button
							type="link"
							block
							onClick={() => navigate("/auth/login")}
							className="auth-switch-link"
						>
							{t("auth.forgot.backToLogin")}
						</Button>
					</Card>
				</AnimatedWrapper>
			</div>
		</>
	);
};

export default ForgotPassword;
