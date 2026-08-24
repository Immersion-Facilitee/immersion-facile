import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  getFormattedFirstnameAndLastname,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { makeShortLinkUrl } from "../../../core/short-link/ShortLink";
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
  let shortLinkGenerator: DeterministShortLinkIdGeneratorGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    config = new AppConfigBuilder({}).build();
    shortLinkGenerator = new DeterministShortLinkIdGeneratorGateway();

    uow = createInMemoryUow();
    const uuidGenerator = new UuidV4Generator();
    timeGateway = new CustomTimeGateway(new Date());
    useCase =
      makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification(
        {
          uowPerformer: new InMemoryUowPerformer(uow),
          deps: {
            timeGateway,
            config,
            shortLinkIdGeneratorGateway: shortLinkGenerator,
            generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
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
    const shortLinks = ["shortLink1", "shortLink2", "shortLink3", "shortLink4"];

    beforeEach(() => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      shortLinkGenerator.addMoreShortLinkIds(shortLinks);
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

      expectToEqual(uow.shortLinkQuery.getShortLinks(), [
        {
          id: shortLinks[0],
          url: fakeGenerateMagicLinkUrlFn({
            id: convention.id,
            role: convention.signatories.beneficiary.role,
            email: convention.signatories.beneficiary.email,
            now: timeGateway.now(),
            targetRoute: "conventionToSign",
            lifetime: "2Days",
            extraQueryParams: {
              at_campaign: "email-signature-link-after-modification",
            },
          }),
          lastUsedAt: null,
        },
        {
          id: shortLinks[1],
          url: fakeGenerateMagicLinkUrlFn({
            id: convention.id,
            role: convention.signatories.establishmentRepresentative.role,
            email: convention.signatories.establishmentRepresentative.email,
            now: timeGateway.now(),
            targetRoute: "conventionToSign",
            lifetime: "2Days",
            extraQueryParams: {
              at_campaign: "email-signature-link-after-modification",
            },
          }),
          lastUsedAt: null,
        },
      ]);

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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[0]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[1]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[0]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[1]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[0]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[1]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[2]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[3]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[0]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[1]),
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
              conventionSignShortlink: makeShortLinkUrl(config, shortLinks[2]),
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
