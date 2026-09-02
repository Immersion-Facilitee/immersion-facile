import { addMinutes, subHours } from "date-fns";
import subDays from "date-fns/subDays";
import {
  AgencyDtoBuilder,
  type AssessmentDto,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { toAgencyWithRights } from "../../../../utils/agency";
import { makeCreateNewEvent } from "../../../core/events/ports/EventBus";
import { broadcastToFtServiceName } from "../../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type BroadcastConventionAgain,
  makeBroadcastConventionAgain,
} from "./BroadcastConventionAgain";

describe("BroadcastConventionAgain", () => {
  const agency = new AgencyDtoBuilder()
    .withId("11111111-1111-4111-9222-111111111122")
    .build();
  const convention = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-9111-111111111111")
    .withAgencyId(agency.id)
    .build();
  const adminUser = new ConnectedUserBuilder().withIsAdmin(true).build();
  const userWithEnoughRights = new ConnectedUserBuilder()
    .withIsAdmin(false)
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        roles: ["validator", "counsellor"],
        isNotifiedByEmail: true,
      },
    ])
    .build();

  const userWithAgencyViewerRight = new ConnectedUserBuilder()
    .withIsAdmin(false)
    .withAgencyRights([
      {
        agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
        roles: ["agency-viewer"],
        isNotifiedByEmail: true,
      },
    ])
    .build();

  let broadcastConventionAgain: BroadcastConventionAgain;
  let uow: InMemoryUnitOfWork;
  let timeGateway: TimeGateway;

  beforeEach(async () => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    broadcastConventionAgain = makeBroadcastConventionAgain({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          uuidGenerator: new TestUuidGenerator(),
          timeGateway,
        }),
        timeGateway: timeGateway,
      },
    });
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    await uow.conventionRepository.save(convention);
  });

  describe("Wrong paths", () => {
    it("throws Forbidden if user doesn't have enough rights on convention", async () => {
      const user = new ConnectedUserBuilder().withIsAdmin(false).build();
      uow.userRepository.users = [user];

      await expectPromiseToFailWithError(
        broadcastConventionAgain.execute({ conventionId: convention.id }, user),
        errors.user.forbidden({ userId: user.id }),
      );
    });

    it("throws notFound when convention is not found", async () => {
      const notFoundConventionId = "40400000-1111-4000-9111-000000000404";
      await expectPromiseToFailWithError(
        broadcastConventionAgain.execute(
          { conventionId: notFoundConventionId },
          adminUser,
        ),
        errors.convention.notFound({
          conventionId: notFoundConventionId,
        }),
      );
    });
  });

  describe("Right paths", () => {
    describe("when there is no previous broadcast", () => {
      it.each([adminUser, userWithEnoughRights, userWithAgencyViewerRight])(
        "trigger ConventionBroadcastAgain event with the whole convention in payload",
        async (user) => {
          await broadcastConventionAgain.execute(
            { conventionId: convention.id },
            user,
          );

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionBroadcastRequested",
              status: "never-published",
              payload: {
                conventionId: convention.id,
                triggeredBy: { kind: "connected-user", userId: user.id },
              },
            },
          ]);
        },
      );
    });

    describe("when there is a previous broadcast", () => {
      it.each([adminUser, userWithEnoughRights, userWithAgencyViewerRight])(
        "trigger ConventionBroadcastAgain event with the whole convention in payload",
        async (user) => {
          uow.broadcastFeedbacksRepository.save({
            serviceName: broadcastToFtServiceName,
            consumerId: "my-consumer-id",
            consumerName: "My consumer name",
            conventionId: convention.id,
            agencyId: agency.id,
            requestParams: {
              conventionId: convention.id,
            },
            response: { httpStatus: 404 },
            subscriberErrorFeedback: { message: "Ops, something is bad" },
            occurredAt: subDays(timeGateway.now(), 1).toISOString(),
            handledByAgency: true,
          });

          await broadcastConventionAgain.execute(
            { conventionId: convention.id },
            user,
          );

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionBroadcastRequested",
              status: "never-published",
              payload: {
                conventionId: convention.id,
                triggeredBy: { kind: "connected-user", userId: user.id },
              },
            },
          ]);
        },
      );

      it("throws tooManyRequest when user request broadcast again before 4h since last broadcast", async () => {
        const lastBroadcastDate = subHours(
          addMinutes(timeGateway.now(), 12),
          1,
        );

        uow.broadcastFeedbacksRepository.save({
          serviceName: broadcastToFtServiceName,
          consumerId: "my-consumer-id",
          consumerName: "My consumer name",
          conventionId: convention.id,
          agencyId: agency.id,
          requestParams: {
            conventionId: convention.id,
          },
          response: { httpStatus: 404 },
          subscriberErrorFeedback: { message: "Ops, something is bad" },
          occurredAt: lastBroadcastDate.toISOString(),
          handledByAgency: true,
        });

        await expectPromiseToFailWithError(
          broadcastConventionAgain.execute(
            { conventionId: convention.id },
            adminUser,
          ),
          errors.broadcastFeedback.tooManyRequests({
            lastBroadcastDate,
            formattedWaitingTime: "3 heures 12 minutes",
          }),
        );
      });
    });

    describe("when assessment if present", () => {
      it.each([adminUser, userWithEnoughRights, userWithAgencyViewerRight])(
        "trigger ConventionBroadcastAgain event with the convention + assessment in payload",
        async (user) => {
          const assessment: AssessmentDto = {
            conventionId: convention.id,
            status: "COMPLETED",
            endedWithAJob: false,
            establishmentFeedback: "commentaire",
            establishmentAdvices: "commentaire",
            beneficiaryAgreement: null,
            beneficiaryFeedback: null,
            signedAt: null,
            createdAt: new Date("2025-01-01").toISOString(),
          };
          await uow.assessmentRepository.save({
            _entityName: "Assessment",
            numberOfHoursActuallyMade: null,
            ...assessment,
          });

          await broadcastConventionAgain.execute(
            { conventionId: convention.id },
            user,
          );

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ConventionWithAssessmentBroadcastRequested",
              status: "never-published",
              payload: {
                conventionId: convention.id,
                assessment,
                triggeredBy: { kind: "connected-user", userId: user.id },
              },
            },
          ]);
        },
      );
    });
  });
});
