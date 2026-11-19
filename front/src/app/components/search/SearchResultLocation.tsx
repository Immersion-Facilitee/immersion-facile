import { fr } from "@codegouvfr/react-dsfr";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { getMapsLink, type OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { getIconMarker, SearchMiniMap } from "./SearchMiniMap";
import { SearchResultAddress } from "./SearchResultAddress";
import {
  makeExternalLinkProps,
  SearchResultCard,
  type SearchResultDomIds,
} from "./SearchResultCard";

const componentRootClassName = "im-search-result-location";
const miniMapMarkerKey = "single-result-mini-map-marker";
const content = searchResultContent.location;

type SearchResultLocationProps = {
  searchResult: OfferDto;
  isExternal: boolean;
  ids: SearchResultDomIds;
};

export const SearchResultLocation = ({
  searchResult,
  isExternal,
  ids,
}: SearchResultLocationProps): JSX.Element => {
  const { address, position } = searchResult;
  return (
    <SearchResultCard title={content.title} className={componentRootClassName}>
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
        className={fr.cx("fr-mb-n2w")}
        buttons={[
          {
            priority: "tertiary",
            linkProps: {
              id: ids.googleMapsLink,
              href: getMapsLink(searchResult) ?? "",
              ...makeExternalLinkProps(content.googleMapsLink),
            },
            children: content.googleMapsLink,
          },
        ]}
      />
    </SearchResultCard>
  );
};
