import crypto from 'crypto';
import type { AuthChallenge, Prisma, PrismaClient, VerificationType } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';
import logger from '../config/logger';
import type { BackendLocale } from '../i18n';
import type {
  EmailVerificationResult,
  RegistrationVerificationResult,
  VerificationCodeDeliveryResult,
} from '../types/auth.types';
import { Errors, AppError } from '../utils/errors';
import { normalizeAuthEmail } from '../utils/auth-email';
import { generateVerificationCode } from '../utils/session';
import {
  emailService,
  type EmailDeliveryReceipt,
  type EmailService,
} from './email.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const PROOF_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type ChallengeTransaction = Prisma.TransactionClient;

export interface AuthChallengeDependencies {
  db: PrismaClient;
  delivery: Pick<EmailService, 'sendVerificationCode'>;
  otpPepper: string;
  now: () => Date;
  generateCode: () => string;
  randomUUID: () => string;
  randomBytes: (size: number) => Buffer;
}

export type { EmailVerificationResult, RegistrationVerificationResult } from '../types/auth.types';

export function getVerificationCodeDeliveryResult(): VerificationCodeDeliveryResult {
  return {
    expires_in: Math.floor(OTP_TTL_MS / 1000),
    resend_after: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

const defaultDependencies: AuthChallengeDependencies = {
  db: prisma,
  delivery: emailService,
  otpPepper: env.EMAIL_OTP_PEPPER || '',
  now: () => new Date(),
  generateCode: generateVerificationCode,
  randomUUID: () => crypto.randomUUID(),
  randomBytes: (size) => crypto.randomBytes(size),
};

function isPrismaConflict(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && ['P2002', 'P2034'].includes(String((error as { code?: unknown }).code))
  );
}

function digestRegistrationProof(proof: string): string {
  return crypto.createHash('sha256').update(proof).digest('hex');
}

function safeCodeEqual(actual: string, expected: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(actual) || !/^[0-9a-f]{64}$/.test(expected)) {
    return false;
  }
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export class AuthChallengeService {
  constructor(private readonly dependencies: AuthChallengeDependencies = defaultDependencies) {}

  private getOtpPepper(): string {
    const pepper = this.dependencies.otpPepper;
    if (pepper.length < 32) throw Errors.EMAIL_DELIVERY_UNAVAILABLE();
    return pepper;
  }

  private digestCode(challengeId: string, email: string, type: VerificationType, code: string): string {
    return crypto
      .createHmac('sha256', this.getOtpPepper())
      .update(`v1\0${challengeId}\0${type}\0${email}\0${code}`)
      .digest('hex');
  }

  async issue(
    emailInput: string,
    type: VerificationType,
    locale: BackendLocale = 'zh-TW'
  ): Promise<VerificationCodeDeliveryResult> {
    const email = normalizeAuthEmail(emailInput);
    const now = this.dependencies.now();
    const challengeId = this.dependencies.randomUUID();
    const code = this.dependencies.generateCode();
    const codeDigest = this.digestCode(challengeId, email, type, code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const cooldownBoundary = new Date(now.getTime() - RESEND_COOLDOWN_MS);

    let challenge: Pick<AuthChallenge, 'id'>;
    try {
      challenge = await this.dependencies.db.$transaction(async (tx) => {
        await tx.authChallenge.updateMany({
          where: {
            email,
            type,
            consumed_at: null,
            invalidated_at: null,
            OR: [
              { expires_at: { lte: now } },
              { registration_proof_expires_at: { lte: now } },
            ],
          },
          data: { invalidated_at: now },
        });

        const active = await tx.authChallenge.findFirst({
          where: {
            email,
            type,
            consumed_at: null,
            invalidated_at: null,
            source: 'provider',
            delivery_status: { in: ['pending', 'provider_accepted'] },
          },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            created_at: true,
            provider_accepted_at: true,
          },
        });
        const cooldownStartedAt = active?.provider_accepted_at ?? active?.created_at;
        if (cooldownStartedAt && cooldownStartedAt > cooldownBoundary) {
          throw Errors.RATE_LIMIT_EXCEEDED('請稍後再試');
        }

        // Once the resend cooldown has elapsed, retire every prior active code
        // before creating the replacement. This makes the old email code
        // unusable as soon as the new delivery attempt begins.
        await tx.authChallenge.updateMany({
          where: {
            email,
            type,
            source: 'provider',
            delivery_status: { in: ['pending', 'provider_accepted'] },
            consumed_at: null,
            invalidated_at: null,
          },
          data: { invalidated_at: now },
        });

        return tx.authChallenge.create({
          data: {
            id: challengeId,
            email,
            type,
            code_digest: codeDigest,
            source: 'provider',
            delivery_status: 'pending',
            expires_at: expiresAt,
          },
          select: { id: true },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (isPrismaConflict(error)) throw Errors.RATE_LIMIT_EXCEEDED('請稍後再試');
      throw error;
    }

    let receipt: EmailDeliveryReceipt;
    try {
      receipt = await this.dependencies.delivery.sendVerificationCode(email, code, type, locale);
    } catch {
      const failedAt = this.dependencies.now();
      await this.dependencies.db.authChallenge.updateMany({
        where: {
          id: challenge.id,
          source: 'provider',
          delivery_status: 'pending',
          invalidated_at: null,
        },
        data: {
          delivery_status: 'failed',
          delivery_failed_at: failedAt,
          invalidated_at: failedAt,
        },
      }).catch(() => {
        logger.error('Auth challenge failure state persistence failed', { purpose: type });
      });
      logger.error('Auth challenge delivery failed', { purpose: type });
      throw Errors.EMAIL_DELIVERY_UNAVAILABLE();
    }

    const accepted = await this.dependencies.db.authChallenge.updateMany({
      where: {
        id: challenge.id,
        source: 'provider',
        delivery_status: 'pending',
        consumed_at: null,
        invalidated_at: null,
      },
      data: {
        delivery_status: 'provider_accepted',
        provider_accepted_at: receipt.acceptedAt,
        provider_message_id_digest: receipt.providerMessageIdDigest,
        // Give the user the full OTP window after the provider accepts delivery.
        expires_at: new Date(receipt.acceptedAt.getTime() + OTP_TTL_MS),
      },
    });
    if (accepted.count !== 1) {
      logger.error('Auth challenge acceptance state persistence failed', { purpose: type });
      throw Errors.EMAIL_DELIVERY_UNAVAILABLE();
    }

    logger.info('Auth challenge delivery accepted', { purpose: type });
    return getVerificationCodeDeliveryResult();
  }

  async verifyRegistrationCode(emailInput: string, code: string): Promise<RegistrationVerificationResult> {
    const email = normalizeAuthEmail(emailInput);
    const now = this.dependencies.now();
    const proof = `rp1_${this.dependencies.randomBytes(32).toString('base64url')}`;
    const proofDigest = digestRegistrationProof(proof);
    const proofExpiresAt = new Date(now.getTime() + PROOF_TTL_MS);

    const outcome = await this.dependencies.db.$transaction(async (tx) => {
      const challenge = await this.loadActiveChallenge(tx, email, 'register');
      if (!challenge) return 'invalid' as const;
      if (challenge.expires_at <= now) {
        await this.invalidateChallenge(tx, challenge.id, now);
        return 'expired' as const;
      }
      if (challenge.attempt_count >= MAX_ATTEMPTS) return 'invalid' as const;
      if (!safeCodeEqual(this.digestCode(challenge.id, email, 'register', code), challenge.code_digest)) {
        await this.recordInvalidAttempt(tx, challenge.id, now);
        return 'invalid' as const;
      }

      const verified = await tx.authChallenge.updateMany({
        where: this.buildVerificationCas(challenge, now),
        data: {
          verified_at: now,
          registration_proof_digest: proofDigest,
          registration_proof_expires_at: proofExpiresAt,
        },
      });
      return verified.count === 1 ? 'verified' as const : 'invalid' as const;
    }, { isolationLevel: 'Serializable' });

    if (outcome === 'expired') throw Errors.CODE_EXPIRED();
    if (outcome !== 'verified') throw Errors.INVALID_CODE();

    return {
      verified: true,
      registration_proof: proof,
      registration_proof_expires_in: Math.floor(PROOF_TTL_MS / 1000),
    };
  }

  async verifyExistingEmail(emailInput: string, code: string): Promise<EmailVerificationResult> {
    const email = normalizeAuthEmail(emailInput);
    const now = this.dependencies.now();

    const outcome = await this.dependencies.db.$transaction(async (tx) => {
      const challenge = await this.loadActiveChallenge(tx, email, 'verify_email');
      if (!challenge) return 'invalid' as const;
      if (challenge.expires_at <= now) {
        await this.invalidateChallenge(tx, challenge.id, now);
        return 'expired' as const;
      }
      if (challenge.attempt_count >= MAX_ATTEMPTS) return 'invalid' as const;
      if (!safeCodeEqual(this.digestCode(challenge.id, email, 'verify_email', code), challenge.code_digest)) {
        await this.recordInvalidAttempt(tx, challenge.id, now);
        return 'invalid' as const;
      }

      const verified = await tx.authChallenge.updateMany({
        where: this.buildVerificationCas(challenge, now),
        data: { verified_at: now, consumed_at: now },
      });
      if (verified.count !== 1) return 'invalid' as const;

      const user = await tx.user.updateMany({
        where: { email, is_active: true },
        data: { email_verified: true },
      });
      if (user.count !== 1) {
        throw Errors.INVALID_CODE();
      }
      return 'verified' as const;
    }, { isolationLevel: 'Serializable' });

    if (outcome === 'expired') throw Errors.CODE_EXPIRED();
    if (outcome !== 'verified') throw Errors.INVALID_CODE();

    return { verified: true };
  }

  async consumeRegistrationProof(
    tx: ChallengeTransaction,
    emailInput: string,
    proof: string,
    now: Date = this.dependencies.now()
  ): Promise<void> {
    const email = normalizeAuthEmail(emailInput);
    if (!/^rp1_[A-Za-z0-9_-]{43}$/.test(proof)) {
      throw Errors.REGISTRATION_PROOF_INVALID();
    }
    const proofDigest = digestRegistrationProof(proof);
    const challenge = await tx.authChallenge.findUnique({
      where: { registration_proof_digest: proofDigest },
    });
    if (!challenge || challenge.email !== email || challenge.type !== 'register') {
      throw Errors.REGISTRATION_PROOF_INVALID();
    }
    if (!challenge.registration_proof_expires_at || challenge.registration_proof_expires_at <= now) {
      throw Errors.REGISTRATION_PROOF_EXPIRED();
    }

    const consumed = await tx.authChallenge.updateMany({
      where: {
        id: challenge.id,
        email,
        type: 'register',
        OR: [
          { source: 'provider', delivery_status: 'provider_accepted' },
          { source: 'release_fixture', delivery_status: 'release_fixture_ready' },
        ],
        verified_at: { not: null },
        consumed_at: null,
        invalidated_at: null,
        registration_proof_digest: proofDigest,
        registration_proof_expires_at: { gt: now },
      },
      data: { consumed_at: now },
    });
    if (consumed.count !== 1) throw Errors.REGISTRATION_PROOF_INVALID();
  }

  async verifyAndConsumeResetCode(
    tx: ChallengeTransaction,
    emailInput: string,
    code: string,
    now: Date = this.dependencies.now()
  ): Promise<AppError | null> {
    const email = normalizeAuthEmail(emailInput);
    const challenge = await this.loadActiveChallenge(tx, email, 'reset_password');
    if (!challenge) return Errors.INVALID_CODE();
    if (challenge.expires_at <= now) {
      await this.invalidateChallenge(tx, challenge.id, now);
      return Errors.CODE_EXPIRED();
    }
    if (challenge.attempt_count >= MAX_ATTEMPTS) return Errors.INVALID_CODE();
    if (!safeCodeEqual(this.digestCode(challenge.id, email, 'reset_password', code), challenge.code_digest)) {
      await this.recordInvalidAttempt(tx, challenge.id, now);
      return Errors.INVALID_CODE();
    }

    const consumed = await tx.authChallenge.updateMany({
      where: this.buildVerificationCas(challenge, now),
      data: { verified_at: now, consumed_at: now },
    });
    return consumed.count === 1 ? null : Errors.INVALID_CODE();
  }

  private loadActiveChallenge(
    tx: ChallengeTransaction,
    email: string,
    type: VerificationType
  ): Promise<AuthChallenge | null> {
    return tx.authChallenge.findFirst({
      where: {
        email,
        type,
        source: 'provider',
        delivery_status: 'provider_accepted',
        verified_at: null,
        consumed_at: null,
        invalidated_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  private async invalidateChallenge(
    tx: ChallengeTransaction,
    challengeId: string,
    now: Date
  ): Promise<void> {
    await tx.authChallenge.updateMany({
      where: { id: challengeId, consumed_at: null, invalidated_at: null },
      data: { invalidated_at: now },
    });
  }

  private buildVerificationCas(challenge: AuthChallenge, now: Date): Prisma.AuthChallengeWhereInput {
    return {
      id: challenge.id,
      source: 'provider',
      delivery_status: 'provider_accepted',
      attempt_count: challenge.attempt_count,
      expires_at: { gt: now },
      verified_at: null,
      consumed_at: null,
      invalidated_at: null,
    };
  }

  private async recordInvalidAttempt(
    tx: ChallengeTransaction,
    challengeId: string,
    now: Date
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "auth_challenges"
      SET
        "attempt_count" = "attempt_count" + 1,
        "invalidated_at" = CASE
          WHEN "attempt_count" + 1 >= ${MAX_ATTEMPTS} THEN ${now}
          ELSE "invalidated_at"
        END,
        "updated_at" = ${now}
      WHERE "id" = ${challengeId}
        AND "delivery_status" = 'provider_accepted'
        AND "source" = 'provider'
        AND "verified_at" IS NULL
        AND "consumed_at" IS NULL
        AND "invalidated_at" IS NULL
        AND "expires_at" > ${now}
        AND "attempt_count" < ${MAX_ATTEMPTS}
    `;
  }
}

export const authChallengeService = new AuthChallengeService();
