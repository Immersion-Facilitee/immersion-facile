import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { useState } from "react";
import {
  BorderedSection,
  ButtonWithSubMenu,
  DiscussionContentContainer,
  DiscussionExchangesContainer,
  SectionHighlight,
  useLayout,
} from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type AbsoluteUrl,
  absoluteUrlSchema,
  type ConnectedUser,
  type ConventionDraftDto,
  type DiscussionDisplayStatus,
  type DiscussionFollowUp,
  type DiscussionReadDto,
  discussionInListFromDiscussionReadDto,
  domElementIds,
  type ExchangeRole,
  frontRoutes,
  getDiscussionDisplayStatus,
  getDiscussionFollowUp,
  getFormattedFirstnameAndLastname,
  getLastExchange,
  isNotEmptyArray,
  makeEmptyConventionInitialValues,
  makeShouldEstablishmentBeReminded,
  toConventionDraftDto,
  toDisplayedPhoneNumber,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { makeConventionFromDiscussion } from "src/core-logic/domain/convention/convention.utils";
import { conventionDraftSelectors } from "src/core-logic/domain/convention/convention-draft/conventionDraft.selectors";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import { match, P } from "ts-pattern";
import {
  AcceptDiscussionModal,
  openAcceptDiscussionModal,
} from "../admin/establishments/AcceptDiscussionModal";
import {
  openRejectDiscussionModal,
  RejectDiscussionModal,
} from "../admin/establishments/RejectDiscussionModal";
import { Feedback } from "../feedback/Feedback";
import { contactModeToBadgeOptions } from "../immersion-offer/CreateDiscussionForm";
import { BeneficiaryGuideInformation } from "./BeneficiaryGuideInformation";
import { DiscussionFollowUpBadge } from "./badges/DiscussionFollowUpBadge";
import { DiscussionStatusBadge } from "./badges/DiscussionStatusBadge";
import { DiscussionSummary, DiscussionSummaryModal } from "./DiscussionSummary";
import { EstablishmentContactInformation } from "./EstablishmentContactInformation";
import { EstablishmentSummary } from "./EstablishmentSummary";
import { DiscussionExchangeMessageForm } from "./exchanges/DiscussionExchangeMessageForm";
import { DiscussionExchangesList } from "./exchanges/DiscussionExchangesList";

type ActivateConventionDraftButtonProps = Pick<
  DiscussionDetailsProps,
  "discussion" | "connectedUser"
>;

type ButtonPropsWithId = ButtonProps & { id: string };

const acceptButton = {
  id: domElementIds.establishmentDashboard.discussion.acceptDiscussionButton,
  priority: "secondary",
  type: "button",
  onClick: openAcceptDiscussionModal,
  children: "Marquer comme acceptée",
} satisfies ButtonPropsWithId;

const rejectButton = {
  id: domElementIds.establishmentDashboard.discussion.rejectDiscussionButton,
  priority: "tertiary",
  type: "button",
  onClick: openRejectDiscussionModal,
  children: "Marquer comme refusée",
} satisfies ButtonPropsWithId;

