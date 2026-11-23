import { subDays } from "date-fns";
import {
  type GeoPositionDto,
  type Location,
  LocationBuilder,
  type RemoteWorkMode,
  UserBuilder,
} from "shared";
import { v4 as uuid } from "uuid";
import { rueJacquardDto } from "../../core/address/adapters/InMemoryAddressGateway";
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";
import type { OfferEntity } from "../entities/OfferEntity";
import type { SearchMade } from "../entities/SearchMadeEntity";
import {
  EstablishmentAggregateBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import type { RepositorySearchResultDto } from "../ports/EstablishmentAggregateRepository";

export const makeExpectedSearchResult = ({
  establishment: establishmentAggregate,
  withOffers,
  withLocationAndDistance,
  nafLabel,
  remoteWorkMode,
}: {
  establishment: EstablishmentAggregate;
  withOffers: OfferEntity[];
  withLocationAndDistance: Location & { distance?: number };
  nafLabel: string;
  remoteWorkMode?: RemoteWorkMode;
}): RepositorySearchResultDto => {
  const firstOffer = withOffers.at(0);
  if (!firstOffer)
    throw new Error(
      "At least one offer is required to make an expected SearchResult",
    );
  const matchingOffersForRemoteWorkMode = withOffers.filter((offer) =>
    remoteWorkMode ? offer.remoteWorkMode === remoteWorkMode : true,
  );
  return {
    additionalInformation:
      establishmentAggregate.establishment.additionalInformation,
    address: withLocationAndDistance.address,
    appellations: matchingOffersForRemoteWorkMode.map((offer) => ({
      appellationCode: offer.appellationCode,
      appellationLabel: offer.appellationLabel,
      ...(offer.immersionActivities
        ? { immersionActivities: offer.immersionActivities }
        : {}),
    })),
    establishmentScore: establishmentAggregate.establishment.score,
    contactMode: establishmentAggregate.establishment.contactMode,
    customizedName: establishmentAggregate.establishment.customizedName,
    distance_m: withLocationAndDistance.distance,
    fitForDisabledWorkers:
      establishmentAggregate.establishment.fitForDisabledWorkers,
    locationId: withLocationAndDistance.id,
    naf: establishmentAggregate.establishment.nafDto.code,
    nafLabel,
    name: establishmentAggregate.establishment.name,
    numberOfEmployeeRange:
      establishmentAggregate.establishment.numberEmployeesRange,
    position: withLocationAndDistance.position,
    rome: firstOffer.romeCode,
    romeLabel: firstOffer.romeLabel,
    siret: establishmentAggregate.establishment.siret,
    voluntaryToImmersion:
      establishmentAggregate.establishment.voluntaryToImmersion,
    website: establishmentAggregate.establishment.website,
    updatedAt: establishmentAggregate.establishment.updatedAt?.toISOString(),
    createdAt: establishmentAggregate.establishment.createdAt.toISOString(),
    remoteWorkMode: remoteWorkMode ?? firstOffer.remoteWorkMode,
    isAvailable:
      !establishmentAggregate.establishment.isMaxDiscussionsForPeriodReached,
  } satisfies RepositorySearchResultDto;
};

export const sortSearchResultsByDistanceAndRomeAndSiretOnRandomResults = (
  a: RepositorySearchResultDto,
  b: RepositorySearchResultDto,
): number => {
  if (a.distance_m && b.distance_m) {
    if (a.distance_m > b.distance_m) return 1;
    if (a.distance_m < b.distance_m) return -1;
  }
  if (a.rome > b.rome) return 1;
  if (a.rome < b.rome) return -1;

  if (a.siret > b.siret) return 1;
  if (a.siret < b.siret) return -1;
  return 0;
};

export const cartographeImmersionOffer = new OfferEntityBuilder()
  .withAppellationCode("11704")
  .withAppellationLabel("Cartographe")
  .withRomeCode("M1808")
  .withRomeLabel("Information géographique")
  .build();

export const analysteEnGeomatiqueImmersionOffer = new OfferEntityBuilder()
  .withAppellationCode("10946")
  .withAppellationLabel("Analyste en géomatique")
  .withRomeCode("M1808")
  .withRomeLabel("Information géographique")
  .build();

export const cuvisteOffer = new OfferEntityBuilder()
  .withRomeCode("A1413")
  .withRomeLabel("Fermentation de boissons alcoolisées")
  .withAppellationCode("140927")
  .withAppellationLabel("Cuviste")
  .build();

export const groomChevauxOffer = new OfferEntityBuilder()
  .withRomeCode("A1501")
  .withRomeLabel("Aide aux soins animaux")
  .withAppellationCode("140928")
  .withAppellationLabel("Groom chevaux")
  .build();

export const artisteCirqueOffer = new OfferEntityBuilder()
  .withRomeCode("L1204")
  .withRomeLabel("Arts du cirque et arts visuels")
  .withAppellationCode("11155")
  .withAppellationLabel("Artiste de cirque")
  .build();

const offer_A1101 = new OfferEntityBuilder()
  .withRomeCode("A1101")
  .withRomeLabel("Conduite d'engins agricoles et forestiers")
  .withAppellationCode("0")
  .withAppellationLabel("")
  .build();

export const offer_A1101_11987 = new OfferEntityBuilder(offer_A1101)
  .withAppellationCode("11987")
  .withAppellationLabel("Chauffeur / Chauffeuse de machines agricoles")
  .build();

export const offer_A1101_12862 = new OfferEntityBuilder(offer_A1101)
  .withAppellationCode("12862")
  .withAppellationLabel("")
  .build();

export const offer_A1101_17751 = new OfferEntityBuilder(offer_A1101)
  .withAppellationCode("17751")
  .withAppellationLabel("Pilote de machines d'abattage")
  .build();

export const offer_A1101_20404 = new OfferEntityBuilder(offer_A1101)
  .withAppellationCode("20404")
  .withAppellationLabel("Tractoriste agricole")
  .build();

export const osefUser = new UserBuilder().withId(uuid()).build();
export const osefUserRight: EstablishmentUserRight = {
  role: "establishment-admin",
  status: "ACCEPTED",
  job: "osef",
  phone: "+33600000000",
  userId: osefUser.id,
  shouldReceiveDiscussionNotifications: true,
  isMainContactByPhone: false,
};

export const centerOfSaintesGeoPosition: GeoPositionDto = {
  lat: 45.7461575,
  lon: -0.728166,
};

export const bassompierreSaintesLocation: Location = {
  id: "22222222-ee70-4c90-b3f4-668d492f7395",
  address: {
    city: "Saintes",
    postcode: "17100",
    streetNumberAndAddress: "8 Place bassompierre",
    departmentCode: "17",
  },
  position: {
    lat: 45.7424192,
    lon: -0.6293045,
  },
};

export const portHubleChaniersLocation: Location = {
  id: "22222222-ee70-4c90-b3f4-668d492f7396",
  address: {
    city: "Chaniers",
    postcode: "17610",
    streetNumberAndAddress: "Le Port Hublé, 2 Chem. des Métrelles",
    departmentCode: "17",
  },
  position: {
    lat: 45.7285766,
    lon: -0.5878595,
  },
};

export const tourDeLaChaineLaRochelleLocation: Location = {
  id: "33333333-ee70-4c90-b3f4-668d492f7354",
  address: {
    streetNumberAndAddress: "Tour de la chaîne",
    postcode: "17000",
    city: "La Rochelle",
    departmentCode: "17",
  },
  position: {
    lat: 46.1556411,
    lon: -1.153885,
  },
};

export const veauxLocation: Location = {
  id: "33333333-ee70-4c90-b3f4-668d492f7395",
  address: rueJacquardDto,
  position: {
    lat: 45.7636093,
    lon: 4.9209047,
  },
};

export const locationOfSearchPosition = new LocationBuilder()
  .withId(uuid())
  .withPosition({ lat: 49, lon: 6 })
  .build();
export const locationOfSearchPosition2 = new LocationBuilder()
  .withId(uuid())
  .withPosition({ lat: 46, lon: 4 })
  .build();
export const locationOfCloseSearchPosition = new LocationBuilder()
  .withId(uuid())
  .withPosition({ lat: 49.001, lon: 6.001 })
  .build();
export const locationOutOfAnySearchedPosition = new LocationBuilder()
  .withId(uuid())
  .withPosition({ lat: 32, lon: 89 })
  .build();

export const searchMadeDistanceWithoutRome: SearchMade = {
  ...locationOfSearchPosition.position,
  distanceKm: 30,
  sortedBy: "distance",
};
export const cartographeSearchMade: SearchMade = {
  ...searchMadeDistanceWithoutRome,
  appellationCodes: [cartographeImmersionOffer.appellationCode],
};

export const establishmentWithOfferA1101_AtPosition =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000001")
    .withLocations([locationOfSearchPosition])
    .withOffers([offer_A1101_11987])
    .withUserRights([osefUserRight])
    .build();

export const establishmentWithOfferA1101_AtPositionWithTwoLocations =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000001")
    .withLocations([locationOfSearchPosition, locationOfSearchPosition2])
    .withOffers([offer_A1101_11987])
    .withUserRights([osefUserRight])
    .build();

export const establishmentWithOfferA1101_close =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000002")
    .withLocations([locationOfCloseSearchPosition])
    .withOffers([offer_A1101_11987])
    .withUserRights([osefUserRight])
    .build();

export const establishmentWithOfferA1101_outOfDistanceRange =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000003")
    .withLocations([locationOutOfAnySearchedPosition])
    .withOffers([offer_A1101_11987])
    .withUserRights([osefUserRight])
    .build();

export const searchableByAllEstablishment = new EstablishmentAggregateBuilder()
  .withEstablishmentSiret("00000000000010")
  .withSearchableBy({ jobSeekers: true, students: true })
  .withOffers([cartographeImmersionOffer])
  .withLocations([
    new LocationBuilder(locationOfSearchPosition).withId(uuid()).build(),
  ])
  .withUserRights([osefUserRight])
  .build();
export const searchableByStudentsEstablishment =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000011")
    .withSearchableBy({ jobSeekers: false, students: true })
    .withOffers([cartographeImmersionOffer])
    .withLocations([
      new LocationBuilder(locationOfSearchPosition).withId(uuid()).build(),
    ])
    .withUserRights([osefUserRight])
    .build();
export const searchableByJobSeekerEstablishment =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000012")
    .withSearchableBy({ jobSeekers: true, students: false })
    .withOffers([cartographeImmersionOffer])
    .withLocations([
      new LocationBuilder(locationOfSearchPosition).withId(uuid()).build(),
    ])
    .withUserRights([osefUserRight])
    .build();

export const establishmentCuvisteAtSaintesAndVeaux =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("78000403200029")
    .withOffers([
      new OfferEntityBuilder(cuvisteOffer).withCreatedAt(new Date()).build(),
    ])
    .withLocations([
      bassompierreSaintesLocation,
      veauxLocation, // outside geographical area
    ])
    .withUserRights([osefUserRight])
    .build();

export const establishmentCuvisteAtChaniersAndLaRochelle =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("78000403200030")
    .withOffers([
      new OfferEntityBuilder(cuvisteOffer)
        .withCreatedAt(subDays(new Date(), 1))
        .build(),
    ])
    .withLocations([
      portHubleChaniersLocation,
      tourDeLaChaineLaRochelleLocation, // outside geographical area (52km)
    ])
    .withUserRights([osefUserRight])
    .build();

export const establishment0145Z_A = new EstablishmentAggregateBuilder()
  .withUserRights([osefUserRight])
  .withOffers([cuvisteOffer])
  .withEstablishmentSiret("00000000000020")
  .withLocations([
    {
      ...bassompierreSaintesLocation,
      id: uuid(),
    },
  ])
  .withEstablishmentNaf({
    code: "0145Z",
    nomenclature: "Élevage d'ovins et de caprins",
  })
  .build();
export const establishment0145Z_B = new EstablishmentAggregateBuilder()
  .withUserRights([osefUserRight])
  .withOffers([cuvisteOffer])
  .withEstablishmentSiret("00000000000021")
  .withLocations([
    {
      ...portHubleChaniersLocation,
      id: uuid(),
    },
  ])
  .withEstablishmentNaf({
    code: "0145Z",
    nomenclature: "Élevage d'ovins et de caprins",
  })
  .build();

export const establishment4741Z = new EstablishmentAggregateBuilder()
  .withUserRights([osefUserRight])
  .withOffers([cuvisteOffer])
  .withEstablishmentSiret("00000000000022")
  .withLocations([
    {
      ...veauxLocation,
      id: uuid(),
    },
  ])
  .withEstablishmentNaf({
    code: "4741Z",
    nomenclature:
      "Commerce de détail d'ordinateurs, d'unités périphériques et de logiciels en magasin spécialisé",
  })
  .build();

export const establishment9900Z = new EstablishmentAggregateBuilder()
  .withUserRights([osefUserRight])
  .withOffers([cuvisteOffer])
  .withEstablishmentSiret("00000000000023")
  .withLocations([
    {
      ...tourDeLaChaineLaRochelleLocation,
      id: uuid(),
    },
  ])
  .withEstablishmentNaf({
    code: "9900Z",
    nomenclature: "Activités des organisations et organismes extraterritoriaux",
  })
  .build();

export const establishmentWithFitForDisabledWorkersNo =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000024")
    .withFitForDisabledWorkers("no")
    .withUserRights([osefUserRight])
    .build();

export const establishmentWithFitForDisabledWorkersYesCertified =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000025")
    .withFitForDisabledWorkers("yes-ft-certified")
    .withUserRights([osefUserRight])
    .withLocations([
      {
        ...locationOfCloseSearchPosition,
        id: uuid(),
      },
    ])
    .build();

export const establishmentWithFitForDisabledWorkersYesDeclaredOnly =
  new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000026")
    .withFitForDisabledWorkers("yes-declared-only")
    .withUserRights([osefUserRight])
    .withLocations([
      {
        ...locationOfCloseSearchPosition,
        id: uuid(),
      },
    ])
    .build();

export const closedEstablishment = new EstablishmentAggregateBuilder()
  .withOffers([cartographeImmersionOffer])
  .withLocations([
    {
      ...locationOfCloseSearchPosition,
      id: uuid(),
    },
  ])
  .withEstablishmentOpen(false)
  .withUserRights([osefUserRight])
  .build();

export const unavailableEstablishment = new EstablishmentAggregateBuilder()
  .withEstablishmentSiret("00000000000027")
  .withIsMaxDiscussionsForPeriodReached(true)
  .withOffers([cartographeImmersionOffer])
  .withLocations([
    new LocationBuilder(locationOfSearchPosition).withId(uuid()).build(),
  ])
  .withUserRights([osefUserRight])
  .build();

export const randomizeTestEstablishmentAggregates = (
  a: EstablishmentAggregate,
  b: EstablishmentAggregate,
) =>
  a.establishment.updatedAt.getTime() * Math.random() -
  b.establishment.updatedAt.getTime() * Math.random();
