import { fr } from "@codegouvfr/react-dsfr";
import {
  type DiscussionInList,
  type ExchangeRole,
  getFormattedFirstnameAndLastname,
} from "shared";
import { match } from "ts-pattern";

export const DiscussionCardContent = ({
  discussion,
  viewer,
}: {
  discussion: DiscussionInList;
  viewer: ExchangeRole;
}) => (
  <>
    {match(viewer)
      .with("establishment", () => (
        <dl className={fr.cx("fr-raw-list", "fr-mt-1w")}>
          <dt className={fr.cx("fr-text--xs", "fr-mb-0")}>Candidat</dt>
          <dd className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-1w")}>
            {getFormattedFirstnameAndLastname({
              firstname: discussion.potentialBeneficiary.firstName,
              lastname: discussion.potentialBeneficiary.lastName,
            })}
          </dd>
          <dt className={fr.cx("fr-text--xs", "fr-mb-0")}>Objectif</dt>
          <dd className={fr.cx("fr-text--sm", "fr-text--bold")}>
            {discussion.immersionObjective}
          </dd>
        </dl>
      ))
      .with("potentialBeneficiary", () => (
        <dl className={fr.cx("fr-raw-list", "fr-mt-1w")}>
          <dt className={fr.cx("fr-text--xs", "fr-mb-0")}>Métier</dt>
          <dd className={fr.cx("fr-text--sm", "fr-text--bold", "fr-mb-1w")}>
            {discussion.appellation.appellationLabel}
          </dd>
        </dl>
      ))
      .exhaustive()}
  </>
);
