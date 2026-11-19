import { fr } from "@codegouvfr/react-dsfr";
import {
  makeAppellationInformationUrl,
  makeNafClassInformationUrl,
  type OfferDto,
} from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import {
  makeExternalLinkProps,
  SearchResultCard,
  type SearchResultDomIds,
} from "./SearchResultCard";

type SearchResultJobProps = {
  searchResult: OfferDto;
  asAccordion: boolean;
  ids: SearchResultDomIds;
};

type JobInformationLink = {
  id: string;
  label: string;
  href: string;
};

export const SearchResultJob = ({
  searchResult,
  asAccordion,
  ids,
}: SearchResultJobProps): JSX.Element => {
  const { cx } = useStyles();
  const { appellations, romeLabel, rome, naf } = searchResult;
  const title =
    appellations.length > 0
      ? appellations.map(({ appellationLabel }) => appellationLabel).join(", ")
      : romeLabel;
  const links: JobInformationLink[] = [
    {
      id: ids.appellationInformationLink,
      label: searchResultContent.job.appellationInformationLink,
      href: makeAppellationInformationUrl(rome),
    },
    {
      id: ids.nafInformationLink,
      label: searchResultContent.job.nafInformationLink,
      href: makeNafClassInformationUrl(naf),
    },
  ];
  const renderLink = (
    { id, label, href }: JobInformationLink,
    className?: string,
  ): JSX.Element => (
    <a
      key={id}
      id={id}
      className={cx(fr.cx("fr-link", "fr-link--sm"), className)}
      href={href}
      {...makeExternalLinkProps(label)}
    >
      {label}
    </a>
  );

  if (asAccordion)
    return (
      <SearchResultCard title={title} accordionId={ids.jobAccordion}>
        <ul className={fr.cx("fr-raw-list")}>
          {links.map((link, index) => (
            <li key={link.id} className={fr.cx(index > 0 && "fr-mt-1w")}>
              {renderLink(link)}
            </li>
          ))}
        </ul>
      </SearchResultCard>
    );

  return (
    <SearchResultCard
      title={title}
      titleAside={links.map((link, index) =>
        renderLink(link, fr.cx(index < links.length - 1 && "fr-mr-2w")),
      )}
    />
  );
};