const getActivateDraftConventionButtonProps = ({
  discussion,
  connectedUser,
  saveConventionDraftThenRedirectRequested,
  saveConventionDraftIsLoading,
}: ActivateConventionDraftButtonProps & {
  saveConventionDraftThenRedirectRequested: ({
    conventionDraft,
    redirectUrl,
  }: {
    conventionDraft: ConventionDraftDto;
    redirectUrl: AbsoluteUrl;
  }) => void;
  saveConventionDraftIsLoading: boolean;
}): ButtonPropsWithId => {
  const internshipKind =
    discussion.kind === "IF" ? "immersion" : "mini-stage-cci";
  const conventionDraft = toConventionDraftDto({
    convention: makeConventionFromDiscussion({
      initialConvention: makeEmptyConventionInitialValues({
        internshipKind,
      }),
      discussion,
      connectedUser,
    }),
  });

  const redirectPath =
    internshipKind === "immersion"
      ? frontRoutes.conventionImmersion({
          skipIntro: true,
          conventionDraftId: conventionDraft.id,
          discussionId: discussion.id,
          at_campaign: "mise_en_relation_activation_convention",
        }).href
      : frontRoutes.conventionMiniStage({
          conventionDraftId: conventionDraft.id,
        }).href;

  return {
    id: domElementIds.establishmentDashboard.discussion.activateDraftConvention,
    priority: "primary",
    onClick: () => {
      saveConventionDraftThenRedirectRequested({
        conventionDraft,
        redirectUrl: absoluteUrlSchema.parse(
          `${window.location.origin}${redirectPath}`,
        ),
      });
    },
    children: "Pré-remplir une convention ",
    disabled: saveConventionDraftIsLoading,
  } satisfies ButtonPropsWithId;
};
const displayContactButton = (onClick: ButtonPropsWithId["onClick"]) =>
  ({
    id: domElementIds.beneficiaryDashboardDiscussions.displayPhoneContactButton,
    iconId: "ri-eye-line",
    priority: "secondary",
    type: "button",
    onClick,
    className: fr.cx("fr-my-1w"),
    children: "Afficher les informations de contact",
  }) satisfies ButtonPropsWithId;

const getDiscussionActionsButtons = ({
  discussion,
  connectedUser,
  viewer,
  makeInitiateConventionDraftButtonProps,
  displayStatus,
  followUp,
}: {
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
  viewer: ExchangeRole;
  makeInitiateConventionDraftButtonProps: (
    props: ActivateConventionDraftButtonProps,
  ) => ButtonPropsWithId;
  displayStatus: DiscussionDisplayStatus;
  followUp?: DiscussionFollowUp;
}): ButtonPropsWithId[] => {
  const initiateConventionButton = makeInitiateConventionDraftButtonProps({
    discussion,
    connectedUser,
  });
  const actionsFullSet = [initiateConventionButton, acceptButton, rejectButton];
  return match({ viewer, displayStatus, followUp })
    .with(
      {
        viewer: "potentialBeneficiary",
        displayStatus: "new",
      },
      () => [],
    )
    .with(
      {
        viewer: "establishment",
        displayStatus: "new",
      },
      () => actionsFullSet,
    )

    .with(
      {
        viewer: "establishment",
        displayStatus: "pending",
        followUp: "to-remind",
      },
      () => actionsFullSet,
    )
    .with(
      {
        viewer: "potentialBeneficiary",
        displayStatus: "pending",
      },
      () => [],
    )
    .with(
      {
        viewer: "establishment",
        displayStatus: "pending",
      },
      () => actionsFullSet,
    )
    .with(
      {
        viewer: "potentialBeneficiary",
        displayStatus: "accepted",
      },
      () => [initiateConventionButton],
    )
    .with(
      {
        viewer: "establishment",
        displayStatus: "accepted",
      },
      () => [initiateConventionButton],
    )
    .with(
      {
        viewer: "potentialBeneficiary",
        displayStatus: "rejected",
      },
      () => [],
    )
    .with(
      {
        viewer: "establishment",
        displayStatus: "rejected",
      },
      () => [],
    )

    .exhaustive();
};

const shouldShowDiscussionActionButtons = ({
  discussion,
  viewer,
}: {
  discussion: DiscussionReadDto;
  viewer: ExchangeRole;
}): boolean =>
  match(viewer)
    .with(
      "establishment",
      () => discussion.status === "PENDING" || discussion.status === "ACCEPTED",
    )
    .with(
      "potentialBeneficiary",
      () =>
        !(
          discussion.status === "ACCEPTED" &&
          discussion.candidateWarnedMethod !== null &&
          discussion.conventionId === undefined
        ),
    )
    .exhaustive();

