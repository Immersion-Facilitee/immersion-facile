import type { LocationId } from "../address/address.dto";
import type {
  AgencyId,
  AgencyStatus,
  AgencyWithUsersRights,
} from "../agency/agency.dto";
import type {
  ApiConsumerId,
  ApiConsumerRightName,
  ApiConsumerSubscriptionId,
} from "../apiConsumer/ApiConsumer";
import type { AssessmentMode } from "../assessment/assessment.dto";
import { authExpiredMessage, type OAuthState } from "../auth/auth.dto";
import type {
  ConventionDto,
  ConventionId,
  ConventionStatus,
  ImmersionObjective,
  ReminderKind,
} from "../convention/convention.dto";
import type { ConventionDraftId } from "../convention/conventionDraftId";
import type { ConventionTemplateId } from "../convention/conventionTemplate.dto";
import type {
  DiscussionId,
  DiscussionKind,
  DiscussionStatus,
  RejectionKind,
} from "../discussion/discussion.dto";
import type { EmailParamsByEmailType } from "../email/EmailParamsByEmailType";
import type { Email } from "../email/email.dto";
import type {
  FederatedIdentityProvider,
  FtExternalId,
} from "../federatedIdentities/federatedIdentity.dto";
import type { StoredFileId } from "../file/file.dto";
import type { FileValidationError } from "../file/file.validators";
import type { ContactMode } from "../formEstablishment/FormEstablishment.dto";
import type { GroupSlug } from "../group/group.dto";
import type {
  NotificationId,
  NotificationKind,
} from "../notifications/notifications.dto";
import type {
  AgencyModifierRole,
  AgencyRole,
  ConventionRole,
  Role,
  SignatoryRole,
} from "../role/role.dto";
import { titleByRole } from "../role/role.utils";
import type { AppellationCode } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { ShortLinkId } from "../shortLink/shortLink.dto";
import type { SiretDto } from "../siret/siret";
import type { User, UserId } from "../user/user.dto";
import {
  convertLocaleDateToUtcTimezoneDate,
  type DateRange,
  type OptionalDateRange,
  toDisplayedDate,
} from "../utils/date";
import { ManagedFTConnectError } from "./ftConnectErrors";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestApiError,
  UnauthorizedError,
  UnavailableApiError,
} from "./httpErrors";

export const badSchemaErrorMessagePrefix = "Schema validation failed";

