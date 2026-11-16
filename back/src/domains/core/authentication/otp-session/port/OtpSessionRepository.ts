import type { OtpSession, OtpSessionId } from "shared";

export type GetOtpSessionsByPurposeAndSubjectParams = Pick<
  OtpSession,
  "purpose" | "subject"
>;

export type RevokeOtpSessionParams = {
  id: OtpSessionId;
  revokedAt: Date;
};

export interface OtpSessionRepository {
  save(otpSession: OtpSession): Promise<void>;
  revoke(params: RevokeOtpSessionParams): Promise<void>;
  getById(id: OtpSessionId): Promise<OtpSession | null>;
  getByPurposeAndSubject(
    params: GetOtpSessionsByPurposeAndSubjectParams,
  ): Promise<OtpSession[]>;
}
