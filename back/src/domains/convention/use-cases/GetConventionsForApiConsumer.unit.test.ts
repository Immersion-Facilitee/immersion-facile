import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  expectToEqual,
  makeEmptyLastReminders,
  reasonableSchedule,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { ApiConsumerBuilder } from "../../core/api-consumer/adapters/InMemoryApiConsumerRepository";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetConventionsForApiConsumer,
  makeGetConventionsForApiConsumer,
} from "./GetConventionsForApiConsumer";

describe("Get Conventions for ApiConsumer", () => {
  const agencyFranceTravail = new AgencyDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withKind("france-travail")
    .withAddress({
      streetNumberAndAddress: "1 rue de Paris",
      city: "Paris",
      departmentCode: "75",
      postcode: "75001",
    })
    .withCoveredDepartments(["75", "92"])
    .build();

  const agencyMissionLocale = new AgencyDtoBuilder()
    .withId("22222222-2222-4222-8222-222222222222")
    .withKind("mission-locale")
    .withAddress({
      streetNumberAndAddress: "1 rue de Lyon",
      city: "Lyon",
      departmentCode: "69",
      postcode: "69001",
    })
    .withCoveredDepartments(["69"])
    .build();

  const counsellor = new ConnectedUserBuilder()
    .withId("33333333-3333-4333-8333-333333333333")
    .withEmail("counsellor@mail.fr")
    .build();

  const validator = new ConnectedUserBuilder()
    .withId("44444444-4444-4444-8444-444444444444")
    .withEmail("validator@mail.fr")
    .build();

  const agencyWithCounsellor = new AgencyDtoBuilder()
    .withId("55555555-5555-4555-8555-555555555555")
    .withKind("cci")
    .withAddress({
      streetNumberAndAddress: "1 rue de Bordeaux",
      city: "Bordeaux",
      departmentCode: "33",
      postcode: "33000",
    })
    .withCoveredDepartments(["33"])
    .build();

  const makeConvention = ({
    id,
    agencyId,
    status,
    dateStart,
  }: {
    id: string;
    agencyId: string;
    status?: "IN_REVIEW" | "READY_TO_SIGN";
    dateStart: string;
  }) => {
    const dateEnd = new Date(
      new Date(dateStart).getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    return new ConventionDtoBuilder()
      .withId(id)
      .withAgencyId(agencyId)
      .withStatus(status ?? "READY_TO_SIGN")
      .withDateStart(dateStart)
      .withDateEnd(dateEnd)
      .withSchedule(reasonableSchedule)
      .build();
  };

  const conventionFranceTravail = makeConvention({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agencyId: agencyFranceTravail.id,
    status: "IN_REVIEW",
    dateStart: "2024-06-01T00:00:00.000Z",
  });

  const conventionMissionLocale = makeConvention({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    agencyId: agencyMissionLocale.id,
    dateStart: "2024-05-01T00:00:00.000Z",
  });

  const conventionWithCounsellorAgency = makeConvention({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    agencyId: agencyWithCounsellor.id,
    dateStart: "2024-04-01T00:00:00.000Z",
  });

  let getConventionsForApiConsumer: GetConventionsForApiConsumer;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agencyFranceTravail),
      toAgencyWithRights(agencyMissionLocale),
      toAgencyWithRights(agencyWithCounsellor, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];
    uow.userRepository.users = [counsellor, validator];
    uow.conventionRepository.setConventions([
      conventionFranceTravail,
      conventionMissionLocale,
      conventionWithCounsellorAgency,
    ]);
    getConventionsForApiConsumer = makeGetConventionsForApiConsumer({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("returns only conventions in scope", () => {
    describe("when only agencyKinds", () => {
      it("return empty array no convention matching agencyKinds", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyKinds: ["chambre-agriculture"],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const conventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(conventions, []);
      });

      it("return empty array when agencyKinds is empty", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyKinds: [],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const conventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(conventions, []);
      });

      it("return convention matching agencyKinds", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyKinds: ["france-travail"],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const retrievedConventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(retrievedConventions, [
          {
            ...conventionFranceTravail,
            agencyName: agencyFranceTravail.name,
            agencyContactEmail: agencyFranceTravail.contactEmail,
            agencyDepartment: agencyFranceTravail.address.departmentCode,
            agencyKind: agencyFranceTravail.kind,
            agencySiret: agencyFranceTravail.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ]);
      });

      it("return convention matching agencyKinds with status IN_REVIEW", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyKinds: ["france-travail", "mission-locale"],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const retrievedConventions = await getConventionsForApiConsumer.execute(
          {
            withStatuses: ["IN_REVIEW"],
          },
          apiConsumer,
        );

        expectToEqual(retrievedConventions, [
          {
            ...conventionFranceTravail,
            agencyName: agencyFranceTravail.name,
            agencyContactEmail: agencyFranceTravail.contactEmail,
            agencyDepartment: agencyFranceTravail.address.departmentCode,
            agencyKind: agencyFranceTravail.kind,
            agencySiret: agencyFranceTravail.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ]);
      });
    });

    describe("when only agencyIds", () => {
      it("return empty array no convention matching agencyIds", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyIds: ["99999999-9999-4999-8999-999999999999"],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const conventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(conventions, []);
      });

      it("return empty array when agencyIds is empty", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyIds: [],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const conventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(conventions, []);
      });

      it("return convention matching agencyIds", async () => {
        const apiConsumer = new ApiConsumerBuilder()
          .withConventionRight({
            scope: {
              agencyIds: [agencyMissionLocale.id],
            },
            kinds: ["READ"],
            subscriptions: [],
          })
          .build();

        const retrievedConventions = await getConventionsForApiConsumer.execute(
          {},
          apiConsumer,
        );

        expectToEqual(retrievedConventions, [
          {
            ...conventionMissionLocale,
            agencyName: agencyMissionLocale.name,
            agencyContactEmail: agencyMissionLocale.contactEmail,
            agencyDepartment: agencyMissionLocale.address.departmentCode,
            agencyKind: agencyMissionLocale.kind,
            agencySiret: agencyMissionLocale.agencySiret,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        ]);
      });
    });
  });

  it("returns agencyValidationSteps specific to each agency", async () => {
    const apiConsumer = new ApiConsumerBuilder()
      .withConventionRight({
        scope: {
          agencyIds: [agencyFranceTravail.id, agencyWithCounsellor.id],
        },
        kinds: ["READ"],
        subscriptions: [],
      })
      .build();

    const retrievedConventions = await getConventionsForApiConsumer.execute(
      {},
      apiConsumer,
    );

    expectToEqual(retrievedConventions, [
      {
        ...conventionFranceTravail,
        agencyName: agencyFranceTravail.name,
        agencyContactEmail: agencyFranceTravail.contactEmail,
        agencyDepartment: agencyFranceTravail.address.departmentCode,
        agencyKind: agencyFranceTravail.kind,
        agencySiret: agencyFranceTravail.agencySiret,
        agencyValidationSteps: "validator-only",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      },
      {
        ...conventionWithCounsellorAgency,
        agencyName: agencyWithCounsellor.name,
        agencyContactEmail: agencyWithCounsellor.contactEmail,
        agencyDepartment: agencyWithCounsellor.address.departmentCode,
        agencyKind: agencyWithCounsellor.kind,
        agencySiret: agencyWithCounsellor.agencySiret,
        agencyValidationSteps: "counsellor-and-validator",
        assessment: null,
        lastReminders: makeEmptyLastReminders(),
        isEstablishmentBanned: false,
      },
    ]);
  });
});
