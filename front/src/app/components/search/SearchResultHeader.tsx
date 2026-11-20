import { type FrIconClassName, fr } from "@codegouvfr/react-dsfr";
import type { TagProps } from "@codegouvfr/react-dsfr/Tag";
import { TagsGroup } from "@codegouvfr/react-dsfr/TagsGroup";
import type { ReactNode } from "react";
import {
  isInternalOfferDto,
  isPhysicalWorkMode,
  type OfferDto,
  remoteWorkModeLabels,
} from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import { SearchResultAddress } from "./SearchResultAddress";
import "./SearchResultHeader.scss";
import type { SearchResultDomIds } from "./searchResult.helpers";
import { getSearchResultBadges } from "./searchResultBadges";

const componentRootClassName = "im-search-result-header";
const content = searchResultContent.header;
const lbbIconId: FrIconClassName = "fr-icon-draft-line";

type SearchResultHeaderProps = {
  searchResult: OfferDto;
  ids: SearchResultDomIds;
};

export const SearchResultHeader = ({
  searchResult,
  ids,
}: SearchResultHeaderProps): ReactNode => {
  const { cx } = useStyles();
  const tagClassName = `${componentRootClassName}__tag`;
  const isPhysical =
    !isInternalOfferDto(searchResult) ||
    isPhysicalWorkMode(searchResult.remoteWorkMode);
  const { address, numberOfEmployeeRange, website } = searchResult;

  const [firstTag, ...otherTags]: TagProps[] = [
    ...getSearchResultBadges(searchResult).map(
      (badge): TagProps => ({
        children: badge.label,
        iconId: badge.iconId,
        className: cx(tagClassName, `${tagClassName}--${badge.modifier}`),
      }),
    ),
    ...(searchResult.voluntaryToImmersion
      ? []
      : [
          {
            children: content.lbbTag,
            iconId: lbbIconId,
            className: cx(tagClassName, `${tagClassName}--lbb`),
          },
        ]),
    ...(isPhysical
      ? [
          {
            children: `${address.city} (${address.departmentCode})`,
            className: tagClassName,
          },
        ]
      : []),
    ...(isInternalOfferDto(searchResult)
      ? [
          {
            children: remoteWorkModeLabels[searchResult.remoteWorkMode].label,
            className: tagClassName,
          },
        ]
      : []),
    ...(numberOfEmployeeRange
      ? [
          {
            children: content.employeesCount(numberOfEmployeeRange),
            className: tagClassName,
          },
        ]
      : []),
  ];

  return (
    <div className={fr.cx("fr-mb-4w")}>
      <h1 className={fr.cx("fr-mb-2w", "fr-mt-2w", "fr-mt-md-4w")}>
        {searchResult.customizedName ?? searchResult.name}
      </h1>
      {firstTag && (
        <TagsGroup
          smallTags
          tags={[firstTag, ...otherTags]}
          className={cx(`${componentRootClassName}__tags`, fr.cx("fr-mb-2w"))}
        />
      )}
      {(isPhysical || website) && (
        <p className={fr.cx("fr-mb-0")}>
          {isPhysical && <SearchResultAddress address={address} />}
          {isPhysical && website && " • "}
          {website && (
            <a
              id={ids.websiteLink}
              className={fr.cx("fr-link")}
              href={website}
              target="_blank"
              rel="noreferrer"
            >
              {content.websiteLink}
            </a>
          )}
        </p>
      )}
    </div>
  );
};
