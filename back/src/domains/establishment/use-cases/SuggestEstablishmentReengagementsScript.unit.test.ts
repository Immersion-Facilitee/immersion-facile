import { subDays, subMonths } from "date-fns";
import { errors, expectToEqual, type SiretDto, UserBuilder } from "shared";
import { v4 as uuid } from "uuid";
import { makeSaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../helpers/EstablishmentBuilders";
import {
  makeSuggestEstablishmentReengagement,
  type SuggestEstablishmentReengagement,
} from "./SuggestEstablishmentReengagement";
import {
  makeSuggestEstablishmentReengagementsScript,
  type SuggestEstablishmentReengagementsScript,
} from "./SuggestEstablishmentReengagementsScript";

const now = new Date("2026-01-15T10:00:00.000Z");
const sixMonthsAgo = subMonths(now, 6);
const batchSize = 5;
const maxEstablishmentsToReengage = 10;

const admin = new UserBuilder()
  .withId("admin-id")
  .withEmail("admin@mail.com")
  .build();

const adminUserRight = {
  userId: admin.id,
  role: "establishment-admin" as const,
  status: "ACCEPTED" as const,
  job: "Boss",
  phone: "+33688779955",
  shouldReceiveDiscussionNotifications: true,
  isMainContactByPhone: false,
};

const establishmentAggregate1 = new EstablishmentAggregateBuilder()
  .withEstablishmentSiret("11111111111111")
  .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
  .withUserRights([adminUserRight])
  .build();

const establishmentAggregate2 = new EstablishmentAggregateBuilder()
  .withEstablishmentSiret("22222222222222")
  .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
  .withUserRights([adminUserRight])
  .build();

describe("SuggestEstablishmentReengagementsScript", () => {
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let suggestEstablishmentReengagement: SuggestEstablishmentReengagement;
  let suggestEstablishmentReengagementsScript: SuggestEstablishmentReengagementsScript;

  const seedAlreadySuggestedNotification = (
    siret: SiretDto,
    createdAt: Date,
  ) => {
    uow.notificationRepository.notifications.push({
      kind: "email",
      id: uuid(),
      createdAt: createdAt.toISOString(),
      followedIds: { establishmentSiret: siret },
      templatedContent: {
        kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
        sender: {
          email: "immersion-facile@beta.gouv.fr",
          name: "Immersion Facilitée",
        },
        recipients: ["someone@mail.com"],
        params: { businessName: "Breizh Galette" },
      },
    });
  };

  const getReengagementSuggestionSiretsFromNotifications = () =>
    uow.notificationRepository.notifications
      .filter(
        (notification) =>
          notification.kind === "email" &&
          notification.templatedContent.kind ===
            "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
      )
      .map((notification) => notification.followedIds.establishmentSiret);

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.userRepository.users = [admin];
    timeGateway = new CustomTimeGateway(now);
    suggestEstablishmentReengagement = makeSuggestEstablishmentReengagement({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
      },
    });
    suggestEstablishmentReengagementsScript =
      makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize,
          maxEstablishmentsToReengage,
        },
      });
  });

  it("returns an empty report when no establishment needs to be contacted", async () => {
    const result = await suggestEstablishmentReengagementsScript.execute();

    expectToEqual(result, { numberOfEstablishmentsToContact: 0, errors: {} });
  });

  it("suggests reengagement only for establishments not updated for 6 months", async () => {
    const recentEstablishmentAggregate = {
      ...establishmentAggregate2,
      establishment: {
        ...establishmentAggregate2.establishment,
        updatedAt: subDays(sixMonthsAgo, -1),
      },
    };
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate1,
      recentEstablishmentAggregate,
    ];

    const result = await suggestEstablishmentReengagementsScript.execute();

    expectToEqual(result, { numberOfEstablishmentsToContact: 1, errors: {} });
    expectToEqual(getReengagementSuggestionSiretsFromNotifications(), [
      establishmentAggregate1.establishment.siret,
    ]);
  });

  it("excludes establishments already suggested a reengagement within the last 6 months", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate1,
      establishmentAggregate2,
    ];
    seedAlreadySuggestedNotification(
      establishmentAggregate1.establishment.siret,
      subDays(now, 1),
    );

    const result = await suggestEstablishmentReengagementsScript.execute();

    expectToEqual(result, {
      numberOfEstablishmentsToContact: 1,
      errors: {},
    });
  });

  it("suggests reengagement again when the previous suggestion is older than 6 months", async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate1,
    ];
    seedAlreadySuggestedNotification(
      establishmentAggregate1.establishment.siret,
      subDays(sixMonthsAgo, 1),
    );

    const result = await suggestEstablishmentReengagementsScript.execute();

    expectToEqual(result, {
      numberOfEstablishmentsToContact: 1,
      errors: {},
    });
  });

  it("records per-siret errors without stopping the run", async () => {
    const failingSiret = establishmentAggregate1.establishment.siret;
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate1,
      establishmentAggregate2,
    ];
    const thrownError = errors.establishment.notFound({
      siret: failingSiret,
    });

    const result = await makeSuggestEstablishmentReengagementsScript({
      deps: {
        suggestEstablishmentReengagement: {
          useCaseName: "SuggestEstablishmentReengagement",
          execute: async (siret) => {
            if (siret === failingSiret) throw thrownError;
          },
        },
        timeGateway,
        uowPerformer: new InMemoryUowPerformer(uow),
        batchSize,
        maxEstablishmentsToReengage,
      },
    }).execute();

    expectToEqual(result, {
      numberOfEstablishmentsToContact: 2,
      errors: { [failingSiret]: thrownError },
    });
  });

  describe("pagination", () => {
    const establishmentAggregate3 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("33333333333333")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
      .withUserRights([adminUserRight])
      .build();

    beforeEach(() => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate1,
        establishmentAggregate2,
        establishmentAggregate3,
      ];
    });

    it("paginates through batches to process all establishments", async () => {
      const result = await makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 2,
          maxEstablishmentsToReengage,
        },
      }).execute();

      expectToEqual(result, {
        numberOfEstablishmentsToContact: 3,
        errors: {},
      });
    });

    it("stops once maxEstablishmentsToReengage is reached", async () => {
      const result = await makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 1,
          maxEstablishmentsToReengage: 2,
        },
      }).execute();

      expectToEqual(result.numberOfEstablishmentsToContact, 2);
    });

    it("does not send more notifications than maxEstablishmentsToReengage, even when batchSize exceed it", async () => {
      const result = await makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 2,
          maxEstablishmentsToReengage: 1,
        },
      }).execute();

      expectToEqual(result.numberOfEstablishmentsToContact, 1);
    });
  });

  describe("consecutive cron runs", () => {
    const oldestEstablishment = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("44444444444444")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 10))
      .withUserRights([adminUserRight])
      .build();

    const secondOldestEstablishment = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("55555555555555")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 9))
      .withUserRights([adminUserRight])
      .build();

    const thirdOldestEstablishment = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("77777777777777")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 8))
      .withUserRights([adminUserRight])
      .build();

    const fourthOldestEstablishment = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("88888888888888")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 7))
      .withUserRights([adminUserRight])
      .build();

    const newerStaleEstablishment = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("66666666666666")
      .withEstablishmentUpdatedAt(subDays(sixMonthsAgo, 1))
      .withUserRights([adminUserRight])
      .build();

    it("does not rescan establishments already suggested during last cron run", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        oldestEstablishment,
        secondOldestEstablishment,
        newerStaleEstablishment,
      ];
      const dailyScript = makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 2,
          maxEstablishmentsToReengage: 2,
        },
      });

      const day1Result = await dailyScript.execute();
      expectToEqual(day1Result, {
        numberOfEstablishmentsToContact: 2,
        errors: {},
      });
      expectToEqual(getReengagementSuggestionSiretsFromNotifications(), [
        oldestEstablishment.establishment.siret,
        secondOldestEstablishment.establishment.siret,
      ]);

      const day2Result = await dailyScript.execute();

      expectToEqual(day2Result, {
        numberOfEstablishmentsToContact: 1,
        errors: {},
      });
      expectToEqual(getReengagementSuggestionSiretsFromNotifications(), [
        oldestEstablishment.establishment.siret,
        secondOldestEstablishment.establishment.siret,
        newerStaleEstablishment.establishment.siret,
      ]);
    });

    it("keeps scanning after a fully already-suggested batch to reach establishments never suggested", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        oldestEstablishment,
        secondOldestEstablishment,
        thirdOldestEstablishment,
        fourthOldestEstablishment,
      ];
      seedAlreadySuggestedNotification(
        oldestEstablishment.establishment.siret,
        subDays(now, 1),
      );
      seedAlreadySuggestedNotification(
        secondOldestEstablishment.establishment.siret,
        subDays(now, 1),
      );

      const result = await makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 2,
          maxEstablishmentsToReengage: 2,
        },
      }).execute();

      expectToEqual(result, { numberOfEstablishmentsToContact: 2, errors: {} });
      expectToEqual(getReengagementSuggestionSiretsFromNotifications(), [
        oldestEstablishment.establishment.siret,
        secondOldestEstablishment.establishment.siret,
        thirdOldestEstablishment.establishment.siret,
        fourthOldestEstablishment.establishment.siret,
      ]);
    });

    it("terminates without sending notifications when every stale establishment was already suggested", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        oldestEstablishment,
        secondOldestEstablishment,
        newerStaleEstablishment,
      ];
      seedAlreadySuggestedNotification(
        oldestEstablishment.establishment.siret,
        subDays(now, 1),
      );
      seedAlreadySuggestedNotification(
        secondOldestEstablishment.establishment.siret,
        subDays(now, 1),
      );
      seedAlreadySuggestedNotification(
        newerStaleEstablishment.establishment.siret,
        subDays(now, 1),
      );

      const result = await makeSuggestEstablishmentReengagementsScript({
        deps: {
          suggestEstablishmentReengagement,
          timeGateway,
          uowPerformer: new InMemoryUowPerformer(uow),
          batchSize: 2,
          maxEstablishmentsToReengage: 10,
        },
      }).execute();

      expectToEqual(result, { numberOfEstablishmentsToContact: 0, errors: {} });
    });
  });
});
