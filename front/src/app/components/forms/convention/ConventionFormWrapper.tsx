import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { intersection } from "ramda";
import { useEffect, useState } from "react";
import { ConventionSummary, Loader, useScrollTo } from "react-design-system";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  agencyModifierRoles,
  type ConventionDraftId,
  type ConventionId,
  type ConventionJwtPayload,
  conventionStatusesAllowedForModification,
  type DiscussionId,
  decodeMagicLinkJwtWithoutSignatureCheck,
  domElementIds,
  errors,
  frontRoutes,
  hasAllowedRolesToEditConvention,
  type InternshipKind,
  isSignatory,
  type Role,
  toDisplayedDate,
  type WithStatusJustification,
  withStatusJustificationSchema,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { ConventionForm } from "src/app/components/forms/convention/ConventionForm";
import { SignButton } from "src/app/components/forms/convention/SignButton";
import { makeConventionSummaryContent } from "src/app/contents/convention/conventionSummary.helpers";
import { useConventionTexts } from "src/app/contents/forms/convention/textSetup";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { ConventionImmersionPageRoute } from "src/app/pages/convention/ConventionImmersionPage";
import type { ConventionMiniStagePageRoute } from "src/app/pages/convention/ConventionMiniStagePage";
import type { ConventionImmersionForExternalsRoute } from "src/app/pages/convention/ConventionPageForExternals";
import type { ConventionTemplateFormRoute } from "src/app/pages/convention/ConventionTemplateForm";
import { ShowConventionErrorOrRenewExpiredJwt } from "src/app/pages/convention/ShowConventionErrorOrRenewExpiredJwt";
import { frontErrors } from "src/app/pages/error/front-errors";
import { useConventionRoute } from "src/app/routes/routes.hooks";
import { commonIllustrations } from "src/assets/img/illustrations";
import { outOfReduxDependencies } from "src/config/dependencies";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { conventionSlice } from "src/core-logic/domain/convention/convention.slice";
import { conventionDraftSelectors } from "src/core-logic/domain/convention/convention-draft/conventionDraft.selectors";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { match, P } from "ts-pattern";

const {
  Component: ConfirmDuplicateConventionModal,
  open: openConfirmDuplicateConventionModal,
  close: closeConfirmDuplicateConventionModal,
} = createModal({
  id: "confirm-duplicate-convention-modal",
  isOpenedByDefault: false,
});

export const creationFormModes = [
  "create-convention-from-scratch",
  "create-convention-from-shared",
  "create-convention-template",
] as const;
const allConventionFormModes = [
  ...creationFormModes,
  "edit-convention",
  "edit-convention-template",
] as const;
export type ConventionFormMode = (typeof allConventionFormModes)[number];

type ConventionFormWrapperProps = {
  internshipKind: InternshipKind;
  mode: ConventionFormMode;
};

export type SupportedConventionRoutes =
  | ConventionImmersionPageRoute
  | ConventionMiniStagePageRoute
  | ConventionImmersionForExternalsRoute
  | ConventionTemplateFormRoute;

