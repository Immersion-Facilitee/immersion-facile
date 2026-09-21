import type { SelectProps } from "@codegouvfr/react-dsfr/SelectNext";
import { equals } from "ramda";
import {
  type FitForDisableWorkerOption,
  fitForDisabledWorkersPositiveOptions,
  type LatLonDistance,
  type RemoteWorkMode,
  remoteWorkModes,
  type SearchSortedBy,
} from "shared";
import type { SearchPageParams } from "src/core-logic/domain/search/search.slice";

export const areValidGeoParams = (
  geoParams: Partial<LatLonDistance>,
): geoParams is LatLonDistance =>
  geoParams.latitude !== undefined &&
  geoParams.longitude !== undefined &&
  geoParams.distanceKm !== undefined &&
  geoParams.distanceKm > 0;

export const areEmptyGeoParams = (
  geoParams: Partial<LatLonDistance>,
): geoParams is Partial<LatLonDistance> =>
  geoParams.latitude === undefined &&
  geoParams.longitude === undefined &&
  geoParams.distanceKm === undefined;

export const canSubmitSearch = (values: SearchPageParams) => {
  const geoParams = {
    latitude: values.latitude,
    longitude: values.longitude,
    distanceKm: values.distanceKm,
  };
  return areValidGeoParams(geoParams) || areEmptyGeoParams(geoParams);
};

export const getSortedByOptions = (
  hasGeoParams: boolean,
  hasScoreEnabled: boolean,
): SelectProps.Option<SearchSortedBy>[] => [
  ...(hasScoreEnabled
    ? [
        {
          label: sortedByOptionsLabel.score,
          value: "score" as const,
        },
      ]
    : []),
  {
    label: sortedByOptionsLabel.date,
    value: "date" as const,
  },
  {
    label: sortedByOptionsLabel.distance,
    value: "distance" as const,
    disabled: !hasGeoParams,
  },
];

export const sortedByOptionsLabel = {
  date: "Trier par date de publication",
  score: "Trier par pertinence",
  distance: "Trier par proximité",
};

export const getLocalisationValues = (
  place?: string,
  currentRemoteWorkModes?: RemoteWorkMode[],
): string[] => [
  ...(place ? [place] : []),
  ...((currentRemoteWorkModes || []).length === remoteWorkModes.length
    ? []
    : currentRemoteWorkModes || []),
];

export const getAppellationAndNafValues = (
  appellationCodes?: string[],
  nafCodes?: string[],
): string[] => [
  ...(appellationCodes ? [appellationCodes.join(", ")] : []),
  ...(nafCodes ? [nafCodes.join(", ")] : []),
];

export const getEstablishmentAdditionalValues = (
  fitForDisabledWorkers?: FitForDisableWorkerOption[],
  showOnlyAvailableOffers?: boolean,
): string[] => [
  ...(equals(fitForDisabledWorkers, [...fitForDisabledWorkersPositiveOptions])
    ? [(fitForDisabledWorkers || []).join(", ")]
    : []),
  ...(showOnlyAvailableOffers ? [showOnlyAvailableOffers.toString()] : []),
];
