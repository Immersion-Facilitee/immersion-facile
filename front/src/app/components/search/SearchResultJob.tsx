import { fr } from "@codegouvfr/react-dsfr";
import {
  makeAppellationInformationUrl,
  makeNafClassInformationUrl,
  type OfferDto,
} from "shared";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultCard.scss";

type SearchResultJobProps = {
  searchResult: OfferDto;
};

export const SearchResultJob = ({ searchResult }: SearchResultJobProps) => {
  const { cx } = useStyles();
  const { appellations, romeLabel, rome, naf } = searchResult;
  return (
    <section
      className={cx("im-search-result-card", fr.cx("fr-p-3w", "fr-mb-3w"))}
    >
      <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
        <h2 className={fr.cx("fr-h5", "fr-col", "fr-mb-0", "fr-mr-2w")}>
          {appellations.length > 0
            ? appellations
                .map(({ appellationLabel }) => appellationLabel)
                .join(", ")
            : romeLabel}
        </h2>
        <a
          className={fr.cx("fr-link", "fr-link--sm", "fr-mr-2w")}
          href={makeAppellationInformationUrl(rome)}
          target="_blank"
          rel="noreferrer"
          title="Fiche métier France Travail - nouvelle fenêtre"
        >
          Fiche métier France Travail
        </a>
        <a
          className={fr.cx("fr-link", "fr-link--sm")}
          href={makeNafClassInformationUrl(naf)}
          target="_blank"
          rel="noreferrer"
          title="Données INSEE - nouvelle fenêtre"
        >
          Données INSEE
        </a>
      </div>
    </section>
  );
};
