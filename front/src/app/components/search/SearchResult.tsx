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

export type EnterpriseSearchResultProps = {
  searchResult: OfferDto;
  linkProps: Link;
  illustration?: ReactNode;
  disableButton?: boolean;
  preview?: boolean;
  showDistance?: boolean;
};

const componentRootClassName = "im-search-result";

const SearchResultComponent = ({
  linkProps,
  searchResult,
  illustration,
}: EnterpriseSearchResultProps) => {
  const { cx } = useStyles();
  const {
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

  return (
    <Card
      nativeDivProps={{
        "aria-disabled": isNotAvailableOffer,
      }}
      className={cx(
        componentRootClassName,
        isNotAvailableOffer && `${componentRootClassName}--unavailable`,
      )}
      title={jobTitle}
      desc={establishmentName}
      linkProps={{
        ...linkPropsHandlingNotAvailable,
        id: voluntaryToImmersion
          ? `${domElementIds.search.searchResultButton}-${locationId}`
          : `${domElementIds.search.lbbSearchResultButton}-${locationId}`,
      }}
      enlargeLink
      titleAs="h2"
      imageComponent={illustration}
      detail={
        isNotAvailableOffer ? (
          <span
            className={cx(
              fr.cx("fr-icon-stop-circle-fill", "fr-icon--sm", "fr-mt-1w"),
              `${componentRootClassName}__availability-indicator`,
            )}
          >
            {" "}
            Mise en relation temporairement indisponible
          </span>
        ) : (
          <span
            className={cx(
              fr.cx("fr-icon-success-fill", "fr-icon--sm", "fr-mt-1w"),
              `${componentRootClassName}__availability-indicator`,
            )}
          >
            {" "}
            Mise en relation disponible
          </span>
        )
      }
      start={
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
      }
    />
  );
};

export const SearchResult = memo(
  SearchResultComponent,
  (prevResult, nextResult) => equals(prevResult, nextResult),
);
