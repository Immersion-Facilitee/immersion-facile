import { type Observable, of } from "rxjs";
import {
  type AdminEstablishmentListItemDto,
  AgencyDtoBuilder,
  type AgencyRight,
  type AgencyUserForListing,
  type ApiConsumer,
  type ApiConsumerId,
  type ApiConsumerJwt,
  adminEstablishmentListDefaultPerPage,
  type BanEstablishmentPayload,
  type ConnectedUserJwt,
  calculatePaginationResult,
  type DashboardUrlAndName,
  type DataWithPagination,
  defaultPageInPagination,
  type EstablishmentBatchReport,
  type FormEstablishmentBatchDto,
  type GetDashboardParams,
  type GetEstablishmentsForAdminParams,
  type GetUsersFilters,
  type NotificationsByKind,
  toAgencyDtoForAgencyUsersAndAdmins,
  toAgencyRightsByAgencyId,
  type UserWithNumberOfAgenciesAndEstablishments,
  type WithPreventToDelete,
  type WithUserId,
} from "shared";
import type { AdminGateway } from "src/core-logic/ports/AdminGateway";

export class SimulatedAdminGateway implements AdminGateway {
  public updateFeatureFlags$ = (): Observable<void> => of(undefined);

  public addEstablishmentBatch$(
    _establishmentBatch: FormEstablishmentBatchDto,
    _token: ConnectedUserJwt,
  ): Observable<EstablishmentBatchReport> {
    return of({
      numberOfEstablishmentsProcessed: 12,
      numberOfSuccess: 8,
      failures: [
        {
          siret: "744854745000266",
          errorMessage: "Test erreur 1",
        },
        {
          siret: "744854745000267",
          errorMessage: "Test erreur 2",
        },
        {
          siret: "744854745000268",
          errorMessage: "Test erreur 3",
        },
      ],
    });
  }

  public getConnectedUsers$(): Observable<AgencyUserForListing[]> {
    return of([
      {
        id: "fake-user-id-1",
        email: "jbon8745@wanadoo.fr",
        firstName: "Jean",
        lastName: "Bon",
        agencyRightsByAgencyId: toAgencyRightsByAgencyId(simulatedAgencyRights),
        isProConnectUser: true,
      },
    ]);
  }

