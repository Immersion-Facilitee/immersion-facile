import { fr } from "@codegouvfr/react-dsfr";
import type { OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultAbout.scss";
import { SearchResultCard, type SearchResultDomIds } from "./SearchResultCard";
import { getSearchResultBadges } from "./searchResultBadges";

const componentRootClassName = "im-search-result-about";

type SearchResultAboutProps = {
  searchResult: OfferDto;
  asAccordion: boolean;
  ids: SearchResultDomIds;
};

export const SearchResultAbout = ({
  searchResult,
  asAccordion,
  ids,
}: SearchResultAboutProps): JSX.Element | null => {
  const { cx } = useStyles();
  const badges = getSearchResultBadges(searchResult);
  const { additionalInformation } = searchResult;
  if (!additionalInformation && badges.length === 0) return null;
  return (
    <SearchResultCard
      title={searchResultContent.about.title}
      accordionId={asAccordion ? ids.aboutAccordion : undefined}
    >
      {additionalInformation && (
        <p className={fr.cx("fr-mb-0")}>{additionalInformation}</p>
      )}
      {badges.length > 0 && (
        <ul
          className={cx(
            `${componentRootClassName}__badges`,
            fr.cx("fr-raw-list", !!additionalInformation && "fr-mt-3w"),
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
                <p
                  className={cx(
                    `${componentRootClassName}__badge-description`,
                    fr.cx("fr-text--sm", "fr-mb-0"),
                  )}
                >
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SearchResultCard>
  );
};
