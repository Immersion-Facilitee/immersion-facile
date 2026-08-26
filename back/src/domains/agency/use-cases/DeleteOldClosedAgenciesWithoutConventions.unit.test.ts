import { subDays, subMonths } from "date-fns";
import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  expectToEqual,
} from "shared";
import { v4 as uuid } from "uuid";
import { toAgencyWithRights } from "../../../utils/agency";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type DeleteOldClosedAgenciesWithoutConventions,
  makeDeleteOldClosedAgenciesWithoutConventions,
} from "./DeleteOldClosedAgenciesWithoutConventions";

describe("DeleteOldClosedAgenciesWithoutConventions", () => {
  const validator1 = new ConnectedUserBuilder()
    .withId("10000000-0000-0000-0000-000000000003")
    .withEmail("validator1@agency1.fr")
    .withProConnectInfos({ externalId: uuid(), siret: "00000000000000" })
    .buildUser();

  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let deleteOldClosedAgenciesWithoutConventions: DeleteOldClosedAgenciesWithoutConventions;

  const now = new Date();

  beforeEach(() => {
    timeGateway = new CustomTimeGateway(now);
    uow = createInMemoryUow();
    deleteOldClosedAgenciesWithoutConventions =
      makeDeleteOldClosedAgenciesWithoutConventions({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          timeGateway,
        },
      });
  });

  const oldDate = subMonths(now, 4);
  const recentDate = subDays(now, 5);

  const closedAgency1_old = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("11111111-1111-4111-9111-111111111111")
      .withStatus("closed")
      .withUpdatedAt(oldDate)
      .build(),
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const rejectedAgency_old = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("22222222-2222-4222-9222-222222222222")
      .withStatus("rejected")
      .withUpdatedAt(oldDate)
      .build(),
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const closedAgency2_recent = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("33333333-3333-4333-9333-333333333333")
      .withStatus("closed")
      .withUpdatedAt(recentDate)
      .build(),
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const activeAgency_old = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("44444444-4444-4444-9444-444444444444")
      .withStatus("active")
      .withUpdatedAt(oldDate)
      .build(),
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const closedAgency3_old = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("55555555-5555-4555-9555-555555555555")
      .withStatus("closed")
      .withUpdatedAt(oldDate)
      .build(),
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  it("do nothing on recent closed agencies and old rejected agencies with conventions", async () => {
    uow.agencyRepository.agencies = [rejectedAgency_old, closedAgency2_recent];

    const convention = new ConventionDtoBuilder()
      .withId("cccccccc-cccc-4ccc-9ccc-cccccccccccc")
      .withAgencyId(rejectedAgency_old.id)
      .build();

    uow.conventionRepository.setConventions([convention]);

    const result = await deleteOldClosedAgenciesWithoutConventions.execute();

    expectToEqual(result, {
      deletedAgencies: [],
    });

    expectToEqual(uow.agencyRepository.agencies, [
      rejectedAgency_old,
      closedAgency2_recent,
    ]);
  });

  it("deletes agencies with status closed or rejected, updated_at older than given date, and without conventions", async () => {
    uow.agencyRepository.agencies = [
      closedAgency1_old,
      closedAgency2_recent,
      closedAgency3_old,
      rejectedAgency_old,
      activeAgency_old,
    ];

    const convention = new ConventionDtoBuilder()
      .withId("cccccccc-cccc-4ccc-9ccc-cccccccccccc")
      .withAgencyId(closedAgency3_old.id)
      .build();

    uow.conventionRepository.setConventions([convention]);

    const result = await deleteOldClosedAgenciesWithoutConventions.execute();

    expectToEqual(result, {
      deletedAgencies: [closedAgency1_old.id, rejectedAgency_old.id],
    });

    expectToEqual(uow.agencyRepository.agencies, [
      closedAgency2_recent,
      closedAgency3_old,
      activeAgency_old,
    ]);
  });

  it("deletes agencies that refer to a deleted agency via refers_to_agency_id", async () => {
    const activeAgencyReferringToAgencyThatShouldBeDeleted = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: closedAgency1_old.id,
          refersToAgencyName: closedAgency1_old.name,
          refersToAgencyContactEmail: closedAgency1_old.contactEmail,
        })
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const activeAgencyNotReferringToDeletedAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("cccccccc-cccc-4ccc-9ccc-cccccccccccc")
        .withStatus("active")
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    uow.agencyRepository.agencies = [
      closedAgency1_old,
      activeAgencyReferringToAgencyThatShouldBeDeleted,
      activeAgencyNotReferringToDeletedAgency,
    ];

    const result = await deleteOldClosedAgenciesWithoutConventions.execute();

    expectToEqual(result, {
      deletedAgencies: [
        closedAgency1_old.id,
        activeAgencyReferringToAgencyThatShouldBeDeleted.id,
      ],
    });

    expectToEqual(uow.agencyRepository.agencies, [
      activeAgencyNotReferringToDeletedAgency,
    ]);
  });

  it("does not delete the agency to delete (nor its referring agencies) if at least one referring agency has conventions", async () => {
    const agencyReferringToDeletedAgencyWithConvention = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("dddddddd-dddd-4ddd-9ddd-dddddddddddd")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: closedAgency1_old.id,
          refersToAgencyName: closedAgency1_old.name,
          refersToAgencyContactEmail: closedAgency1_old.contactEmail,
        })
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    const agencyReferringToDeletedAgencyWithoutConvention = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("dddddddd-dddd-4ddd-ffff-dddddddddddd")
        .withStatus("active")
        .withRefersToAgencyInfo({
          refersToAgencyId: closedAgency1_old.id,
          refersToAgencyName: closedAgency1_old.name,
          refersToAgencyContactEmail: closedAgency1_old.contactEmail,
        })
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    uow.agencyRepository.agencies = [
      closedAgency1_old,
      agencyReferringToDeletedAgencyWithConvention,
      agencyReferringToDeletedAgencyWithoutConvention,
    ];

    const convention = new ConventionDtoBuilder()
      .withId("dddddddd-dddd-4ddd-9ddd-dddddddddddc")
      .withAgencyId(agencyReferringToDeletedAgencyWithConvention.id)
      .build();

    await uow.conventionRepository.save(convention);

    const deletedAgencyIds =
      await deleteOldClosedAgenciesWithoutConventions.execute();

    expectToEqual(deletedAgencyIds, { deletedAgencies: [] });
    expectToEqual(uow.agencyRepository.agencies, [
      closedAgency1_old,
      agencyReferringToDeletedAgencyWithConvention,
      agencyReferringToDeletedAgencyWithoutConvention,
    ]);
  });

  it("deletes both closed agencies when one refers to the other", async () => {
    const oldClosedAgencyReferrer = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("eeeeeeee-eeee-4eee-9eee-eeeeeeeeeeee")
        .withStatus("closed")
        .withRefersToAgencyInfo({
          refersToAgencyId: closedAgency1_old.id,
          refersToAgencyName: closedAgency1_old.name,
          refersToAgencyContactEmail: closedAgency1_old.contactEmail,
        })
        .build(),
      {
        [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    uow.agencyRepository.agencies = [
      closedAgency1_old,
      oldClosedAgencyReferrer,
    ];

    const result = await deleteOldClosedAgenciesWithoutConventions.execute();

    expectToEqual(result, {
      deletedAgencies: [closedAgency1_old.id, oldClosedAgencyReferrer.id],
    });

    expectToEqual(uow.agencyRepository.agencies, []);
  });
});
