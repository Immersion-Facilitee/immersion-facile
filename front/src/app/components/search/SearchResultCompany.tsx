import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { makeSiretDescriptionLink, type OfferDto } from "shared";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultCard.scss";
import "./SearchResultCompany.scss";

const componentRootClassName = "im-search-result-company";

type SearchResultCompanyProps = {
  searchResult: OfferDto;
};

export const SearchResultCompany = ({
  searchResult,
}: SearchResultCompanyProps) => {
  const { cx } = useStyles();
  const { nafLabel, numberOfEmployeeRange, siret } = searchResult;
  const items: { label: string; value: ReactNode }[] = [
    { label: "Secteur d'activité (NAF)", value: nafLabel },
    ...(numberOfEmployeeRange
      ? [{ label: "Effectif", value: `${numberOfEmployeeRange} salariés` }]
      : []),
    {
      label: "SIRET",
      value: (
        <a
          className={fr.cx("fr-link", "fr-link--sm")}
          href={makeSiretDescriptionLink(siret)}
          target="_blank"
          rel="noreferrer"
          title={`SIRET ${siret} - nouvelle fenêtre`}
        >
          {siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4")}
        </a>
      ),
    },
  ];
  return (
    <section
      className={cx(
        "im-search-result-card",
        componentRootClassName,
        fr.cx("fr-p-3w", "fr-mb-3w"),
      )}
    >
      <h2 className={fr.cx("fr-h5", "fr-mb-1w")}>L'entreprise</h2>
      <dl className={fr.cx("fr-mb-0", "fr-pl-0")}>
        {items.map(({ label, value }) => (
          <div
            key={label}
            className={cx(`${componentRootClassName}__item`, fr.cx("fr-py-1w"))}
          >
            <dt className={fr.cx("fr-text--xs", "fr-mb-0")}>{label}</dt>
            <dd
              className={fr.cx(
                "fr-text--sm",
                typeof value === "string" && "fr-text--bold",
                "fr-mb-0",
                "fr-pl-0",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