export const ConventionFormWrapper = ({
  internshipKind,
  mode,
}: ConventionFormWrapperProps) => {
  const showSummary = useAppSelector(conventionSelectors.showSummary);
  const route = useConventionRoute();
  const routeJwt = "jwt" in route.params ? route.params.jwt : undefined;
  const routeConventionDraftId =
    "conventionDraftId" in route.params
      ? route.params.conventionDraftId
      : undefined;
  const routeDiscussionId =
    "discussionId" in route.params ? route.params.discussionId : undefined;
  const fetchedConvention = useAppSelector(conventionSelectors.convention);
  const dispatch = useDispatch();
  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const conventionDraftFormFeedback = useFeedbackTopic("convention-draft");
  const conventionActionEditFeedback = useFeedbackTopic(
    "convention-action-edit",
  );
  const userRolesForFetchedConvention = useAppSelector(
    connectedUserSelectors.userRolesForFetchedConvention,
  );
  const conventionIsLoading = useAppSelector(conventionSelectors.isLoading);
  const conventionDraftIsLoading = useAppSelector(
    conventionDraftSelectors.isLoading,
  );
  const currentUserIsLoading = useAppSelector(connectedUserSelectors.isLoading);
  const isLoading =
    conventionIsLoading || currentUserIsLoading || conventionDraftIsLoading;
  const fetchConventionError =
    conventionFormFeedback?.level === "error" &&
    conventionFormFeedback.on === "fetch";
  const fetchConventionDraftError =
    conventionDraftFormFeedback?.level === "error" &&
    conventionDraftFormFeedback.on === "fetch";

  const formSuccessfullySubmitted =
    (conventionFormFeedback?.level === "success" &&
      (conventionFormFeedback.on === "create" ||
        conventionFormFeedback.on === "update")) ||
    (conventionActionEditFeedback?.level === "success" &&
      conventionActionEditFeedback.on === "update");

  const hasConventionUpdateConflict =
    (conventionFormFeedback?.level === "error" &&
      conventionFormFeedback.on === "update" &&
      conventionFormFeedback.message ===
        errors.convention.conventionGotUpdatedWhileUpdating().message) ||
    (conventionActionEditFeedback?.level === "error" &&
      conventionActionEditFeedback.on === "update" &&
      conventionActionEditFeedback.message ===
        errors.convention.conventionGotUpdatedWhileUpdating().message);

  const [userRolesOnConvention, setUserRolesOnConvention] = useState<Role[]>(
    userRolesForFetchedConvention,
  );
  const conventionDraftId =
    outOfReduxDependencies.localDeviceRepository.get("conventionDraftId") ??
    routeConventionDraftId;

  useScrollTo(formSuccessfullySubmitted || hasConventionUpdateConflict);

  useEffect(() => {
    if (conventionDraftId) {
      dispatch(
        conventionDraftSlice.actions.fetchConventionDraftRequested({
          conventionDraftId,
          feedbackTopic: "convention-draft",
        }),
      );
    } else if (mode === "edit-convention" && routeJwt) {
      dispatch(conventionSlice.actions.jwtProvided(routeJwt));
      const { applicationId } =
        decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(routeJwt);

      const conventionIdInRouteParams =
        "conventionId" in route.params ? route.params.conventionId : undefined;

      const conventionId = applicationId ?? conventionIdInRouteParams;

      dispatch(
        conventionSlice.actions.fetchConventionRequested({
          jwt: routeJwt,
          conventionId,
          feedbackTopic: "unused",
        }),
      );
    }
  }, [dispatch, mode, routeJwt, route.params, conventionDraftId]);

  useEffect(() => {
    if (routeJwt) {
      const { role: roleFromJwt } =
        decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(routeJwt);

      const roles: Role[] = roleFromJwt
        ? [roleFromJwt]
        : userRolesForFetchedConvention;
      setUserRolesOnConvention(roles);
      const signatoryRole = roles.find((role) => isSignatory(role));

      if (signatoryRole) {
        dispatch(
          conventionSlice.actions.currentSignatoryRoleChanged(signatoryRole),
        );
      }
    }
  }, [dispatch, routeJwt, userRolesForFetchedConvention]);

  useEffect(() => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    return () => {
      dispatch(conventionSlice.actions.clearFetchedConvention());
      dispatch(conventionDraftSlice.actions.clearFetchedConventionDraft());
      dispatch(
        conventionSlice.actions.showSummaryChangeRequested({
          showSummary: false,
        }),
      );
    };
  }, [dispatch]);

  const routeToRedirectTo = getRouteToRedirectAfterSubmit({
    mode,
    userRolesOnConvention,
    route,
    fetchedConvention,
  });

  if (routeConventionDraftId && fetchConventionDraftError) {
    throw frontErrors.conventionDraft.notFound();
  }

  return (
    <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
      {isLoading && <Loader />}
      {match({
        showSummary,
        formSuccessfullySubmitted,
        isUpdateMode: mode === "edit-convention",
        shouldRedirectToError: !!(routeJwt && fetchConventionError),
        hasAllowedRoleToEditConvention:
          mode === "edit-convention" &&
          routeJwt &&
          fetchedConvention &&
          hasAllowedRolesToEditConvention(userRolesOnConvention),
        conventionCantBeEdited:
          mode === "edit-convention" &&
          routeJwt &&
          fetchedConvention &&
          !conventionStatusesAllowedForModification.includes(
            fetchedConvention?.status,
          ),
        fetchedConvention,
        hasConventionUpdateConflict,
        conventionCantBeEditedAfterAcceptanceByCounsellor:
          mode === "edit-convention" &&
          routeJwt &&
          fetchedConvention &&
          fetchedConvention?.status === "ACCEPTED_BY_COUNSELLOR" &&
          fetchedConvention?.agencyRefersTo &&
          !userRolesOnConvention.includes("counsellor"),
      })
        .with({ hasConventionUpdateConflict: true }, () => (
          <section className={fr.cx("fr-col-12")}>
            <Alert
              severity="error"
              title="Attention ! Vos modifications n'ont pas été prises en compte"
              description={
                errors.convention.conventionGotUpdatedWhileUpdating().message
              }
            />
            {routeToRedirectTo && (
              <Button
                linkProps={routeToRedirectTo.link}
                className={fr.cx("fr-mt-4w")}
              >
                Retourner sur la convention
              </Button>
            )}
          </section>
        ))

        .with(
          {
            conventionCantBeEdited: true,
            formSuccessfullySubmitted: false,
            shouldRedirectToError: false,
            conventionCantBeEditedAfterAcceptanceByCounsellor: false,
          },
          () => (
            <Alert
              severity="error"
              title="Cette convention ne peut plus être modifiée"
              description="Cette convention ne peut plus être modifiée car elle a déjà été validée, annulée ou refusée."
              className={fr.cx("fr-mb-4w")}
            />
          ),
        )
        .with(
          {
            conventionCantBeEditedAfterAcceptanceByCounsellor: true,
            conventionCantBeEdited: false,
          },
          () => (
            <Alert
              severity="error"
              title="Cette convention ne peut plus être modifiée"
              description="Cette convention ne peut plus être modifiée car elle a déjà été validée par le conseiller."
              className={fr.cx("fr-mb-4w")}
            />
          ),
        )
        .with(
          {
            conventionCantBeEdited: false,
            formSuccessfullySubmitted: false,
            shouldRedirectToError: false,
            hasAllowedRoleToEditConvention: false,
            isUpdateMode: true,
          },
          () => (
            <Alert
              severity="error"
              title="Vous n'avez pas les droits pour modifier cette convention."
              description="Seul les signataires ainsi que les conseillers liés a cette convention peuvent la modifier."
              className={fr.cx("fr-mb-4w")}
            />
          ),
        )
        .with(
          {
            formSuccessfullySubmitted: false,
            shouldRedirectToError: false,
          },
          ({ showSummary, fetchedConvention }) =>
            showSummary && fetchedConvention ? (
              <ConventionSummarySection
                mode={mode}
                internshipKind={internshipKind}
                userRolesOnConvention={userRolesOnConvention}
                conventionId={fetchedConvention.id}
                fromConventionDraftId={conventionDraftId}
                discussionId={routeDiscussionId}
                isEditingConvention={!!routeJwt}
              />
            ) : (
              <ConventionForm
                internshipKind={internshipKind}
                mode={mode}
                fromConventionTemplateId={
                  "conventionTemplateId" in route.params
                    ? route.params.conventionTemplateId
                    : undefined
                }
              />
            ),
        )
        .with(
          {
            formSuccessfullySubmitted: true,
            shouldRedirectToError: false,
          },
          () => {
            if (!fetchedConvention) return null;

            if (
              mode === "create-convention-from-scratch" ||
              mode === "create-convention-from-shared"
            ) {
              frontRoutes
                .conventionConfirmation({
                  conventionId: fetchedConvention.id,
                })
                .push();
            }

            if (routeToRedirectTo) routeToRedirectTo.push();
          },
        )
        .with({ shouldRedirectToError: true }, () => (
          <>
            {routeJwt && fetchConventionError && (
              <ShowConventionErrorOrRenewExpiredJwt
                errorMessage={conventionFormFeedback?.message}
                jwt={routeJwt}
              />
            )}
          </>
        ))
        .exhaustive()}
    </div>
  );
};

