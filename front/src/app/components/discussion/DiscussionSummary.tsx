import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { BorderedSection } from "react-design-system";
import {
  type DiscussionReadDto,
  type ExchangeRole,
  getFormattedFirstnameAndLastname,
  immersionDurationLabels,
} from "shared";

const {
  Component: DiscussionSummaryModalComponent,
  open: openDiscussionSummaryModal,
} = createModal({ isOpenedByDefault: false, id: "discussion-summary-modal" });

export const DiscussionSummary = ({
  viewer,
  displayMode,
  discussion,
}: {
  viewer: ExchangeRole;
  displayMode: "full" | "preview";
  discussion: DiscussionReadDto;
}) => (
  <BorderedSection className={fr.cx("fr-mb-2w")}>
    <h6 className={fr.cx("fr-h6", "fr-mb-2w")}>
      {viewer === "potentialBeneficiary"
        ? "Ma candidature"
        : getFormattedFirstnameAndLastname({
            firstname: discussion.potentialBeneficiary.firstName,
            lastname: discussion.potentialBeneficiary.lastName,
          })}
    </h6>
    <ul className={fr.cx("fr-raw-list", "fr-mb-2w")}>
      <li>
        <strong>
          <span
            className={fr.cx(
              "fr-icon-calendar-line",
              "fr-icon--sm",
              "fr-mr-1w",
            )}
          />
          Période
        </strong>
        &nbsp;: {discussion.potentialBeneficiary.datePreferences}
      </li>
      {discussion.kind === "IF" && (
        <li>
          <strong>
            <span
              className={fr.cx("fr-icon-time-line", "fr-icon--sm", "fr-mr-1w")}
            />
            Durée
          </strong>
          &nbsp;:{" "}
          {
            immersionDurationLabels[
              discussion.potentialBeneficiary.immersionDuration
            ]
          }
        </li>
      )}
    </ul>

    {discussion.kind === "IF" && (
      <>
        {displayMode === "full" && (
          <>
            <div className={fr.cx("fr-mb-2w")}>
              <strong>Pourquoi cette immersion</strong>
              <p className={fr.cx("fr-mb-0")}>
                {discussion.potentialBeneficiary.motivation}
              </p>
            </div>
            <div className={fr.cx("fr-mb-2w")}>
              <strong>Compétences, expériences et savoir-être</strong>
              <p className={fr.cx("fr-mb-0")}>
                {
                  discussion.potentialBeneficiary
                    .experienceAdditionalInformation
                }
              </p>
            </div>
          </>
        )}
        <a
          href={discussion.potentialBeneficiary.resumeLink}
          target="_blank"
          rel="noreferrer"
          className={fr.cx("fr-link")}
        >
          CV ou profil en ligne
        </a>
        {displayMode === "preview" && (
          <div
            className={fr.cx("fr-btns-group", "fr-btns-group--sm", "fr-mt-2w")}
          >
            <Button
              size="small"
              priority="tertiary"
              onClick={openDiscussionSummaryModal}
              className={fr.cx("fr-mb-0")}
            >
              En savoir plus
            </Button>
          </div>
        )}
      </>
    )}
  </BorderedSection>
);

export const DiscussionSummaryModal = DiscussionSummaryModalComponent;
