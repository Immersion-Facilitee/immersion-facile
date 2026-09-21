import { fr } from "@codegouvfr/react-dsfr";
import { BorderedSection } from "react-design-system";
import { type DiscussionReadDto, frontRoutes } from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";

export const EstablishmentSummary = ({
  discussion,
}: {
  discussion: DiscussionReadDto;
}) => {
  const relatedOffer = useAppSelector(searchSelectors.currentSearchResult);

  return (
    <BorderedSection>
      <h3 className={fr.cx("fr-h6")}>Entreprise</h3>

      <ul className={fr.cx("fr-raw-list")}>
        {relatedOffer?.website && (
          <li className={fr.cx("fr-mb-1w")}>
            <a
              href={relatedOffer.website}
              title="Site web de l'entreprise"
              target="_blank"
              rel="noreferrer"
            >
              Site web de l'entreprise
            </a>
          </li>
        )}

        <li>{discussion.businessName}</li>

        <li className={fr.cx("fr-mt-1w")}>
          <a
            target="_blank"
            rel="noreferrer"
            href={
              frontRoutes.searchResult({
                appellationCode: [discussion.appellation.appellationCode],
                siret: discussion.siret,
                location: discussion.locationId,
              }).href
            }
            className={fr.cx("fr-link")}
          >
            Voir l'offre
          </a>
        </li>
      </ul>
    </BorderedSection>
  );
};
