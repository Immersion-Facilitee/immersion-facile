import {
  type AgencyId,
  type AgencyKind,
  adminPlaywrightEmail,
  ConventionDtoBuilder,
  conventionSchema,
  getFormattedFirstnameAndLastname,
  immersionFacileNoReplyEmailSender,
  reasonableSchedule,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_2_ID,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_3_ID,
  SEED_ADMIN_BENEFICIARY_CONVENTION_ID,
  SEED_AGENCY_WITH_REFERS_TO_ID,
  SEED_FT_AGENCY_ID,
  SEED_IN_REVIEW_CONVENTION_ID,
  SEED_IN_REVIEW_CONVENTION_WITH_DOUBLE_VALIDATION_ID,
  SEED_PARTIALLY_SIGNED_CONVENTION_ID,
  SEED_READY_TO_SIGN_CONVENTION_1_ID,
  SEED_READY_TO_SIGN_CONVENTION_2_ID,
} from "shared";
import { AppConfig } from "../../config/bootstrap/appConfig";
import { makeGenerateConventionMagicLinkUrl } from "../../config/bootstrap/magicLinkUrl";
import { defaultPriority } from "../../domains/core/events/ports/EventBus";
import { makeGenerateJwtES256 } from "../../domains/core/jwt";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { franceMerguez } from "./establishmentSeed";
import { getRandomAgencyId } from "./seed.helpers";

export const conventionSeed = async (
  uow: UnitOfWork,
  agencyIds: Record<AgencyKind, AgencyId[]>,
) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("conventionSeed start...");

  const uuidGenerator = new UuidV4Generator();
  const ftConvention = new ConventionDtoBuilder()
    .withId(uuidGenerator.new())
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(new Date("2023-03-27").toISOString())
    .withDateEnd(new Date("2023-03-28").toISOString())
    .withStatus("READY_TO_SIGN")
    .withAgencyId(getRandomAgencyId({ kind: "france-travail", agencyIds }))
    .withSchedule(reasonableSchedule)
    .build();

  const cciConvention = new ConventionDtoBuilder()
    .withId(uuidGenerator.new())
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("mini-stage-cci")
    .withDateStart(new Date("2023-05-01").toISOString())
    .withDateEnd(new Date("2023-05-03").toISOString())
    .withStatus("READY_TO_SIGN")
    .withAgencyId(getRandomAgencyId({ kind: "cci", agencyIds }))
    .withSchedule(reasonableSchedule)
    .build();

  const conventionWithAssessmentReadyToFill = new ConventionDtoBuilder()
    .withId(uuidGenerator.new())
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(new Date("2025-01-01").toISOString())
    .withDateEnd(new Date("2025-01-05").toISOString())
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(getRandomAgencyId({ kind: "france-travail", agencyIds }))
    .withSchedule(reasonableSchedule)
    .build();

  const config = AppConfig.createFromEnv();
  const generateConventionJwt = makeGenerateJwtES256<"convention">(
    config.jwtPrivateKey,
    3600 * 24 * 30,
  );

  conventionSchema.parse(ftConvention);

  conventionSchema.parse(cciConvention);

  conventionSchema.parse(conventionWithAssessmentReadyToFill);

  await Promise.all([
    uow.conventionRepository.save(ftConvention),
    uow.conventionRepository.save(cciConvention),
    uow.conventionRepository.save(conventionWithAssessmentReadyToFill),
  ]);

  await uow.notificationRepository.save({
    id: uuidGenerator.new(),
    createdAt: new Date().toISOString(),
    kind: "email",
    templatedContent: {
      kind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
      recipients: [
        conventionWithAssessmentReadyToFill.establishmentTutor.email,
      ],
      sender: immersionFacileNoReplyEmailSender,
      params: {
        agencyLogoUrl: undefined,
        beneficiaryFirstName: getFormattedFirstnameAndLastname({
          firstname:
            conventionWithAssessmentReadyToFill.signatories.beneficiary
              .firstName,
        }),
        beneficiaryLastName: getFormattedFirstnameAndLastname({
          lastname:
            conventionWithAssessmentReadyToFill.signatories.beneficiary
              .lastName,
        }),
        conventionId: conventionWithAssessmentReadyToFill.id,
        establishmentTutorName: `${conventionWithAssessmentReadyToFill.establishmentTutor.firstName} ${conventionWithAssessmentReadyToFill.establishmentTutor.lastName}`,
        assessmentCreationLink: makeGenerateConventionMagicLinkUrl(
          config,
          generateConventionJwt,
        )({
          email: conventionWithAssessmentReadyToFill.establishmentTutor.email,
          id: conventionWithAssessmentReadyToFill.id,
          now: new Date(),
          role: "establishment-tutor",
          targetRoute: "assessment",
        }),
        internshipKind: conventionWithAssessmentReadyToFill.internshipKind,
      },
    },
    followedIds: {
      conventionId: conventionWithAssessmentReadyToFill.id,
      agencyId: conventionWithAssessmentReadyToFill.agencyId,
      establishmentSiret: conventionWithAssessmentReadyToFill.siret,
    },
  });
  await uow.outboxRepository.save({
    id: uuidGenerator.new(),
    occurredAt: new Date().toISOString(),
    status: "published",
    publications: [],
    wasQuarantined: false,
    topic: "EmailWithLinkToCreateAssessmentSent",
    priority: defaultPriority,
    payload: {
      id: conventionWithAssessmentReadyToFill.id,
    },
  });

  await saveConventionsToManageForPlaywrightTest(uow);

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("conventionSeed done");
};

