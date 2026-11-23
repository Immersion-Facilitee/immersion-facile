import { fr } from "@codegouvfr/react-dsfr";
import type { ReactNode } from "react";
import { ContentCard } from "react-design-system";
import {
  type ImmersionActivities,
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

const listMarkerPattern = /^[-•*]\s*/;

const toImmersionActivityLines = (
  immersionActivities: ImmersionActivities,
): string[] =>
  immersionActivities
    .split("\n")
    .map((line) => line.trim().replace(listMarkerPattern, ""))
    .filter((line) => line.length > 0);

const getImmersionActivities = ({
  appellations,
}: OfferDto): ImmersionActivities | undefined =>
  appellations.length === 1 ? appellations[0].immersionActivities : undefined;

const toImmersionActivitiesSection = (
  searchResult: OfferDto,
  appellationInformationUrl: string,
  ids: SearchResultDomIds,
): ReactNode => {
  const immersionActivities = getImmersionActivities(searchResult);
  if (!searchResult.voluntaryToImmersion && !immersionActivities) return null;
  return (
    <ImmersionActivitiesSection
      immersionActivities={immersionActivities}
      appellationInformationUrl={appellationInformationUrl}
      ids={ids}
    />
  );
};

const ImmersionActivitiesSection = ({
  immersionActivities,
  appellationInformationUrl,
  ids,
}: {
  immersionActivities: ImmersionActivities | undefined;
  appellationInformationUrl: string;
  ids: SearchResultDomIds;
}): ReactNode => {
  const lines = immersionActivities
    ? toImmersionActivityLines(immersionActivities)
    : [];

  if (lines.length === 0)
    return (
      <p className={fr.cx("fr-mb-0")}>
        {searchResultContent.job.noImmersionActivities}{" "}
        <a
          id={ids.noImmersionActivitiesAppellationInformationLink}
          href={appellationInformationUrl}
          target="_blank"
          rel="noreferrer"
        >
          {
            searchResultContent.job
              .noImmersionActivitiesAppellationInformationLink
          }
        </a>
        .
      </p>
    );

  return (
    <>
      <h3 className={fr.cx("fr-text--md", "fr-mb-1w")}>
        {searchResultContent.job.immersionActivitiesTitle}
      </h3>
      {lines.length === 1 ? (
        <p className={fr.cx("fr-mb-0")}>{lines[0]}</p>
      ) : (
        <ul className={fr.cx("fr-mb-0")}>
          {lines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      )}
    </>
  );
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
  const appellationInformationUrl = makeAppellationInformationUrl(rome);
  const links: JobInformationLink[] = [
    {
      id: searchResultIds.appellationInformationLink,
      label: searchResultContent.job.appellationInformationLink,
      href: appellationInformationUrl,
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
  const immersionActivitiesSection = toImmersionActivitiesSection(
    searchResult,
    appellationInformationUrl,
    searchResultIds,
  );

  if (asAccordion)
    return (
      <ContentCard title={title} accordionId={searchResultIds.jobAccordion}>
        {immersionActivitiesSection}
        <ul className={fr.cx("fr-raw-list", "fr-mt-2w")}>
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
    >
      {immersionActivitiesSection && (
        <div className={fr.cx("fr-mt-2w")}>{immersionActivitiesSection}</div>
      )}
    </ContentCard>
  );
};
