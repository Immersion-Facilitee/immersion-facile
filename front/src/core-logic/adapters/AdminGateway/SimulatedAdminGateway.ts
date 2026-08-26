import { type Observable, of, throwError } from "rxjs";
import {
  type ApiConsumer,
  type ApiConsumerId,
  type ApiConsumerJwt,
  type BanEstablishmentPayload,
  type ConnectedUser,
  type ConnectedUserJwt,
  type DashboardUrlAndName,
  type EstablishmentBatchReport,
  type FormEstablishmentBatchDto,
  type GetDashboardParams,
  type GetUsersFilters,
  type NotificationsByKind,
  noAgencyDashboards,
  noEstablishmentDashboard,
  type RejectConnectedUserRoleForAgencyParams,
  type UserParamsForAgency,
  type UserWithNumberOfAgenciesAndEstablishments,
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

  public createUserForAgency$(
    { agencyId }: UserParamsForAgency,
    _token: string,
  ): Observable<ConnectedUser> {
    return agencyId === "non-existing-agency-id"
      ? throwError(() => new Error(`Agency Id ${agencyId} not found`))
      : of({
          id: "fake-user-id-2",
          email: "remi@sanfamille.fr",
          firstName: "Rémi",
          lastName: "Sanfamille",
          agencyRights: [],
          dashboards: {
            agencies: noAgencyDashboards,
            establishments: noEstablishmentDashboard,
          },
          proConnect: {
            externalId: "fake-user-external-id-2",
            siret: "00000000001234",
          },
          createdAt: new Date().toISOString(),
          preventToDelete: false,
        });
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

  public getLastNotifications$(
    _token: ConnectedUserJwt,
  ): Observable<NotificationsByKind> {
    const notificationsByKind: NotificationsByKind = {
      emails: [],
      sms: [],
    };
    return of(notificationsByKind);
  }

  public rejectUserForAgency$(
    { agencyId }: RejectConnectedUserRoleForAgencyParams,
    _token: string,
  ): Observable<void> {
    return agencyId === "non-existing-agency-id"
      ? throwError(() => new Error(`Agency Id ${agencyId} not found`))
      : of(undefined);
  }

  public saveApiConsumer$(
    _apiConsumer: ApiConsumer,
    _adminToken: ConnectedUserJwt,
  ): Observable<ApiConsumerJwt> {
    return of(
      "fakeTokenJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4ZDE3NTE3LWJlNDItNDY2OS04OTVkLTQ3ODE0MjBhNjhiOCIsImlhdCI6MTY5MTM5MTk4Mn0.WuGBIyvVa7rNaIxjZTgVTSIcU0LkN8GRDmFxXMYTRYFh0vK0c6ImupszTJF4VXHGpkkpE1AXasOwBWhOg",
    );
  }

  public updateUserRoleForAgency$(
    { agencyId }: UserParamsForAgency,
    _token: string,
  ): Observable<void> {
    return agencyId === "non-existing-agency-id"
      ? throwError(() => new Error(`Agency Id ${agencyId} not found`))
      : of(undefined);
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
}

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
