import {
  type ApiConsumer,
  type ApiConsumerId,
  type ConnectedUser,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  calculateDurationInSecondsFrom,
  castError,
  type LegacySearchQueryParamsDto,
  type UserId,
  type VisitorOtpJwtPayload,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { validateAndParseZodSchema } from "../../config/helpers/validateAndParseZodSchema";
import type { OpacifiedLogger } from "../../utils/logger";

export const getSearchParams = (
  useCaseName: string,
  params: unknown,
): LegacySearchQueryParamsDto | undefined => {
  if (useCaseName === "SearchImmersion")
    return params as LegacySearchQueryParamsDto;
};

export const extractValue = (
  propName: string,
  params: unknown,
): string | undefined => {
  if (typeof params !== "object" || params === null) return undefined;

  if (propName in params) {
    return (params as Record<string, unknown>)[propName] as string;
  }

  for (const value of Object.values(params)) {
    if (typeof value === "object" && value !== null && propName in value) {
      return (value as Record<string, unknown>)[propName] as string;
    }
  }

  return undefined;
};

export type UseCaseIdentityPayload =
  | ConventionDomainJwtPayload
  | ConnectedUserDomainJwtPayload
  | ConnectedUser
  | ApiConsumer
  | VisitorOtpJwtPayload
  | void;

export const useCaseLoggerWrapper = <
  Input,
  Output,
  P extends UseCaseIdentityPayload = void,
>({
  cb,
  useCaseName,
  startDate,
  logger,
  validInput,
  identityPayload,
}: {
  cb: (param: {
    useCaseName: string;
    validInput: Input;
    identityPayload: P;
  }) => Promise<Output>;
  useCaseName: string;
  startDate: Date;
  logger: OpacifiedLogger;
  validInput: Input;
  identityPayload: P;
}): Promise<Output> =>
  cb({ useCaseName, validInput, identityPayload })
    .then((result) => {
      logger.info({
        useCaseName,
        durationInSeconds: calculateDurationInSecondsFrom(startDate),
        userId: extractConnectedUserId<P>(identityPayload),
        apiConsumerId: extractApiConsumerId<P>(identityPayload),
        logStatus: "ok",
      });

      return result;
    })
    .catch((error) => {
      const searchParams = getSearchParams(useCaseName, validInput);
      const sqlQuery =
        error instanceof Error ? (error as any)?.sqlQuery : undefined;
      logger.error({
        error,
        useCaseName,
        durationInSeconds: calculateDurationInSecondsFrom(startDate),
        searchParams,
        userId: extractConnectedUserId<P>(identityPayload),
        apiConsumerId: extractApiConsumerId<P>(identityPayload),
        ...(sqlQuery && { sqlQuery }),
        message: castError(error).message,
      });
      throw error;
    });

export const validateUseCaseInput = <Input = void>({
  useCaseName,
  inputSchema,
  input,
  logger,
}: {
  useCaseName: string;
  inputSchema: ZodSchemaWithInputMatchingOutput<Input>;
  input: Input;
  logger: OpacifiedLogger;
}): Input =>
  validateAndParseZodSchema({
    useCaseName,
    inputSchema,
    schemaParsingInput: input,
    logger,
    id: extractValue("id", input) ?? extractValue("siret", input),
  });

const extractApiConsumerId = <P extends UseCaseIdentityPayload = void>(
  identityPayload: P,
): ApiConsumerId | undefined => {
  if (
    identityPayload &&
    "id" in identityPayload &&
    "contact" in identityPayload
  )
    return identityPayload.id;
  return undefined;
};

const extractConnectedUserId = <P extends UseCaseIdentityPayload = void>(
  identityPayload: P,
): UserId | undefined => {
  if (identityPayload && "userId" in identityPayload)
    return identityPayload.userId;
  if (
    identityPayload &&
    "id" in identityPayload &&
    !("contact" in identityPayload)
  )
    return identityPayload.id;
  return undefined;
};
