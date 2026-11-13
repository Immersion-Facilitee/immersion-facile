import { fr } from "@codegouvfr/react-dsfr";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { getMapsLink, type OfferDto } from "shared";
import { useStyles } from "tss-react/dsfr";
import { getIconMarker, SearchMiniMap } from "./SearchMiniMap";
import { SearchResultAddress } from "./SearchResultAddress";
import "./SearchResultCard.scss";
import "./SearchResultLocation.scss";

const componentRootClassName = "im-search-result-location";
const miniMapMarkerKey = "single-result-mini-map-marker";

type SearchResultLocationProps = {
  searchResult: OfferDto;
  isExternal: boolean;
};

export const SearchResultLocation = ({
  searchResult,
  isExternal,
}: SearchResultLocationProps) => {
  const { cx } = useStyles();
  const { address, position } = searchResult;
  return (
    <section
      className={cx(
        "im-search-result-card",
        componentRootClassName,
        fr.cx("fr-pt-3w", "fr-px-3w", "fr-pb-1w", "fr-mb-3w"),
      )}
    >
      <h2 className={fr.cx("fr-h5", "fr-mb-2w")}>Localisation</h2>
      <SearchMiniMap
        kind="single"
        isExternal={isExternal}
        markerProps={{
          position: [position.lat, position.lon],
          icon: getIconMarker({
            activeMarkerKey: miniMapMarkerKey,
            isAvailable: true,
            isExternal,
            key: miniMapMarkerKey,
          }),
        }}
      />
      <p className={fr.cx("fr-mt-1w", "fr-mb-2w")}>
        <SearchResultAddress address={address} />
      </p>
      <ButtonsGroup
        buttonsSize="small"
        buttons={[
          {
            priority: "tertiary",
            linkProps: {
              href: getMapsLink(searchResult) ?? "",
              target: "_blank",
              rel: "noreferrer",
              title: "Ouvrir dans Google Maps - nouvelle fenêtre",
            },
            children: "Ouvrir dans Google Maps",
          },
        ]}
      />
    </section>
  );
};