const ConventionSummarySection = ({
  mode,
  internshipKind,
  conventionId,
  fromConventionDraftId,
  discussionId,
  isEditingConvention,
}: {
  mode: ConventionFormMode;
  internshipKind: InternshipKind;
  userRolesOnConvention: Role[];
  conventionId: ConventionId;
  fromConventionDraftId?: ConventionDraftId;
  discussionId?: DiscussionId;
  isEditingConvention: boolean;
}) => {
  const dispatch = useDispatch();
  const isLoading = useAppSelector(conventionSelectors.isLoading);
  const convention = useAppSelector(conventionSelectors.convention);
  const similarConventionIds = useAppSelector(
    conventionSelectors.similarConventionIds,
  );
  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const conventionActionEditFeedback = useFeedbackTopic(
    "convention-action-edit",
  );

  const conventionSuccessfullySubmitted =
    (conventionFormFeedback?.level === "success" &&
      (conventionFormFeedback.on === "create" ||
        conventionFormFeedback.on === "update")) ||
    (conventionActionEditFeedback?.level === "success" &&
      conventionActionEditFeedback.on === "update");

  const { signatory: currentSignatory } = useAppSelector(
    conventionSelectors.signatoryData,
  );
  const [isModalClosedWithoutSignature, setIsModalClosedWithoutSignature] =
    useState<boolean>(false);

  const shouldShowDuplicateWarning =
    !isEditingConvention && similarConventionIds.length > 0;

  const t = useConventionTexts(internshipKind);

  if (!convention) {
    throw errors.convention.notFound({ conventionId });
  }

  const { register, handleSubmit, formState, getValues, trigger } =
    useForm<WithStatusJustification>({
      mode: "onTouched",
      defaultValues: { statusJustification: "" },
      resolver: zodResolver(withStatusJustificationSchema),
    });
  const getFieldError = makeFieldError(formState);

  const onConfirmSubmit = () => {
    dispatch(
      conventionSlice.actions.saveConventionRequested({
        fromConventionDraftId,
        convention: {
          ...convention,
          statusJustification: getValues("statusJustification"),
          status: "READY_TO_SIGN",
        },
        discussionId,
        feedbackTopic:
          mode === "edit-convention"
            ? "convention-action-edit"
            : "convention-form",
      }),
    );
  };

  return (
    <article>
      <p className={fr.cx("fr-m-0", "fr-mb-2w")}>
        {t.intro.conventionSummaryDescription}
      </p>
      <ConventionSummary
        illustration={commonIllustrations.documentsAdministratifs}
        submittedAt={toDisplayedDate({
          date: new Date(convention.dateSubmission),
        })}
        {...makeConventionSummaryContent(convention)}
      />

      {convention?.internshipKind === "mini-stage-cci" && (
        <Alert
          severity={"info"}
          title="Validation"
          description="Attention ! Vérifiez que tous les éléments sont bien intégrés et exacts. En cas de demande de modification après validation, tous les signataires devront signer à nouveau la convention."
          small
        />
      )}
      {shouldShowDuplicateWarning && (
        <DuplicateConventionAlert similarConventionIds={similarConventionIds} />
      )}
      {isModalClosedWithoutSignature && (
        <Alert
          {...t.conventionNeedToBeSign}
          closable={true}
          severity="warning"
          small
          className={fr.cx("fr-mb-5w")}
        />
      )}

      {mode === "edit-convention" ? (
        <>
          {!conventionSuccessfullySubmitted && (
            <Feedback
              topics={["convention-action-edit"]}
              className={fr.cx("fr-mb-2w")}
              closable
            />
          )}
          <form className={fr.cx("fr-mt-2w")}>
            <Input
              textArea
              label="Expliquer les modifications *"
              hintText="Votre message sera envoyé aux autres signataires"
              nativeTextAreaProps={{
                ...register("statusJustification"),
                id: domElementIds.conventionImmersion.statusJustificationInput,
              }}
              {...getFieldError("statusJustification")}
            />

            <div
              className={fr.cx(
                "fr-btns-group",
                "fr-btns-group--inline",
                "fr-btns-group--icon-left",
              )}
            >
              <Button
                disabled={isLoading}
                iconId="fr-icon-arrow-go-back-line"
                id={domElementIds.conventionImmersion.summaryEditButton}
                priority="secondary"
                onClick={() => {
                  dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
                  dispatch(
                    conventionSlice.actions.showSummaryChangeRequested({
                      showSummary: false,
                    }),
                  );
                }}
              >
                Retourner à la modification
              </Button>

              {currentSignatory ? (
                <SignButton
                  disabled={isLoading}
                  id={domElementIds.conventionToSign.openSignModalButton}
                  signatory={currentSignatory}
                  internshipKind={convention?.internshipKind}
                  onOpenSignModal={() => trigger("statusJustification")}
                  onCloseSignModalWithoutSignature={
                    setIsModalClosedWithoutSignature
                  }
                  onSubmit={handleSubmit(onConfirmSubmit)}
                />
              ) : (
                <Button
                  priority="primary"
                  onClick={handleSubmit(onConfirmSubmit)}
                  nativeButtonProps={{
                    id: domElementIds.conventionImmersion
                      .confirmSubmitFormButton,
                    disabled: isLoading,
                  }}
                >
                  Envoyer la convention
                </Button>
              )}
            </div>
          </form>
        </>
      ) : (
        <>
          <ButtonsGroup
            className={fr.cx("fr-mt-4w")}
            inlineLayoutWhen="sm and up"
            alignment="center"
            buttons={[
              {
                children: "Retourner à la modification",
                onClick: () => {
                  dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
                  dispatch(
                    conventionSlice.actions.showSummaryChangeRequested({
                      showSummary: false,
                    }),
                  );
                },
                id: domElementIds.conventionImmersion.summaryEditButton,
                priority: "secondary",
              },
              {
                children: "Envoyer la convention",
                onClick: () =>
                  shouldShowDuplicateWarning
                    ? openConfirmDuplicateConventionModal()
                    : onConfirmSubmit(),
                nativeButtonProps: {
                  id: domElementIds.conventionImmersion.confirmSubmitFormButton,
                  disabled: isLoading,
                },
              },
            ]}
          />
          {createPortal(
            <ConfirmDuplicateConventionModal
              title={"Confirmer la création de cette convention"}
              buttons={[
                {
                  children: "Annuler",
                  onClick: closeConfirmDuplicateConventionModal,
                  priority: "secondary",
                },
                {
                  children: "Valider (au risque de créer un doublon)",
                  onClick: () => {
                    onConfirmSubmit();
                    closeConfirmDuplicateConventionModal();
                  },
                  nativeButtonProps: {
                    disabled: isLoading,
                  },
                },
              ]}
            >
              <DuplicateConventionAlert
                similarConventionIds={similarConventionIds}
              />
            </ConfirmDuplicateConventionModal>,
            document.body,
          )}
        </>
      )}
    </article>
  );
};

