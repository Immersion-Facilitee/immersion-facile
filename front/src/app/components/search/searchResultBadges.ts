import type { FrIconClassName } from "@codegouvfr/react-dsfr";
import { isSuperEstablishment, type OfferDto } from "shared";

type SearchResultBadge = {
  modifier: "super-enterprise" | "rqth";
  label: string;
  description: string;
  iconId: FrIconClassName;
};

export const getSearchResultBadges = ({
  establishmentScore,
  fitForDisabledWorkers,
}: OfferDto): SearchResultBadge[] => [
  ...(isSuperEstablishment(establishmentScore)
    ? [
        {
          modifier: "super-enterprise",
          label: "Super entreprise",
          description:
            "Cette entreprise a déjà accueilli des immersions et répond activement aux candidatures.",
          iconId: "fr-icon-star-line",
        } satisfies SearchResultBadge,
      ]
    : []),
  ...(fitForDisabledWorkers === "yes-declared-only"
    ? [
        {
          modifier: "rqth",
          label: "Personnes en situation de handicap bienvenues",
          description:
            "L’entreprise a indiqué être prête à accueillir une personne en situation de handicap.",
          iconId: "fr-icon-accessibility-line",
        } satisfies SearchResultBadge,
      ]
    : []),
  ...(fitForDisabledWorkers === "yes-ft-certified"
    ? [
        {
          modifier: "rqth",
          label: "Reconnue handi-engagée",
          description:
            "L’entreprise est reconnue handi-engagée pour l’accueil de personnes en situation de handicap.",
          iconId: "fr-icon-accessibility-line",
        } satisfies SearchResultBadge,
      ]
    : []),
];
