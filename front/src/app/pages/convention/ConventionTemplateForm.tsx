import { fr } from "@codegouvfr/react-dsfr";
import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import { errors, frontRoutes } from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { ConventionForm } from "src/app/components/forms/convention/ConventionForm";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { ErrorPageContent } from "src/app/pages/error/ErrorPageContent";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionTemplateSelectors } from "src/core-logic/domain/convention-template/conventionTemplate.selectors";
import { conventionTemplateSlice } from "src/core-logic/domain/convention-template/conventionTemplate.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import { frontErrors } from "../error/front-errors";

export type ConventionTemplateFormRoute = Route<
  typeof frontRoutes.conventionTemplate
>;

export const ConventionTemplateForm = ({
  route,
}: {
  route: ConventionTemplateFormRoute;
}) => {
  const { fromRoute, conventionTemplateId } = route.params;
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const fetchedConventionTemplate = useAppSelector(
    conventionTemplateSelectors.getConventionTemplateById(conventionTemplateId),
  );
  const isConventionTemplateLoading = useAppSelector(
    conventionTemplateSelectors.isLoading,
  );
  const conventionTemplateFeedback = useFeedbackTopic("convention-template");

  useEffect(() => {
    if (!connectedUserJwt) {
      throw errors.user.unauthorized();
    }

    dispatch(
      conventionTemplateSlice.actions.fetchConventionTemplatesRequested({
        jwt: connectedUserJwt,
        feedbackTopic: "convention-template",
      }),
    );
  }, [dispatch, connectedUserJwt]);

  useEffect(() => {
    return () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    };
  }, [dispatch]);

  if (!fromRoute) throw frontErrors.generic.pageNotFound();

  const backButtonProps: ButtonProps = {
    priority: "tertiary",
    iconId: "fr-icon-arrow-left-line",
    linkProps: frontRoutes[fromRoute]().link,
    className: fr.cx("fr-mb-4w"),
    children: conventionTemplateFeedback
      ? "Aller à mon espace"
      : "Annuler et revenir en arrière",
  };

  if (
    !isConventionTemplateLoading &&
    conventionTemplateId &&
    !fetchedConventionTemplate
  ) {
    return (
      <ErrorPageContent
        title="Problème d'accès"
        description="Vous n'avez pas accès au modèle de convention demandé. Êtes-vous propriétaire de ce modèle ?"
        buttons={[<Button key="back" {...backButtonProps} />]}
      />
    );
  }

  return (
    <>
      {isConventionTemplateLoading && <Loader />}
      <Button {...backButtonProps} />
      <Feedback
        topics={["convention-template"]}
        className={fr.cx("fr-mb-2w")}
        closable
      />
      <h1>
        {fetchedConventionTemplate?.name
          ? "Modifier un modèle de convention"
          : "Créer un modèle de convention"}
      </h1>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <ConventionForm
          internshipKind="immersion"
          mode={
            conventionTemplateId
              ? "edit-convention-template"
              : "create-convention-template"
          }
          fromConventionTemplateId={conventionTemplateId}
        />
      </div>
    </>
  );
};
