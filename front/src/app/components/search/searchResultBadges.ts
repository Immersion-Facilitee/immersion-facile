import type { FrIconClassName } from "@codegouvfr/react-dsfr";
import { isSuperEstablishment, type OfferDto } from "shared";
import { searchResultContent } from "src/app/contents/search/content";

type SearchResultBadge = {
  modifier: "super-enterprise" | "rqth";
  label: string;
  description: string;
  iconId: FrIconClassName;
};

const { badges } = searchResultContent;

export const getSearchResultBadges = ({
  establishmentScore,
  fitForDisabledWorkers,
}: OfferDto): SearchResultBadge[] => [
  ...(isSuperEstablishment(establishmentScore)
    ? [
        {
          modifier: "super-enterprise",
          ...badges.superEstablishment,
          iconId: "fr-icon-star-line",
        } satisfies SearchResultBadge,
      ]
    : []),
  ...(fitForDisabledWorkers === "yes-declared-only"
    ? [
        {
          modifier: "rqth",
          ...badges.disabledWorkersDeclared,
          iconId: "fr-icon-accessibility-line",
        } satisfies SearchResultBadge,
      ]
    : []),
  ...(fitForDisabledWorkers === "yes-ft-certified"
    ? [
        {
          modifier: "rqth",
          ...badges.disabledWorkersCertified,
          iconId: "fr-icon-accessibility-line",
        } satisfies SearchResultBadge,
      ]
    : []),
];
