import { fr } from "@codegouvfr/react-dsfr";
import type { TagProps } from "@codegouvfr/react-dsfr/Tag";
import { TagsGroup } from "@codegouvfr/react-dsfr/TagsGroup";
import {
  isInternalOfferDto,
  isPhysicalWorkMode,
  type OfferDto,
  remoteWorkModeLabels,
} from "shared";
import { useStyles } from "tss-react/dsfr";
import { SearchResultAddress } from "./SearchResultAddress";
import "./SearchResultHeader.scss";
import { getSearchResultBadges } from "./searchResultBadges";

const componentRootClassName = "im-search-result-header";

type SearchResultHeaderProps = {
  searchResult: OfferDto;
};

export const SearchResultHeader = ({
  searchResult,
}: SearchResultHeaderProps) => {
  const { cx } = useStyles();
  const tagClassName = `${componentRootClassName}__tag`;
  const isPhysical =
    !isInternalOfferDto(searchResult) ||
    isPhysicalWorkMode(searchResult.remoteWorkMode);
  const { address, numberOfEmployeeRange, website } = searchResult;

  const tags: TagProps[] = [
    ...getSearchResultBadges(searchResult).map(
      ({ label, iconId, modifier }): TagProps => ({
        children: label,
        iconId,
        className: cx(tagClassName, `${tagClassName}--${modifier}`),
      }),
    ),
    ...(searchResult.voluntaryToImmersion
      ? []
      : [
          {
            children: "Tentez votre chance",
            iconId: "fr-icon-draft-line",
            className: cx(tagClassName, `${tagClassName}--lbb`),
          } satisfies TagProps,
        ]),
    ...(isPhysical
      ? [{ children: `${address.city} (${address.departmentCode})` }]
      : []),
    ...(isInternalOfferDto(searchResult)
      ? [{ children: remoteWorkModeLabels[searchResult.remoteWorkMode].label }]
      : []),
    ...(numberOfEmployeeRange
      ? [{ children: `${numberOfEmployeeRange} salariés` }]
      : []),
  ].map((tag) => ({ className: tagClassName, ...tag }));

  return (
    <div className={fr.cx("fr-mb-4w")}>
      <h1 className={fr.cx("fr-mb-2w")}>
        {searchResult.customizedName ?? searchResult.name}
      </h1>
      {tags.length > 0 && (
        <TagsGroup
          smallTags
          tags={tags as [TagProps, ...TagProps[]]}
          className={cx(`${componentRootClassName}__tags`, fr.cx("fr-mb-1w"))}
        />
      )}
      {(isPhysical || website) && (
        <p className={fr.cx("fr-mb-0")}>
          {isPhysical && <SearchResultAddress address={address} />}
          {isPhysical && website && " • "}
          {website && (
            <a
              className={fr.cx("fr-link")}
              href={website}
              target="_blank"
              rel="noreferrer"
              title="Site web - nouvelle fenêtre"
            >
              Site web
            </a>
          )}
        </p>
      )}
    </div>
  );
};
