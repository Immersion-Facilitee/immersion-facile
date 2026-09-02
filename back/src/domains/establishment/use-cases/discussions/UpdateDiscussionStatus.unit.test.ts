import {
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  DiscussionBuilder,
  type DiscussionDto,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type UpdateDiscussionStatusParams,
} from "shared";
import type { TriggeredBy } from "../../../core/events/events";
import { makeCreateNewEvent } from "../../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  makeUpdateDiscussionStatus,
  type UpdateDiscussionStatus,
} from "./UpdateDiscussionStatus";

describe("UpdateDiscussionStatus", () => {
  const authorizedUser = new ConnectedUserBuilder()

    .withId("authorizedUser")
    .withFirstName("auto")
    .withLastName("rized")
    .withEmail("authorized@domain.com")
    .build();
  const unauthorizedUser = new ConnectedUserBuilder()
    .withId("unauthorizedUser")
    .withFirstName("notauto")
    .withLastName("notrized")
    .withEmail("unauthorized@domain.com")
    .build();

  const pendingUser = new ConnectedUserBuilder()
    .withId("pendingUser")
    .withFirstName("Pending")
    .withLastName("User")
    .withEmail("pending.user@establishment.com")
    .build();

  const establishmentWithAuthorizedUserRight =
    new EstablishmentAggregateBuilder()
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "osef",
          phone: "osef",
          shouldReceiveDiscussionNotifications: false,
          userId: authorizedUser.id,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "PENDING",
          userId: authorizedUser.id,
          shouldReceiveDiscussionNotifications: false,
          job: "osef",
          phone: "osef",
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "PENDING",
          userId: pendingUser.id,
          shouldReceiveDiscussionNotifications: false,
          job: "osef",
          phone: "osef",
          isMainContactByPhone: false,
        },
      ])
      .build();

  const discussion = new DiscussionBuilder()
    .withSiret(establishmentWithAuthorizedUserRight.establishment.siret)
    .build();

  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let uuidGenerator: TestUuidGenerator;
  let updateDiscussionStatus: UpdateDiscussionStatus;

  beforeEach(() => {
    timeGateway = new CustomTimeGateway();
    uuidGenerator = new TestUuidGenerator();
    uow = createInMemoryUow();

    updateDiscussionStatus = makeUpdateDiscussionStatus({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        timeGateway,
        createNewEvent: makeCreateNewEvent({ timeGateway, uuidGenerator }),
      },
    });

    uow.discussionRepository.discussions = [discussion];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentWithAuthorizedUserRight,
    ];
  });

  describe("Wrong paths", () => {
    it("throws NotFoundError if discussion is not found", async () => {
      uow.discussionRepository.discussions = [];

      await expectPromiseToFailWithError(
        updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          authorizedUser,
        ),
        errors.discussion.notFound({ discussionId: discussion.id }),
      );
    });

    it("throws ForbiddenError if user has no right on establishment related to discussion", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(discussion.siret)
          .withUserRights([
            {
              role: "establishment-admin",
              status: "ACCEPTED",
              userId: "other-user",
              job: "",
              phone: "",
              shouldReceiveDiscussionNotifications: false,
              isMainContactByPhone: false,
            },
          ])
          .build(),
      ];

      await expectPromiseToFailWithError(
        updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          unauthorizedUser,
        ),
        errors.discussion.rejectForbidden({
          discussionId: discussion.id,
          userId: unauthorizedUser.id,
        }),
      );
    });

    it("throws BadRequestError if discussion is already rejected", async () => {
      const alreadyRejectedDiscussion: DiscussionDto = {
        ...discussion,
        status: "REJECTED",
        rejectionKind: "UNABLE_TO_HELP",
      };

      uow.discussionRepository.discussions = [alreadyRejectedDiscussion];

      await expectPromiseToFailWithError(
        updateDiscussionStatus.execute(
          {
            discussionId: alreadyRejectedDiscussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          authorizedUser,
        ),
        errors.discussion.alreadyRejected({
          discussionId: alreadyRejectedDiscussion.id,
        }),
      );
    });

    it("throws notFound on missing establishment", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [];

      await expectPromiseToFailWithError(
        updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          unauthorizedUser,
        ),
        errors.establishment.notFound({
          siret: discussion.siret,
        }),
      );
    });

    it("throws when user have pending right on establishment", async () => {
      await expectPromiseToFailWithError(
        updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          pendingUser,
        ),
        errors.discussion.rejectForbidden({
          discussionId: discussion.id,
          userId: pendingUser.id,
        }),
      );
    });
  });

  describe("Accept discussion", () => {
    it("accepts a discussion, providing candidateWarnedMethod. Should skip email sending", async () => {
      await updateDiscussionStatus.execute(
        {
          discussionId: discussion.id,
          status: "ACCEPTED",
          candidateWarnedMethod: "inPerson",
        },
        authorizedUser,
      );

      expectDiscussionInRepoAndInOutbox({
        triggeredBy: {
          kind: "connected-user",
          userId: authorizedUser.id,
        },
        expectedDiscussion: {
          ...discussion,
          status: "ACCEPTED",
          candidateWarnedMethod: "inPerson",
          updatedAt: timeGateway.now().toISOString(),
        },
        skipSendingEmail: true,
      });
    });

    describe("providing a conventionId", () => {
      it("throws if convention is not found", async () => {
        const conventionId = "40400000-0000-4000-9000-000000000404";

        await expectPromiseToFailWithError(
          updateDiscussionStatus.execute(
            {
              discussionId: discussion.id,
              status: "ACCEPTED",
              candidateWarnedMethod: null,
              conventionId,
            },
            authorizedUser,
          ),
          errors.convention.notFound({ conventionId }),
        );
      });

      it("accepts a discussion, when convention exists", async () => {
        const convention = new ConventionDtoBuilder().build();
        uow.conventionRepository.setConventions([convention]);

        await updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "ACCEPTED",
            candidateWarnedMethod: null,
            conventionId: convention.id,
          },
          authorizedUser,
        );

        expectDiscussionInRepoAndInOutbox({
          triggeredBy: {
            kind: "connected-user",
            userId: authorizedUser.id,
          },
          expectedDiscussion: {
            ...discussion,
            status: "ACCEPTED",
            candidateWarnedMethod: null,
            conventionId: convention.id,
            updatedAt: timeGateway.now().toISOString(),
          },
          skipSendingEmail: true,
        });
      });
    });
  });

  describe("Reject discussion", () => {
    describe("providing candidateWarnedMethod", () => {
      it("works, and does not send email", async () => {
        await updateDiscussionStatus.execute(
          {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "CANDIDATE_ALREADY_WARNED",
            candidateWarnedMethod: "inPerson",
          },
          authorizedUser,
        );

        expectDiscussionInRepoAndInOutbox({
          triggeredBy: {
            kind: "connected-user",
            userId: authorizedUser.id,
          },
          expectedDiscussion: {
            ...discussion,
            updatedAt: timeGateway.now().toISOString(),
            status: "REJECTED",
            rejectionKind: "CANDIDATE_ALREADY_WARNED",
            candidateWarnedMethod: "inPerson",
          },
          skipSendingEmail: true,
        });
      });
    });
    describe("validate each possible statuses", () => {
      it.each<{
        params: UpdateDiscussionStatusParams;
        expectedRejectionReason: string;
      }>([
        {
          params: {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "UNABLE_TO_HELP",
          },
          expectedRejectionReason:
            "l’entreprise estime ne pas être en capacité de vous aider dans votre projet professionnel.",
        },
        {
          params: {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "NO_TIME",
          },
          expectedRejectionReason:
            "l’entreprise traverse une période chargée et n’a pas le temps d’accueillir une immersion.",
        },
        {
          params: {
            discussionId: discussion.id,
            status: "REJECTED",
            rejectionKind: "OTHER",
            rejectionReason: "my rejection reason",
          },
          expectedRejectionReason: "my rejection reason",
        },
      ])(
        "rejects discussion with kind $params.rejectionKind",
        async ({
          expectedRejectionReason,
          params: { discussionId, ...rest },
        }) => {
          await updateDiscussionStatus.execute(
            { discussionId, ...rest },
            authorizedUser,
          );

          const { htmlContent, subject } = makeExpectedEmailParams(
            expectedRejectionReason,
            authorizedUser.firstName,
            authorizedUser.lastName,
          );

          expectDiscussionInRepoAndInOutbox({
            triggeredBy: {
              kind: "connected-user",
              userId: authorizedUser.id,
            },
            expectedDiscussion: {
              ...discussion,
              ...rest,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...discussion.exchanges,
                {
                  subject,
                  message: htmlContent,
                  attachments: [],
                  sender: "establishment",
                  email: authorizedUser.email,
                  firstname: authorizedUser.firstName,
                  lastname: authorizedUser.lastName,
                  sentAt: timeGateway.now().toISOString(),
                },
              ],
            },
          });
        },
      );
    });

    describe("validate user rights", () => {
      it("allow rejection when user is establishment admin", async () => {
        const params: UpdateDiscussionStatusParams = {
          discussionId: discussion.id,
          status: "REJECTED",
          rejectionKind: "NO_TIME",
        };

        await updateDiscussionStatus.execute(params, authorizedUser);

        const { htmlContent, subject } = makeExpectedEmailParams(
          "l’entreprise traverse une période chargée et n’a pas le temps d’accueillir une immersion.",
          authorizedUser.firstName,
          authorizedUser.lastName,
        );

        expectDiscussionInRepoAndInOutbox({
          triggeredBy: {
            kind: "connected-user",
            userId: authorizedUser.id,
          },
          expectedDiscussion: {
            ...discussion,
            status: "REJECTED",
            rejectionKind: params.rejectionKind,
            updatedAt: timeGateway.now().toISOString(),
            exchanges: [
              ...discussion.exchanges,
              {
                subject,
                message: htmlContent,
                attachments: [],
                sender: "establishment",
                email: authorizedUser.email,
                firstname: authorizedUser.firstName,
                lastname: authorizedUser.lastName,
                sentAt: timeGateway.now().toISOString(),
              },
            ],
          },
        });
      });

      it("allow rejection when user is establishment contact", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder(
            establishmentWithAuthorizedUserRight,
          )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "other-user-id",
                job: "osef",
                phone: "osef",
                shouldReceiveDiscussionNotifications: false,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: authorizedUser.id,
                shouldReceiveDiscussionNotifications: false,
              },
            ])
            .build(),
        ];

        const params: UpdateDiscussionStatusParams = {
          discussionId: discussion.id,
          status: "REJECTED",
          rejectionKind: "NO_TIME",
        };

        await updateDiscussionStatus.execute(params, authorizedUser);

        const { htmlContent, subject } = makeExpectedEmailParams(
          "l’entreprise traverse une période chargée et n’a pas le temps d’accueillir une immersion.",
          authorizedUser.firstName,
          authorizedUser.lastName,
        );

        expectDiscussionInRepoAndInOutbox({
          triggeredBy: {
            kind: "connected-user",
            userId: authorizedUser.id,
          },
          expectedDiscussion: {
            ...discussion,
            status: "REJECTED",
            rejectionKind: params.rejectionKind,
            updatedAt: timeGateway.now().toISOString(),
            exchanges: [
              ...discussion.exchanges,
              {
                subject,
                message: htmlContent,
                attachments: [],
                sender: "establishment",
                email: authorizedUser.email,
                firstname: authorizedUser.firstName,
                lastname: authorizedUser.lastName,
                sentAt: timeGateway.now().toISOString(),
              },
            ],
          },
        });
      });
    });
  });

  const expectDiscussionInRepoAndInOutbox = ({
    expectedDiscussion,
    triggeredBy,
    skipSendingEmail,
  }: {
    expectedDiscussion: DiscussionDto;
    triggeredBy: TriggeredBy;
    skipSendingEmail?: boolean;
  }) => {
    expectToEqual(uow.discussionRepository.discussions, [expectedDiscussion]);

    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "DiscussionStatusManuallyUpdated",
        payload: {
          discussion: expectedDiscussion,
          triggeredBy,
          ...(skipSendingEmail !== undefined ? { skipSendingEmail } : {}),
        },
      },
    ]);
  };
});

const makeExpectedEmailParams = (
  expectedRejectionReason: string,
  firstName?: string,
  lastName?: string,
) => ({
  subject:
    "L’entreprise My default business name ne souhaite pas donner suite à votre candidature à l’immersion",
  htmlContent: `Bonjour, 
  
Malheureusement, nous ne souhaitons pas donner suite à votre candidature à l’immersion.

La raison du refus est : ${expectedRejectionReason}

N’hésitez pas à <a href="https://immersion-facile.beta.gouv.fr/recherche">rechercher une immersion dans une autre entreprise</a> !

Bonne journée, 
${firstName && lastName ? `${firstName} ${lastName}, ` : "Le "}représentant de l'entreprise My default business name`,
});
