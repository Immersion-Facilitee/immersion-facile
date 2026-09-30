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
  disableButton?: boolean;
  preview?: boolean;
  showDistance?: boolean;
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

  const offerLinkId = `${offerLinkIdPrefix}-${locationId}`;

  return (
    <Card
      size={mode === "map-preview" ? "small" : "medium"}
      nativeDivProps={{
        "aria-disabled": isNotAvailableOffer,
      }}
      className={cx(
        componentRootClassName,
        mode === "map-preview" && fr.cx("fr-card--no-icon"),
        isNotAvailableOffer && `${componentRootClassName}--unavailable`,
      )}
      enlargeLink
      id={
        voluntaryToImmersion
          ? `${domElementIds.search.searchResultButton}-${siret}`
          : `${domElementIds.search.lbbSearchResultButton}-${siret}`
      }
      linkProps={{
        ...linkPropsHandlingNotAvailable,
        id: offerLinkId,
      }}
      imageComponent={illustration}
      start={
        mode === "list" && (
          <>
            <Badge className={fr.cx("fr-mb-2v", "fr-mr-2v")}>
              {displayedLocation}
            </Badge>
            {isInternalOfferDto(searchResult) && (
              <Badge className={fr.cx("fr-mb-2v")}>
                {remoteWorkModeLabels[searchResult.remoteWorkMode].label}
              </Badge>
            )}
          </>
        )
      }
      detail={
        <div className={fr.cx(mode === "list" && "fr-mt-1w")}>
          {isNotAvailableOffer ? (
            <span
              className={cx(
                fr.cx("fr-icon-stop-circle-fill", "fr-icon--sm"),
                `${componentRootClassName}__availability-indicator`,
              )}
            >
              {" "}
              Temporairement indisponible
            </span>
          ) : (
            <span
              className={cx(
                fr.cx("fr-icon-success-fill", "fr-icon--sm"),
                `${componentRootClassName}__availability-indicator`,
              )}
            >
              {" "}
              Disponible
            </span>
          )}
        </div>
      }
      title={
        mode === "map-preview" ? (
          <div className={fr.cx("fr-text--md", "fr-m-0")}>{jobTitle}</div>
        ) : (
          jobTitle
        )
      }
      titleAs="h2"
      desc={
        <div className={fr.cx("fr-my-0")}>
          {establishmentName}
          {mode === "map-preview" && (
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
              {isInternalOfferDto(searchResult) && (
                <Badge small className="fr-my-0">
                  {remoteWorkModeLabels[searchResult.remoteWorkMode].label}
                </Badge>
              )}
            </div>
          )}
        </div>
      }
      end={
        mode === "map-preview" ? (
          <Button
            size="small"
            linkProps={{
              ...linkPropsHandlingNotAvailable,
              id: offerLinkId,
            }}
          >
            Voir l'offre
          </Button>
        ) : null
      }
    />
  );
};

export const SearchResult = memo(
  SearchResultComponent,
  (prevResult, nextResult) => equals(prevResult, nextResult),
);
