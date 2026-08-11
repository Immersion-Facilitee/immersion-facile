import { fr } from "@codegouvfr/react-dsfr";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import {
  BorderedSection,
  ExchangeMessage,
  Loader,
  SectionHighlight,
  useBreakpoint,
} from "react-design-system";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AbsoluteUrl,
  absoluteUrlSchema,
  addressDtoToString,
  type ConnectedUser,
  type ContactMode,
  type ConventionDraftDto,
  type CreateConventionPresentationInitialValues,
  type DiscussionEstablishmentContactInfo,
  type DiscussionId,
  type DiscussionReadDto,
  domElementIds,
  type ExchangeFromDashboard,
  type ExchangeRole,
  emailExchangeSplitters,
  escapeHtml,
  exchangeMessageFromDashboardSchema,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  getLastExchange,
  makeEmptyConventionInitialValues,
  shouldEstablishmentBeReminded,
  splitTextOnFirstSeparator,
  toConventionDraftDto,
  toDisplayedDate,
  toDisplayedPhoneNumber,
  type WithDiscussionId,
} from "shared";
import {
  AcceptDiscussionModal,
  openAcceptDiscussionModal,
} from "src/app/components/admin/establishments/AcceptDiscussionModal";
import {
  openRejectDiscussionModal,
  RejectDiscussionModal,
} from "src/app/components/admin/establishments/RejectDiscussionModal";
import { DiscussionFollowUpBadge } from "src/app/components/establishment/establishment-dashboard/DiscussionFollowUpBadge";
import { DiscussionStatusBadge } from "src/app/components/establishment/establishment-dashboard/DiscussionStatusBadge";
import { useDiscussion } from "src/app/hooks/discussion.hooks";
import { useFeedbackEventCallback } from "src/app/hooks/feedback.hooks";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  addLineBreakOnNewLines,
  convertHtmlToText,
} from "src/app/utils/html.utils";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionDraftSelectors } from "src/core-logic/domain/convention/convention-draft/conventionDraft.selectors";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import { discussionSlice } from "src/core-logic/domain/discussion/discussion.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import { match, P } from "ts-pattern";
import { Feedback } from "../../feedback/Feedback";
import { WithFeedbackReplacer } from "../../feedback/WithFeedbackReplacer";
import { contactModeToBadgeOptions } from "../../immersion-offer/CreateDiscussionForm";

type DiscussionManageContentProps = WithDiscussionId & {
  viewer: ExchangeRole;
};

export const DiscussionManageContent = ({
  discussionId,
  viewer,
}: DiscussionManageContentProps): JSX.Element => {
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const { discussion, isLoading } = useDiscussion(
    discussionId,
    connectedUserJwt,
  );
  const dispatch = useDispatch();
  const showDiscussion = !isLoading && discussion && currentUser;

  useFeedbackEventCallback(
    "dashboard-discussion-status-updated",
    "update.success",
    () => {
      if (connectedUserJwt) {
        dispatch(
          discussionSlice.actions.fetchDiscussionRequested({
            discussionId,
            feedbackTopic: "dashboard-discussion",
            jwt: connectedUserJwt,
          }),
        );
      }
    },
  );

  useEffect(() => {
    if (discussion && connectedUserJwt) {
      dispatch(
        searchSlice.actions.fetchSearchResultRequested({
          searchResult: {
            siret: discussion.siret,
            appellationCode: discussion.appellation.appellationCode,
            locationId: discussion.locationId,
          },
          feedbackTopic: "unused",
        }),
      );
    }
  }, [discussion, connectedUserJwt, dispatch]);

  useEffect(() => {
    if (discussion && connectedUserJwt) {
      dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            discussionId: discussion.id,
            jwt: connectedUserJwt,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );
    }
  }, [discussion, connectedUserJwt, dispatch]);

  useEffect(
    () => () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );

  return (
    <>
      {isLoading && <Loader />}
      <WithFeedbackReplacer topic="dashboard-discussion" level="error">
        {showDiscussion && (
          <DiscussionDetails
            discussion={discussion}
            connectedUser={currentUser}
            viewer={viewer}
          />
        )}
      </WithFeedbackReplacer>
    </>
  );
};

type DiscussionDetailsProps = {
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
  viewer: ExchangeRole;
};
type ActivateConventionDraftButtonProps = Pick<
  DiscussionDetailsProps,
  "discussion" | "connectedUser"
