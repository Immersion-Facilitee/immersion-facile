import { fr } from "@codegouvfr/react-dsfr";
import type { TagProps } from "@codegouvfr/react-dsfr/Tag";
import { TagsGroup } from "@codegouvfr/react-dsfr/TagsGroup";
import {
  isInternalOfferDto,
  isPhysicalWorkMode,
  type OfferDto,
  remoteWorkModeLabels,
} from "shared";
import { searchResultContent } from "src/app/contents/search/content";
import { useStyles } from "tss-react/dsfr";
import { SearchResultAddress } from "./SearchResultAddress";
import {
  makeExternalLinkProps,
  type SearchResultDomIds,
} from "./SearchResultCard";
import "./SearchResultHeader.scss";
import { getSearchResultBadges } from "./searchResultBadges";

const componentRootClassName = "im-search-result-header";
const content = searchResultContent.header;

type SearchResultHeaderProps = {
  searchResult: OfferDto;
  ids: SearchResultDomIds;
};

export const SearchResultHeader = ({
  searchResult,
  ids,
}: SearchResultHeaderProps): JSX.Element => {
  const { cx } = useStyles();
  const tagClassName = `${componentRootClassName}__tag`;
  const isPhysical =
    !isInternalOfferDto(searchResult) ||
    isPhysicalWorkMode(searchResult.remoteWorkMode);
  const { address, numberOfEmployeeRange, website } = searchResult;

  const tags: TagProps[] = [];
  for (const tag of getSearchResultBadges(searchResult)) {
    tags.push({
      children: tag.label,
      iconId: tag.iconId,
      className: cx(tagClassName, `${tagClassName}--${tag.modifier}`),
    });
  }
  if (searchResult.voluntaryToImmersion) {
    tags.push({
      children: content.lbbTag,
      iconId: "fr-icon-draft-line",
      className: cx(tagClassName, `${tagClassName}--lbb`),
    });
  }
  if (isPhysical) {
    tags.push({
      children: `${address.city} (${address.departmentCode})`,
      className: tagClassName,
    });
  }
  if (isInternalOfferDto(searchResult)) {
    tags.push({
      children: remoteWorkModeLabels[searchResult.remoteWorkMode].label,
      className: tagClassName,
    });
  }

  if (numberOfEmployeeRange) {
    tags.push({
      children: content.employeesCount(numberOfEmployeeRange),
      className: tagClassName,
    });
  }

  const [firstTag, ...otherTags] = tags;

  return (
    <div className={fr.cx("fr-mb-4w")}>
      <h1 className={fr.cx("fr-mb-2w")}>
        {searchResult.customizedName ?? searchResult.name}
      </h1>
      {firstTag && (
        <TagsGroup
          smallTags
          tags={[firstTag, ...otherTags]}
          className={cx(`${componentRootClassName}__tags`, fr.cx("fr-mb-1w"))}
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
              {...makeExternalLinkProps(content.websiteLink)}
            >
              {content.websiteLink}
            </a>
          )}
        </p>
      )}
    </div>
  );
};
