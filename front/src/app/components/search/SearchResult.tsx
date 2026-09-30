import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Card from "@codegouvfr/react-dsfr/Card";
import { equals } from "ramda";
import { memo, type ReactNode } from "react";
import {
  domElementIds,
  frenchEstablishmentKinds,
  isInternalOfferDto,
  isPhysicalWorkMode,
  type OfferDto,
  remoteWorkModeLabels,
} from "shared";
import { useStyles } from "tss-react/dsfr";
import type { Link } from "type-route";
import "./SearchResult.scss";
import { Button } from "@codegouvfr/react-dsfr/Button";

export type EnterpriseSearchResultProps = {
  mode: "list" | "map-preview";
  searchResult: OfferDto;
  linkProps: Link;
  illustration?: ReactNode;
};

const componentRootClassName = "im-search-result";

const SearchResultComponent = ({
  mode,
  linkProps,
  searchResult,
  illustration,
}: EnterpriseSearchResultProps) => {
  const { cx } = useStyles();
  const {
    siret,
    name,
    customizedName,
    address,
    romeLabel,
    appellations,
    voluntaryToImmersion,
    locationId,
  } = searchResult;
  const isCustomizedNameValidToDisplay =
    customizedName &&
    customizedName.length > 0 &&
    !frenchEstablishmentKinds.includes(customizedName.toUpperCase().trim());

  const isNotAvailableOffer =
    isInternalOfferDto(searchResult) && !searchResult.isAvailable;

  const establishmentRawName = isCustomizedNameValidToDisplay
    ? customizedName
    : name;

  const [establismentNameFirstLetter, ...establismentNameOtherLetters] =
    establishmentRawName;

  const jobTitle =
    appellations.length > 0 ? appellations[0].appellationLabel : romeLabel;

  const establishmentName = [
    establismentNameFirstLetter.toLocaleUpperCase(),
    establismentNameOtherLetters.join("").toLocaleLowerCase(),
  ].join("");

  const displayedLocation =
    isInternalOfferDto(searchResult) &&
    !isPhysicalWorkMode(searchResult.remoteWorkMode)
      ? "France entière"
      : `${address.city} (${address.departmentCode})`;
  const linkPropsHandlingNotAvailable:
    | Link
    | {
        disabled: true;
        title: string;
      } = isNotAvailableOffer
    ? {
        disabled: true,
        title:
          "Cette entreprise a reçu le nombre de candidatures qu’elle peut traiter pour le moment. Elle redeviendra disponible pour les candidatures prochainement.",
      }
    : linkProps;

  const offerLinkIdPrefix = {
    list: voluntaryToImmersion
      ? domElementIds.search.searchResultButton
      : domElementIds.search.lbbSearchResultButton,
    "map-preview": voluntaryToImmersion
      ? domElementIds.search.mapSearchResultButton
      : domElementIds.search.lbbMapSearchResultButton,
  }[mode];

  const offerLinkProps = {
    ...linkPropsHandlingNotAvailable,
    id: `${offerLinkIdPrefix}-${locationId}`,
  };

  const isMapPreview = mode === "map-preview";

  const remoteWorkModeLabel = isInternalOfferDto(searchResult)
    ? remoteWorkModeLabels[searchResult.remoteWorkMode].label
    : null;

  const locationAndWorkModeBadges = isMapPreview ? (
    <div className={fr.cx("fr-badge-group", "fr-my-1v")}>
      <Badge
        small
        className={cx(
          fr.cx("fr-my-0"),
          `${componentRootClassName}__location-badge`,
        )}
      >
        {displayedLocation}
      </Badge>
      {remoteWorkModeLabel && (
        <Badge small className={fr.cx("fr-my-0")}>
          {remoteWorkModeLabel}
        </Badge>
      )}
    </div>
  ) : (
    <>
      <Badge className={fr.cx("fr-mb-2v", "fr-mr-2v")}>
        {displayedLocation}
      </Badge>
      {remoteWorkModeLabel && (
        <Badge className={fr.cx("fr-mb-2v")}>{remoteWorkModeLabel}</Badge>
      )}
    </>
  );

  return (
    <Card
      size={isMapPreview ? "small" : "medium"}
      nativeDivProps={{
        "aria-disabled": isNotAvailableOffer,
      }}
      className={cx(
        componentRootClassName,
        isMapPreview && fr.cx("fr-card--no-icon"),
        isNotAvailableOffer && `${componentRootClassName}--unavailable`,
      )}
      enlargeLink
      id={
        voluntaryToImmersion
          ? `${domElementIds.search.searchResultButton}-${siret}`
          : `${domElementIds.search.lbbSearchResultButton}-${siret}`
      }
      linkProps={offerLinkProps}
      imageComponent={illustration}
      start={!isMapPreview && locationAndWorkModeBadges}
      detail={
        <div className={fr.cx(!isMapPreview && "fr-mt-1w")}>
          <span
            className={cx(
              fr.cx(
                isNotAvailableOffer
                  ? "fr-icon-stop-circle-fill"
                  : "fr-icon-success-fill",
                "fr-icon--sm",
              ),
              `${componentRootClassName}__availability-indicator`,
            )}
          >
            {" "}
            {isNotAvailableOffer ? "Temporairement indisponible" : "Disponible"}
          </span>
        </div>
      }
      title={
        isMapPreview ? (
          <div className={fr.cx("fr-text--md", "fr-m-0")}>{jobTitle}</div>
        ) : (
          jobTitle
        )
      }
      titleAs="h2"
      desc={
        <div className={fr.cx("fr-my-0")}>
          {establishmentName}
          {isMapPreview && locationAndWorkModeBadges}
        </div>
      }
      end={
        isMapPreview && (
          <Button size="small" linkProps={offerLinkProps}>
            Voir l'offre
          </Button>
        )
      }
    />
  );
};

export const SearchResult = memo(
  SearchResultComponent,
  (prevResult, nextResult) => equals(prevResult, nextResult),
);
