import { fr } from "@codegouvfr/react-dsfr";
import type { OfferDto } from "shared";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultAbout.scss";
import "./SearchResultCard.scss";
import { getSearchResultBadges } from "./searchResultBadges";

const componentRootClassName = "im-search-result-about";

type SearchResultAboutProps = {
  searchResult: OfferDto;
};

export const SearchResultAbout = ({ searchResult }: SearchResultAboutProps) => {
  const { cx } = useStyles();
  const badges = getSearchResultBadges(searchResult);
  const { additionalInformation } = searchResult;
  if (!additionalInformation && badges.length === 0) return null;
  return (
    <section
      className={cx("im-search-result-card", fr.cx("fr-p-3w", "fr-mb-3w"))}
    >
      <h2 className={fr.cx("fr-h5", "fr-mb-2w")}>À propos de l’entreprise</h2>
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
    </section>
  );
};
