import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { ContentCard } from "react-design-system";
import {
  makeAppellationInformationUrl,
  makeNafClassInformationUrl,
  type OfferDto,
} from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import type { SearchResultDomIds } from "./searchResult.helpers";

type SearchResultJobProps = {
  searchResult: OfferDto;
  asAccordion: boolean;
  searchResultIds: SearchResultDomIds;
};

type JobInformationLink = {
  id: string;
  label: string;
  href: string;
};

export const SearchResultJob = ({
  searchResult,
  asAccordion,
  searchResultIds,
}: SearchResultJobProps): ReactNode => {
  const { cx } = useStyles();
  const { appellations, romeLabel, rome, naf } = searchResult;
  const title =
    appellations.length > 0
      ? appellations.map(({ appellationLabel }) => appellationLabel).join(", ")
      : romeLabel;
  const links: JobInformationLink[] = [
    {
      id: searchResultIds.appellationInformationLink,
      label: searchResultContent.job.appellationInformationLink,
      href: makeAppellationInformationUrl(rome),
    },
    {
      id: searchResultIds.nafInformationLink,
      label: searchResultContent.job.nafInformationLink,
      href: makeNafClassInformationUrl(naf),
    },
  ];
  const renderLink = (
    { id, label, href }: JobInformationLink,
    className?: string,
  ): ReactNode => (
    <a
      key={id}
      id={id}
      className={cx(fr.cx("fr-link", "fr-link--sm"), className)}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );

  if (asAccordion)
    return (
      <ContentCard title={title} accordionId={searchResultIds.jobAccordion}>
        <ul className={fr.cx("fr-raw-list")}>
          {links.map((link, index) => (
            <li key={link.id} className={fr.cx(index > 0 && "fr-mt-1w")}>
              {renderLink(link)}
            </li>
          ))}
        </ul>
      </ContentCard>
    );

  return (
    <ContentCard
      title={title}
      titleAside={links.map((link, index) =>
        renderLink(link, fr.cx(index < links.length - 1 && "fr-mr-2w")),
      )}
    />
  );
};
