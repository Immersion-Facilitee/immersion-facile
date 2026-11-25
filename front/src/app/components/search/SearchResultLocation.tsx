import { fr } from "@codegouvfr/react-dsfr";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { ReactNode } from "react";
import { ContentCard } from "react-design-system";
import { getMapsLink, type OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { getIconMarker, SearchMiniMap } from "./SearchMiniMap";
import { SearchResultAddress } from "./SearchResultAddress";
import type { SearchResultDomIds } from "./searchResult.helpers";

const componentRootClassName = "im-search-result-location";
const miniMapMarkerKey = "single-result-mini-map-marker";
const content = searchResultContent.location;

type SearchResultLocationProps = {
  searchResult: OfferDto;
  isExternal: boolean;
  searchResultIds: SearchResultDomIds;
};

export const SearchResultLocation = ({
  searchResult,
  isExternal,
  searchResultIds,
}: SearchResultLocationProps): ReactNode => {
  const { address, position } = searchResult;
  return (
    <ContentCard title={content.title} className={componentRootClassName}>
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
              id: searchResultIds.googleMapsLink,
              href: getMapsLink(searchResult) ?? "",
              target: "_blank",
              rel: "noreferrer",
            },
            children: content.googleMapsLink,
          },
        ]}
      />
    </ContentCard>
  );
};
