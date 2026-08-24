import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MapContainer,
  Marker,
  type MarkerProps,
  Popup,
  TileLayer,
} from "react-leaflet";
import {
  domElementIds,
  frontRoutes,
  type GeoPositionDto,
  isInternalOfferDto,
  type OfferDto,
} from "shared";
import { SearchResult } from "src/app/components/search/SearchResult";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import type { SearchPageParams } from "src/core-logic/domain/search/search.slice";
import { useStyles } from "tss-react/dsfr";
import "./SearchMiniMap.scss";
import { keys } from "ramda";

type SearchMiniMapListProps = {
  kind: "list";
  markerProps?: never;
  isExternal: boolean;
};

type SearchMiniMapSingleProps = {
  kind: "single";
  markerProps: MarkerProps;
  isExternal: boolean;
};

type SearchMiniMapProps = SearchMiniMapListProps | SearchMiniMapSingleProps;

const defaultMarkerIcon = L.icon({
  iconUrl: "/marker-icon-2x.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const disabledMarkerIcon = L.icon({
  iconUrl: "/marker-icon-2x--disabled.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const lbbMarkerIcon = L.icon({
  iconUrl: "/marker-icon-2x--purple.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const activeMarkerIcon = L.icon({
  iconUrl: "/marker-icon-2x--active.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const getIconMarker = ({
  activeMarkerKey,
  isExternal,
  isAvailable,
  key,
}: {
  activeMarkerKey: string | undefined | null;
  isExternal: boolean;
  isAvailable: boolean;
  key: string;
}) => {
  if (activeMarkerKey === key) {
    return activeMarkerIcon;
  }
  if (!isAvailable) {
    return disabledMarkerIcon;
  }
  return isExternal ? lbbMarkerIcon : defaultMarkerIcon;
};

const getDefaultZoomLevel = (
  kind: SearchMiniMapProps["kind"],
  distanceKm: SearchPageParams["distanceKm"],
) => {
  if (kind === "single") {
    return 17;
  }
  return distanceKm
    ? distanceToZoomOptions[
        keys(distanceToZoomOptions).reduce((closest, current) => {
          const currentDiff = Math.abs(current - distanceKm);
          const closestDiff = Math.abs(closest - distanceKm);
          return currentDiff < closestDiff ? current : closest;
        })
      ]
    : 10;
};

