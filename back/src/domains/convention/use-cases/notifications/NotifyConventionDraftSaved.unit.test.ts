import {
  type AbsoluteUrl,
  type ConventionDraftDto,
  type Email,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  frontRoutes,
  makeRouteAbsoluteUrl,
} from "shared";
import { v4 as uuid } from "uuid";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import {
  makeSaveNotificationAndRelatedEvent,
  type SaveNotificationAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyConventionDraftSaved,
  type NotifyConventionDraftSaved,
} from "./NotifyConventionDraftSaved";

describe("NotifyConventionDraftSaved", () => {
  const shortLinkId = "shortlink";
  const conventionDraft: ConventionDraftDto = {
    id: uuid(),
    internshipKind: "immersion",
  };
  const recipientEmail: Email = "recipient@mail.com";
  const senderEmail: Email = "sender@mail.com";
  const config = new AppConfigBuilder().build();
  const expectedLongLink: AbsoluteUrl = makeRouteAbsoluteUrl({
    route: frontRoutes.conventionImmersion({
      conventionDraftId: conventionDraft.id,
    }),
    baseUrl: config.immersionFacileBaseUrl,
  });
  const expectedShortLink: AbsoluteUrl = `${config.immersionFacileBaseUrl}/api/to/${shortLinkId}`;

  let useCase: NotifyConventionDraftSaved;
  let uow: InMemoryUnitOfWork;
  let shortLinkIdGeneratorGateway: DeterministShortLinkIdGeneratorGateway;
  let timeGateway: TimeGateway;
  let saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    shortLinkIdGeneratorGateway = new DeterministShortLinkIdGeneratorGateway();
    timeGateway = new CustomTimeGateway();
    const uuidGenerator = new UuidV4Generator();
    saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      uuidGenerator,
      timeGateway,
    );
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    useCase = makeNotifyConventionDraftSaved({
      deps: {
        config,
        saveNotificationAndRelatedEvent,
        shortLinkIdGeneratorGateway,
      },
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    shortLinkIdGeneratorGateway.addMoreShortLinkIds([shortLinkId]);
    uow.conventionDraftRepository.conventionDrafts = [conventionDraft];
  });

  describe("right paths", () => {
    it("Send email to recipent on recipient email in event", async () => {
      await useCase.execute({
        draftId: conventionDraft.id,
        recipientEmail,
        senderEmail: null,
        details: null,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "SHARE_CONVENTION_DRAFT_RECIPIENT",
            params: {
              additionalDetails: undefined,
              conventionDraftId: conventionDraft.id,
              internshipKind: conventionDraft.internshipKind,
              conventionFormUrl: expectedShortLink,
            },
            recipients: [recipientEmail],
          },
        ],
      });

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: shortLinkId,
          lastUsedAt: null,
          url: expectedLongLink,
        },
      ]);
    });

    it("Send email to recipient with additionalDetails when sender email and details in event", async () => {
      const details = "message";

      await useCase.execute({
        draftId: conventionDraft.id,
        recipientEmail,
        senderEmail: null,
        details,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "SHARE_CONVENTION_DRAFT_RECIPIENT",
            params: {
              internshipKind: conventionDraft.internshipKind,
              conventionDraftId: conventionDraft.id,
              conventionFormUrl: expectedShortLink,
              additionalDetails: details,
            },
            recipients: [recipientEmail],
          },
        ],
      });

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: shortLinkId,
          lastUsedAt: null,
          url: expectedLongLink,
        },
      ]);
    });

    it("Send email to sender on sender email in event", async () => {
      await useCase.execute({
        draftId: conventionDraft.id,
        recipientEmail: null,
        senderEmail,
        details: null,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "SHARE_CONVENTION_DRAFT_SENDER",
            params: {
              conventionDraftId: conventionDraft.id,
              internshipKind: conventionDraft.internshipKind,
              conventionFormUrl: expectedShortLink,
            },
            recipients: [senderEmail],
          },
        ],
      });

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: shortLinkId,
          lastUsedAt: null,
          url: expectedLongLink,
        },
      ]);
    });

    it("Send email to recipent & sender on recipient & sender emails in event", async () => {
      await useCase.execute({
        draftId: conventionDraft.id,
        recipientEmail,
        senderEmail,
        details: null,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "SHARE_CONVENTION_DRAFT_SENDER",
            params: {
              conventionDraftId: conventionDraft.id,
              internshipKind: conventionDraft.internshipKind,
              conventionFormUrl: expectedShortLink,
            },
            recipients: [senderEmail],
          },
          {
            kind: "SHARE_CONVENTION_DRAFT_RECIPIENT",
            params: {
              additionalDetails: undefined,
              conventionDraftId: conventionDraft.id,
              internshipKind: conventionDraft.internshipKind,
              conventionFormUrl: expectedShortLink,
            },
            recipients: [recipientEmail],
          },
        ],
      });

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: shortLinkId,
          lastUsedAt: null,
          url: expectedLongLink,
        },
      ]);
    });

    it("No email sent when sender & recipient emails are not provided", async () => {
      await useCase.execute({
        draftId: conventionDraft.id,
        recipientEmail: null,
        senderEmail: null,
        details: null,
      });

      expectSavedNotificationsAndEvents({
        emails: [],
      });

      expectToEqual(uow.shortLinkRepository.getShortLinks(), []);
    });
  });

  describe("wrong paths", () => {
    it("throws on missing draft", async () => {
      uow.conventionDraftRepository.conventionDrafts = [];

      await expectPromiseToFailWithError(
        useCase.execute({
          draftId: conventionDraft.id,
          details: null,
          recipientEmail,
          senderEmail,
        }),
        errors.conventionDraft.notFound({
          conventionDraftId: conventionDraft.id,
        }),
      );
    });
  });
});
