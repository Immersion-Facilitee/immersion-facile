import { values } from "ramda";
import {
  type ConventionDto,
  type ConventionId,
  conventionSchema,
  errors,
} from "shared";
import { validateAndParseZodSchema } from "../../../config/helpers/validateAndParseZodSchema";
import { createLogger } from "../../../utils/logger";
import type { ConventionRepository } from "../ports/ConventionRepository";

export class InMemoryConventionRepository implements ConventionRepository {
  #conventions: Record<string, ConventionDto> = {};

  public get conventions() {
    return Object.values(this.#conventions);
  }

  public async deprecateConventionsWithoutDefinitiveStatusEndedSince(
    endedSince: Date,
    statusJustification: string,
  ): Promise<ConventionId[]> {
    const conventionsToDeprecate = await Promise.all(
      values(this.#conventions)
        .filter(
          (convention) =>
            convention.dateEnd <= endedSince.toISOString() &&
            ![
              "REJECTED",
              "CANCELLED",
              "DEPRECATED",
              "ACCEPTED_BY_VALIDATOR",
            ].includes(convention.status),
        )
        .map((convention) =>
          this.update({
            ...convention,
            status: "DEPRECATED",
            statusJustification,
          }),
        ),
    );
    return conventionsToDeprecate.filter((id) => id !== undefined);
  }

  public async deleteOldConventions(_params: {
    updatedBefore: Date;
  }): Promise<ConventionId[]> {
    throw errors.generic.fakeError("Not implemented");
  }

  public async getById(id: ConventionId) {
    const convention = this.#conventions[id];
    if (!convention) return;

    return validateAndParseZodSchema({
      schemaName: "conventionSchema",
      inputSchema: conventionSchema,
      schemaParsingInput: convention,
      id: convention.id,
      logger: createLogger(__filename),
    });
  }

  public async save(convention: ConventionDto): Promise<void> {
    if (this.#conventions[convention.id])
      throw errors.convention.conflict({ conventionId: convention.id });

    this.#conventions[convention.id] = convention;
  }

  // for test purpose
  public setConventions(conventions: ConventionDto[]) {
    this.#conventions = conventions.reduce<Record<ConventionId, ConventionDto>>(
      (acc, convention) => ({
        ...acc,
        [convention.id]: convention,
      }),
      {},
    );
  }

  public async update(convention: ConventionDto) {
    const id = convention.id;
    if (!this.#conventions[id]) return;

    this.#conventions[id] = convention;
    return id;
  }
}