export const SearchMiniMap = ({
  kind,
  markerProps,
  isExternal,
}: SearchMiniMapProps) => {
  const searchResultsWrapper = useRef<HTMLDivElement>(null);
  const { data: searchResults } = useAppSelector(
    searchSelectors.searchResultsWithPagination,
  );
  const searchParams = useAppSelector(searchSelectors.searchParams);
  const mapRef = useRef<L.Map | null>(null);
  const { cx } = useStyles();
  const [isMapOpened, setIsMapOpened] = useState(false);
  const [activeMarkerKey, setActiveMarkerKey] = useState<string | null>(null);

  const zoom = useMemo(
    () =>
      getDefaultZoomLevel(
        kind,
        searchParams.distanceKm ??
          getMaxDistanceFromSearchResults(searchResults),
      ),
    [kind, searchParams, searchResults],
  );

  const mapCenterPosition: GeoPositionDto = useMemo(() => {
    if (searchParams.latitude && searchParams.longitude)
      return {
        lat: searchParams.latitude,
        lon: searchParams.longitude,
      };

    const parisDefaultLocation: GeoPositionDto = {
      lat: 48.8589384,
      lon: 2.2646348,
    };

    return searchResults.length > 0
      ? getEpicenterFromPositions(
          searchResults.map((result) => result.position),
        )
      : parisDefaultLocation;
  }, [searchParams, searchResults]);

  useEffect(() => {
    const latLon = markerProps
      ? markerProps.position
      : ([mapCenterPosition.lat, mapCenterPosition.lon] as L.LatLngExpression);
    mapRef.current?.setView(latLon, zoom);
  }, [markerProps, zoom, mapCenterPosition]);

  const mapContainerJsx = (
    <MapContainer
      className={cx("search-map-results__map")}
      scrollWheelZoom={false}
      center={
        kind === "single"
          ? markerProps.position
          : [mapCenterPosition.lat, mapCenterPosition.lon]
      }
      zoom={zoom}
      touchZoom={true}
      minZoom={5}
      ref={mapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markerProps && (
        <Marker position={markerProps.position} icon={markerProps.icon} />
      )}
      {!markerProps &&
        searchResults.map((searchResult, index) => {
          const key = searchResult.locationId
            ? `${searchResult.locationId}-${index}`
            : `lbb-${index}`;
          const appellations = searchResult.appellations;
          const searchResultAppellationCode = appellations?.length
            ? appellations[0].appellationCode
            : null;
          const appellationCode =
            searchResultAppellationCode || searchParams.appellationCodes?.[0];
          return (
            <Marker
              key={key}
              position={[searchResult.position.lat, searchResult.position.lon]}
              icon={getIconMarker({
                activeMarkerKey,
                isExternal,
                key,
                isAvailable:
                  isInternalOfferDto(searchResult) && searchResult.isAvailable,
              })}
              eventHandlers={{
                click: () => {
                  if (setActiveMarkerKey) {
                    setActiveMarkerKey(key);
                  }
                },
              }}
            >
              <Popup>
                <SearchResult
                  key={`${searchResult.siret}-${searchResult.rome}`} // Should be unique !
                  searchResult={searchResult}
                  linkProps={
                    searchResult.voluntaryToImmersion
                      ? frontRoutes.searchResult({
                          appellationCode: [appellationCode ?? ""],
                          siret: searchResult.siret,
                          ...(searchResult.locationId
                            ? { location: searchResult.locationId }
                            : {}),
                        }).link
                      : frontRoutes.searchResultExternal({
                          siret: searchResult.siret,
                          appellationCode: [appellationCode ?? ""],
                        }).link
                  }
                />
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );

  if (kind === "single")
    return (
      <div
        ref={searchResultsWrapper}
        className={cx("search-map-results", "search-map-results--inline")}
      >
        {mapContainerJsx}
      </div>
    );

  const mapJsx = (
    <div ref={searchResultsWrapper} key={`map-${kind}`}>
      <div
        className={cx(
          "search-map-results",
          isMapOpened && "search-map-results--opened",
        )}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: div overlay avoids DSFR global button hover styles */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Fermer la carte"
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setIsMapOpened(false);
          }}
          className={cx("search-map-results__overlay")}
          onClick={() => setIsMapOpened(false)}
        />
        <div className={cx("search-map-results__inner")}>
          <Button
            priority="tertiary"
            size="small"
            className={cx(
              fr.cx("fr-ml-auto", "fr-btn--close"),
              "search-map-results__close-button",
            )}
            type="button"
            onClick={() => setIsMapOpened(false)}
          >
            Fermer
          </Button>
          {mapContainerJsx}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        id={domElementIds.search.openMapButton}
        title="Visualiser sur la carte"
        onClick={() => setIsMapOpened(true)}
        priority="tertiary"
        size="small"
        iconId="fr-icon-road-map-line"
        className={fr.cx("fr-ml-auto")}
        type="button"
      >
        Visualiser sur la carte
      </Button>
      {createPortal(mapJsx, document.body)}
    </>
  );
};

const distanceToZoomOptions: Record<number, number> = {
  1: 15,
  2: 14,
  5: 12,
  10: 11,
  20: 10,
  50: 9,
  100: 8,
  200: 7,
  400: 6.5,
  600: 6,
  3000: 1,
};

const getMaxDistanceFromSearchResults = (
  searchResults: OfferDto[],
): number | undefined =>
  searchResults
    .map((result) => result.position)
    .reduce((maxDist, posA, index, positions) => {
      const maxForPosA = positions
        .slice(index + 1)
        .reduce(
          (innerMax, posB) => Math.max(innerMax, getDistanceInKm(posA, posB)),
          0,
        );

      return Math.max(maxDist, maxForPosA);
    }, 0);

const getDistanceInKm = (
  position1: GeoPositionDto,
  position2: GeoPositionDto,
): number => {
  const haversineFormulaResult =
    Math.sin(degreesToRad(position2.lat - position1.lat) / 2) ** 2 +
    Math.cos(degreesToRad(position1.lat)) *
      Math.cos(degreesToRad(position2.lat)) *
      Math.sin(degreesToRad(position2.lon - position1.lon) / 2) ** 2;

  const centralAngleInRadians =
    2 *
    Math.atan2(
      Math.sqrt(haversineFormulaResult),
      Math.sqrt(1 - haversineFormulaResult),
    );

  const EARTH_RADIUS_IN_KM = 6371;

  return centralAngleInRadians * EARTH_RADIUS_IN_KM;
};

const getEpicenterFromPositions = (
  positions: GeoPositionDto[],
): GeoPositionDto => {
  const [avgX, avgY, avgZ] = positions
    .reduce(
      ([sumX, sumY, sumZ], { lat, lon }) => {
        const latRad = degreesToRad(lat);
        const lonRad = degreesToRad(lon);
        return [
          sumX + Math.cos(latRad) * Math.cos(lonRad),
          sumY + Math.cos(latRad) * Math.sin(lonRad),
          sumZ + Math.sin(latRad),
        ];
      },
      [0, 0, 0],
    )
    .map((value) => value / positions.length);

  const lonCenterRad = Math.atan2(avgY, avgX);
  const hyp = Math.sqrt(avgX * avgX + avgY * avgY);
  const latCenterRad = Math.atan2(avgZ, hyp);

  return {
    lat: (latCenterRad * 180) / Math.PI,
    lon: (lonCenterRad * 180) / Math.PI,
  };
};

const degreesToRad = (degree: number) => (degree * Math.PI) / 180;
