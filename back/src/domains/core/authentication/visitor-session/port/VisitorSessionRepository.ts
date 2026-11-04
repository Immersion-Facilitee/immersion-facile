import type { VisitorSession, VisitorSessionId } from "shared";

export type GetVisitorSessionsByPurposeAndSubjectParams = Pick<
  VisitorSession,
  "purpose" | "subject"
>;

export type RevokeVisitorSessionParams = {
  id: VisitorSessionId;
  revokedAt: Date;
};

export interface VisitorSessionRepository {
  save(visitorSession: VisitorSession): Promise<void>;
  revoke(params: RevokeVisitorSessionParams): Promise<void>;
  getById(id: VisitorSessionId): Promise<VisitorSession | null>;
  getByPurposeAndSubject(
    params: GetVisitorSessionsByPurposeAndSubjectParams,
  ): Promise<VisitorSession[]>;
}