>;

type ButtonPropsWithId = ButtonProps & { id: string };

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

const getDiscussionActionsButtons = ({
  discussion,
  connectedUser,
  viewer,
  makeInitiateConventionDraftButtonProps,
}: {
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
  viewer: ExchangeRole;
  makeInitiateConventionDraftButtonProps: (
    props: ActivateConventionDraftButtonProps,
  ) => ButtonPropsWithId;
}): [ButtonPropsWithId, ...ButtonPropsWithId[]] => {
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

  return match(viewer)
    .with(
      "potentialBeneficiary",
      (): [ButtonPropsWithId, ...ButtonPropsWithId[]] => [
        makeInitiateConventionDraftButtonProps({ discussion, connectedUser }),
      ],
    )
    .with("establishment", (): [ButtonPropsWithId, ...ButtonPropsWithId[]] =>
      discussion.kind === "IF"
        ? [
            makeInitiateConventionDraftButtonProps({
              discussion,
              connectedUser,
            }),
            acceptButton,
            rejectButton,
          ]
        : [acceptButton, rejectButton],
    )
    .exhaustive();
};

const getDiscussionStatusUpdatedFeedbackMessage = (
  discussion: DiscussionReadDto,
): string => {
  return match(discussion)
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
};

const DiscussionDetails = (props: DiscussionDetailsProps): JSX.Element => {
  const dispatch = useDispatch();
  const { discussion, connectedUser, viewer } = props;
  const saveConventionDraftIsLoading = useAppSelector(
    conventionDraftSelectors.isLoading,
  );
  const discussionEstablishmentContactInfo = useAppSelector(
    discussionSelectors.discussionEstablishmentContactInfo,
  );
  const relatedOffer = useAppSelector(searchSelectors.currentSearchResult);
  const [shouldShowContactInfo, setShouldShowContactInfo] =
    useState<boolean>(false);
  const isDesktopScreen = useBreakpoint("lg");

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
          <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            <p
              {...contactModeToBadgeOptions[discussion.contactMode]}
              className={`${contactModeToBadgeOptions[discussion.contactMode].className} ${fr.cx("fr-mr-2w")}`}
            />
            <DiscussionStatusBadge discussion={discussion} viewer={viewer} />
            <DiscussionFollowUpBadge
              key={discussion.id}
              discussion={discussion}
              isEstablishmentReachableByPhoneAfter15Days={
                discussionEstablishmentContactInfo?.isEstablishmentReachableByPhoneAfter15Days ??
                false
              }
              className={fr.cx("fr-ml-1w")}
              viewer={viewer}
            />
          </div>
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
        shouldEstablishmentBeReminded({
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
                    id={
                      domElementIds.beneficiaryDashboardDiscussions
                        .displayPhoneContactButton
                    }
                    iconId="ri-eye-line"
                    iconPosition="left"
                    priority="secondary"
                    type="button"
                    onClick={() => setShouldShowContactInfo(true)}
                    className={fr.cx("fr-my-1w")}
                  >
                    Afficher les informations de contact
                  </Button>
                )}
              </>
            }
            className={fr.cx("fr-mt-3w")}
          />
        )}

      <div
        className={fr.cx(
          "fr-grid-row",
          "fr-grid-row--top",
          "fr-grid-row--gutters",
          "fr-my-2w",
        )}
      >
        <div
          className={fr.cx("fr-col-12", "fr-col-lg-8")}
          style={{ order: isDesktopScreen ? 1 : 2 }}
        >
          {match(discussion.contactMode)
            .with("EMAIL", () => (
              <>
                <BorderedSection>
                  <DiscussionExchangeMessageForm
                    discussionId={discussion.id}
                    viewer={viewer}
                  />
                </BorderedSection>
                <BorderedSection className={fr.cx("fr-mt-2w")}>
                  <DiscussionExchangesList
                    discussion={discussion}
                    viewer={viewer}
                  />
                </BorderedSection>
              </>
            ))
            .with(P.union("PHONE", "IN_PERSON"), (contactMode) =>
              viewer === "potentialBeneficiary" ? (
                <>
                  <Feedback
                    topics={["dashboard-discussion-contact-info"]}
                    className={fr.cx("fr-mb-2w")}
                  />
                  <BorderedSection>
                    <EstablishmentContactInformation
                      discussionEstablishmentContactInfo={
                        discussionEstablishmentContactInfo
                      }
                      contactMode={contactMode}
                    />
                  </BorderedSection>
                  <BorderedSection className={fr.cx("fr-mt-2w")}>
                    <BeneficiaryGuideInformation contactMode={contactMode} />
                  </BorderedSection>
                </>
              ) : (
                <BorderedSection>
                  <DiscussionExchangeMessageForm
                    viewer="establishment"
                    discussionId={discussion.id}
                  />
                </BorderedSection>
              ),
            )
            .exhaustive()}
        </div>
        <div
          className={fr.cx("fr-col-12", "fr-col-lg-4")}
          style={{ order: isDesktopScreen ? 2 : 1 }}
        >
          {discussion.kind === "IF" &&
            (viewer === "potentialBeneficiary" ||
              discussion.potentialBeneficiary.resumeLink) && (
              <BorderedSection className={fr.cx("fr-p-2w", "fr-mb-2w")}>
                {viewer === "potentialBeneficiary" ? (
                  <>
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
                          title="Offre d'immersion"
                          target="_blank"
                          rel="noreferrer"
                          href={
                            frontRoutes.searchResult({
                              appellationCode: [
                                discussion.appellation.appellationCode,
                              ],
                              siret: discussion.siret,
                              location: discussion.locationId,
                            }).href
                          }
                        >
                          Voir l'offre
                        </a>
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    <h3 className={fr.cx("fr-h6")}>Profil du candidat</h3>

                    <a
                      href={discussion.potentialBeneficiary.resumeLink}
                      title="CV du candidat"
                      target="_blank"
                      rel="noreferrer"
                    >
                      CV
                    </a>
                  </>
                )}
              </BorderedSection>
            )}
          {(discussion.status === "PENDING" ||
            discussion.status === "ACCEPTED") &&
            viewer === "establishment" && (
              <BorderedSection>
                <h3 className={fr.cx("fr-h6")}>Actions</h3>
                <ButtonsGroup
                  buttons={getDiscussionActionsButtons({
                    discussion,
                    connectedUser,
                    viewer,
                    makeInitiateConventionDraftButtonProps: (discussionProps) =>
                      getActivateDraftConventionButtonProps({
                        ...discussionProps,
                        saveConventionDraftThenRedirectRequested,
                        saveConventionDraftIsLoading,
                      }),
                  })}
                />
              </BorderedSection>
            )}
          {viewer === "potentialBeneficiary" &&
            !(
              discussion.status === "ACCEPTED" &&
              discussion.candidateWarnedMethod !== null &&
              discussion.conventionId === undefined
            ) && (
              <BorderedSection className={fr.cx("fr-p-2w", "fr-mt-2w")}>
                <h3 className={fr.cx("fr-h6")}>Actions</h3>
                <ButtonsGroup
                  buttons={getDiscussionActionsButtons({
                    discussion,
                    connectedUser,
                    viewer,
                    makeInitiateConventionDraftButtonProps: (discussionProps) =>
                      getActivateDraftConventionButtonProps({
                        ...discussionProps,
                        saveConventionDraftThenRedirectRequested,
                        saveConventionDraftIsLoading,
                      }),
                  })}
                />
              </BorderedSection>
            )}
        </div>
      </div>

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

