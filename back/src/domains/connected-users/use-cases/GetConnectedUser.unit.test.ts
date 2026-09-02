import {
  AgencyDtoBuilder,
  allAgencyRoles,
  type ConnectedUser,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  defaultProConnectInfos,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  noAgencyDashboards,
  noEstablishmentDashboard,
  splitCasesBetweenPassingAndFailing,
  toAgencyDtoForAgencyUsersAndAdmins,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { StubDashboardGateway } from "../../core/dashboard/adapters/StubDashboardGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import type { EstablishmentUserRight } from "../../establishment/entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../../establishment/helpers/EstablishmentBuilders";
import {
  type GetConnectedUser,
  makeGetConnectedUser,
} from "./GetConnectedUser";

describe("GetConnectedUser", () => {
  const now = new Date();

  const notAdminBuilder = new ConnectedUserBuilder()
    .withId("not-an-admin-id")
    .withFirstName("Francis")
    .withLastName("Lemoine")
    .withEmail("francis.lemoine@mail.com")
    .withIsAdmin(false)
    .withEstablishments(undefined);
  const anotherUserBuilder = new ConnectedUserBuilder()
    .withId("another-user-id")
    .withFirstName("Billy")
    .withLastName("Idol")
    .withEmail("billy.idol@mail.com")
    .withIsAdmin(false)
    .withEstablishments(undefined);
  const adminUserBuilder = new ConnectedUserBuilder()
    .withId("admin-id")
    .withFirstName("Admin")
    .withIsAdmin(true);
  const pendingUserBuilder = new ConnectedUserBuilder()
    .withId("pending-id")
    .withFirstName("Pending")
    .withIsAdmin(false);

  const connectedPendingUser = pendingUserBuilder.build();

  const pendingUser = pendingUserBuilder.buildUser();

  const connectedAdminUser = adminUserBuilder.build();
  const admin = adminUserBuilder.buildUser();

  const notAdminUser = notAdminBuilder.buildUser();
  const connectedNotAdminUser = notAdminBuilder.build();

  const anotherUser = anotherUserBuilder.build();

  const agencyWithoutCounsellorAndValidatorBuilder = new AgencyDtoBuilder();

  let getConnectedUser: GetConnectedUser;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(now);
    getConnectedUser = makeGetConnectedUser({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        dashboardGateway: new StubDashboardGateway(),
        timeGateway,
      },
    });

    uow.userRepository.users = [notAdminUser, anotherUser, admin];
  });

  describe("For getting the current user's data", () => {
    it("throws NotFoundError if the user is not found", async () => {
      uow.userRepository.users = [];

      await expectPromiseToFailWithError(
        getConnectedUser.execute({}, connectedNotAdminUser),
        errors.user.notFound({ userId: notAdminUser.id }),
      );
    });

    describe("agency user infos", () => {
      const [
        agencyRolesAllowedToGetDashboard,
        agencyRolesForbiddenToGetDashboard,
      ] = splitCasesBetweenPassingAndFailing(allAgencyRoles, [
        "agency-admin",
        "validator",
        "counsellor",
        "agency-viewer",
      ]);

      const agency = agencyWithoutCounsellorAndValidatorBuilder.build();

      describe("returns agency rights with agency dashboards", () => {
        it.each(agencyRolesAllowedToGetDashboard)(
          "when role is '%s'",
          async (agencyUserRole) => {
            const agency = agencyWithoutCounsellorAndValidatorBuilder
              .withKind("france-travail")
              .build();

            uow.agencyRepository.agencies = [
              toAgencyWithRights(agency, {
                [notAdminUser.id]: {
                  roles: [agencyUserRole],
                  isNotifiedByEmail: true,
                },
              }),
            ];

            const user = await getConnectedUser.execute(
              {},
              connectedNotAdminUser,
            );

            expectToEqual(user, {
              ...notAdminUser,
              agencyRights: [
                {
                  agency: toAgencyDtoForAgencyUsersAndAdmins(
                    agency,
                    agencyUserRole === "agency-admin"
                      ? [connectedNotAdminUser.email]
                      : [],
                  ),
                  roles: [agencyUserRole],
                  isNotifiedByEmail: true,
                },
              ],
              dashboards: {
                agencies: {
                  agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${
                    connectedNotAdminUser.id
                  }/${timeGateway.now()}`,
                  erroredConventionsDashboardUrl: `http://stubErroredConventionDashboard/${
                    connectedNotAdminUser.id
                  }/${timeGateway.now()}`,
                  statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${timeGateway.now()}`,
                  agencyManagement: `http://stub-metabasev2/ManageMyAgency/${timeGateway.now()}/${agency.name}`,
                  establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${timeGateway.now()}`,
                },
                establishments: noEstablishmentDashboard,
              },
            });
          },
        );
      });

      describe("gets the user without dashboard url", () => {
        it.each(agencyRolesForbiddenToGetDashboard)(
          "for role '%s'",
          async (agencyUserRole) => {
            uow.userRepository.users = [notAdminUser];
            uow.agencyRepository.agencies = [
              toAgencyWithRights(agency, {
                [notAdminUser.id]: {
                  roles: [agencyUserRole],
                  isNotifiedByEmail: true,
                },
              }),
            ];

            expectToEqual(
              await getConnectedUser.execute({}, connectedNotAdminUser),
              {
                ...notAdminUser,
                proConnect: defaultProConnectInfos,
                agencyRights: [
                  {
                    agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
                    roles: [agencyUserRole],
                    isNotifiedByEmail: true,
                  },
                ],
                dashboards: {
                  agencies: noAgencyDashboards,
                  establishments: noEstablishmentDashboard,
                },
              },
            );
          },
        );
      });

      it("returns the erroredConventionsDashboardUrl to undefined when agency is not of kind with synchronisation enabled", async () => {
        const agency = new AgencyDtoBuilder().withKind("autre").build();

        uow.userRepository.users = [notAdminUser];
        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          }),
        ];
        const url = await getConnectedUser.execute({}, connectedNotAdminUser);

        expectToEqual(url, {
          ...notAdminUser,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency, []),
              roles: ["validator"],
              isNotifiedByEmail: false,
            },
          ],
          dashboards: {
            agencies: {
              agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${
                notAdminUser.id
              }/${timeGateway.now()}`,
              erroredConventionsDashboardUrl: null,
              statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${timeGateway.now()}`,
              agencyManagement: `http://stub-metabasev2/ManageMyAgency/${timeGateway.now()}/${agency.name}`,
              establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${timeGateway.now()}`,
            },
            establishments: noEstablishmentDashboard,
          },
        });
      });

      it("the dashboard url should not include the agency ids where role is 'to-review'", async () => {
        const agencyBuilder = new AgencyDtoBuilder();

        const agency1 = agencyBuilder
          .withId("1111")
          .withKind("france-travail")
          .build();
        const agency2 = agencyBuilder
          .withId("2222")
          .withKind("france-travail")
          .build();
        const agency3 = agencyBuilder.withId("3333").withKind("autre").build();
        const agency4 = agencyBuilder
          .withId("4444")
          .withKind("france-travail")
          .build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency1, {
            [notAdminUser.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency3, {
            [notAdminUser.id]: {
              roles: ["to-review"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency4, {
            [notAdminUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const user = await getConnectedUser.execute({}, connectedNotAdminUser);

        expectToEqual(user, {
          ...notAdminUser,
          proConnect: defaultProConnectInfos,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
              isNotifiedByEmail: true,
              roles: ["counsellor"],
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency3, []),
              roles: ["to-review"],
              isNotifiedByEmail: true,
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency4, [
                notAdminUser.email,
              ]),
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          ],
          dashboards: {
            agencies: {
              agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${
                notAdminUser.id
              }/${timeGateway.now()}`,
              erroredConventionsDashboardUrl: `http://stubErroredConventionDashboard/${
                notAdminUser.id
              }/${timeGateway.now()}`,
              statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${timeGateway.now()}`,
              agencyManagement: `http://stub-metabasev2/ManageMyAgency/${timeGateway.now()}/${[agency1, agency2, agency3, agency4].map((agency) => agency.name).join()}`,
              establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${timeGateway.now()}`,
            },
            establishments: noEstablishmentDashboard,
          },
        });
      });

      it("should not include agency kind in dashboard URL when agencies have different kinds", async () => {
        const agencyBuilder = new AgencyDtoBuilder();

        const agency1 = agencyBuilder
          .withId("1111")
          .withKind("france-travail")
          .build();
        const agency2 = agencyBuilder.withId("2222").withKind("autre").build();
        const agency3 = agencyBuilder.withId("3333").withKind("cci").build();

        uow.agencyRepository.agencies = [
          toAgencyWithRights(agency1, {
            [notAdminUser.id]: {
              roles: ["counsellor"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency2, {
            [notAdminUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
          toAgencyWithRights(agency3, {
            [notAdminUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const user = await getConnectedUser.execute({}, connectedNotAdminUser);

        expectToEqual(user, {
          ...notAdminUser,
          proConnect: defaultProConnectInfos,
          agencyRights: [
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency1, []),
              isNotifiedByEmail: true,
              roles: ["counsellor"],
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency2, []),
              isNotifiedByEmail: true,
              roles: ["validator"],
            },
            {
              agency: toAgencyDtoForAgencyUsersAndAdmins(agency3, [
                notAdminUser.email,
              ]),
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          ],
          dashboards: {
            agencies: {
              agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${
                notAdminUser.id
              }/${timeGateway.now()}`,
              erroredConventionsDashboardUrl: `http://stubErroredConventionDashboard/${
                notAdminUser.id
              }/${timeGateway.now()}`,
              statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${timeGateway.now()}`,
              agencyManagement: `http://stub-metabasev2/ManageMyAgency/${timeGateway.now()}/${[agency1, agency2, agency3].map((agency) => agency.name).join()}`,
              establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${timeGateway.now()}`,
            },
            establishments: noEstablishmentDashboard,
          },
        });
      });

      describe("establishment user infos", () => {
        it("do NOT retrieve any establishment user infos when user is not establishment tutor or respresentative in any conventions nor has any role in the establishment", async () => {
          expectToEqual(
            await getConnectedUser.execute({}, connectedNotAdminUser),
            {
              ...notAdminUser,
              agencyRights: [],
              dashboards: {
                agencies: noAgencyDashboards,
                establishments: noEstablishmentDashboard,
              },
            },
          );
        });

        describe("get only convention dashboard without establishment rights when user don't have establishment rights", () => {
          const expectedUserWithEstablishmentConventionDashboardOnly: ConnectedUser =
            {
              ...notAdminUser,
              agencyRights: [],
              dashboards: {
                agencies: noAgencyDashboards,
                establishments: {
                  conventions: `http://stubEstablishmentConventionsDashboardUrl/${notAdminUser.id}/${now}`,
                  discussions: null,
                },
              },
            };

          it("and user is establishement representative in at least one convention", async () => {
            const convention = new ConventionDtoBuilder()
              .withEstablishmentRepresentativeEmail(notAdminUser.email)
              .build();

            uow.conventionRepository.setConventions([convention]);

            expectToEqual(
              await getConnectedUser.execute({}, connectedNotAdminUser),
              expectedUserWithEstablishmentConventionDashboardOnly,
            );
          });

          it("and user is establishement tutor in at least one convention", async () => {
            const convention = new ConventionDtoBuilder()
              .withEstablishmentTutorEmail(notAdminUser.email)
              .build();
            uow.conventionRepository.setConventions([convention]);

            expectToEqual(
              await getConnectedUser.execute({}, connectedNotAdminUser),
              expectedUserWithEstablishmentConventionDashboardOnly,
            );
          });

          it("and user is establishment representative and tutor for at least one convention", async () => {
            const convention = new ConventionDtoBuilder()
              .withEstablishmentTutorEmail(notAdminUser.email)
              .withEstablishmentRepresentativeEmail(notAdminUser.email)
              .build();
            uow.conventionRepository.setConventions([convention]);

            expectToEqual(
              await getConnectedUser.execute({}, connectedNotAdminUser),
              expectedUserWithEstablishmentConventionDashboardOnly,
            );
          });
        });

        describe("when user have establishment rights", () => {
          const establishmentUserRightsForFirstEstablishment: EstablishmentUserRight[] =
            [
              {
                job: "Chef",
                status: "ACCEPTED",
                role: "establishment-admin",
                userId: notAdminUser.id,
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                job: "Dev",
                status: "ACCEPTED",
                role: "establishment-admin",
                userId: anotherUser.id,
                phone: "+33600000001",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                job: "Dev",
                status: "PENDING",
                role: "establishment-contact",
                userId: pendingUser.id,
                phone: "+33600000002",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ];

          const establishmentUserRightsForSecondEstablishment: EstablishmentUserRight[] =
            [
              {
                job: "Chef",
                status: "ACCEPTED",
                role: "establishment-contact",
                userId: notAdminUser.id,
                phone: "+33600000000",
                shouldReceiveDiscussionNotifications: true,
              },
            ];

          const establishmentAggregate1 = new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("89114285300012")
            .withUserRights(establishmentUserRightsForFirstEstablishment)
            .build();

          const establishmentAggregate2 = new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("89114285300013")
            .withUserRights(establishmentUserRightsForSecondEstablishment)
            .build();

          beforeEach(() => {
            uow.establishmentAggregateRepository.establishmentAggregates = [
              establishmentAggregate1,
              establishmentAggregate2,
            ];
          });

          it("retrieve establishments rights and discussions / conventions dashboards when user have right on at least one establishment even if there is no conventions/discussion for establishment for all user right status", async () => {
            uow.conventionRepository.setConventions([]);
            uow.discussionRepository.discussions = [];
            uow.userRepository.users = [notAdminUser, anotherUser, pendingUser];

            expectToEqual(
              await Promise.all([
                getConnectedUser.execute({}, connectedNotAdminUser),
                getConnectedUser.execute({}, connectedPendingUser),
              ]),
              [
                {
                  ...connectedNotAdminUser,
                  establishments: [
                    {
                      siret: establishmentAggregate1.establishment.siret,
                      businessName:
                        establishmentAggregate1.establishment.customizedName ??
                        establishmentAggregate1.establishment.name,
                      role: "establishment-admin",
                      status: "ACCEPTED",
                      admins: [
                        {
                          email: anotherUser.email,
                          firstName: anotherUser.firstName,
                          lastName: anotherUser.lastName,
                        },
                        {
                          email: notAdminUser.email,
                          firstName: notAdminUser.firstName,
                          lastName: notAdminUser.lastName,
                        },
                      ],
                      shouldReceiveDiscussionNotifications: true,
                      isEstablishmentBanned: false,
                    },
                    {
                      siret: establishmentAggregate2.establishment.siret,
                      businessName:
                        establishmentAggregate2.establishment.customizedName ??
                        establishmentAggregate2.establishment.name,
                      role: "establishment-contact",
                      status: "ACCEPTED",
                      admins: [],
                      shouldReceiveDiscussionNotifications: true,
                      isEstablishmentBanned: false,
                    },
                  ],
                  dashboards: {
                    agencies: noAgencyDashboards,
                    establishments: {
                      conventions: `http://stubEstablishmentConventionsDashboardUrl/${
                        notAdminUser.id
                      }/${timeGateway.now()}`,
                      discussions: `http://stubEstablishmentDiscussionsDashboardUrl/${
                        notAdminUser.id
                      }/${timeGateway.now()}`,
                    },
                  },
                },
                {
                  ...connectedPendingUser,
                  establishments: [
                    {
                      siret: establishmentAggregate1.establishment.siret,
                      businessName:
                        establishmentAggregate1.establishment.customizedName ??
                        establishmentAggregate1.establishment.name,
                      role: "establishment-contact",
                      status: "PENDING",
                      shouldReceiveDiscussionNotifications: true,
                      isEstablishmentBanned: false,
                    },
                  ],
                  dashboards: {
                    agencies: noAgencyDashboards,
                    establishments: noEstablishmentDashboard,
                  },
                },
              ],
            );
          });
        });
      });
    });

    describe("When a backoffice admin user gets another user's datas", () => {
      it("throws if currentUser is not admin", async () => {
        await expectPromiseToFailWithError(
          getConnectedUser.execute({ userId: admin.id }, connectedNotAdminUser),
          errors.user.forbidden({ userId: connectedNotAdminUser.id }),
        );
      });

      it("gets another user's data if currentUser is admin", async () => {
        const fetchedUser = await getConnectedUser.execute(
          { userId: notAdminUser.id },
          connectedAdminUser,
        );
        expectToEqual(fetchedUser, {
          ...notAdminUser,
          proConnect: defaultProConnectInfos,
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
          agencyRights: [],
        });
      });
    });
  });
});
