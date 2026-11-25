import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { ContentCard } from "react-design-system";
import {
  makeSiretDescriptionLink,
  type OfferDto,
  toFormatedTextSiret,
} from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import type { SearchResultDomIds } from "./searchResult.helpers";

const content = searchResultContent.company;

type SearchResultCompanyProps = {
  searchResult: OfferDto;
  searchResultIds: SearchResultDomIds;
};

export const SearchResultCompany = ({
  searchResult,
  searchResultIds,
}: SearchResultCompanyProps): ReactNode => {
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
          id={searchResultIds.siretLink}
          className={fr.cx("fr-link", "fr-link--sm")}
          href={makeSiretDescriptionLink(siret)}
          target="_blank"
          rel="noreferrer"
        >
          {toFormatedTextSiret(siret)}
        </a>
      ),
    },
  ];
  return (
    <ContentCard title={content.title} last>
      <dl className={fr.cx("fr-mt-n1w", "fr-mb-0", "fr-pl-0")}>
        {items.map(({ label, value }, index) => (
          <div
            key={label}
            className={fr.cx("fr-py-1w", index !== 0 && "fr-hr")}
          >
            <dt className={fr.cx("fr-text--xs", "fr-mb-0", "fr-pb-0")}>
              {label}
            </dt>
            <dd
              className={fr.cx(
                "fr-text--sm",
                typeof value === "string" && "fr-text--bold",
                "fr-mb-0",
                "fr-p-0",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </ContentCard>
  );
};