const BeneficiaryGuideInformation = ({
  contactMode,
}: {
  contactMode: Extract<ContactMode, "IN_PERSON" | "PHONE">;
}) => (
  <>
    <h5 className={fr.cx("fr-h5")}>Comment procéder ?</h5>
    <div className={fr.cx("fr-accordions-group")}>
      <Accordion
        label={
          contactMode === "IN_PERSON"
            ? "Avant de vous présenter sur place"
            : "Avant d'appeler"
        }
      >
        <ul>
          <li>Préparez votre présentation en 30 secondes</li>
          <li>Notez les dates/semaines qui vous conviennent</li>
          <li>Ayez votre projet clair en tête</li>
          {contactMode === "IN_PERSON" && (
            <li>Notez l'adresse et le nom de la personne à contacter</li>
          )}
        </ul>
      </Accordion>
      {contactMode === "PHONE" && (
        <Accordion label="Pendant l'appel">
          <ul>
            <li>
              Présentez-vous et expliquez que vous avez obtenu le contact via
              Immersion Facilitée.
            </li>
            <li>
              Décrivez votre projet professionnel et l'objectif que vous
              recherchez en effectuant cette immersion.
            </li>
            <li>
              Mentionnez que l'immersion est encadrée par une convention
              d'Immersion Facilitée.
            </li>
            <li>
              Proposez une période et une durée souhaitées pour l'immersion, en
              expliquant pourquoi elles vous conviennent.
            </li>
            <li>
              Concluez en demandant un rendez-vous afin d'échanger sur votre
              demande.
            </li>
          </ul>
        </Accordion>
      )}
      <Accordion label="À savoir">
        <ul>
          <li>
            L'immersion est un stage d'observation strictement encadré d'un
            point de vue juridique.
          </li>
          <li>Une immersion peut durer de 1 à 30 jours.</li>
          <li>Vous conservez votre statut et votre indemnité habituelle.</li>
          {contactMode !== "PHONE" && (
            <li>
              Une convention encadre l'immersion (vous pourrez la compléter lors
              du rendez-vous).
            </li>
          )}
        </ul>
      </Accordion>
    </div>
  </>
);

