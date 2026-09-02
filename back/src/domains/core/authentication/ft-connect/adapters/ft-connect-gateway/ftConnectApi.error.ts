import type { AxiosError } from "axios";
import { FTConnectError, HTTP_STATUS, ManagedFTConnectError } from "shared";
import { UnhandledError } from "../../../../../../config/helpers/handleHttpJsonResponseError";
import type { FtConnectExternalRoutes } from "./ftConnectApi.routes";

type FtConnectTargetsKind = keyof FtConnectExternalRoutes;

class ConnectionRefusedError extends Error {
  constructor(
    public override readonly message: string = "Could not connect to server",
    public override readonly cause?: Error,
  ) {
    super();
    // Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
  }
}

export const ftConnectNetworkErrorMessage =
  "Nous n'avons pas réussi à joindre pôle emploi connect.";

// ! In a map the highest priority is given to the lasted entry
export const ftConnectErrorStrategy = (
  error: AxiosError,
  context: FtConnectTargetsKind,
) =>
  new Map<boolean, UnhandledError | FTConnectError | ManagedFTConnectError>([
    // Generic catch all Http errors
    [
      isHttpClientError4XX(error),
      makeRawRedirectError(
        "Une erreur est survenue lors de la connexion aux services France Travail",
        error,
      ),
    ],
    [
      isHttpServerError5XX(error),
      makeRawRedirectError(
        "Une erreur est survenue lors de la connexion aux services France Travail",
        error,
      ),
    ],
    [hasNoErrorIdentifier(error), makeUnknownError(error)],
    // Specific error management
    [
      error instanceof ConnectionRefusedError,
      makeRawRedirectError(
        "Le serveur distant de France Travail refuse la connexion.",
        error,
      ),
    ],
    [
      isGetUserInfoServerInternalError(context, error),
      makeRawRedirectError(
        "Nous n’avons pas réussi à récupérer vos informations personnelles pôle emploi connect.",
        error,
      ),
    ],
    [
      isGetUserStatusInfoServerInternalError(context, error),
      makeRawRedirectError(
        "Nous n’avons pas réussi à récupérer votre status pôle emploi connect.",
        error,
      ),
    ],
    [
      isGetUserBirthDateServerInternalError(context, error),
      makeRawRedirectError(
        "Nous n’avons pas réussi à récupérer votre date de naissance pôle emploi connect.",
        error,
      ),
    ],
    [
      isAdvisorsServerInternalError(context, error),
      makeRawRedirectError(
        "Nous n’avons pas réussi à récupérer vos conseillers référents alors que vous êtes demandeur d’emploi. Cette situation ne devrait pas survenir.",
        error,
      ),
    ],
    [
      isGetUserContactDetailsServerInternalError(context, error),
      makeRawRedirectError(
        "Nous n’avons pas réussi à récupérer vos coordonnées pôle emploi connect.",
        error,
      ),
    ],
    [
      isAdvisorForbiddenError(error, context),
      new ManagedFTConnectError("ftConnectAdvisorForbiddenAccess", error),
    ],
    [
      isGetUserInfoForbiddenError(error, context),
      new ManagedFTConnectError("ftConnectGetUserInfoForbiddenAccess", error),
    ],
    [
      isGetUserStatusInfoForbiddenError(error, context),
      new ManagedFTConnectError(
        "ftConnectGetUserStatusInfoForbiddenAccess",
        error,
      ),
    ],
    [
      isGetUserBirthDateForbiddenError(error, context),
      new ManagedFTConnectError(
        "ftConnectGetUserBirthDateForbiddenAccess",
        error,
      ),
    ],
    [
      isGetUserContactDetailsForbiddenError(error, context),
      new ManagedFTConnectError(
        "ftConnectGetUserContactDetailsForbiddenAccess",
        error,
      ),
    ],
    [
      error.code === "ECONNABORTED",
      new ManagedFTConnectError("ftConnectConnectionAborted", error),
    ],
    [
      error.message === "Network Error",
      new FTConnectError(
        "Une erreur est survenue - Erreur réseau",
        ftConnectNetworkErrorMessage,
        error,
      ),
    ],
    [
      isInvalidGrantError(context, error),
      new ManagedFTConnectError("ftConnectInvalidGrant", error),
    ],
  ]);

const isInvalidGrantError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "exchangeCodeForAccessToken" &&
  error.response?.status === HTTP_STATUS.BAD_REQUEST &&
  // biome-ignore lint/correctness/noUnsafeOptionalChaining: Legacy code and FT Response standards not trusted
  (error.response?.data as { error?: string }).error === "invalid_grant";

const hasNoErrorIdentifier = (error: AxiosError) =>
  !error.response?.status && !error.code;

const rawRedirectTitle = (error: AxiosError) =>
  `Une erreur est survenue - ${error.response?.status ?? error.code}`;

const isGetUserInfoServerInternalError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "getUserInfo" &&
  error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR;

const isGetUserStatusInfoServerInternalError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "getUserStatutInfo" &&
  error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR;

const isGetUserBirthDateServerInternalError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "getUserBirthDate" &&
  error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR;

const isGetUserContactDetailsServerInternalError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "getUserContactDetails" &&
  error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR;

const isAdvisorsServerInternalError = (
  context: FtConnectTargetsKind,
  error: AxiosError,
) =>
  context === "getAdvisorsInfo" &&
  error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR;

const makeUnknownError = (error: AxiosError) =>
  new UnhandledError("Code erreur inconnu", error);

const makeRawRedirectError = (
  message: string,
  error: AxiosError<any, any>,
): FTConnectError =>
  new FTConnectError(rawRedirectTitle(error), message, error);

const isAdvisorForbiddenError = (
  error: AxiosError,
  context: FtConnectTargetsKind,
): boolean =>
  error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
  context === "getAdvisorsInfo";

const isGetUserInfoForbiddenError = (
  error: AxiosError<any, any>,
  context: FtConnectTargetsKind,
): boolean =>
  error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
  context === "getUserInfo";

const isGetUserStatusInfoForbiddenError = (
  error: AxiosError<any, any>,
  context: FtConnectTargetsKind,
): boolean =>
  error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
  context === "getUserStatutInfo";

const isGetUserBirthDateForbiddenError = (
  error: AxiosError<any, any>,
  context: FtConnectTargetsKind,
): boolean =>
  error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
  context === "getUserBirthDate";

const isGetUserContactDetailsForbiddenError = (
  error: AxiosError<any, any>,
  context: FtConnectTargetsKind,
): boolean =>
  error.response?.status === HTTP_STATUS.UNAUTHORIZED &&
  context === "getUserContactDetails";

const isHttpServerError5XX = (error: AxiosError): boolean =>
  !!error &&
  !!error.response &&
  !!error.response.status &&
  error.response.status.toString().startsWith("5");

const isHttpClientError4XX = (error: AxiosError): boolean =>
  !!error &&
  !!error.response &&
  !!error.response.status &&
  error.response.status.toString().startsWith("4");
