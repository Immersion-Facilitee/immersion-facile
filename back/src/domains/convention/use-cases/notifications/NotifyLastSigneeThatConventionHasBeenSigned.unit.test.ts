import {
  type AgencyWithUsersRights,
  type ConventionDto,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
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
  makeNotifyLastSigneeThatConventionHasBeenSigned,
  type NotifyLastSigneeThatConventionHasBeenSigned,
} from "./NotifyLastSigneeThatConventionHasBeenSigned";

describe("NotifyLastSigneeThatConventionHasBeenSigned", () => {
  let conventionSignedByNoOne: ConventionDto;
  let notifyLastSignee: NotifyLastSigneeThatConventionHasBeenSigned;
  let uow: InMemoryUnitOfWork;
  let agency: AgencyWithUsersRights;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let config: AppConfig;

  beforeEach(() => {
    uow = createInMemoryUow();
    agency = uow.agencyRepository.agencies[0];
    conventionSignedByNoOne = new ConventionDtoBuilder()
      .withAgencyId(agency.id)
      .signedByBeneficiary(undefined)
      .signedByEstablishmentRepresentative(undefined)
      .build();

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    config = new AppConfigBuilder({}).build();

    const uuidGenerator = new UuidV4Generator();
    const saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      uuidGenerator,
      new CustomTimeGateway(),
    );

    notifyLastSignee = makeNotifyLastSigneeThatConventionHasBeenSigned({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent,
        config,
      },
    });
  });

  const manageConventionUrl = (
    conventionId: string,
    loginPersona: "beneficiary" | "professional",
  ) =>
    makeRouteAbsoluteUrl({
      route: frontRoutes.manageConventionConnectedUser({
        conventionId,
        loginPersona,
      }),
      baseUrl: config.immersionFacileBaseUrl,
    });

  it("Last signed by beneficiary, no more signees", async () => {
    const signedConvention = new ConventionDtoBuilder(conventionSignedByNoOne)
      .signedByBeneficiary(new Date().toISOString())
      .build();

    uow.conventionRepository.setConventions([signedConvention]);

    await notifyLastSignee.execute({ convention: signedConvention });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          params: {
            internshipKind: signedConvention.internshipKind,
            conventionId: signedConvention.id,
            // biome-ignore lint/style/noNonNullAssertion: signedAt is set in this test
            signedAt: signedConvention.signatories.beneficiary.signedAt!,
            magicLink: manageConventionUrl(signedConvention.id, "beneficiary"),
            agencyLogoUrl: agency.logoUrl ?? undefined,
            agencyName: agency.name,
          },
          recipients: [signedConvention.signatories.beneficiary.email],
          kind: "SIGNEE_HAS_SIGNED_CONVENTION",
        },
      ],
    });
  });

  it("Last signed by establishment representative, beneficiary already signed", async () => {
    const signedConvention = new ConventionDtoBuilder(conventionSignedByNoOne)
      .signedByBeneficiary(new Date().toISOString())
      .signedByEstablishmentRepresentative(new Date().toISOString())
      .build();
    uow.conventionRepository.setConventions([signedConvention]);

    await notifyLastSignee.execute({ convention: signedConvention });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          params: {
            internshipKind: signedConvention.internshipKind,
            signedAt:
              // biome-ignore lint/style/noNonNullAssertion: signedAt is set in this test
              signedConvention.signatories.establishmentRepresentative
                .signedAt!,
            conventionId: signedConvention.id,
            magicLink: manageConventionUrl(signedConvention.id, "professional"),
            agencyLogoUrl: agency.logoUrl ?? undefined,
            agencyName: agency.name,
          },
          recipients: [
            signedConvention.signatories.establishmentRepresentative.email,
          ],
          kind: "SIGNEE_HAS_SIGNED_CONVENTION",
        },
      ],
    });
  });

  it("No one has signed the convention.", async () => {
    uow.conventionRepository.setConventions([conventionSignedByNoOne]);

    await expectPromiseToFailWithError(
      notifyLastSignee.execute({ convention: conventionSignedByNoOne }),
      errors.convention.noSignatoryHasSigned({
        conventionId: conventionSignedByNoOne.id,
      }),
    );

    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("No convention on repository.", async () => {
    uow.conventionRepository.setConventions([]);

    await expectPromiseToFailWithError(
      notifyLastSignee.execute({ convention: conventionSignedByNoOne }),
      errors.convention.notFound({
        conventionId: conventionSignedByNoOne.id,
      }),
    );

    expectSavedNotificationsAndEvents({ emails: [] });
  });
});