const EstablishmentContactInformation = ({
  discussionEstablishmentContactInfo,
  contactMode,
}: {
  discussionEstablishmentContactInfo: DiscussionEstablishmentContactInfo | null;
  contactMode: Extract<ContactMode, "IN_PERSON" | "PHONE">;
}) => {
  const contactDetail =
    contactMode === "IN_PERSON"
      ? ((discussionEstablishmentContactInfo?.potentialBeneficiaryWelcomeAddress &&
          addressDtoToString(
            discussionEstablishmentContactInfo
              .potentialBeneficiaryWelcomeAddress.address,
          )) ??
        "Un mail avec l'adresse de l'entreprise et la personne a contacter sur place vous a été envoyé")
      : discussionEstablishmentContactInfo &&
        toDisplayedPhoneNumber(
          discussionEstablishmentContactInfo.mainContact.phone,
        );

  return (
    <>
      <h5 className={fr.cx("fr-h5")}>Coordonnées de l'entreprise</h5>
      {discussionEstablishmentContactInfo && contactDetail ? (
        <ul className={fr.cx("fr-raw-list")}>
          <li className={fr.cx("fr-mb-1w")}>
            <strong>
              {getFormattedFirstnameAndLastname({
                firstname:
                  discussionEstablishmentContactInfo.mainContact.firstName,
                lastname:
                  discussionEstablishmentContactInfo.mainContact.lastName,
              })}
            </strong>
          </li>
          <li>{contactDetail}</li>
        </ul>
      ) : (
        "Aucune information trouvée"
      )}
    </>
  );
};

const DiscussionExchangesList = ({
  discussion,
  viewer,
}: {
  discussion: DiscussionReadDto;
  viewer: ExchangeRole;
}): JSX.Element => {
  const sortedExchangesBySentAtDesc = [...discussion.exchanges].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  return (
    <section>
      {sortedExchangesBySentAtDesc.map((exchange) => {
        const currentMessage = addLineBreakOnNewLines(
          convertHtmlToText(exchange.message),
        );
        const messageToDisplay = splitTextOnFirstSeparator(
          currentMessage,
          emailExchangeSplitters,
        );
        return (
          <ExchangeMessage
            key={exchange.sentAt}
            viewer={viewer}
            sender={exchange.sender}
          >
            <header
              className={fr.cx(
                "fr-grid-row",
                "fr-grid-row--middle",
                "fr-mb-2w",
              )}
            >
              <div>
                <h2 className={fr.cx("fr-mb-0", "fr-mb-1v")}>
                  {exchange.sender === "establishment"
                    ? `${exchange.firstname} ${exchange.lastname}`
                    : getFormattedFirstnameAndLastname({
                        firstname: discussion.potentialBeneficiary.firstName,
                        lastname: discussion.potentialBeneficiary.lastName,
                      })}
                </h2>
              </div>
              <div className={fr.cx("fr-ml-auto")}>
                <div className={fr.cx("fr-mb-2w")}>
                  <Badge
                    className={fr.cx(
                      "fr-badge",
                      `fr-badge--${
                        exchange.sender === "establishment"
                          ? "blue-cumulus"
                          : "green-archipel"
                      }`,
                    )}
                  >
                    {exchange.sender === "establishment"
                      ? "Entreprise"
                      : "Candidat"}
                  </Badge>
                </div>

                <span className={fr.cx("fr-hint-text")}>
                  {toDisplayedDate({
                    date: new Date(exchange.sentAt),
                    withHours: true,
                  })}
                </span>
              </div>
            </header>
            <hr className={fr.cx("fr-hr")} />
            <section>
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(messageToDisplay[0]),
                }}
              />
            </section>
          </ExchangeMessage>
        );
      })}
    </section>
  );
};

