import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { ContentCard } from "react-design-system";
import type { OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import type { SearchResultDomIds } from "./searchResult.helpers";
import { getSearchResultBadges } from "./searchResultBadges";

type SearchResultAboutProps = {
  searchResult: OfferDto;
  asAccordion: boolean;
  ids: SearchResultDomIds;
};

export const SearchResultAbout = ({
  searchResult,
  asAccordion,
  ids,
}: SearchResultAboutProps): ReactNode => {
  const badges = getSearchResultBadges(searchResult);
  const { additionalInformation } = searchResult;
  if (!additionalInformation && badges.length === 0) return null;
  return (
    <ContentCard
      title={searchResultContent.about.title}
      accordionId={asAccordion ? ids.aboutAccordion : undefined}
    >
      {additionalInformation && (
        <p className={fr.cx("fr-mb-0")}>{additionalInformation}</p>
      )}
      {badges.length > 0 && (
        <ul
          className={fr.cx(
            "fr-raw-list",
            "fr-col-6",
            !!additionalInformation && "fr-mt-3w",
          )}
        >
          {badges.map(({ label, description, iconId }, index) => (
            <li
              key={label}
              className={fr.cx("fr-grid-row", index > 0 && "fr-mt-4w")}
            >
              <span className={fr.cx(iconId, "fr-mr-1w")} aria-hidden="true" />
              <div className={fr.cx("fr-col")}>
                <p className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-0")}>
                  {label}
                </p>
                <p className={fr.cx("fr-text--sm", "fr-mb-0")}>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ContentCard>
  );
};