const DuplicateConventionAlert = (props: {
  similarConventionIds: ConventionId[];
}) => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  return (
    <Alert
      severity={"warning"}
      title={"Attention ! Possible convention en doublon."}
      description={
        <div>
          {props.similarConventionIds.length === 1
            ? "Une convention a déjà été initiée avec des informations similaires. Voici son identifiant :"
            : "Des conventions ont déjà été initiées avec des informations similaires. Voici leurs identifiants :"}
          <ul>
            {props.similarConventionIds.map((id) => (
              <li key={id}>
                {currentUser ? (
                  <a
                    {...frontRoutes.manageConventionConnectedUser({
                      conventionId: id,
                    }).link}
                    target="_blank"
                  >
                    {id}
                  </a>
                ) : (
                  id
                )}
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
};

const getRouteToRedirectAfterSubmit = ({
  mode,
  userRolesOnConvention,
  route,
  fetchedConvention,
}: {
  mode: ConventionFormMode;
  userRolesOnConvention: Role[];
  route: SupportedConventionRoutes;
  fetchedConvention: { id: string } | null;
}) =>
  match({
    mode,
    userRolesOnConvention,
    route,
    fetchedConvention,
  })
    .with({ fetchedConvention: null }, () => undefined)
    .with(
      {
        mode: "edit-convention",
        userRolesOnConvention: P.when((roles) =>
          roles.some((role) => isSignatory(role)),
        ),
        route: {
          params: {
            jwt: P.string,
          },
        },
        fetchedConvention: { id: P.string },
      },
      ({ route, fetchedConvention }) => {
        const { applicationId } =
          decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(
            route.params.jwt,
          );

        if (applicationId) {
          return frontRoutes.conventionToSign({ jwt: route.params.jwt });
        }
        return frontRoutes.manageConventionConnectedUser({
          conventionId: fetchedConvention.id,
        });
      },
    )
    .with(
      {
        mode: "edit-convention",
        userRolesOnConvention: P.when((roles) => roles.includes("back-office")),
        fetchedConvention: { id: P.string },
      },
      ({ fetchedConvention }) =>
        frontRoutes.adminConventionDetail({
          conventionId: fetchedConvention.id,
        }),
    )
    .with(
      {
        mode: "edit-convention",
        userRolesOnConvention: P.when(
          (roles) => intersection(roles, agencyModifierRoles).length > 0,
        ),
        route: {
          params: {
            jwt: P.string,
          },
        },
        fetchedConvention: { id: P.string },
      },
      ({ route, fetchedConvention }) => {
        const { applicationId } =
          decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(
            route.params.jwt,
          );
        if (applicationId) {
          return frontRoutes.manageConvention({ jwt: route.params.jwt });
        }
        return frontRoutes.manageConventionConnectedUser({
          conventionId: fetchedConvention.id,
        });
      },
    )
    .otherwise(() => undefined);