const makeConventionFromDiscussion = ({
  initialConvention,
  discussion,
  connectedUser,
}: {
  initialConvention: CreateConventionPresentationInitialValues;
  discussion: DiscussionReadDto;
  connectedUser: ConnectedUser;
}): CreateConventionPresentationInitialValues => ({
  ...initialConvention,
  signatories: {
    ...initialConvention.signatories,
    beneficiary: {
      ...initialConvention.signatories.beneficiary,
      firstName: discussion.potentialBeneficiary.firstName,
      lastName: discussion.potentialBeneficiary.lastName,
      email: discussion.potentialBeneficiary.email,
      phone:
        discussion.contactMode === "EMAIL"
          ? discussion.potentialBeneficiary.phone
          : "",
    },
    establishmentRepresentative: {
      ...initialConvention.signatories.establishmentRepresentative,
      firstName: connectedUser.firstName,
      lastName: connectedUser.lastName,
      email: connectedUser.email,
    },
  },
  establishmentTutor: {
    firstName: connectedUser.firstName,
    lastName: connectedUser.lastName,
    email: connectedUser.email,
    job: "",
    phone: "",
    role: "establishment-tutor",
  },
  immersionObjective:
    discussion.contactMode === "EMAIL" &&
    discussion.potentialBeneficiary.immersionObjective
      ? discussion.potentialBeneficiary.immersionObjective
      : undefined,
  siret: discussion.siret,
  businessName: discussion.businessName,
  immersionAppellation: discussion.appellation,
  immersionAddress: addressDtoToString(discussion.address),
});

const DiscussionExchangeMessageForm = ({
  discussionId,
  viewer,
}: {
  discussionId: DiscussionId;
  viewer: ExchangeRole;
}) => {
  const { register, handleSubmit, formState, watch, setValue } =
    useForm<ExchangeFromDashboard>({
      resolver: zodResolver(exchangeMessageFromDashboardSchema),
      defaultValues: {
        message: "",
        recipientRole:
          viewer === "establishment" ? "potentialBeneficiary" : "establishment",
      },
    });
  const getFieldError = makeFieldError(formState);
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const message = watch("message");

  const onSubmit = (data: ExchangeFromDashboard) => {
    if (connectedUserJwt) {
      dispatch(
        discussionSlice.actions.sendExchangeRequested({
          exchangeData: {
            jwt: connectedUserJwt,
            discussionId,
            message: data.message,
            recipientRole: data.recipientRole,
          },
          feedbackTopic: "beneficiary-dashboard-discussion-send-message",
        }),
      );
    }
  };

  useFeedbackEventCallback(
    "beneficiary-dashboard-discussion-send-message",
    "create.success",
    () => {
      setValue("message", "", { shouldValidate: true });
    },
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Feedback
        topics={[
          "establishment-dashboard-discussion-send-message",
          "beneficiary-dashboard-discussion-send-message",
        ]}
        className={fr.cx("fr-mb-2w")}
        closable
      />
      <input type="hidden" {...register("discussionId")} value={discussionId} />
      <Input
        textArea
        label={
          viewer === "establishment"
            ? "Répondre au candidat"
            : "Répondre à l'entreprise"
        }
        nativeTextAreaProps={{
          id: domElementIds.establishmentDashboard.discussion.sendMessageInput,
          rows: 5,
          placeholder: "Rédigez votre message ici...",
          ...register("message", {
            setValueAs: escapeHtml,
          }),
        }}
        {...getFieldError("message")}
      />
      <div className={fr.cx("fr-mt-2w")}>
        <Button
          id={
            domElementIds.establishmentDashboard.discussion
              .sendMessageSubmitButton
          }
          type="submit"
          disabled={formState.isSubmitting || message.trim().length === 0}
          size="small"
        >
          Envoyer un message
        </Button>
      </div>
    </form>
  );
};
