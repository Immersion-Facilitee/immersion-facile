import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { makeSiretDescriptionLink, type OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import {
  makeExternalLinkProps,
  SearchResultCard,
  type SearchResultDomIds,
} from "./SearchResultCard";
import "./SearchResultCompany.scss";

const componentRootClassName = "im-search-result-company";
const content = searchResultContent.company;

type SearchResultCompanyProps = {
  searchResult: OfferDto;
  ids: SearchResultDomIds;
};

export const SearchResultCompany = ({
  searchResult,
  ids,
}: SearchResultCompanyProps): JSX.Element => {
  const { cx } = useStyles();
  const { nafLabel, numberOfEmployeeRange, siret } = searchResult;
  const items: { label: string; value: ReactNode }[] = [
    { label: content.nafLabel, value: nafLabel },
    ...(numberOfEmployeeRange
      ? [
          {
            label: content.employeesLabel,
            value: searchResultContent.header.employeesCount(
              numberOfEmployeeRange,
            ),
          },
        ]
      : []),
    {
      label: content.siretLabel,
      value: (
        <a
          id={ids.siretLink}
          className={fr.cx("fr-link", "fr-link--sm")}
          href={makeSiretDescriptionLink(siret)}
          {...makeExternalLinkProps(`${content.siretLabel} ${siret}`)}
        >
          {siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4")}
        </a>
      ),
    },
  ];
  return (
    <SearchResultCard title={content.title} className={componentRootClassName}>
      <dl className={fr.cx("fr-mt-n1w", "fr-mb-0", "fr-pl-0")}>
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
    </SearchResultCard>
  );
};
