import {
  AgencyDtoBuilder,
  type AgencyGroup,
  defaultProConnectInfos,
  expectObjectInArrayToMatch,
  expectToEqual,
  type User,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type LinkFranceTravailUsersToTheirAgencies,
  makeLinkFranceTravailUsersToTheirAgencies,
} from "./LinkFranceTravailUsersToTheirAgencies";

describe("LinkFranceTravailUsersToTheirAgencies", () => {
  const codeSafir = "546546645";
  const agencyGroupCodeSafir = "my-group-safir-code";
  const agency = new AgencyDtoBuilder().withCodeSafir(codeSafir).build();
  const agencyWithSameSafir = new AgencyDtoBuilder()
    .withId("agency-same-safir-2")
    .withCodeSafir(codeSafir)
    .withStatus("active")
    .build();
  const agency1InGroup = new AgencyDtoBuilder()
    .withId("agency-id-1")
    .withCodeSafir("agency-safir-1")
    .build();

  const agency2InGroup = new AgencyDtoBuilder()
    .withId("agency-id-2")
    .withCodeSafir("agency-safir-2")
    .build();

  const agency3InGroup = new AgencyDtoBuilder()
    .withId("agency-id-3")
    .withCodeSafir("agency-safir-3")
    .build();

  const agenciesInRepo = [
    agency,
    agencyWithSameSafir,
    agency1InGroup,
    agency2InGroup,
    agency3InGroup,
  ];

  const defaultUser: User = {
    id: "my-user-id",
    firstName: "John",
    lastName: "Doe",
    proConnect: defaultProConnectInfos,
    email: "john.doe@mail.com",
    createdAt: new Date().toISOString(),
  };

  let uow: InMemoryUnitOfWork;
  let linkFranceTravailUsersToTheirAgencies: LinkFranceTravailUsersToTheirAgencies;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    const uuidGenerator = new TestUuidGenerator();
    uuidGenerator.setNextUuids(["event-uuid-1", "event-uuid-2"]);
    linkFranceTravailUsersToTheirAgencies =
      makeLinkFranceTravailUsersToTheirAgencies({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          createNewEvent: makeCreateNewEvent({
            timeGateway: timeGateway,
            uuidGenerator: uuidGenerator,
          }),
          timeGateway,
        },
      });
    uow.userRepository.users = [defaultUser];
    uow.agencyRepository.agencies = agenciesInRepo.map((agency) =>
      toAgencyWithRights(agency, {}),
    );
  });

  describe("when no safir code is provided", () => {
    it("does nothing", async () => {
      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: "my-user-id",
        codeSafir: null,
      });

      expectToEqual(uow.userRepository.users, [defaultUser]);
      expectToEqual(
        uow.agencyRepository.agencies,
        agenciesInRepo.map((agency) => toAgencyWithRights(agency)),
      );
    });
  });

  describe("when safir code is provided", () => {
    it("add agency right to IC user if user has no rights on agency", async () => {
      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: "my-user-id",
        codeSafir: codeSafir,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [defaultUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agencyWithSameSafir)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ]);
      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: agency.id,
            triggeredBy: {
              kind: "crawler",
            },
          },
        },
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: agencyWithSameSafir.id,
            triggeredBy: {
              kind: "crawler",
            },
          },
        },
      ]);
    });

    it("don't add agency right to IC user if user already has rights on agency", async () => {
      uow.userRepository.users = [defaultUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [defaultUser.id]: {
            roles: ["agency-admin"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agencyWithSameSafir, {
          [defaultUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: "my-user-id",
        codeSafir: codeSafir,
      });

      expectToEqual(uow.userRepository.users, [defaultUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency, {
          [defaultUser.id]: {
            roles: ["agency-admin"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agencyWithSameSafir, {
          [defaultUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ]);
    });

    it("replace agency right to IC user if user already has rights on agency and current right is to-review", async () => {
      uow.userRepository.users = [defaultUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [defaultUser.id]: {
            roles: ["to-review"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agencyWithSameSafir, {
          [defaultUser.id]: {
            roles: ["to-review"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: "my-user-id",
        codeSafir: codeSafir,
      });

      expectToEqual(uow.userRepository.users, [defaultUser]);
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(
          new AgencyDtoBuilder(agency).withUpdatedAt(timeGateway.now()).build(),
          {
            [defaultUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agencyWithSameSafir)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ]);
      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: agency.id,
            triggeredBy: {
              kind: "crawler",
            },
          },
        },
        {
          topic: "AgencyUpdated",
          payload: {
            agencyId: agencyWithSameSafir.id,
            triggeredBy: {
              kind: "crawler",
            },
          },
        },
      ]);
    });

    it("don't add agency right to IC user if there is no agency with this code safir", async () => {
      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: "my-user-id",
        codeSafir: "not-existing-code-safir",
      });

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency),
        toAgencyWithRights(agencyWithSameSafir),
        toAgencyWithRights(agency1InGroup),
        toAgencyWithRights(agency2InGroup),
        toAgencyWithRights(agency3InGroup),
      ]);
    });

    it("don't add agency right to IC user if agency is closed or rejected", async () => {
      const closedAgency = new AgencyDtoBuilder()
        .withId("agency-id-3")
        .withCodeSafir("agency-safir-4")
        .withStatus("closed")
        .build();

      const rejectedAgency = new AgencyDtoBuilder()
        .withId("agency-id-4")
        .withCodeSafir("agency-safir-5")
        .withStatus("rejected")
        .build();

      uow.agencyRepository.agencies = [
        toAgencyWithRights(closedAgency),
        toAgencyWithRights(rejectedAgency),
      ];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: defaultUser.id,
        codeSafir: closedAgency.codeSafir,
      });
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(closedAgency),
        toAgencyWithRights(rejectedAgency),
      ]);

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: defaultUser.id,
        codeSafir: rejectedAgency.codeSafir,
      });
      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(closedAgency),
        toAgencyWithRights(rejectedAgency),
      ]);
    });
  });
  describe("when safir code matches agency group", () => {
    const agencyGroup: AgencyGroup = {
      siret: "12345678902345",
      kind: "france-travail",
      email: "agency-group-1-email@gmail.com",
      codeSafir: agencyGroupCodeSafir,
      departments: ["87", "23", "19"],
      name: "DR du limousin",
      scope: "direction-régionale",
      agencyIds: [agency1InGroup.id, agency2InGroup.id, agency3InGroup.id],
      ccEmails: ["fake-email1@gmail.com", "fake-email2@gmail.com"],
    };

    it("adds rights to connected user for all agencies in agency group when safir code matches", async () => {
      uow.agencyGroupRepository.agencyGroups = [agencyGroup];
      uow.userRepository.users = [defaultUser];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: defaultUser.id,
        codeSafir: agencyGroupCodeSafir,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency),
        toAgencyWithRights(agencyWithSameSafir),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency1InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency2InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency3InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            },
          },
        ),
      ]);
    });

    it("doesn't override an agency role except if it's to review", async () => {
      uow.agencyGroupRepository.agencyGroups = [agencyGroup];
      uow.userRepository.users = [defaultUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency),
        toAgencyWithRights(agency1InGroup, {
          [defaultUser.id]: {
            roles: ["validator"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agency2InGroup, {
          [defaultUser.id]: {
            roles: ["to-review"],
            isNotifiedByEmail: false,
          },
        }),
        toAgencyWithRights(agency3InGroup),
      ];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: defaultUser.id,
        codeSafir: agencyGroupCodeSafir,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(agency),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency1InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency2InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            },
          },
        ),
        toAgencyWithRights(
          new AgencyDtoBuilder(agency3InGroup)
            .withUpdatedAt(timeGateway.now())
            .build(),
          {
            [defaultUser.id]: {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            },
          },
        ),
      ]);
    });

    it("don't add agency right to IC user if agency is closed or rejected", async () => {
      const closedAgency = new AgencyDtoBuilder()
        .withId("agency-id-3")
        .withCodeSafir("agency-safir-4")
        .withStatus("closed")
        .build();
      const rejectedAgency = new AgencyDtoBuilder()
        .withId("agency-id-4")
        .withCodeSafir("agency-safir-5")
        .withStatus("rejected")
        .build();
      const agencyGroupWithClosedAndRejectedAgencies: AgencyGroup = {
        siret: "12345678902345",
        kind: "france-travail",
        email: "agency-group-1-email@gmail.com",
        codeSafir: agencyGroupCodeSafir,
        departments: ["87", "23", "19"],
        name: "DR du limousin",
        scope: "direction-régionale",
        agencyIds: [closedAgency.id, rejectedAgency.id],
        ccEmails: ["fake-email1@gmail.com", "fake-email2@gmail.com"],
      };

      uow.userRepository.users = [defaultUser];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(closedAgency),
        toAgencyWithRights(rejectedAgency),
      ];
      uow.agencyGroupRepository.agencyGroups = [
        agencyGroupWithClosedAndRejectedAgencies,
      ];

      await linkFranceTravailUsersToTheirAgencies.execute({
        userId: defaultUser.id,
        codeSafir: agencyGroupCodeSafir,
      });

      expectToEqual(uow.agencyRepository.agencies, [
        toAgencyWithRights(closedAgency),
        toAgencyWithRights(rejectedAgency),
      ]);
    });
  });
});
