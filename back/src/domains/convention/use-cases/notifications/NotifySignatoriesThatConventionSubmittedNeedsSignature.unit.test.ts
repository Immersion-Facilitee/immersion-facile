import {
  type AgencyDto,
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type EmailNotification,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { expectEmailSignatoryConfirmationSignatureRequestMatchingConvention } from "../../../core/notifications/adapters/InMemoryNotificationRepository";
import {
  makeSaveNotificationAndRelatedEvent,
  type WithNotificationIdAndKind,
} from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifySignatoriesThatConventionSubmittedNeedsSignature,
  type NotifySignatoriesThatConventionSubmittedNeedsSignature,
} from "./NotifySignatoriesThatConventionSubmittedNeedsSignature";

describe("NotifySignatoriesThatConventionSubmittedNeedsSignature", () => {
  const config: AppConfig = new AppConfigBuilder({}).build();
  const agency: AgencyDto = new AgencyDtoBuilder().build();
  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.com")
    .buildUser();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .buildUser();
  const validConvention: ConventionDto = new ConventionDtoBuilder()
    .withBeneficiaryRepresentative({
      firstName: "Tom",
      lastName: "Cruise",
      phone: "0665454271",
      role: "beneficiary-representative",
      email: "beneficiary@representative.fr",
    })
    .withAgencyId(agency.id)
    .build();

  let uow: InMemoryUnitOfWork;
  let useCase: NotifySignatoriesThatConventionSubmittedNeedsSignature;

  beforeEach(() => {
    uow = createInMemoryUow();
    const timeGateway = new CustomTimeGateway();
    useCase = makeNotifySignatoriesThatConventionSubmittedNeedsSignature({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        config,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
      },
    });
    uow.userRepository.users = [counsellor, validator];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      }),
    ];
  });

  it("Sends confirmation email to all signatories", async () => {
    await useCase.execute({ convention: validConvention });

    const emailNotifications = uow.notificationRepository.notifications.filter(
      (notification): notification is EmailNotification =>
        notification.kind === "email",
    );

    expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
      emailNotifications.map(
        ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
      ),
    );
    expect(emailNotifications).toHaveLength(3);

    expectEmailSignatoryConfirmationSignatureRequestMatchingConvention({
      templatedEmail: emailNotifications[0].templatedContent,
      convention: validConvention,
      signatory: validConvention.signatories.beneficiary,
      recipient: validConvention.signatories.beneficiary.email,
      agency,
      config,
    });
    expectEmailSignatoryConfirmationSignatureRequestMatchingConvention({
      templatedEmail: emailNotifications[1].templatedContent,
      convention: validConvention,
      signatory: validConvention.signatories.establishmentRepresentative,
      recipient: validConvention.signatories.establishmentRepresentative.email,
      agency,
      config,
    });
    expectEmailSignatoryConfirmationSignatureRequestMatchingConvention({
      templatedEmail: emailNotifications[2].templatedContent,
      convention: validConvention,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      signatory: validConvention.signatories.beneficiaryRepresentative!,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipient: validConvention.signatories.beneficiaryRepresentative!.email,
      agency,
      config,
    });
  });
});
