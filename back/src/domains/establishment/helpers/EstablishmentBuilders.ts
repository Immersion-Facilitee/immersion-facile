import {
  type AbsoluteUrl,
  type AddressAndPosition,
  type Builder,
  type ContactMode,
  defaultMaxContactsPerMonth,
  type EstablishmentSearchableBy,
  type FitForDisableWorkerOption,
  type FormEstablishmentSource,
  type Location,
  type NafDto,
  type NumberEmployeesRange,
  type RemoteWorkMode,
  type RomeCode,
  type WithAcquisition,
  type WithBannedEstablishmentInformations,
} from "shared";
import { avenueChampsElyseesDto } from "../../core/address/adapters/InMemoryAddressGateway";
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";
import type { OfferEntity } from "../entities/OfferEntity";

export const TEST_APPELLATION_LABEL = "test_appellation_label";
export const TEST_APPELLATION_CODE = "12345";
export const TEST_LOCATION: Location = {
  id: "11111111-1111-4444-1111-111111111111",
  address: avenueChampsElyseesDto,
  position: { lat: 43.8666, lon: 8.3333 },
};

export const defaultNafCode = "7820Z";
export const defaultLocation: Location = {
  id: "aaaaaaaa-aaaa-4444-aaaa-aaaaaaaaaaaa",
  address: avenueChampsElyseesDto,
  position: {
    lat: 48.866667, // Paris lat/lon
    lon: 2.333333,
  },
};

export const defaultUpdatedAt = new Date("2024-08-10");
export const defaultCreatedAt = new Date("2024-08-08");

const validEstablishmentEntityV2: EstablishmentEntity = {
  siret: "78000403200019",
  name: "Company inside repository",
  locations: [defaultLocation],
  customizedName: undefined,
  createdAt: defaultCreatedAt,
  sourceProvider: "immersion-facile",
  voluntaryToImmersion: true,
  nafDto: { code: defaultNafCode, nomenclature: "NAFRev2" },
  numberEmployeesRange: "10-19",
  updatedAt: defaultUpdatedAt,
  contactMode: "EMAIL",
  isOpen: true,
  isMaxDiscussionsForPeriodReached: false,
  maxContactsPerMonth: defaultMaxContactsPerMonth,
  searchableBy: {
    jobSeekers: true,
    students: true,
  },
  additionalInformation: "",
  fitForDisabledWorkers: "no",
  website: "",
  score: 10,
  isEstablishmentBanned: false,
};