  public getAllApiConsumers$(
    _adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumer[]> {
    return of(apiConsumers);
  }

  public getDashboardUrl$(
    { name }: GetDashboardParams,
    _token: ConnectedUserJwt,
  ): Observable<DashboardUrlAndName> {
    return of({ name, url: `http://${name}.com` });
  }

  public getEstablishmentsForAdmin$(
    {
      page = defaultPageInPagination,
      perPage = adminEstablishmentListDefaultPerPage,
    }: GetEstablishmentsForAdminParams,
    _jwt: ConnectedUserJwt,
  ): Observable<DataWithPagination<AdminEstablishmentListItemDto>> {
    return of({
      data: simulatedAdminEstablishments.slice(
        (page - 1) * perPage,
        page * perPage,
      ),
      pagination: calculatePaginationResult({
        page,
        perPage,
        totalRecords: simulatedAdminEstablishments.length,
      }),
    });
  }

  public getLastNotifications$(
    _token: ConnectedUserJwt,
  ): Observable<NotificationsByKind> {
    const notificationsByKind: NotificationsByKind = {
      emails: [],
      sms: [],
    };
    return of(notificationsByKind);
  }

  public saveApiConsumer$(
    _apiConsumer: ApiConsumer,
    _adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return of(
      "fakeTokenJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4ZDE3NTE3LWJlNDItNDY2OS04OTVkLTQ3ODE0MjBhNjhiOCIsImlhdCI6MTY5MTM5MTk4Mn0.WuGBIyvVa7rNaIxjZTgVTSIcU0LkN8GRDmFxXMYTRYFh0vK0c6ImupszTJF4VXHGpkkpE1AXasOwBWhOg",
    );
  }

  public listUsers$(
    { emailContains }: GetUsersFilters,
    _token: string,
  ): Observable<UserWithNumberOfAgenciesAndEstablishments[]> {
    return of(
      simulatedUsers.filter((user) => user.email.includes(emailContains)),
    );
  }

  public revokeApiConsumer$(
    _consumerId: ApiConsumerId,
    _token: ConnectedUserJwt,
  ): Observable<void> {
    return of(undefined);
  }

  public renewApiConsumerKey$(
    _consumerId: ApiConsumerId,
    _token: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return of(
      "newFakeTokenJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4ZDE3NTE3LWJlNDItNDY2OS04OTVkLTQ3ODE0MjBhNjhiOCIsImlhdCI6MTY5MTM5MTk4Mn0.RENEWED_KEY",
    );
  }

  public banEstablishment$(
    _payload: BanEstablishmentPayload,
  ): Observable<void> {
    return of(undefined);
  }

  public updateUserPreventToDelete$(
    _params: WithUserId & WithPreventToDelete,
    _token: ConnectedUserJwt,
  ): Observable<void> {
    return of(undefined);
  }
}

const simulatedAgencyRights: AgencyRight[] = [
  {
    roles: ["to-review"],
    agency: toAgencyDtoForAgencyUsersAndAdmins(
      new AgencyDtoBuilder()
        .withName("Agence de Bourg en Bresse")
        .withId("fake-agency-id-1")
        .build(),
      [],
    ),
    isNotifiedByEmail: true,
  },
  {
    roles: ["validator"],
    agency: toAgencyDtoForAgencyUsersAndAdmins(
      new AgencyDtoBuilder()
        .withName("Mission locale qu'on ne devrait pas voir")
        .withId("fake-agency-id-not-shown")
        .build(),
      [],
    ),
    isNotifiedByEmail: true,
  },
];

const simulatedUsers: UserWithNumberOfAgenciesAndEstablishments[] = [
  {
    id: "fake-user-id-1",
    email: "jerome@mail.com",
    firstName: "Jerome",
    lastName: "Yolo",
    createdAt: new Date().toISOString(),
    preventToDelete: false,
    numberOfAgencies: 10,
    numberOfEstablishments: 5,
    proConnect: {
      externalId: "external-id-1",
      siret: "00000000001111",
    },
  },
  {
    id: "fake-user-id-2",
    email: "john@mail.com",
    firstName: "john",
    lastName: "Lala",
    createdAt: new Date().toISOString(),
    preventToDelete: false,
    numberOfAgencies: 3,
    numberOfEstablishments: 2,
    proConnect: {
      externalId: "external-id-2",
      siret: "00000000002222",
    },
  },
];

const apiConsumers: ApiConsumer[] = [
  {
    id: "fake-api-consumer-id-1",
    name: "FakeApiConsumer1",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce fermentum odio nibh, quis porta mi tempus quis.",
    contact: {
      lastName: "FakeLastname1",
      firstName: "FakeFirstname1",
      job: "FakeJob1",
      phone: "FakePhone1",
      emails: ["fakeEmail1@mail.com"],
    },
    createdAt: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    revokedAt: null,
    currentKeyIssuedAt: new Date().toISOString(),
    rights: {
      searchEstablishment: {
        kinds: ["READ"],
        scope: "no-scope",
        subscriptions: [],
      },
      convention: {
        kinds: ["READ", "WRITE"],
        scope: {
          agencyKinds: ["france-travail", "mission-locale"],
        },
        subscriptions: [],
      },
      statistics: {
        kinds: ["READ"],
        scope: "no-scope",
        subscriptions: [],
      },
    },
  },
  {
    id: "fake-api-consumer-id-2",
    name: "FakeApiConsumer2",
    description: "Temp",
    contact: {
      lastName: "FakeLastname2",
      firstName: "FakeFirstname2",
      job: "FakeJob2",
      phone: "FakePhone2",
      emails: ["fakeEmail2@mail.com"],
    },
    createdAt: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    revokedAt: null,
    currentKeyIssuedAt: new Date().toISOString(),
    rights: {
      searchEstablishment: {
        kinds: ["READ"],
        scope: "no-scope",
        subscriptions: [],
      },
      convention: {
        kinds: ["READ"],
        scope: {
          agencyIds: ["fake-agency-id-1"],
        },
        subscriptions: [],
      },
      statistics: {
        kinds: ["READ"],
        scope: "no-scope",
        subscriptions: [],
      },
    },
  },
];

const simulatedAdminEstablishments: AdminEstablishmentListItemDto[] = [
  {
    siret: "12345678901236",
    name: "BOULANGERIE DU CENTRE",
    customizedName: "Le Fournil",
    city: "Lyon",
    postcode: "69001",
    otherLocationsCount: 1,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
    discussionsCount: 3,
    validatedConventionsCount: 1,
  },
  {
    siret: "12345678901237",
    name: "GARAGE MARTIN",
    customizedName: null,
    city: "Villeurbanne",
    postcode: "69100",
    otherLocationsCount: 0,
    createdAt: "2025-03-01T10:00:00.000Z",
    updatedAt: "2025-06-15T10:00:00.000Z",
    discussionsCount: 0,
    validatedConventionsCount: 0,
  },
];
