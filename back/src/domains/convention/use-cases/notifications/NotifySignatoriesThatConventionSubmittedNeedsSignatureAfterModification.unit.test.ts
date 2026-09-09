import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification,
  NO_JUSTIFICATION,
  type NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification,
} from "./NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification";

describe("NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification", () => {
  let useCase: NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification;
  let config: AppConfig;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    config = new AppConfigBuilder({}).build();

    uow = createInMemoryUow();
    const uuidGenerator = new UuidV4Generator();
    const timeGateway = new CustomTimeGateway(new Date());
    useCase =
      makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification(
        {
          uowPerformer: new InMemoryUowPerformer(uow),
          deps: {
            config,
            saveNotificationAndRelatedEvent:
              makeSaveNotificationAndRelatedEvent(uuidGenerator, timeGateway),
          },
        },
      );
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  describe("Right paths", () => {
    const agency = new AgencyDtoBuilder().build();

    beforeEach(() => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    });

    it("Convention with minimal signatories", async () => {
      const justification = "justif";
      const convention = new ConventionDtoBuilder()
        .withAgencyId(agency.id)
        .withStatusJustification(justification)
        .withBeneficiarySignedAt(undefined)
        .withEstablishmentRepresentativeSignedAt(undefined)
        .build();

      uow.conventionRepository.setConventions([convention]);

      await useCase.execute({ convention });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [convention.signatories.beneficiary.email],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              convention.signatories.establishmentRepresentative.email,
            ],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "professional",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.establishmentRepresentative.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.establishmentRepresentative.lastName,
              }),
            },
          },
        ],
      });
    });

    it("Convention without justification", async () => {
      const convention = new ConventionDtoBuilder()
        .withAgencyId(agency.id)
        .withBeneficiarySignedAt(undefined)
        .withEstablishmentRepresentativeSignedAt(undefined)
        .build();
      uow.conventionRepository.setConventions([convention]);

      await useCase.execute({ convention });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [convention.signatories.beneficiary.email],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification: NO_JUSTIFICATION,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              convention.signatories.establishmentRepresentative.email,
            ],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "professional",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification: NO_JUSTIFICATION,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.establishmentRepresentative.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.establishmentRepresentative.lastName,
              }),
            },
          },
        ],
      });
    });

    it("Convention with all signatories", async () => {
      const justification = "justif";
      const convention = new ConventionDtoBuilder()
        .withAgencyId(agency.id)
        .withStatusJustification(justification)
        .withBeneficiarySignedAt(undefined)
        .withEstablishmentRepresentativeSignedAt(undefined)
        .withBeneficiaryRepresentative({
          firstName: "benef rep first name",
          lastName: "benef rep last name",
          email: "benefrep@email.com",
          phone: "0600558877",
          role: "beneficiary-representative",
          signedAt: undefined,
        })
        .withBeneficiaryCurrentEmployer({
          firstName: "benef cur emp first name",
          lastName: "benef cur emp last name",
          email: "benefcuremp@email.com",
          phone: "0600777777",
          businessAddress: "13 rue de la soif, 60666 Quimper",
          businessName: "Merguez Corp",
          businessSiret: "77884455998877",
          job: "Lanceur de guezmer",
          role: "beneficiary-current-employer",
          signedAt: undefined,
        })
        .build();
      uow.conventionRepository.setConventions([convention]);

      await useCase.execute({ convention });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [convention.signatories.beneficiary.email],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              convention.signatories.establishmentRepresentative.email,
            ],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "professional",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.establishmentRepresentative.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.establishmentRepresentative.lastName,
              }),
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              // biome-ignore lint/style/noNonNullAssertion: testing purpose
              convention.signatories.beneficiaryRepresentative!.email,
            ],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: convention.signatories
                .beneficiaryRepresentative
                ? getFormattedFirstnameAndLastname({
                    firstname:
                      convention.signatories.beneficiaryRepresentative
                        .firstName,
                  })
                : "",
              signatoryLastName: convention.signatories
                .beneficiaryRepresentative
                ? getFormattedFirstnameAndLastname({
                    lastname:
                      convention.signatories.beneficiaryRepresentative.lastName,
                  })
                : "",
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              // biome-ignore lint/style/noNonNullAssertion: testing purpose
              convention.signatories.beneficiaryCurrentEmployer!.email,
            ],
            params: {
              agencyLogoUrl: agency.logoUrl ?? undefined,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              internshipKind: convention.internshipKind,
              justification,
              signatoryFirstName: convention.signatories
                .beneficiaryCurrentEmployer
                ? getFormattedFirstnameAndLastname({
                    firstname:
                      convention.signatories.beneficiaryCurrentEmployer
                        .firstName,
                  })
                : "",
              signatoryLastName: convention.signatories
                .beneficiaryCurrentEmployer
                ? getFormattedFirstnameAndLastname({
                    lastname:
                      convention.signatories.beneficiaryCurrentEmployer
                        .lastName,
                  })
                : "",
            },
          },
        ],
      });
    });
    it("send notification only to signatories that didn't sign yet", async () => {
      const justification = "justif";

      const convention = new ConventionDtoBuilder()
        .withAgencyId(agency.id)
        .withStatusJustification(justification)
        .withBeneficiarySignedAt(new Date())
        .withEstablishmentRepresentativeSignedAt(undefined)
        .withBeneficiaryRepresentative({
          firstName: "benef rep first name",
          lastName: "benef rep last name",
          email: "benefrep@email.com",
          phone: "0600558877",
          role: "beneficiary-representative",
          signedAt: undefined,
        })
        .withBeneficiaryCurrentEmployer({
          firstName: "benef cur emp first name",
          lastName: "benef cur emp last name",
          email: "benefcuremp@email.com",
          phone: "0600777777",
          businessAddress: "13 rue de la soif, 60666 Quimper",
          businessName: "Merguez Corp",
          businessSiret: "77884455998877",
          job: "Lanceur de guezmer",
          role: "beneficiary-current-employer",
          signedAt: undefined,
        })
        .build();
      const commonEmailParams = {
        agencyLogoUrl: agency.logoUrl ?? undefined,
        beneficiaryFirstName: getFormattedFirstnameAndLastname({
          firstname: convention.signatories.beneficiary.firstName,
        }),
        beneficiaryLastName: getFormattedFirstnameAndLastname({
          lastname: convention.signatories.beneficiary.lastName,
        }),
        businessName: convention.businessName,
        conventionId: convention.id,
        internshipKind: convention.internshipKind,
        justification,
      };
      uow.conventionRepository.setConventions([convention]);

      await useCase.execute({ convention });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              convention.signatories.establishmentRepresentative.email,
            ],
            params: {
              ...commonEmailParams,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "professional",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              signatoryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  convention.signatories.establishmentRepresentative.firstName,
              }),
              signatoryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  convention.signatories.establishmentRepresentative.lastName,
              }),
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              // biome-ignore lint/style/noNonNullAssertion: testing purpose
              convention.signatories.beneficiaryRepresentative!.email,
            ],
            params: {
              ...commonEmailParams,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              signatoryFirstName: convention.signatories
                .beneficiaryRepresentative
                ? getFormattedFirstnameAndLastname({
                    firstname:
                      convention.signatories.beneficiaryRepresentative
                        .firstName,
                  })
                : "",
              signatoryLastName: convention.signatories
                .beneficiaryRepresentative
                ? getFormattedFirstnameAndLastname({
                    lastname:
                      convention.signatories.beneficiaryRepresentative.lastName,
                  })
                : "",
            },
          },
          {
            kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            recipients: [
              // biome-ignore lint/style/noNonNullAssertion: testing purpose
              convention.signatories.beneficiaryCurrentEmployer!.email,
            ],
            params: {
              ...commonEmailParams,
              conventionSignatureLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                  loginPersona: "beneficiary",
                  at_campaign: "email-signature-link-after-modification",
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              signatoryFirstName: convention.signatories
                .beneficiaryCurrentEmployer
                ? getFormattedFirstnameAndLastname({
                    firstname:
                      convention.signatories.beneficiaryCurrentEmployer
                        .firstName,
                  })
                : "",
              signatoryLastName: convention.signatories
                .beneficiaryCurrentEmployer
                ? getFormattedFirstnameAndLastname({
                    lastname:
                      convention.signatories.beneficiaryCurrentEmployer
                        .lastName,
                  })
                : "",
            },
          },
        ],
      });
    });
  });

  describe("Wrong paths", () => {
    it("Convention missing", async () => {
      const convention = new ConventionDtoBuilder().build();
      uow.agencyRepository.agencies = [
        toAgencyWithRights(new AgencyDtoBuilder().build()),
      ];

      await expectPromiseToFailWithError(
        useCase.execute({ convention }),
        errors.convention.notFound({ conventionId: convention.id }),
      );

      await expectSavedNotificationsAndEvents({});
    });

    it("Agency missing", async () => {
      const convention = new ConventionDtoBuilder().build();
      const agency = new AgencyDtoBuilder().build();
      uow.conventionRepository.setConventions([
        new ConventionDtoBuilder(convention).withAgencyId(agency.id).build(),
      ]);

      await expectPromiseToFailWithError(
        useCase.execute({ convention }),
        errors.agency.notFound({ agencyId: convention.agencyId }),
      );

      await expectSavedNotificationsAndEvents({});
    });
  });
});
