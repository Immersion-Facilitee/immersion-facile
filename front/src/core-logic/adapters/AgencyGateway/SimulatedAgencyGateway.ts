import { values } from "ramda";
import { delay, type Observable, of, Subject, throwError } from "rxjs";
import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyOption,
  type AgencyPublicDisplayDto,
  type ConnectedUser,
  type ConnectedUserJwt,
  type CreateAgencyDto,
  errors,
  type ListAgencyOptionsRequestDto,
  noAgencyDashboards,
  noEstablishmentDashboard,
  toAgencyPublicDisplayDto,
  type UserParamsForAgency,
  type WithAgencyId,
  type WithAgencyIdAndUserId,
} from "shared";
import type { AgencyGateway } from "src/core-logic/ports/AgencyGateway";

export const nonExisitingAgencyId: AgencyId = "not-found-agency-id";

const MISSION_LOCAL_AGENCY_ACTIVE = new AgencyDtoBuilder()
  .withId("test-agency-1-front")
  .withName("Test Agency 1 (front)")
  .withAddress({
    streetNumberAndAddress: "Agency 1",
    postcode: "75001",
    city: "Paris",
    departmentCode: "75",
  })
  .withKind("mission-locale")
  .withStatus("active")
  .build();

export const PE_AGENCY_ACTIVE = new AgencyDtoBuilder()
  .withId("PE-test-agency-2-front")
  .withName("Test Agency 2 PE (front)")
  .withAddress({
    streetNumberAndAddress: "Agency 2",
    postcode: "75001",
    city: "Paris",
    departmentCode: "75",
  })
  .withKind("france-travail")
  .withSignature("Mon agence PE")
  .withStatus("active")
  .build();

const CCI_ACTIVE = new AgencyDtoBuilder()
  .withId("CCI-test-agency")
  .withName("Test Agency CCI")
  .withAddress({
    streetNumberAndAddress: "CCI",
    postcode: "75001",
    city: "Paris",
    departmentCode: "75",
  })
  .withKind("cci")
  .withSignature("CCI Agency")
  .withStatus("active")
  .build();

export const AGENCY_NEEDING_REVIEW_1 = new AgencyDtoBuilder()
  .withId("PE-test-agency-needs-review-1-front")
  .withName("Test Agency Needs review 1 (front)")
  .withStatus("needsReview")
  .build();

export const AGENCY_NEEDING_REVIEW_2 = new AgencyDtoBuilder()
  .withId("PE-test-agency-needs-review-2-front")
  .withName("Test Agency Needs review 2 (front)")
  .withStatus("needsReview")
  .build();

export class SimulatedAgencyGateway implements AgencyGateway {
  constructor(private simulatedLatency = 0) {}

  addAgency$(_agency: CreateAgencyDto): Observable<void> {
    return of(undefined);
  }

  public agencyInfo$ = new Subject<AgencyPublicDisplayDto>();

  #agencies: Record<string, AgencyDto> = {
    [MISSION_LOCAL_AGENCY_ACTIVE.id]: MISSION_LOCAL_AGENCY_ACTIVE,
    [PE_AGENCY_ACTIVE.id]: PE_AGENCY_ACTIVE,
    [AGENCY_NEEDING_REVIEW_1.id]: AGENCY_NEEDING_REVIEW_1,
    [AGENCY_NEEDING_REVIEW_2.id]: AGENCY_NEEDING_REVIEW_2,
    [CCI_ACTIVE.id]: CCI_ACTIVE,
  };

  public async addAgency(createAgencyDto: CreateAgencyDto) {
    this.#agencies[createAgencyDto.id] = {
      ...createAgencyDto,
      status: "needsReview",
      codeSafir: null,
      statusJustification: null,
    };
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
            siret: "00000000002222",
          },
          createdAt: new Date().toISOString(),
        });
  }

  public getAgencyById$(
    agencyId: AgencyId,
    _token: ConnectedUserJwt,
  ): Observable<AgencyDto> {
    return of(this.#agencies[agencyId]);
  }

  public getAgencyPublicInfoById$({
    agencyId,
  }: WithAgencyId): Observable<AgencyPublicDisplayDto> {
    const agency = this.#agencies[agencyId];

    if (agency) {
      return of(
        toAgencyPublicDisplayDto(
          agency,
          this.#agencies[MISSION_LOCAL_AGENCY_ACTIVE.id],
        ),
      );
    }
    throw errors.agency.notFound({ agencyId });
  }

  public getImmersionFacileAgencyId$(): Observable<AgencyId> {
    return of("agency-id-with-immersion-facile-kind");
  }

  public listAgencyOptionsByFilter$(
    _filter: ListAgencyOptionsRequestDto,
  ): Observable<AgencyOption[]> {
    return of(values(this.#agencies));
  }

  public updateAgency$(): Observable<void> {
    return of(undefined);
  }

  public updateUserAgencyRight$(
    { agencyId }: UserParamsForAgency,
    _token: string,
  ): Observable<void> {
    return agencyId === "non-existing-agency-id"
      ? throwError(() => new Error(`Agency Id ${agencyId} not found`))
      : of(undefined);
  }

  public removeUserFromAgency$(
    _params: WithAgencyIdAndUserId,
    _token: string,
  ): Observable<void> {
    return of(undefined);
  }

  public registerAgenciesToCurrentUser$(
    agencyIds: AgencyId[],
    _token: string,
  ): Observable<void> {
    const agencyIdInError = agencyIds.findIndex(
      (id) => id === nonExisitingAgencyId,
    );
    return agencyIdInError > 0
      ? throwError(
          new Error(`Agency Id ${agencyIds[agencyIdInError]} not found`),
        )
      : of(undefined).pipe(delay(this.simulatedLatency));
  }

  public closeAgencyAndTransfertConventions$(): Observable<void> {
    return of(undefined);
  }
}
