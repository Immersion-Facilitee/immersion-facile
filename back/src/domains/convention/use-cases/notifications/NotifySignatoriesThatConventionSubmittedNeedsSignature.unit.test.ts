import {
  type AgencyDto,
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type EmailNotification,
  expectToEqual,
  type ShortLinkId,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../../utils/jwtTestHelper";
import { expectEmailSignatoryConfirmationSignatureRequestMatchingConvention } from "../../../core/notifications/adapters/InMemoryNotificationRepository";
import {
  makeSaveNotificationAndRelatedEvent,
  type WithNotificationIdAndKind,
} from "../../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
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
  let timeGateway: CustomTimeGateway;
  let shortLinkGenerator: DeterministShortLinkIdGeneratorGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    shortLinkGenerator = new DeterministShortLinkIdGeneratorGateway();
    useCase = makeNotifySignatoriesThatConventionSubmittedNeedsSignature({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        shortLinkIdGeneratorGateway: shortLinkGenerator,
        generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
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
    const deterministicShortLinks: ShortLinkId[] = [
      "shortLink1",
      "shortLink2",
      "shortLink3",
    ];
    shortLinkGenerator.addMoreShortLinkIds(deterministicShortLinks);

    await useCase.execute({ convention: validConvention });

    expectToEqual(uow.shortLinkQuery.getShortLinks(), [
      {
        id: deterministicShortLinks[0],
        url: fakeGenerateMagicLinkUrlFn({
          id: validConvention.id,
          role: validConvention.signatories.beneficiary.role,
          email: validConvention.signatories.beneficiary.email,
          now: timeGateway.now(),
          targetRoute: "conventionToSign",
          lifetime: "2Days",
          extraQueryParams: { at_campaign: "email-signature-link" },
        }),
        lastUsedAt: null,
      },
      {
        id: deterministicShortLinks[1],
        url: fakeGenerateMagicLinkUrlFn({
          id: validConvention.id,
          // biome-ignore lint/style/noNonNullAssertion: testing purpose
          role: validConvention.signatories.establishmentRepresentative!.role,
          // biome-ignore lint/style/noNonNullAssertion: testing purpose
          email: validConvention.signatories.establishmentRepresentative!.email,
          now: timeGateway.now(),
          targetRoute: "conventionToSign",
          lifetime: "2Days",
          extraQueryParams: { at_campaign: "email-signature-link" },
        }),
        lastUsedAt: null,
      },
      {
        id: deterministicShortLinks[2],
        url: fakeGenerateMagicLinkUrlFn({
          id: validConvention.id,
          // biome-ignore lint/style/noNonNullAssertion: testing purpose
          role: validConvention.signatories.beneficiaryRepresentative!.role,
          // biome-ignore lint/style/noNonNullAssertion: testing purpose
          email: validConvention.signatories.beneficiaryRepresentative!.email,
          now: timeGateway.now(),
          targetRoute: "conventionToSign",
          lifetime: "2Days",
          extraQueryParams: { at_campaign: "email-signature-link" },
        }),
        lastUsedAt: null,
      },
    ]);

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
      now: timeGateway.now(),
      agency,
      config,
      conventionToSignLinkId: deterministicShortLinks[0],
    });
    expectEmailSignatoryConfirmationSignatureRequestMatchingConvention({
      templatedEmail: emailNotifications[1].templatedContent,
      convention: validConvention,
      signatory: validConvention.signatories.establishmentRepresentative,
      recipient: validConvention.signatories.establishmentRepresentative.email,
      now: timeGateway.now(),
      agency,
      config,
      conventionToSignLinkId: deterministicShortLinks[1],
    });
    expectEmailSignatoryConfirmationSignatureRequestMatchingConvention({
      templatedEmail: emailNotifications[2].templatedContent,
      convention: validConvention,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      signatory: validConvention.signatories.beneficiaryRepresentative!,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      recipient: validConvention.signatories.beneficiaryRepresentative!.email,
      now: timeGateway.now(),
      agency,
      config,
      conventionToSignLinkId: deterministicShortLinks[2],
    });
  });
});
