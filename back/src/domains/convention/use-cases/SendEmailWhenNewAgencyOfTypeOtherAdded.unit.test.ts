import { AgencyDtoBuilder, ConnectedUserBuilder } from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeSendEmailWhenNewAgencyOfTypeOtherAdded,
  type SendEmailWhenNewAgencyOfTypeOtherAdded,
} from "./SendEmailWhenNewAgencyOfTypeOtherAdded";

describe("Send email when agency of type other added ", () => {
  const counsellorAndValidator = new ConnectedUserBuilder()
    .withId("in-both")
    .withEmail("in-both@mail.com")
    .buildUser();
  const counsellor = new ConnectedUserBuilder()
    .withId("councellor")
    .withEmail("councellor@email.com")
    .buildUser();
  const validator = new ConnectedUserBuilder()
    .withId("validator")
    .withEmail("validator@email.com")
    .buildUser();

  const agency = new AgencyDtoBuilder()
    .withId("other-agency")
    .withName("just-added-agency")
    .withLogoUrl("https://agency-logo.com")
    .withKind("autre")
    .build();

  const ftAgency = new AgencyDtoBuilder()
    .withId("peAgency")
    .withName("just-added-agency")
    .withLogoUrl("https://agency-logo.com")
    .withKind("france-travail")
    .build();

  const agencyWithRefersTo = new AgencyDtoBuilder()
    .withId("id-of-agency-refering-to-other")
    .withRefersToAgencyInfo({
      refersToAgencyId: agency.id,
      refersToAgencyName: agency.name,
      refersToAgencyContactEmail: agency.contactEmail,
    })
    .withName("just-added-agency-refering-to-other-one")
    .withLogoUrl("https://agency-refering-logo.com")
    .withKind("autre")
    .build();

  let uow: InMemoryUnitOfWork;
  let sendEmailWhenNewAgencyOfTypeOtherAdded: SendEmailWhenNewAgencyOfTypeOtherAdded;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    sendEmailWhenNewAgencyOfTypeOtherAdded =
      makeSendEmailWhenNewAgencyOfTypeOtherAdded({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            new UuidV4Generator(),
            new CustomTimeGateway(),
          ),
        },
      });
    uow.userRepository.users = [counsellor, validator, counsellorAndValidator];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [counsellorAndValidator.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor", "validator"],
        },
      }),
      toAgencyWithRights(ftAgency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [counsellorAndValidator.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor", "validator"],
        },
      }),
      toAgencyWithRights(agencyWithRefersTo, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];
  });

  it("Sends email to counsellors and validators when agency of type other added", async () => {
    // Act
    await sendEmailWhenNewAgencyOfTypeOtherAdded.execute({
      agencyId: agency.id,
    });

    // Assert
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "AGENCY_OF_TYPE_OTHER_ADDED",
          recipients: [
            counsellorAndValidator.email,
            validator.email,
            counsellor.email,
          ],
          params: {
            agencyName: "just-added-agency",
            agencyLogoUrl: "https://agency-logo.com",
          },
        },
      ],
    });
  });

  it("doesn't send an email to agency if agency is refering to other agency ", async () => {
    await sendEmailWhenNewAgencyOfTypeOtherAdded.execute({
      agencyId: agencyWithRefersTo.id,
    });

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });

  it("doesn't send an email to agency if agency isn't of type 'autre' ", async () => {
    await sendEmailWhenNewAgencyOfTypeOtherAdded.execute({
      agencyId: ftAgency.id,
    });

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });
});