export const errors = {
  fetch: {
    errorResponse: async (errorResponse: Response) => {
      const textbody = await errorResponse
        .text()
        .catch((_error) => "no text in body");
      return new Error(
        `Fetch error response. Status code '${errorResponse.status}' '${errorResponse.statusText}'. Body:'${textbody}'`,
      );
    },
  },
  email: {
    missingContentParts: (kind: keyof EmailParamsByEmailType) =>
      new BadRequestError(
        `Erreur de construction de modèle d'email - Pas de contenu pour le modèle '${kind}'`,
      ),
  },
  pdfGenerator: {
    makeFailed: ({
      body,
      conventionId,
      requestId,
      status,
    }: {
      requestId: string;
      conventionId: ConventionId;
      status: number;
      body: any;
    }) =>
      new Error(
        `[requestId : ${requestId}, conventionId : ${conventionId}] Pdf generation failed with status ${status} - ${body}`,
      ),
  },
  partner: {
    failure: ({
      serviceName,
      message,
    }: {
      serviceName: string;
      message: string;
    }) => new Error(`[${serviceName}] : ${message}`),
    tooManyRequests: ({ serviceName }: { serviceName: string }) =>
      new TooManyRequestApiError(
        `Le service ${serviceName} a subit trop de sollicitations. Réessayez dans quelques minutes.`,
      ),
  },
  event: {
    deleteWithBadOccuredAtRange: ({ from, to }: DateRange) =>
      new ForbiddenError(
        `Deleting events - range not supported :  from > ${from} - to > ${to}`,
      ),
    saveNewPublicationFailed: (eventId: string) =>
      new Error(`saveNewPublication of event ${eventId} failed`),
    subscriptionFailed: ({
      subscriptionId,
      error,
      errorMessage,
      eventId,
      eventTopic,
    }: {
      eventId: string; // Domain event on back only
      eventTopic: string;
      subscriptionId: string;
      errorMessage: string;
      error: any;
    }) =>
      new Error(
        [
          `Could not process event with id : ${eventId}.`,
          `Subscription ${subscriptionId} failed on topic ${eventTopic}.`,
          `Error was : ${errorMessage}`,
        ].join("\n"),
        { cause: error },
      ),
  },
  config: {
    badConfig: (message: string) => new Error(message),
  },
  ftConnect: {
    noAuth: () => new ManagedFTConnectError("ftConnectNoAuthorisation"),
    associationFailed: ({
      conventionId,
      ftExternalId,
      rowCount,
    }: {
      rowCount: number;
      conventionId: ConventionId;
      ftExternalId: FtExternalId;
    }) =>
      new Error(
        `Association between Convention and userAdvisor failed. rowCount: ${rowCount}, conventionId: ${conventionId}, ftExternalId: ${ftExternalId}`,
      ),
  },
  generic: {
    badDateRange: ({ from, to }: OptionalDateRange) =>
      new Error(`L'intervale de temps n'est pas supporté. De: ${from} À:${to}`),
    notAnError: () => new Error("Not an error class"),
    testError: (message: string) => new Error(message),
    fakeError: (message: string, httpStatus?: number) => {
      const error = new Error(message);
      if (httpStatus) (error as any).httpStatus = httpStatus;
      return error;
    },
    zodIssues: ({
      schemaName,
      issues,
    }: {
      issues: string[];
      schemaName?: string;
    }) =>
      new BadRequestError(
        `Il y a une erreur avec les données de cette ressource ${schemaName ? `(${schemaName}) ` : ""}: ${issues.join("\n")}`,
      ),
    httpStatus: ({ status, message }: { status?: number; message: string }) =>
      new Error(`Erreur HTTP ${status ? `(${status}) ` : ""}: ${message}`),
    unsupportedLimit: (limit: number) =>
      new Error(`La limite ${limit} n'est pas supportée.`),
    unsupportedStatus: ({
      body,
      status,
      serviceName,
    }: {
      status: number;
      body: any;
      serviceName: string;
    }) =>
      new Error(
        `Unsupported response status form ${serviceName} : ${
          status
        } with body '${JSON.stringify(body, null, 2)}'`,
      ),
  },
  file: {
    missingFileInParams: () => new BadRequestError("No file provided."),
    fileAlreadyExist: (id: StoredFileId) =>
      new ConflictError(`File ${id} already exist.`),
    missingFile: (id: StoredFileId) => new NotFoundError(`File ${id} missing.`),
    invalidFile: (validationResult: FileValidationError) =>
      new BadRequestError(validationResult.message),
  },
  assessment: {
    lastDayOfPresenceNotInConventionRange: () =>
      new BadRequestError(
        `La date du dernier jour de présence doit être comprise entre la date de début et la date de fin de l'immersion.`,
      ),
    numberOfMissedHoursExceedsScheduled: () =>
      new BadRequestError(
        "Le nombre d'heures manquées ne peut pas dépasser le nombre total d'heures prévues dans la convention.",
      ),
    partialCompletionDetailsRequired: () =>
      new BadRequestError(
        "Vous avez indiqué un changement d'horaires. Pour continuer, merci de préciser au moins une information : la date de fin réelle ou le nombre d'heures manquées.",
      ),
    contractStartDateBeforeImmersionStart: ({
      immersionDateStart,
    }: {
      immersionDateStart: string;
    }) =>
      new BadRequestError(
        `La date début du contrat ne peut pas être antérieure à la date de début d'immersion: ${toDisplayedDate({ date: convertLocaleDateToUtcTimezoneDate(new Date(immersionDateStart)) })}.`,
      ),
    alreadyExist: (conventionId: ConventionId) =>
      new ConflictError(
        `Il n'est pas possible de créer le bilan car un bilan existe déjà pour la convention '${conventionId}'.`,
      ),
    assessmentAlreadyFullfilled: (conventionId: ConventionId) =>
      new BadRequestError(
        `Le bilan pour la convention '${conventionId}' a déjà été complété.`,
      ),
    badStatus: (status: ConventionStatus) =>
      new BadRequestError(
        `Il n'est pas possible de créer un bilan d'immersion pour une convention qui n'est pas validée, le status actuel étant '${status}'.`,
      ),
    notFound: (conventionId: ConventionId) =>
      new NotFoundError(
        `Il n'y a pas de bilan pour la convention ${conventionId}.`,
      ),
    forbidden: (mode: AssessmentMode) =>
      new ForbiddenError(
        `Seul le tuteur de l'entreprise ou bien les conseillers et les validateurs de l'agence prescriptrice peuvent ${
          mode === "GetAssessment" ? "récupérer" : "créer"
        } le bilan.`,
      ),
    conventionEndingInMoreThanOneDay: () =>
      new BadRequestError(
        `Impossible de relancer la demande de completion du bilan pour les conventions se terminant dans plus d'un jour.`,
      ),
    conventionIdMismatch: () =>
      new ForbiddenError(
        "Il y a un décalage d'identifiant de convention dans les données envoyées.",
      ),
    missingAssessment: ({ conventionId }: { conventionId: ConventionId }) =>
      new BadRequestError(
        `Il manque le bilan dans les paramêtres pour la convention ${conventionId}`,
      ),
    sendAssessmentLinkForbidden: () =>
      new ForbiddenError(
        "Seul les signataires ainsi que les conseillers et les validateurs de l'agence prescriptrice sont autorisés à renvoyer un lien de bilan.",
      ),
    sendAssessmentSignatureReminderNotAllowedForStatus: ({
      status,
    }: {
      status: ConventionStatus;
    }) =>
      new BadRequestError(
        `Impossible de relancer la signature du bilan pour les conventions ayant le statut "${status}".`,
      ),
    sendAssessmentSignatureReminderForbidden: () =>
      new ForbiddenError(
        "Vous n'êtes pas autorisé à relancer la signature du bilan pour cette convention.",
      ),
    sendAssessmentSignatureReminderAssessmentNotEligible: () =>
      new BadRequestError(
        "Impossible de relancer la signature du bilan de cette immersion car le candidat n'est jamais venu.",
      ),
    alreadySigned: (conventionId: ConventionId) =>
      new ConflictError(
        `Le bilan pour la convention '${conventionId}' a déjà été signé par le bénéficiaire.`,
      ),
    signForbidden: () =>
      new ForbiddenError("Seul le bénéficiaire peut signer le bilan."),
    signNotAvailableForLegacyAssessment: () =>
      new ForbiddenError(
        "La signature n'est pas disponible pour les anciens bilans.",
      ),
    sendAssessmentLinkNotAllowedForStatus: ({
      status,
    }: {
      status: ConventionStatus;
    }) =>
      new BadRequestError(
        `Impossible de relancer la demande de completion du bilan pour les conventions ayant le statut "${status}".`,
      ),
    assessmentLinkAlreadySent: ({
      notificationKind,
      minHoursBetweenReminder,
      timeRemaining,
    }: {
      notificationKind: NotificationKind;
      minHoursBetweenReminder: number;
      timeRemaining: string;
    }) =>
      new TooManyRequestApiError(
        `Une relance a été envoyée il y a moins de ${minHoursBetweenReminder}h par ${notificationKind}. Vous pourrez réessayer dans ${timeRemaining}.`,
      ),
  },
  auth: {
    accessTokenErrorType: ({
      actualType,
      expectedType,
    }: {
      actualType: FederatedIdentityProvider;
      expectedType: FederatedIdentityProvider;
    }) =>
      new BadRequestError(
        `Erreur sur le type d'access token qui est ${actualType} alors qu'elle devrait être ${expectedType}.`,
      ),
    otherRenewalNotSupported: (provider: FederatedIdentityProvider) =>
      new ForbiddenError(
        `Le renouvellement d'une connexion du type ${provider} n'est pas supportée. Veuillez vous reconnecter manuellement.`,
      ),
    missingIdToken: (state: OAuthState) =>
      new ForbiddenError(
        `L'authentification avec le state '${state}' n'a pas d'idToken.`,
      ),
    missingOAuth: ({ state }: { state?: OAuthState }) =>
      new ForbiddenError(
        `Il n'y a pas d'authentification en cours ${state ? `avec l'état '${state}'` : ""}.`,
      ),
    unsupportedProvider: ({ actual }: { actual: FederatedIdentityProvider }) =>
      new ForbiddenError(`L'authentification '${actual}' n'est pas supportée.`),
    unusedOAuth: () =>
      new ForbiddenError(
        "Le renouvellement d'une connexion non utilisée n'est pas autorisé.",
      ),
    nonceMismatch: () =>
      new ForbiddenError("Il y a un décalage sur le 'Nonce'."),
    couldNotGetAccessToken: ({ message }: { message: string }) =>
      new BadRequestError(
        `Impossible de récupérer l'access token FT : ${message}`,
      ),
    couldNotGetUserInfo: ({ message }: { message: string }) =>
      new BadRequestError(
        `Impossible de récupérer les infos ProConnect : ${message}`,
      ),
    missingUserId: (state: OAuthState) =>
      new BadRequestError(
        `La connexion en cours (state: ${state}) n'est pas affectée à un identifiant d'utilisateur.`,
      ),
    alreadyUsedAuthentication: () =>
      new BadRequestError("Ce lien d'authentification a déjà été utilisé."),
  },
  convention: {
    editCounsellorNameNotAuthorizedForRole: () =>
      new ForbiddenError(
        `Seul les conseillers et les validateurs de l'agence prescriptrice sont autorisés à modifier le nom du conseiller.`,
      ),
    editCounsellorNameNotAllowedForStatus: ({
      status,
    }: {
      status: ConventionStatus;
    }) =>
      new BadRequestError(
        `Impossible de modifier le nom du conseiller pour les conventions ayant le statut "${status}".`,
      ),

    editConventionWithFinalStatusNotAuthorizedForRole: () =>
      new ForbiddenError(
        "Seuls les conseillers, les validateurs, administrateurs d'agence et le représentant légal de l'entreprise sont autorisés à modifier la convention lorsqu'elle est finalisée.",
      ),
    editConventionWithFinalStatusNotAllowedForStatus: ({
      status,
      conventionId,
    }: {
      status: ConventionStatus;
      conventionId: ConventionId;
    }) =>
      new BadRequestError(
        `Impossible de modifier la convention : ${conventionId} en tant qu'admin : le statut "${status}" ne permet pas cette action.`,
      ),
    invalidConventionAfterFinalStatusEdit: ({
      message,
      conventionId,
    }: {
      message: string;
      conventionId: ConventionId;
    }) =>
      new BadRequestError(
        `La convention : ${conventionId} ne serait plus valide avec ces modifications : ${message}`,
      ),
    emailNotLinkedToConvention: (role: Role) =>
      new BadRequestError(
        `L'email fournit n'est pas lié à la convention pour l'utilisateur ayant le role ${role}.`,
      ),
    updateBadStatusInParams: ({ id }: { id: ConventionId }) =>
      new ForbiddenError(
        `Convention ${id} with modifications should have status READY_TO_SIGN`,
      ),
    updateBadStatusInRepo: ({
      id,
      status,
    }: {
      id: ConventionId;
      status: ConventionStatus;
    }) =>
      new BadRequestError(
        `Convention ${id} cannot be modified as it has status ${status}`,
      ),
    updateForbidden: ({ id }: { id: ConventionId }) =>
      new ForbiddenError(
        `Vous n'avez pas les droits nécessaires pour modifier la convention '${id}'. Seul les signataires ainsi que les conseillers liés a cette convention peuvent la modifier.`,
      ),
    conventionGotUpdatedWhileUpdating: () =>
      new BadRequestError(
        "Quelqu'un d'autre a modifié la demande en même temps que vous. Veuillez la relire puis la signer ou la modifier.",
      ),
    missingFTAdvisor: ({ ftExternalId }: { ftExternalId: FtExternalId }) =>
      new NotFoundError(
        `Il n'y a pas de conseiller France Travail attaché à l'identifiant OAuth ftExternalId '${ftExternalId}'.`,
      ),
    notValidated: ({ convention }: { convention: ConventionDto }) =>
      new BadRequestError(
        `La convention '${convention.id}' n'est pas validée. Son status est '${convention.status}'.`,
      ),
    notFound: ({ conventionId }: { conventionId: ConventionId }) =>
      new NotFoundError(
        `Aucune convention trouvée avec l'identifiant '${conventionId}'. Êtes-vous sûr d'avoir bien tapé votre identifiant de convention ?`,
      ),
    conflict: ({ conventionId }: { conventionId: ConventionId }) =>
      new ConflictError(
        `Une convention avec l'identifiant ${conventionId} existe déjà.`,
      ),
    forbiddenStatus: ({ status }: { status: ConventionStatus }) =>
      new ForbiddenError(
        `Impossible de créer une convention avec le statut "${status}"`,
      ),
    forbiddenModification: (requesterRole: Role) =>
      new ForbiddenError(
        `Actor with role ${requesterRole} is not allowed to request a modification`,
      ),
    forbiddenMissingRightsUserId: ({
      conventionId,
      userId,
    }: {
      conventionId: ConventionId;
      userId: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur ${userId} n'a pas de droit sur la convention '${conventionId}'.`,
      ),
    forbiddenMissingRightsEmailHash: ({
      conventionId,
      emailHash,
      role,
    }: {
      conventionId: ConventionId;
      role: Role;
      emailHash: string;
    }) =>
      new ForbiddenError(
        `L'utilisateur ${role}-${emailHash} n'a pas de droit sur la convention '${conventionId}'. L'email saisi dans la convention a été modifié. Vous ne pouvez plus accéder à cette convention avec l'email que vous venez d'utiliser.`,
      ),
    forbiddenMissingRightsApiConsumer: (
      conventionId: ConventionId,
      apiConsumerId: ApiConsumerId,
    ) =>
      new ForbiddenError(
        `Le consomateur API '${apiConsumerId}' n'a pas de droits sur la convention '${conventionId}'.`,
      ),
    forbiddenConventionIdMismatch: ({
      jwtConventionId,
      jwtRole,
      requestedConventionId,
    }: {
      jwtConventionId: ConventionId;
      jwtRole: ConventionRole;
      requestedConventionId: ConventionId;
    }) =>
      new ForbiddenError(
        `Il y a un écart entre le numéro de convention demandée ${requestedConventionId} et le numéro de convention authentifiée ${jwtConventionId}. Actionné par ${jwtRole}`,
      ),
    badRoleStatusChange: ({
      roles,
      status,
      conventionId,
    }: {
      roles: Role[];
      status: ConventionStatus;
      conventionId: ConventionId;
    }) =>
      new ForbiddenError(
        `Les rôles "${roles.join(
          ", ",
        )}" ne peuvent pas appliquer le statut "${status}" pour la convention avec l'identifiant ${conventionId}.`,
      ),
    roleHasNoMagicLink: ({ role }: { role: Role }) =>
      new BadRequestError(`Le rôle "${role}" n'a pas de liens magiques.`),
    badStatusTransition: ({
      currentStatus,
      targetStatus,
    }: {
      currentStatus: ConventionStatus;
      targetStatus: ConventionStatus;
    }) =>
      new BadRequestError(
        `Impossible de passer du statut de convention "${currentStatus}" à "${targetStatus}".`,
      ),
    notAllowedToCancelConventionWithAssessment: () =>
      new BadRequestError(
        "Impossible d'annuler cette convention car le bilan a été complété.",
      ),
    roleNotAllowedToSign: ({ role }: { role: Role }) =>
      new ForbiddenError(
        `Seules les roles bénéficaires, employeur du bénéficaire, représentant légal ou le réprésentant de l'établissement d'accueil ont la possibilitée de signer. Le role fourni était : ${role}`,
      ),
    connectedUserNotSignatory: ({
      userId,
      conventionId,
    }: {
      userId: UserId;
      conventionId: ConventionId;
    }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'est pas autorisé à signer la convention '${conventionId}'.`,
      ),
    sendSignatureLinkNotAllowedForStatus: ({
      status,
    }: {
      status: ConventionStatus;
    }) =>
      new BadRequestError(
        `Impossible de relancer la demande de signature pour les conventions ayant le statut "${status}".`,
      ),
    transferNotAllowedForStatus: ({ status }: { status: ConventionStatus }) =>
      new BadRequestError(
        `Impossible de transférer les conventions ayant le statut "${status}".`,
      ),
    transferNotAuthorizedForRole: () =>
      new ForbiddenError(
        `Seul les conseillers et les validateurs de l'agence prescriptrice sont autorisés à transférer la convention.`,
      ),
    twoStepsValidationBadStatus: ({
      targetStatus,
      conventionId,
    }: {
      targetStatus: ConventionStatus;
      conventionId: ConventionId;
    }) =>
      new ForbiddenError(
        `Impossible de passer du statut "${targetStatus}" pour la convention "${conventionId}". La convention doit être d'abord approuvée par un conseiller.`,
      ),
    noSignatoryHasSigned: ({ conventionId }: { conventionId: ConventionId }) =>
      new BadRequestError(
        `Aucun des signataires n'a signé la convention avec l'identifiant ${conventionId}.`,
      ),
    signatoryAlreadySigned: ({
      conventionId,
      signatoryRole,
    }: {
      conventionId: ConventionId;
      signatoryRole: SignatoryRole;
    }) =>
      new BadRequestError(
        `Le  ${titleByRole[signatoryRole]} a déjà signé la convention ${conventionId}.`,
      ),
    magicLinkNotAssociatedToConvention: () =>
      new BadRequestError(
        "Le lien magique n'est plus associé à cette demande d'immersion",
      ),
    malformedExpiredJwt: () => new BadRequestError("Malformed expired JWT"),
    missingActor: ({
      conventionId,
      role,
    }: {
      conventionId: ConventionId;
      role: Role;
    }) =>
      new BadRequestError(
        `Il n'y a pas de role ${role} pour la convention ${conventionId}.`,
      ),
    missingSignatorySignature: ({ role }: { role: SignatoryRole }) =>
      new BadRequestError(`Signature manquante pour ${titleByRole[role]}.`),
    missingAgencyApprovalOrValidation: ({
      role,
    }: {
      role: AgencyModifierRole;
    }) =>
      new BadRequestError(`Validation manquante par le ${titleByRole[role]}.`),
    unsupportedRole: ({ role }: { role: Role }) =>
      new ForbiddenError(
        `Le rôle ${role} n'est pas supporté pour cette fonctionnalité.`,
      ),
    unsupportedRenewRoute: ({
      supportedRenewRoutes,
      originalUrl,
    }: {
      supportedRenewRoutes: string[];
      originalUrl: string;
    }) =>
      new BadRequestError(
        `Lien non supporté, le lien doit faire partie des liens supportés suivants: ${supportedRenewRoutes
          .map((route) => `${route}`)
          .join(", ")}. Lien fourni : ${originalUrl}`,
      ),
    forbiddenReminder: ({
      convention,
      kind,
    }: {
      convention: ConventionDto;
      kind: ReminderKind;
    }) =>
      new ForbiddenError(
        `Convention with id: '${convention.id}' and status: '${convention.status}' is not supported for reminder ${kind}.`,
      ),
    invalidMobilePhoneNumber: ({
      conventionId,
      role,
    }: {
      conventionId: ConventionId;
      role: Role;
    }) =>
      new BadRequestError(
        `Le numéro de téléphone du ${titleByRole[role]} renseigné dans la convention '${conventionId}' n'est pas supporté pour l'envoi de sms.`,
      ),
    sendSignatureLinkNotAuthorizedForRole: () =>
      new ForbiddenError(
        `Seul les signataires ainsi que les conseillers et les validateurs de l'agence prescriptrice sont autorisés à envoyer un lien de signature.`,
      ),
    signatureLinkAlreadySent: ({
      signatoryRole: _signatoryRole,
      notificationKind,
      minHoursBetweenReminder,
      timeRemaining,
    }: {
      signatoryRole: SignatoryRole;
      notificationKind: NotificationKind;
      minHoursBetweenReminder: number;
      timeRemaining: string;
    }) =>
      new TooManyRequestApiError(
        `Une relance a été envoyée il y a moins de ${minHoursBetweenReminder}h par ${notificationKind}. Vous pourrez réessayer dans ${timeRemaining}.`,
      ),
    validatorOfAgencyRefersToNotAllowed: () =>
      new ForbiddenError(
        `Les validateurs de l'agence référente ne sont pas autorisés à accéder à cette fonctionnalité.`,
      ),
  },
  conventionDraft: {
    conflict: ({
      conventionDraftId,
    }: {
      conventionDraftId: ConventionDraftId;
    }) =>
      new ConflictError(
        `Le brouillon de convention avec l'identifiant ${conventionDraftId} a déjà été modifié avant votre demande. Veuillez la relire et prendre connaissance des modifications.`,
      ),
    notFound: ({
      conventionDraftId,
    }: {
      conventionDraftId: ConventionDraftId;
    }) =>
      new NotFoundError(
        `Aucun brouillon de convention trouvé avec l'identifiant '${conventionDraftId}' : soit ce brouillon a expiré, soit une convention a déjà été créée à partir de ce brouillon.`,
      ),
  },
  conventionTemplate: {
    forbidden: ({
      conventionTemplateId,
    }: {
      conventionTemplateId: ConventionTemplateId;
    }) =>
      new ForbiddenError(
        `Vous n'avez pas les droits nécessaires sur le modèle de convention '${conventionTemplateId}'.`,
      ),
    notFound: ({
      conventionTemplateId,
    }: {
      conventionTemplateId: ConventionTemplateId;
    }) =>
      new NotFoundError(
        `Aucun modèle de convention trouvé avec l'identifiant '${conventionTemplateId}'.`,
      ),
  },
  archivedConventionRequest: {
    notFound: ({ id }: { id: string }) =>
      new NotFoundError(
        `Aucune demande de convention archivée trouvée avec l'identifiant '${id}'.`,
      ),
    unknownReason: ({ reason }: { reason: string }) =>
      new Error(
        `La raison de la demande de convention archivée est inconnue : ${reason}`,
      ),
    incomplete: ({ id }: { id: string }) =>
      new Error(`La demande de convention archivée est incomplète pour ${id}`),
  },
  establishment: {
    badPagination: ({
      page,
      perPage,
      totalPages,
    }: {
      page: number;
      totalPages: number;
      perPage: number;
    }) =>
      new BadRequestError(
        `Le numéro de la page est plus grand que le nombre total de pages (page demandée: ${page} > pages totales: ${totalPages}, avec ${perPage} résultats / page).`,
      ),
    invalidGeoParams: () =>
      new BadRequestError("Les paramètres géographiques ne sont pas valides."),
    outOfMaxLimit: ({ kind, maxLimit }: { kind: string; maxLimit: number }) =>
      new BadRequestError(
        `La requête '${kind}' n'autorise pas une limite de '${maxLimit}'.`,
      ),
    pgCreateConflict: ({ siret, error }: { siret: SiretDto; error: Error }) =>
      new ConflictError(
        `Il n'est pas possible de créer l'établissement avec le siret '${siret}'. Erreur: '${error}'.`,
      ),
    noUserRights: ({ siret }: { siret: SiretDto }) =>
      new BadRequestError(
        `L'établissement avec le siret ${siret}, n'a aucun utilisateur.`,
      ),
    notAdminOrContactRight: ({
      siret,
      userId,
    }: {
      siret: SiretDto;
      userId: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'a pas les droits administrateur ou contact sur l'entreprise '${siret}'.`,
      ),
    notAdmin: ({ siret, userId }: { siret: SiretDto; userId: UserId }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'a pas les droits administrateur actifs sur l'entreprise '${siret}'.`,
      ),
    noContactToNotify: ({ siret }: { siret: SiretDto }) =>
      new BadRequestError(`L'entreprise ${siret} n'a aucun contact a notifier`),
    missingOrClosed: ({ siret }: { siret: SiretDto }) =>
      new BadRequestError(
        `Ce SIRET (${siret}) n'est pas attribué ou correspond à un établissement fermé. Veuillez le corriger.`,
      ),
    notFound: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `Aucune entreprise trouvée avec le siret : ${siret}. Êtes-vous sûr d'avoir bien tapé votre siret ?`,
      ),
    adminNotFound: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `Aucun administrateur trouvé pour l'établissement avec le siret : ${siret}.`,
      ),
    contactUserNotFound: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `Aucun utilisateur à contacter trouvé pour l'établissement avec le siret : ${siret}.`,
      ),
    siretMismatch: () =>
      new ForbiddenError(
        "Il y a un problème de cohérence de Siret entre les données techniques (JWT et formulaire).",
      ),
    conflictError: ({ siret }: { siret: SiretDto }) =>
      new ConflictError(
        `Une entreprise avec le siret ${siret} existe déjà dans notre annuaire.`,
      ),
    contactRequestConflict: ({
      siret,
      appellationCode,
      minimumNumberOfDaysBetweenSimilarContactRequests,
    }: {
      siret: SiretDto;
      appellationCode: AppellationCode;
      minimumNumberOfDaysBetweenSimilarContactRequests: number;
    }) =>
      new ConflictError(
        [
          `Une demande de mise en contact existe déjà pour l'entreprise '${siret}', le code métier '${appellationCode}' et l'email du candidat.`,
          `Un minimum de ${minimumNumberOfDaysBetweenSimilarContactRequests} jours entre deux demande de mise en contact sont permises.`,
        ].join("\n"),
      ),
    contactRequestContactModeMismatch: ({
      siret,
      contactModes,
    }: {
      siret: SiretDto;
      contactModes: { inParams: ContactMode; inRepo: ContactMode };
    }) =>
      new BadRequestError(
        `Incohérence sur le mode de mise en contact. '${contactModes.inParams}' dans les params. '${contactModes.inRepo}' dans le contact d'entreprise '${siret}'.`,
      ),
    offerMissing: ({
      siret,
      appellationCode,
      mode,
    }: {
      siret: SiretDto;
      appellationCode: AppellationCode;
      mode: "not found" | "bad request";
    }) =>
      mode === "bad request"
        ? new BadRequestError(
            `L'entreprise '${siret}' n'a pas d'offre d'immersion avec le code appellation '${appellationCode}'.`,
          )
        : new NotFoundError(
            `L'entreprise '${siret}' n'a pas d'offre d'immersion avec le code appellation '${appellationCode}'.`,
          ),
    missingLocation: ({
      siret,
      locationId,
    }: {
      siret: SiretDto;
      locationId?: LocationId;
    }) =>
      new NotFoundError(
        `L'addresse ${locationId ? `'${locationId}' ` : ""}n'existe pas pour l'entreprise '${siret}'.`,
      ),
    noLocation: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(`L'établissement '${siret}' n'a pas de localisations.`),
    forbiddenUnavailable: ({ siret }: { siret: SiretDto }) =>
      new ForbiddenError(
        `L'entreprise ${siret} n'est pas disponible pour des immersions.`,
      ),
    userRightAlreadyExists: ({
      siret,
      userId,
    }: {
      siret: SiretDto;
      userId: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' a déjà un droit sur l'entreprise '${siret}'.`,
      ),
    bannedEstablishment: ({ siret }: { siret: SiretDto }) =>
      new ForbiddenError(`L'entreprise avec le siret '${siret}' est bannie`),
    establishmentNotBanned: ({ siret }: { siret: SiretDto }) =>
      new BadRequestError(
        `L'entreprise avec le siret '${siret}' n'est pas bannie`,
      ),
  },
  establishmentLead: {
    notFound: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `Les informations de lead d'entreprise avec le siret '${siret}' ne sont pas trouvés.`,
      ),
  },
  establishmentMarketing: {
    notFound: ({ siret }: { siret: string }) =>
      new NotFoundError(
        `Les informations de marketing d'entreprise avec le siret '${siret}' ne sont pas trouvés.`,
      ),
  },
  bannedEstablishment: {
    alreadyBanned: ({ siret }: { siret: SiretDto }) =>
      new ConflictError(
        `L'établissement avec le siret '${siret}' est déjà banni.`,
      ),
  },
  establishmentCsv: {
    firstUserMustBeAdmin: (email: string) =>
      new Error(`Le premier utilisateur ${email} doit être admin`),
  },
  address: {
    queryToShort: ({ minLength }: { minLength: number }) =>
      new BadRequestError(
        `Vous devez taper au moins ${minLength} caractères pour faire une recherche.`,
      ),
    notFound: ({ address }: { address: string }) =>
      new NotFoundError(`Aucune adresse trouvée pour l'adresse ${address}.`),
  },
  agencies: {
    notFound: ({
      missingAgencyIds,
      presentAgencyIds = [],
    }: {
      missingAgencyIds: AgencyId[];
      presentAgencyIds?: AgencyId[];
    }) =>
      new NotFoundError(
        [
          `Nous n'avons pas trouvé les agences avec les identifiants suivants : ${missingAgencyIds.join(
            ", ",
          )}. `,
          presentAgencyIds.length
            ? `Nous avons seulement trouvé : ${presentAgencyIds.join(", ")}.`
            : "Aucune agence trouvée.",
        ].join(""),
      ),
    refersToMismatch: ({
      agencyWithRefersToId,
      referedAgencyId,
    }: {
      agencyWithRefersToId: AgencyId;
      referedAgencyId: AgencyId;
    }) =>
      `Le refersToAgencyId de l'agence '${agencyWithRefersToId}' ne correspond pas avec l'agence '${referedAgencyId}' à laquelle elle est référencée.`,
    noAgencyRights: (userId: UserId) =>
      new ForbiddenError(`L'utilisateur ${userId} n'a pas de droit d'agence.`),
  },
  agency: {
    alreadyExist: (agencyId: AgencyId) =>
      new ConflictError(`L'agence avec id '${agencyId}' existe déjà.`),
    emailNotFound: ({ agencyId }: { agencyId: AgencyId }) =>
      new NotFoundError(
        `Mail not found for agency with id: ${agencyId} on agency repository.`,
      ),
    routeIdMismatch: ({
      routeAgencyId,
      bodyAgencyId,
    }: {
      routeAgencyId: AgencyId;
      bodyAgencyId: AgencyId;
    }) =>
      new BadRequestError(
        `L'identifiant d'agence dans l'URL (${routeAgencyId}) ne correspond pas à celui du corps de requête (${bodyAgencyId}).`,
      ),
    forbiddenDelegationConventionReminder: ({
      agencyId,
    }: {
      agencyId: AgencyId;
    }) =>
      new ForbiddenError(
        `L'agence '${agencyId}' n'est pas éligible pour ce rappel de convention de délégation.`,
      ),
    invalidSiret: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `Le SIRET que vous avez saisi (${siret}) n'est pas valide et votre organisme n'a pas été enregistré. Merci de corriger le SIRET et de soumettre à nouveau le formulaire.`,
      ),
    invalidCounsellorRoleForFTAgency: () =>
      new BadRequestError(
        "Le rôle pré-valideur n'est pas autorisé pour une agence France Travail",
      ),
    invalidRoleUpdateForAgencyWithRefersTo: ({
      agencyId,
      role,
    }: {
      agencyId: AgencyId;
      role: AgencyRole;
    }) =>
      new BadRequestError(
        `Le role "${role}" n'est pas autorisé pour l'agence "${agencyId}" car cette agence est une structure d'accompagnement.`,
      ),
    invalidRoleUpdateForOneStepValidationAgency: ({
      agencyId,
    }: {
      agencyId: AgencyId;
    }) =>
      new BadRequestError(
        `L'agence "${agencyId}" à une seule étape de validation ne peut pas avoir aucun validateur recevant des notifications.`,
      ),
    invalidStatus: ({
      id,
      actual,
      expected,
    }: {
      id: AgencyId;
      actual: AgencyStatus;
      expected: AgencyStatus;
    }) =>
      new BadRequestError(
        `L'agence '${id}' n'a pas le bon status. Le status actuel est '${actual}' alors que le status attendu est '${expected}'.`,
      ),
    invalidValidatorEditionWhenAgencyWithRefersTo: (agencyId: AgencyId) =>
      new BadRequestError(
        `L'ajout, la suppression ou l'édition d'un valideur n'est pas autorisée pour l'agence "${agencyId}" car il s'agit d'une structure d'accompagnement. Cette action est autorisée seulement par l'agence prescriptrice à laquelle elle est rattachée.`,
      ),
    missingParamAgencyId: () =>
      new BadRequestError(
        "You need to provide agency Id in query params : http://.../agency?agencyId=your-id",
      ),
    notEnoughCounsellors: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(
        `L'agence ${agencyId} doit avoir au moins un pré-valideur recevant les emails.`,
      ),
    notEnoughValidators: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(
        `L'agence ${agencyId} doit avoir au moins un validateur recevant les emails.`,
      ),
    cannotActivateWithoutAdmin: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(
        `L'agence ${agencyId} ne peut pas être activée sans administrateur d'agence.`,
      ),
    cannotUpdateToStatus: ({
      agencyId,
      status,
    }: {
      agencyId: AgencyId;
      status: AgencyStatus;
    }) =>
      new BadRequestError(
        `Le statut « ${status} » de l'agence ${agencyId} ne peut pas être défini via la mise à jour de l'agence.`,
      ),
    notFound: ({ agencyId }: { agencyId: AgencyId }) =>
      new NotFoundError(
        `Aucune agence trouvée avec l'identifiant : ${agencyId}.`,
      ),
    notRejected: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(`L'agence ${agencyId} n'est pas rejetée.`),
    noUsers: (agencyId: AgencyId) =>
      new BadRequestError(
        `L'agence '${agencyId}' ne peut pas avoir aucun utilisateur.`,
      ),
    registerNotFtUserForbidden: ({
      agency,
      user,
    }: {
      user: User;
      agency: AgencyWithUsersRights;
    }) =>
      new ForbiddenError(
        `Vous ne pouvez pas être rattaché à l'organisme ${agency.name} avec cette adresse email : ${user.email} .`,
      ),
    sourceAndTargetAgencyMustBeDifferent: ({
      agencyId,
    }: {
      agencyId: AgencyId;
    }) =>
      new BadRequestError(
        `L'agence à fermer et l'agence cible doivent être différentes (${agencyId}).`,
      ),
    targetAgencyMustBeActive: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(
        `L'agence vers laquelle transférer (${agencyId}) doit avoir un statut actif (active ou from-api-PE).`,
      ),
    targetAgencyMustNotReferToAnother: ({ agencyId }: { agencyId: AgencyId }) =>
      new BadRequestError(
        `L'agence vers laquelle transférer (${agencyId}) ne doit pas être une agence qui référence une autre agence.`,
      ),
    userAlreadyExist: () =>
      new BadRequestError(
        "L'utilisateur est déjà rattaché à cette agence. Vous pouvez le modifier depuis la liste des utilisateurs de l'agence.",
      ),
    usersNotFound: ({ agencyId }: { agencyId: AgencyId }) =>
      new NotFoundError(`L'agence ${agencyId} n'a aucun utilisateur rattaché`),
  },
  users: {
    notFound: ({ userIds }: { userIds: UserId[] }) =>
      new NotFoundError(
        `Nous n'avons pas trouvé les utilisateurs avec les identifiants suivants : ${userIds.join(
          ", ",
        )}.`,
      ),
  },
  user: {
    unauthorized: () => new UnauthorizedError(),
    noJwtProvided: () =>
      new ForbiddenError("Aucun jeton d'authentification (JWT) fourni."),
    invalidJwt: () =>
      new ForbiddenError(
        "Le jeton d'authentification (JWT) fourni est invalide.",
      ),
    unsupportedJwtPayload: () =>
      new ForbiddenError(
        "Les données du jeton d'authentification ne sont pas supportés.",
      ),
    expiredJwt: (durationInMinutes?: number) =>
      new ForbiddenError(authExpiredMessage(durationInMinutes)),
    notFound: ({ userId }: { userId: UserId }) =>
      new NotFoundError(
        `Aucun utilisateur trouvé avec l'identifiant : ${userId}.`,
      ),
    notFoundByEmail: ({ email }: { email: Email }) =>
      new NotFoundError(`Aucun utilisateur trouvé avec l'email '${email}'.`),
    deleteForbiddenAgencyRights: (userId: UserId) =>
      new ForbiddenError(
        `Il n'est pas possible de supprimer l'utilisateur '${userId}' car il a des droits sur des agences prescriptrices.`,
      ),
    deleteForbiddenPreventToDelete: ({ userId }: { userId: UserId }) =>
      new ForbiddenError(
        `Il n'est pas possible de supprimer l'utilisateur '${userId}' car il est exclu de la suppression automatique.`,
      ),
    forbidden: ({ userId }: { userId: UserId }) =>
      new ForbiddenError(
        `L'utilisateur qui a l'identifiant "${userId}" n'a pas le droit d'accéder à cette ressource.`,
      ),
    forbiddenNotTriggeredByCrawler: () =>
      new ForbiddenError(
        "Seul le système événementiel peut executer cette fonctionnalité.",
      ),
    alreadyHaveAgencyRights: ({ userId }: { userId: UserId }) =>
      new BadRequestError(
        `L'utilisateur qui a l'identifiant "${userId}" a déjà les droits pour cette agence.`,
      ),
    expectedRightsOnAgency: ({
      agencyId,
      userId,
    }: {
      userId: UserId;
      agencyId: AgencyId;
    }) =>
      new BadRequestError(
        `L'utilisateur qui a l'identifiant "${userId}" n'a pas de droits sur l'agence "${agencyId}".`,
      ),
    noRightsOnAgency: ({
      agencyId,
      userId,
    }: {
      userId: UserId;
      agencyId: AgencyId;
    }) =>
      new ForbiddenError(
        `L'utilisateur qui a l'identifiant "${userId}" n'a pas de droits sur l'agence "${agencyId}".`,
      ),
    notBackOfficeAdmin: (params?: { userId: UserId }) =>
      new ForbiddenError(
        `L'utilisateur '${params?.userId} 'n'est pas administrateur Immersion Facilitée.`,
      ),
    notConventionSignatory: () =>
      new ForbiddenError(
        "Seul les signataires peuvent signer la convention. Le lien que vous avez utilisé ne vous permet pas de signer la convention.",
      ),
    conflictByEmail: ({ userEmail }: { userEmail: Email }) =>
      new ConflictError(
        `L'utilisateur ayant le mail ${userEmail} existe déjà.`,
      ),
    conflictById: ({ userId }: { userId: UserId }) =>
      new ConflictError(
        `L'utilisateur ayant l'identifiant ${userId} existe déjà.`,
      ),
    conflictByExternalId: ({ externalId }: { externalId: string }) =>
      new ConflictError(
        `L'utilisateur ayant l'externalId ${externalId} existe déjà.`,
      ),
    forbiddenToChangeEmailForConnectedUser: () =>
      new ForbiddenError(
        "Il n'est pas possible de modifier un mail d'un utilisateur connecté.",
      ),
    forbiddenNotificationsPreferencesUpdate: () =>
      new ForbiddenError(
        "Vous n'avez pas les droits nécessaires pour modifier ces préférences de notifications.",
      ),
    forbiddenRolesUpdate: () =>
      new ForbiddenError(
        "Vous n'avez pas les droits nécessaires pour modifier ces rôles.",
      ),
    forbiddenEmailUpdate: () =>
      new ForbiddenError(
        "Vous n'avez pas les droits nécessaires pour modifier l'email d'un autre utilisateur.",
      ),
    emailMismatch: () =>
      new BadRequestError(
        "L'email fourni ne correspond pas à l'email de l'utilisateur connecté.",
      ),
    missingPreviousJwtPublicKey: () =>
      new Error("No deprecated JWT private key provided"),
    notEnoughRightOnAgency: ({
      userId,
      agencyId,
    }: {
      agencyId: AgencyId;
      userId?: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur ${
          userId ? `qui a l'identifiant '${userId}' ` : ""
        }n'a pas les droits suffisant sur l'agence qui a l'identifiant '${agencyId}'.`,
      ),
    noContactPhone: ({ userId }: { userId: UserId }) =>
      new BadRequestError(
        `L'utilisateur '${userId}' n'a pas de numéro de téléphone pour être contacté.`,
      ),
  },
  broadcastFeedback: {
    notFound: ({ conventionId }: { conventionId: ConventionId }) =>
      new NotFoundError(
        `Il n'y a pas d'erreur non géré de transfert de convention pour la convention '${conventionId}'.`,
      ),
    tooManyRequests: (params: {
      lastBroadcastDate: Date;
      formattedWaitingTime: string;
    }) =>
      new TooManyRequestApiError(
        `La convention a été synchronisée le ${toDisplayedDate({
          date: params.lastBroadcastDate,
          withHours: true,
        })}. Merci d'essayer à nouveau dans ${params.formattedWaitingTime}.`,
      ),
  },
  discussion: {
    missingNotDeleted: (discussionIds: DiscussionId[]) =>
      new NotFoundError(
        `Les discussions ne peuvent pas être supprimées car manquantes : ${discussionIds}.`,
      ),
    badSiretFilter: () =>
      new BadRequestError(
        "Le filtre par SIRET est fourni mais il n'y a pas de SIRET dans le filtre.",
      ),
    notFound: ({ discussionId }: { discussionId: DiscussionId }) =>
      new NotFoundError(`La candidature '${discussionId}' n'est pas trouvée.`),
    noExchanges: (discussionId: DiscussionId) =>
      new Error(`La candidature '${discussionId}' n'a pas d'échanges.`),
    missingPhone: (id: DiscussionId) =>
      `Propriété phone manquante pour la candidature de type email '${id}'.`,
    missingDatePreferences: (id: DiscussionId) =>
      new Error(
        `Propriété datePreferences manquante pour la candidature de type email '${id}'.`,
      ),
    missingLevelOfEducation: ({
      id,
      kind,
    }: {
      id: DiscussionId;
      kind: DiscussionKind;
    }) =>
      new Error(
        `Propriété levelOfEducation manquante pour la candidature de type ${kind} '${id}'.`,
      ),
    unsupportedSource: ({ source }: { source: string }) =>
      new BadRequestError(`Le source '${source}' n'est pas supporté.`),
    rejectForbidden: ({
      discussionId,
      userId,
    }: {
      discussionId: DiscussionId;
      userId: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'a pas le droit de rejeter la candidature '${discussionId}'.`,
      ),
    alreadyRejected: ({ discussionId }: { discussionId: DiscussionId }) =>
      new BadRequestError(`La candidature '${discussionId}' est déjà rejetée.`),
    accessForbidden: ({
      discussionId,
      userId,
    }: {
      discussionId: DiscussionId;
      userId: UserId;
    }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'a pas accès à la candidature '${discussionId}'.`,
      ),
    badContactMode: () => new Error("Mode de contact invalide."),
    badImmersionObjective: (
      discussionId: DiscussionId,
      discussionKind: DiscussionKind,
      discussionObjective?: ImmersionObjective,
    ) =>
      new Error(
        `L'objectif d'immersion ${discussionObjective} est non supportée pour la candidature ${discussionId} de type ${discussionKind}`,
      ),
    missingRequiredIfFields: ({
      discussionId,
      discussionKind,
    }: {
      discussionId: DiscussionId;
      discussionKind: DiscussionKind;
    }) =>
      new Error(
        `Les champs requis ne sont pas renseignés pour la candidature ${discussionId} de type ${discussionKind}`,
      ),
    badEmailFormat: ({ email }: { email: Email }) =>
      new BadRequestError(`L'email n'a pas le bon format '${email}'.`),
    badRecipientKindFormat: ({ kind }: { kind: string }) =>
      new BadRequestError(`L'email n'a pas le bon type '${kind}'.`),
    hasDiscussionMissingParams: () =>
      new BadRequestError(
        "Aucun critère n'a été fourni pour vérifier l'existence d'une mise en relation.",
      ),
    unsupportedRejectionKind: (rejectionKind: RejectionKind) =>
      new BadRequestError(`La raison ${rejectionKind} n'est pas supportée.`),
    badStatus: ({
      discussionId,
      expectedStatus,
    }: {
      discussionId: DiscussionId;
      expectedStatus: DiscussionStatus;
    }) =>
      new BadRequestError(
        `La candidature '${discussionId}' n'a pas le statut '${expectedStatus}'.`,
      ),
  },
  discussions: {
    accessForbidden: ({ siret, userId }: { siret: SiretDto; userId: UserId }) =>
      new ForbiddenError(
        `L'utilisateur '${userId}' n'a pas accès aux candidatures de l'entreprise avec le SIRET ${siret}'.`,
      ),
  },
  establishmentGroup: {
    missingBySlug: ({ groupSlug }: { groupSlug: GroupSlug }) =>
      new NotFoundError(`Aucun group avec le terme ${groupSlug} trouvé.`),
  },
  apiConsumer: {
    notFound: ({ id }: { id: ApiConsumerId }) =>
      new NotFoundError(`Api consumer with id '${id}' not found`),
    forbidden: () => new ForbiddenError(),
    notEnoughPrivilege: () =>
      new ForbiddenError(
        "Vous n'avez pas le droit d'accès à cette route. Contactez le support Immersion Facilitée si vous voulez plus de privilèges.",
      ),
    missingRights: ({ rightName }: { rightName: ApiConsumerRightName }) =>
      new ForbiddenError(
        `You do not have the "SUBSCRIPTION" kind associated to the "${rightName}" right.`,
      ),
    missingCallbackParams: ({
      consumerId,
      conventionId,
    }: {
      consumerId: ApiConsumerId;
      conventionId: ConventionId;
    }) =>
      new NotFoundError(
        `No callback params found for convention.updated : apiConsumer : ${consumerId} | convention : ${conventionId}`,
      ),
    missing: ({ id }: { id: ApiConsumerSubscriptionId }) =>
      new NotFoundError(`subscription ${id} not found`),
  },
  inputs: {
    badSchema: (
      params: { id?: string; flattenErrors: string[] } & (
        | { schemaName: string }
        | { useCaseName: string }
      ),
    ) =>
      new BadRequestError(
        `${badSchemaErrorMessagePrefix} ${"schemaName" in params ? `for schema ${params.schemaName}` : `in usecase ${params.useCaseName}`}${params.id ? ` for element with id ${params.id}` : ""}. See issues for details.`,
        params.flattenErrors,
      ),
  },
  siretApi: {
    notFound: ({ siret }: { siret: SiretDto }) =>
      new NotFoundError(
        `L'établissement avec le siret '${siret}' n'est pas trouvé dans l'API SIRET.`,
      ),
    tooManyRequests: ({ serviceName }: { serviceName: string }) =>
      new TooManyRequestApiError(
        `Le service ${serviceName} a subit trop de sollicitation`,
      ),
    unavailable: ({
      serviceName,
      message,
    }: {
      serviceName: string;
      message?: string;
    }) => new UnavailableApiError(serviceName, message),
  },
  search: {
    noRomeForAppellations: (appellationCodes: AppellationCode[]) =>
      new BadRequestError(
        `No Rome code matching appellation codes ${appellationCodes}`,
      ),
    invalidGeoParams: () =>
      new BadRequestError(
        "Invalid geo params, needs latitude, longitude and distanceKm",
      ),
  },
  shortLink: {
    notFound: ({ shortLinkId }: { shortLinkId: ShortLinkId }) =>
      new NotFoundError(`Le lien court '${shortLinkId}' n'existe pas.`),
    invalidUrl: ({ shortLinkId }: { shortLinkId: ShortLinkId }) =>
      new BadRequestError(`Le lien court '${shortLinkId}' n'est pas valide.`),
    forbiddenLinkUpdate: () =>
      new ForbiddenError(
        "Il est interdit de modifier le lien long d'un lien court. Veuillez créer un nouveau lien court.",
      ),
  },
  notification: {
    notFound: ({ id, kind }: { id: NotificationId; kind: NotificationKind }) =>
      new NotFoundError(
        `La notification avec l'identifiant '${id}' et le type '${kind}' n'existe pas.`,
      ),
    missingRecipient: (params: { notificationId?: NotificationId }) =>
      new BadRequestError(
        `Il n'y a pas de destinataire fourni pour l'email. ${
          params?.notificationId
            ? `Identifiant de la notification : ${params.notificationId}`
            : ""
        }`,
      ),
    smsNotSupported: () =>
      new Error(
        "Le SMS n'est pas supporté pour la gestion de mail non envoyés.",
      ),
    doesNotNeedToBeWarned: (params: { notificationId: string }) =>
      new BadRequestError(
        `La notification ${params.notificationId} n'est pas en erreur, il n'est pas nécessaire de prévenir l'envoyeur.`,
      ),
    noSenderEmail: ({ notificationId }: { notificationId: string }) =>
      new Error(`Missing sender email in notification ${notificationId}`),
  },
  dashboard: {
    establishmentConventionForbidden: () =>
      new ForbiddenError(
        "'establishmentRepresentativeConventions' n'est pas disponible pour 'GetDashboardUrl'",
      ),
  },
  delegation: {
    missingLabel: ({ label }: { label: ShortLinkId }) =>
      new BadRequestError(`No value found for label "${label}".`),
    missingEmail: ({ province }: { province: ShortLinkId }) =>
      new BadRequestError(`Province ${province} not found`),
  },
  routeParams: {
    missingJwt: () =>
      new BadRequestError(
        "La page que vous avez atteint n'est n'est pas valide : aucun jeton d'authentification fourni.",
      ),
    malformedJson: ({ paramName }: { paramName: string }) =>
      new BadRequestError(
        `Il semble que le paramètre d'URL '${paramName}' est incorrect : vous n'avez probablement pas copié-collé le lien correctement.`,
      ),
  },
  breadcrumbs: {
    notFound: ({ currentRouteName }: { currentRouteName: string }) =>
      new NotFoundError(
        `Le fil d'arianne n'est pas défini pour cette page ('${currentRouteName}').`,
      ),
  },
  rome: {
    missingAppellation: ({
      appellationCode,
    }: {
      appellationCode: AppellationCode;
    }) => new NotFoundError(`Code appellation ${appellationCode} non trouvé.`),
  },
  url: {
    notFromIFDomain: (url: string) =>
      new BadRequestError(`L'url ${url} ne provient pas d'Immersion Facilitée`),
  },
};
