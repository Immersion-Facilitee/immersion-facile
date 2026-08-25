import type { ConventionDto, ConventionId, DateString } from "shared";

export interface ConventionRepository {
  save: (conventionDto: ConventionDto, now?: DateString) => Promise<void>;
  getById: (id: ConventionId) => Promise<ConventionDto | undefined>;
  update: (
    conventionDto: ConventionDto,
    now?: DateString,
  ) => Promise<ConventionId | undefined>;
  deprecateConventionsWithoutDefinitiveStatusEndedSince: (
    endedSince: Date,
    statusJustification: string,
    now?: DateString,
  ) => Promise<ConventionId[]>;
  deleteOldConventions: (params: {
    updatedBefore: Date;
  }) => Promise<ConventionId[]>;
}