const saveConventionsToManageForPlaywrightTest = async (uow: UnitOfWork) => {
  const today = new Date();
  const inFiveDays = new Date(today);
  inFiveDays.setDate(today.getDate() + 5);

  const futureStart = today.toISOString();
  const futureEnd = inFiveDays.toISOString();

  const readyToSignConvention1 = new ConventionDtoBuilder()
    .withId(SEED_READY_TO_SIGN_CONVENTION_1_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("READY_TO_SIGN")
    .notSigned()
    .build();

  const readyToSignConvention2 = new ConventionDtoBuilder()
    .withId(SEED_READY_TO_SIGN_CONVENTION_2_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("READY_TO_SIGN")
    .notSigned()
    .build();

  const partiallySignedConvention = new ConventionDtoBuilder()
    .withId(SEED_PARTIALLY_SIGNED_CONVENTION_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("PARTIALLY_SIGNED")
    .signedByBeneficiary(new Date("2024-10-04").toISOString())
    .build();

  const inReviewConventionWithDoubleValidation = new ConventionDtoBuilder()
    .withId(SEED_IN_REVIEW_CONVENTION_WITH_DOUBLE_VALIDATION_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_AGENCY_WITH_REFERS_TO_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("IN_REVIEW")
    .build();

  const inReviewConvention = new ConventionDtoBuilder()
    .withId(SEED_IN_REVIEW_CONVENTION_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("IN_REVIEW")
    .build();

  const acceptedByValidatorConvention1 = new ConventionDtoBuilder()
    .withId(SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(today.toISOString())
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateValidation(today.toISOString())
    .build();

  const acceptedByValidatorConvention2 = new ConventionDtoBuilder()
    .withId(SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_2_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(today.toISOString())
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withDateValidation(today.toISOString())
    .build();

  const acceptedByValidatorConvention3 = new ConventionDtoBuilder()
    .withId(SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_3_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .build();

  const conventionByAdminAsBeneficiary = new ConventionDtoBuilder()
    .withId(SEED_ADMIN_BENEFICIARY_CONVENTION_ID)
    .withSiret(franceMerguez.establishment.siret)
    .withBusinessName(franceMerguez.establishment.name)
    .withInternshipKind("immersion")
    .withDateStart(futureStart)
    .withDateEnd(futureEnd)
    .withAgencyId(SEED_FT_AGENCY_ID)
    .withSchedule(reasonableSchedule)
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withBeneficiaryEmail(adminPlaywrightEmail)
    .build();

  await Promise.all([
    uow.conventionRepository.save(readyToSignConvention1),
    uow.conventionRepository.save(readyToSignConvention2),
    uow.conventionRepository.save(partiallySignedConvention),
    uow.conventionRepository.save(inReviewConvention),
    uow.conventionRepository.save(inReviewConventionWithDoubleValidation),
    uow.conventionRepository.save(acceptedByValidatorConvention1),
    uow.conventionRepository.save(acceptedByValidatorConvention2),
    uow.conventionRepository.save(acceptedByValidatorConvention3),
    uow.conventionRepository.save(conventionByAdminAsBeneficiary),
  ]);
};
