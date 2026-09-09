import { format } from "date-fns";
import { uniq } from "ramda";
import {
  type AgencyDto,
  type Beneficiary,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  type ConventionActorRole,
  type ConventionDto,
  type Email,
  type EstablishmentRepresentative,
  type ExtractFromExisting,
  errors,
  executeInSequence,
  filterNotFalsy,
  frontRoutes,
  type GenericActor,
  getFormattedFirstnameAndLastname,
  isEstablishmentTutorIsEstablishmentRepresentative,
  isSignatoryRole,
  isValidMobilePhone,
  loginPersonaByConventionRole,
  makeRouteAbsoluteUrl,
  type ReminderKind,
  type TemplatedEmail,
  type TemplatedSms,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import { conventionReminderPayloadSchema } from "../../../core/events/eventPayload.schema";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationsBatchAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { makeShortLink } from "../../../core/short-link/ShortLink";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

type SignatoriesReminderKind = ExtractFromExisting<
  ReminderKind,
  "ReminderForSignatories"
>;

type AgenciesReminderKind = ExtractFromExisting<
  ReminderKind,
  "FirstReminderForAgency" | "LastReminderForAgency"
>;

export type NotifyConventionReminder = ReturnType<
  typeof makeNotifyConventionReminder
>;

type Deps = {
  saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
};

export const makeNotifyConventionReminder = useCaseBuilder(
  "NotifyConventionReminder",
)
  .withInput(conventionReminderPayloadSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { conventionId, reminderKind }, uow, deps }) => {
    const convention = await uow.conventionRepository.getById(conventionId);
    if (!convention) throw errors.convention.notFound({ conventionId });

    return reminderKind === "ReminderForSignatories"
      ? onSignatoriesReminder({
          reminderKind,
          convention,
          uow,
          deps,
        })
      : onAgencyReminder({
          reminderKind,
          convention,
          uow,
          deps,
        });
  });

const onAgencyReminder = async ({
  reminderKind,
  convention,
  uow,
  deps,
}: {
  reminderKind: AgenciesReminderKind;
  convention: ConventionDto;
  uow: UnitOfWork;
  deps: Deps;
}): Promise<void> => {
  const agencyWithRights = await uow.agencyRepository.getById(
    convention.agencyId,
  );
  if (!agencyWithRights)
    throw errors.agency.notFound({
      agencyId: convention.agencyId,
    });

  const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);
  if (convention.status !== "IN_REVIEW")
    throw errors.convention.forbiddenReminder({
      convention,
      kind: reminderKind,
    });

  const counsellorsAndValidatorsEmails = uniq([
    ...agency.validatorEmails,
    ...agency.counsellorEmails,
  ]);

  await deps.saveNotificationsBatchAndRelatedEvent(
    uow,
    await executeInSequence(
      counsellorsAndValidatorsEmails,
      (counsellorOrValidatorEmail) =>
        createAgencyReminderEmail({
          counsellorOrValidatorEmail,
          convention,
          agency,
          reminderKind,
          config: deps.config,
        }),
    ),
  );
};

const onSignatoriesReminder = async ({
  reminderKind,
  convention,
  uow,
  deps,
}: {
  reminderKind: SignatoriesReminderKind;
  convention: ConventionDto;
  uow: UnitOfWork;
  deps: Deps;
}): Promise<void> => {
  if (!["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(convention.status))
    throw errors.convention.forbiddenReminder({
      convention,
      kind: reminderKind,
    });

  const signatories = Object.values(convention.signatories);

  const smsSignatories = signatories.filter(
    (signatory) => !signatory.signedAt && isValidMobilePhone(signatory.phone),
  );

  const emailActors = [
    ...signatories,
    ...(isEstablishmentTutorIsEstablishmentRepresentative(convention)
      ? []
      : [convention.establishmentTutor]),
  ];

  const templatedEmails: TemplatedEmail[] = emailActors.map((actor) =>
    makeSignatoryReminderEmail({
      actor,
      convention,
      config: deps.config,
    }),
  );

  const templatedSms = await executeInSequence(smsSignatories, (signatory) =>
    prepareSmsReminderParams({
      actor: signatory,
      convention,
      uow,
      reminderKind,
      deps,
    }),
  );

  const followedIds = {
    conventionId: convention.id,
    agencyId: convention.agencyId,
    establishmentSiret: convention.siret,
  };

  await deps.saveNotificationsBatchAndRelatedEvent(uow, [
    ...templatedEmails.map(
      (email): NotificationContentAndFollowedIds => ({
        kind: "email",
        followedIds,
        templatedContent: email,
      }),
    ),
    ...templatedSms.map(
      (sms): NotificationContentAndFollowedIds => ({
        kind: "sms",
        followedIds,
        templatedContent: sms,
      }),
    ),
  ]);
};

const makeSignatoryReminderEmail = ({
  actor: { email, role, firstName, lastName },
  convention,
  config,
}: {
  actor: GenericActor<ConventionActorRole>;
  convention: ConventionDto;
  config: AppConfig;
}): TemplatedEmail => ({
  kind: "SIGNATORY_REMINDER",
  recipients: [email],
  params: {
    actorFirstName: getFormattedFirstnameAndLastname({
      firstname: firstName,
    }),
    actorLastName: getFormattedFirstnameAndLastname({ lastname: lastName }),
    beneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
    }),
    beneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: convention.signatories.beneficiary.lastName,
    }),
    businessName: convention.businessName,
    conventionId: convention.id,
    signatoriesSummary: toSignatoriesSummary(convention).join("\n"),
    magicLinkUrl: isSignatoryRole(role)
      ? makeRouteAbsoluteUrl({
          route: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.id,
            loginPersona: loginPersonaByConventionRole(role),
          }),
          baseUrl: config.immersionFacileBaseUrl,
        })
      : undefined,
  },
});