export class EstablishmentEntityBuilder
  implements Builder<EstablishmentEntity>
{
  constructor(
    private readonly entity: EstablishmentEntity = validEstablishmentEntityV2,
  ) {}

  public build() {
    return this.entity;
  }

  public withAdditionalInformation(additionalInformation?: string) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      additionalInformation,
    });
  }

  public withCreatedAt(createdAt: Date) {
    return new EstablishmentEntityBuilder({ ...this.entity, createdAt });
  }

  public withContactMode(contactMode: ContactMode) {
    return new EstablishmentEntityBuilder({ ...this.entity, contactMode });
  }

  public withCustomizedName(customizedName?: string) {
    return new EstablishmentEntityBuilder({ ...this.entity, customizedName });
  }

  public withFitForDisabledWorkers(
    fitForDisabledWorkers: FitForDisableWorkerOption,
  ) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      fitForDisabledWorkers,
    });
  }

  public withIsOpen(isOpen: boolean) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      isOpen,
    });
  }

  public withIsMaxDiscussionsForPeriodReached(
    isMaxDiscussionsForPeriodReached: boolean,
  ) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      isMaxDiscussionsForPeriodReached,
    });
  }

  public withLastInseeCheck(lastInseeCheck: Date | undefined) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      lastInseeCheckDate: lastInseeCheck,
    });
  }

  public withLocationId(locationId: string) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      locations: [{ ...defaultLocation, id: locationId }],
    });
  }

  public withLocations(locations: Location[]) {
    return new EstablishmentEntityBuilder({ ...this.entity, locations });
  }

  public withMaxContactsPerMonth(maxContactsPerMonth: number) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      maxContactsPerMonth,
    });
  }

  public withNafDto(nafDto: NafDto) {
    return new EstablishmentEntityBuilder({ ...this.entity, nafDto });
  }

  public withName(name: string) {
    return new EstablishmentEntityBuilder({ ...this.entity, name });
  }

  public withNextAvailabilityDate(nextAvailabilityDate: Date | undefined) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      nextAvailabilityDate: nextAvailabilityDate?.toISOString(),
    });
  }

  public withNumberOfEmployeeRange(numberEmployeesRange: NumberEmployeesRange) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      numberEmployeesRange,
    });
  }

  public withSearchableBy(searchableBy: EstablishmentSearchableBy) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      searchableBy,
    });
  }

  public withSiret(siret: string) {
    return new EstablishmentEntityBuilder({ ...this.entity, siret });
  }

  public withSourceProvider(sourceProvider: FormEstablishmentSource) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      sourceProvider,
    });
  }

  public withUpdatedAt(updatedAt: Date) {
    return new EstablishmentEntityBuilder({ ...this.entity, updatedAt });
  }

  public withWebsite(website?: AbsoluteUrl | "") {
    return new EstablishmentEntityBuilder({ ...this.entity, website });
  }

  withAcquisition(withAcquisition: WithAcquisition) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      ...withAcquisition,
    });
  }

  public withScore(score: number) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      score,
    });
  }

  public withWelcomeAddress(welcomeAddress: AddressAndPosition) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      potentialBeneficiaryWelcomeAddress: welcomeAddress,
    });
  }

  public withBannishmentInformations(
    withBannishmentInformations: WithBannedEstablishmentInformations,
  ) {
    return new EstablishmentEntityBuilder({
      ...this.entity,
      ...withBannishmentInformations,
    });
  }
}

export class EstablishmentAggregateBuilder
  implements Builder<EstablishmentAggregate>
{
  constructor(
    private readonly aggregate: EstablishmentAggregate = {
      establishment: new EstablishmentEntityBuilder().build(),
      offers: [new OfferEntityBuilder().build()],
      userRights: [],
    },
  ) {}

  withEstablishmentWebsite(website?: AbsoluteUrl | "") {
    return new EstablishmentAggregateBuilder().withEstablishment(
      new EstablishmentEntityBuilder(this.aggregate.establishment)
        .withWebsite(website ?? "")
        .build(),
    );
  }

  public build() {
    return this.aggregate;
  }

  public withUserRights(userRights: EstablishmentUserRight[]) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      userRights,
    });
  }

  public withScore(score: number) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withScore(score)
        .build(),
    });
  }

  public withContactMode(contactMode: ContactMode) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withContactMode(contactMode)
        .build(),
    });
  }

  public withEstablishment(establishment: EstablishmentEntity) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment,
    });
  }

  public withEstablishmentLastInseeCheckDate(
    lastInseeCheckDate: Date | undefined,
  ) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withLastInseeCheck(lastInseeCheckDate)
        .build(),
    });
  }

  public withEstablishmentNaf(naf: NafDto) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withNafDto(naf)
        .build(),
    });
  }

  public withEstablishmentNextAvailabilityDate(date?: Date) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withNextAvailabilityDate(date)
        .build(),
    });
  }

  withEstablishmentOpen(isOpen: boolean) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withIsOpen(isOpen)
        .build(),
    });
  }

  public withEstablishmentSiret(siret: string) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withSiret(siret)
        .build(),
    });
  }

  public withEstablishmentCreatedAt(createdAt: Date) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withCreatedAt(createdAt)
        .build(),
    });
  }

  public withEstablishmentCustomizedName(name: string | undefined) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withCustomizedName(name)
        .build(),
    });
  }

  public withEstablishmentName(name: string) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withName(name)
        .build(),
    });
  }

  public withEstablishmentUpdatedAt(updatedAt: Date) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withUpdatedAt(updatedAt)
        .build(),
    });
  }

  public withEstablishmentWelcomeAddress(welcomeAddress: AddressAndPosition) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withWelcomeAddress(welcomeAddress)
        .build(),
    });
  }

  public withFitForDisabledWorkers(
    fitForDisabledWorkers: FitForDisableWorkerOption,
  ) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withFitForDisabledWorkers(fitForDisabledWorkers)
        .build(),
    });
  }

  public withIsMaxDiscussionsForPeriodReached(
    isMaxDiscussionsForPeriodReached: boolean,
  ) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withIsMaxDiscussionsForPeriodReached(isMaxDiscussionsForPeriodReached)
        .build(),
    });
  }

  public withLocationId(locationId: string) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withLocationId(locationId)
        .build(),
    });
  }

  public withLocations(locations: Location[]) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withLocations(locations)
        .build(),
    });
  }

  public withMaxContactsPerMonth(maxContactsPerMonth: number) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withMaxContactsPerMonth(maxContactsPerMonth)
        .build(),
    });
  }

  public withOffers(offers: OfferEntity[]) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      offers,
    });
  }

  public withSearchableBy(searchableBy: EstablishmentSearchableBy) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withSearchableBy(searchableBy)
        .build(),
    });
  }

  withAcquisition(withAcquisition: WithAcquisition) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withAcquisition(withAcquisition)
        .build(),
    });
  }

  public withBannishmentInformations(
    withBannishmentInformation: WithBannedEstablishmentInformations,
  ) {
    return new EstablishmentAggregateBuilder({
      ...this.aggregate,
      establishment: new EstablishmentEntityBuilder(
        this.aggregate.establishment,
      )
        .withBannishmentInformations(withBannishmentInformation)
        .build(),
    });
  }
}