const getDiscussionStatusUpdatedFeedbackMessage = (
  discussion: DiscussionReadDto,
): string =>
  match(discussion)
    .with({ status: "PENDING" }, () => "")
    .with(
      { status: "ACCEPTED" },
      () =>
        "La candidature a bien été marquée comme acceptée. Merci pour votre retour.",
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: "CANDIDATE_ALREADY_WARNED",
      },
      () =>
        "Candidature marquée comme refusée. Merci d’avoir indiqué que le candidat a bien été informé.",
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: P.union("UNABLE_TO_HELP", "NO_TIME", "OTHER"),
      },
      () =>
        "Candidature refusée, le message a bien été envoyé au candidat. Merci pour votre retour.",
    )
    .with(
      {
        status: "REJECTED",
        rejectionKind: "DEPRECATED",
      },
      () =>
        "Candidature automatiquement refusée par manque de réponse de votre part dans un délai de 3 mois.",
    )
    .exhaustive();

type DiscussionDetailsProps = {
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
  viewer: ExchangeRole;
};

export const DiscussionDetails = (
  props: DiscussionDetailsProps,
): JSX.Element => {
  const dispatch = useDispatch();
  const { discussion, connectedUser, viewer } = props;
  const saveConventionDraftIsLoading = useAppSelector(
    conventionDraftSelectors.isLoading,
  );
  const discussionEstablishmentContactInfo = useAppSelector(
    discussionSelectors.discussionEstablishmentContactInfo,
  );
  const [shouldShowContactInfo, setShouldShowContactInfo] =
    useState<boolean>(false);
  const { isLayoutDesktop } = useLayout();

  const [_firstExchange, ...restSortedExchanges] = [
    ...discussion.exchanges,
  ].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  const shouldShowFullSummary = restSortedExchanges.length === 0;

  const saveConventionDraftThenRedirectRequested = ({
    conventionDraft,
    redirectUrl,
  }: {
    conventionDraft: ConventionDraftDto;
    redirectUrl: AbsoluteUrl;
  }) =>
    dispatch(
      conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
        conventionDraft,
        redirectUrl,
        mode: "share",
        feedbackTopic: "convention-draft",
      }),
    );

  const displayStatus = getDiscussionDisplayStatus({
    discussion: discussionInListFromDiscussionReadDto(discussion),
  });
  const followUp = getDiscussionFollowUp({
    discussion: discussionInListFromDiscussionReadDto(discussion),
    isEstablishmentReachableByPhoneAfter15Days: true,
    now: new Date(),
    viewer,
  });

  const discussionActionsButtons = getDiscussionActionsButtons({
    discussion,
    connectedUser,
    viewer,
    displayStatus,
    followUp,
    makeInitiateConventionDraftButtonProps: (discussionProps) =>
      getActivateDraftConventionButtonProps({
        ...discussionProps,
        saveConventionDraftThenRedirectRequested,
        saveConventionDraftIsLoading,
      }),
  });
  const shouldShowDiscussionActions = shouldShowDiscussionActionButtons({
    discussion,
    viewer,
  });
  const isViewerBeneficiaryOrDiscussionRejected =
    viewer === "potentialBeneficiary" || discussion.status === "REJECTED";

  return (
    <>
      <Feedback
        topics={["dashboard-discussion-status-updated"]}
        render={({ title, level, message }) => (
          <Alert
            title={title}
            description={
              level === "error"
                ? message
                : getDiscussionStatusUpdatedFeedbackMessage(discussion)
            }
            severity={level}
            small
          />
        )}
      />

      <header>
        <Button
          type="button"
          onClick={() =>
            viewer === "establishment"
              ? frontRoutes.establishmentDashboardDiscussions().push()
              : frontRoutes.beneficiaryDashboardDiscussions().push()
          }
          priority="tertiary"
          iconId="fr-icon-arrow-left-line"
          iconPosition="left"
          className={fr.cx("fr-my-2w")}
        >
          Retour
        </Button>
        <SectionHighlight>
          {viewer === "establishment" ? (
            <h1 className={fr.cx("fr-h1")}>
              Candidature de {discussion.potentialBeneficiary.firstName}{" "}
              {discussion.potentialBeneficiary.lastName.toUpperCase()}
            </h1>
          ) : (
            <h1 className={fr.cx("fr-h1")}>
              Candidature pour {discussion.businessName}
            </h1>
          )}
          <p>
            {discussion.appellation.appellationLabel}
            {"  "}•{"  "}
            {discussion.potentialBeneficiary.immersionObjective}
          </p>
          <ul className={fr.cx("fr-badges-group", "fr-mt-1w")}>
            <li>
              <p
                {...contactModeToBadgeOptions[discussion.contactMode]}
                className={
                  contactModeToBadgeOptions[discussion.contactMode].className
                }
              />
            </li>
            <li>
              <DiscussionStatusBadge discussion={discussion} viewer={viewer} />
            </li>
            <li>
              <DiscussionFollowUpBadge
                key={discussion.id}
                discussion={discussion}
                isEstablishmentReachableByPhoneAfter15Days={
                  discussionEstablishmentContactInfo?.isEstablishmentReachableByPhoneAfter15Days ??
                  false
                }
                viewer={viewer}
              />
            </li>
          </ul>
        </SectionHighlight>
        {viewer === "establishment" &&
          (discussion.contactMode === "PHONE" ||
            discussion.contactMode === "IN_PERSON") && (
            <Alert
              severity="info"
              description={
                discussion.contactMode === "PHONE"
                  ? "Un email a été envoyé au candidat avec vos coordonnées. Vous pouvez quand même lui envoyer un message ici si vous souhaitez lui donner des infos supplémentaires sur l'immersion."
                  : "Un email a été envoyé au candidat avec l’adresse de l’entreprise et la personne à contacter sur place. Vous pouvez quand même lui envoyer un message ici si vous souhaitez lui donner des infos supplémentaires sur l'immersion."
              }
              small
              className={fr.cx("fr-mt-2w")}
            />
          )}
      </header>

      {discussionEstablishmentContactInfo &&
        viewer === "potentialBeneficiary" &&
        makeShouldEstablishmentBeReminded({
          contactMode: discussion.contactMode,
          discussionUpdatedAt: discussion.updatedAt,
          isEstablishmentReachableByPhoneAfter15Days:
            discussionEstablishmentContactInfo?.isEstablishmentReachableByPhoneAfter15Days ??
            false,
          lastExchangeSender: getLastExchange(discussion.exchanges)?.sender,
        }) && (
          <Alert
            severity="info"
            title="Information importante"
            description={
              <>
                <p className={fr.cx("fr-mb-2w")}>
                  L'entreprise n'ayant pas répondu depuis 15 jours ou plus, vous
                  pouvez la relancer par téléphone en lui rappelant votre
                  motivation.
                </p>
                {shouldShowContactInfo ? (
                  <>
                    <strong>Informations de contact :</strong>
                    <ul className={fr.cx("fr-ml-2w")}>
                      {(discussionEstablishmentContactInfo.mainContact
                        .firstName ||
                        discussionEstablishmentContactInfo.mainContact
                          .lastName) && (
                        <li>
                          <strong>
                            {getFormattedFirstnameAndLastname({
                              firstname:
                                discussionEstablishmentContactInfo.mainContact
                                  .firstName,
                              lastname:
                                discussionEstablishmentContactInfo.mainContact
                                  .lastName,
                            })}
                          </strong>
                        </li>
                      )}
                      <li>
                        <strong>
                          {toDisplayedPhoneNumber(
                            discussionEstablishmentContactInfo.mainContact
                              .phone,
                          )}
                        </strong>
                      </li>
                    </ul>
                  </>
                ) : (
                  <Button
                    {...displayContactButton(() =>
                      setShouldShowContactInfo(true),
                    )}
                  />
                )}
              </>
            }
            className={fr.cx("fr-mt-3w")}
          />
        )}

      {!isLayoutDesktop && shouldShowDiscussionActions && (
        <div className={fr.cx("fr-grid-row", "fr-grid-row--right", "fr-mt-2w")}>
          <ButtonWithSubMenu
            navItems={discussionActionsButtons}
            priority="primary"
            buttonLabel={"Actions"}
            buttonIconId={"fr-icon-more-fill"}
            iconPosition="right"
            position="bottom-right"
            floatingMenuOnMobile
          />
        </div>
      )}

      <DiscussionContentContainer
        content={match(discussion.contactMode)
          .with("EMAIL", () => (
            <>
              {shouldShowFullSummary && (
                <DiscussionSummary
                  displayMode="full"
                  discussion={discussion}
                  viewer={viewer}
                />
              )}
              <DiscussionExchangesContainer
                exchangesComponent={
                  restSortedExchanges.length > 0 && (
                    <DiscussionExchangesList
                      sortedExchanges={restSortedExchanges}
                      potentialBeneficiary={discussion.potentialBeneficiary}
                      viewer={viewer}
                    />
                  )
                }
                exchangeFormComponent={
                  !isViewerBeneficiaryOrDiscussionRejected && (
                    <DiscussionExchangeMessageForm
                      discussionId={discussion.id}
                      viewer={viewer}
                    />
                  )
                }
              />
            </>
          ))
          .with(P.union("PHONE", "IN_PERSON"), (contactMode) =>
            viewer === "potentialBeneficiary" ? (
              <>
                <Feedback
                  topics={["dashboard-discussion-contact-info"]}
                  className={fr.cx("fr-mb-2w")}
                />
                <EstablishmentContactInformation
                  discussionEstablishmentContactInfo={
                    discussionEstablishmentContactInfo
                  }
                  contactMode={contactMode}
                />
                <BeneficiaryGuideInformation contactMode={contactMode} />
              </>
            ) : (
              <DiscussionExchangeMessageForm
                viewer="establishment"
                discussionId={discussion.id}
              />
            ),
          )
          .exhaustive()}
        aside={
          <>
            {match({ viewer, shouldShowFullSummary })
              .with({ viewer: "potentialBeneficiary" }, () => (
                <EstablishmentSummary discussion={discussion} />
              ))
              .with(
                {
                  viewer: "establishment",
                  shouldShowFullSummary: false,
                },
                () => (
                  <DiscussionSummary
                    viewer={viewer}
                    discussion={discussion}
                    displayMode="preview"
                  />
                ),
              )
              .otherwise(() => null)}

            {isLayoutDesktop && isNotEmptyArray(discussionActionsButtons) && (
              <BorderedSection
                className={
                  viewer === "potentialBeneficiary" &&
                  shouldShowDiscussionActions
                    ? fr.cx("fr-p-2w", "fr-mt-2w")
                    : undefined
                }
              >
                <h3 className={fr.cx("fr-h6")}>Actions</h3>
                <ButtonsGroup buttons={discussionActionsButtons} />
              </BorderedSection>
            )}
          </>
        }
        className={fr.cx("fr-mt-md-2w", "fr-mt-1w")}
      />
      {createPortal(
        <DiscussionSummaryModal title="Résumé de la candidature" size="large">
          <DiscussionSummary
            viewer={viewer}
            displayMode="full"
            discussion={discussion}
          />
        </DiscussionSummaryModal>,
        document.body,
      )}

      {createPortal(
        <RejectDiscussionModal discussion={discussion} />,
        document.body,
      )}

      {createPortal(
        <AcceptDiscussionModal discussion={discussion} />,
        document.body,
      )}
    </>
  );
};