const prepareSmsReminderParams = async ({
  actor: { role, phone },
  convention,
  uow,
  reminderKind,
  deps,
}: {
  actor: GenericActor<ConventionActorRole>;
  convention: ConventionDto;
  uow: UnitOfWork;
  reminderKind: SignatoriesReminderKind;
  deps: Deps;
}): Promise<TemplatedSms> => {
  const shortLink = await makeShortLink({
    uow,
    shortLinkIdGeneratorGateway: deps.shortLinkIdGeneratorGateway,
    config: deps.config,
    longLink: makeRouteAbsoluteUrl({
      route: frontRoutes.manageConventionConnectedUser({
        conventionId: convention.id,
        loginPersona: loginPersonaByConventionRole(role),
      }),
      baseUrl: deps.config.immersionFacileBaseUrl,
    }),
  });

  return {
    kind: reminderKind,
    recipientPhone: phone,
    params: { shortLink },
  };
};

const createAgencyReminderEmail = async ({
  counsellorOrValidatorEmail,
  convention,
  agency,
  reminderKind,
  config,
}: {
  counsellorOrValidatorEmail: Email;
  convention: ConventionDto;
  agency: AgencyDto;
  reminderKind: AgenciesReminderKind;
  config: AppConfig;
}): Promise<NotificationContentAndFollowedIds> => {
  const templatedEmail: TemplatedEmail =
    reminderKind === "FirstReminderForAgency"
      ? {
          kind: "AGENCY_FIRST_REMINDER",
          recipients: [counsellorOrValidatorEmail],
          params: {
            conventionId: convention.id,
            agencyName: agency.name,
            agencyReferentName: getFormattedFirstnameAndLastname(
              convention.agencyReferent ?? {},
            ),
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            dateStart: convention.dateStart,
            dateEnd: convention.dateEnd,
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: convention.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
          },
        }
      : {
          kind: "AGENCY_LAST_REMINDER",
          recipients: [counsellorOrValidatorEmail],
          params: {
            conventionId: convention.id,
            agencyReferentName: getFormattedFirstnameAndLastname(
              convention.agencyReferent ?? {},
            ),
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: convention.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
          },
        };

  return {
    kind: "email",
    followedIds: {
      conventionId: convention.id,
      agencyId: agency.id,
      establishmentSiret: convention.siret,
    },
    templatedContent: templatedEmail,
  };
};

export const toSignatoriesSummary = ({
  signatories,
  businessName,
}: ConventionDto): string[] =>
  [
    beneficiarySummary(signatories.beneficiary),
    beneficiaryRepresentativeSummary(signatories.beneficiaryRepresentative),
    beneficiaryCurrentEmployer(signatories.beneficiaryCurrentEmployer),
    establishmentSummary(signatories.establishmentRepresentative, businessName),
  ].filter(filterNotFalsy);

const beneficiarySummary = (
  beneficiary: Beneficiary<"immersion" | "mini-stage-cci">,
): string =>
  `- ${signStatus(beneficiary.signedAt)} - ${beneficiary.firstName} ${
    beneficiary.lastName
  }, bénéficiaire`;

const beneficiaryRepresentativeSummary = (
  beneficiaryRepresentative: BeneficiaryRepresentative | undefined,
): string | undefined =>
  beneficiaryRepresentative &&
  `- ${signStatus(beneficiaryRepresentative.signedAt)} - ${
    beneficiaryRepresentative.firstName
  } ${beneficiaryRepresentative.lastName}, représentant légal du bénéficiaire`;

const beneficiaryCurrentEmployer = (
  beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer | undefined,
): string | undefined =>
  beneficiaryCurrentEmployer &&
  `- ${signStatus(beneficiaryCurrentEmployer.signedAt)} - ${
    beneficiaryCurrentEmployer.firstName
  } ${beneficiaryCurrentEmployer.lastName}, employeur actuel du bénéficiaire`;

const establishmentSummary = (
  establishmentRepresentative: EstablishmentRepresentative,
  businessName: string,
): string =>
  `- ${signStatus(establishmentRepresentative.signedAt)} - ${
    establishmentRepresentative.firstName
  } ${
    establishmentRepresentative.lastName
  }, représentant l'entreprise ${businessName}`;

const signStatus = (signAt: string | undefined): string =>
  signAt
    ? `√  - A signé le ${format(new Date(signAt), "dd/MM/yyyy")}`
    : `❌ - N'a pas signé`;
