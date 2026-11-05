import { fr } from "@codegouvfr/react-dsfr";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import { useEffect, useMemo } from "react";
import {
  MainWrapper,
  SectionConventionNextSteps,
  type SectionConventionNextStepsProps,
  useCopyButton,
} from "react-design-system";
import { useDispatch } from "react-redux";
import { domElementIds, errors, type frontRoutes, zUuidLike } from "shared";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import {
  commonIllustrations,
  nextStepIllustrations,
} from "../../../assets/img/illustrations";

type ConventionConfirmationPageProps = {
  route: ConventionImmersionPageRoute;
};

type ConventionImmersionPageRoute = Route<
  typeof frontRoutes.conventionConfirmation
>;

const nextSteps: SectionConventionNextStepsProps["nextSteps"] = [
  {
    illustration: nextStepIllustrations[0],
    content: (
      <>
        <p>1. Pensez à verifier votre boîte mail et votre dossier de spams.</p>
        <a
          className={fr.cx("fr-download__link", "fr-link--icon-right")}
          href="https://immersion-facile.beta.gouv.fr/aide/article/le-beneficiaire-lentreprise-ou-le-prescripteur-na-pas-recu-la-convention-a-signer-125bxxd/"
          target="_blank"
          rel="noreferrer"
        >
          Vous n'avez pas reçu l'email ?
        </a>
      </>
    ),
  },
  {
    illustration: nextStepIllustrations[1],
    content: (
      <>
        <p>
          2. Signez électroniquement la demande de convention à partir du mail
          reçu.
        </p>
      </>
    ),
  },
  {
    illustration: nextStepIllustrations[2],
    content: (
      <p>
        3. Pensez également à informer les autres signataires de la convention
        qu'ils devront vérifier leur boîte mail et leur dossier de spams.
      </p>
    ),
  },
];

export const ConventionConfirmationPage = ({
  route,
}: ConventionConfirmationPageProps) => {
  const { conventionId, isSignatoryAfterUpdate } = route.params;
  const showNotificationInfo = isSignatoryAfterUpdate !== false;
  const { copyButtonIsDisabled, copyButtonLabel, onCopyButtonClick } =
    useCopyButton("Copier l'identifiant");
  const isValidConventionId = useMemo(
    () => !!conventionId && zUuidLike.safeParse(conventionId).success,
    [conventionId],
  );
  if (!isValidConventionId) throw errors.convention.notFound({ conventionId });
  const dispatch = useDispatch();
  useEffect(
    () => () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );
  return (
    <HeaderFooterLayout>
      <MainWrapper
        layout="fullscreen"
        useBackground
        backgroundStyles={{
          marginTop: "10rem",
        }}
      >
        <FullPageFeedback
          includeWrapper={false}
          title="Votre demande de convention a bien été envoyée !"
          titleAs="h3"
          illustration={commonIllustrations.success}
          content={
            <>
              <p className={fr.cx("fr-mb-md-3w")}>
                Avant de débuter l'immersion, la convention doit encore être
                signée par toutes les parties puis être validée par
                l'accompagnateur du bénéficiaire.
                {showNotificationInfo &&
                  " Vous recevrez une notification dès que tout sera finalisé."}
              </p>
              <Highlight className={fr.cx("fr-mb-5w")}>
                <p className={fr.cx("fr-mb-0")}>
                  <strong>Important :</strong> L'immersion ne pourra commencer
                  qu'une fois la convention entièrement finalisée. Cela garantit
                  un cadre sécurisé pour l'entreprise comme pour le
                  bénéficiaire, notamment en cas d'accident ou de maladie
                  professionnelle.
                </p>
              </Highlight>
              <h2 className={fr.cx("fr-h5", "fr-mb-2w")}>
                Identifiant de votre convention
              </h2>
              <p className={fr.cx("fr-mb-2w")}>
                Conservez cet identifiant précieusement pour retrouver votre
                convention en cas de besoin : <strong> {conventionId}</strong>
              </p>
            </>
          }
          buttons={[
            {
              id: domElementIds.conventionImmersion.conventionConfirmation
                .copyConventionIdButton,
              children: copyButtonLabel,
              disabled: copyButtonIsDisabled,
              onClick: () => onCopyButtonClick(conventionId),
              priority: "primary",
              size: "small",
              iconId: "fr-icon-clipboard-line",
            },
          ]}
        />
        <SectionConventionNextSteps nextSteps={nextSteps} />
      </MainWrapper>
    </HeaderFooterLayout>
  );
};