const defaultValidOfferEntity: OfferEntity = {
  romeCode: "B1805",
  appellationLabel: "Styliste",
  appellationCode: "19540",
  remoteWorkMode: "ON_SITE",
  romeLabel: "Stylisme",
  createdAt: new Date("2022-05-15T12:00:00.000"),
};

export class OfferEntityBuilder implements Builder<OfferEntity> {
  constructor(
    private readonly entity: OfferEntity = {
      ...defaultValidOfferEntity,
    },
  ) {}

  public build() {
    return this.entity;
  }

  public withAppellationCode(appellationCode: string) {
    return new OfferEntityBuilder({
      ...this.entity,
      appellationCode,
    });
  }

  public withAppellationLabel(appellationLabel: string) {
    return new OfferEntityBuilder({
      ...this.entity,
      appellationLabel,
    });
  }

  public withCreatedAt(createdAt: Date) {
    return new OfferEntityBuilder({
      ...this.entity,
      createdAt,
    });
  }

  public withRomeCode(romeCode: RomeCode) {
    return new OfferEntityBuilder({
      ...this.entity,
      romeCode,
    });
  }

  public withRomeLabel(romeLabel: string) {
    return new OfferEntityBuilder({
      ...this.entity,
      romeLabel,
    });
  }

  public withRemoteWorkMode(remoteWorkMode: RemoteWorkMode) {
    return new OfferEntityBuilder({
      ...this.entity,
      remoteWorkMode,
    });
  }
}

export const secretariatOffer = new OfferEntityBuilder()
  .withRomeCode("M1607")
  .withAppellationLabel("Secrétaire")
  .withAppellationCode("19364")
  .withRomeLabel("Secrétariat")
  .build();

export const boulangerOffer = new OfferEntityBuilder()
  .withRomeCode("D1102")
  .withAppellationLabel("Boulanger / Boulangère")
  .withAppellationCode("11573")
  .withRomeLabel("Boulangerie - viennoiserie")
  .build();

export const boulangerAssistantOffer = new OfferEntityBuilder()
  .withRomeCode("D1102")
  .withAppellationLabel("Boulanger / Boulangère assistant de l'enfer!!!")
  .withAppellationCode("00666")
  .withRomeLabel("Boulangerie - viennoiserie")
  .build();
