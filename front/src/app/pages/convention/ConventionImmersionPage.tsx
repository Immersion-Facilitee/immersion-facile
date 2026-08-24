import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { keys } from "ramda";
import { useMemo, useRef, useState } from "react";
import { Loader, MainWrapper, PageHeader } from "react-design-system";
import {
  authRoutes,
  domElementIds,
  frontRoutes,
  makeUrlWithQueryParams,
} from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import {
  type ConventionFormMode,
  ConventionFormWrapper,
} from "src/app/components/forms/convention/ConventionFormWrapper";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useConventionTexts } from "src/app/contents/forms/convention/textSetup";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFeatureFlags } from "src/app/hooks/useFeatureFlags";
import illustrationShareConvention from "src/assets/img/share-convention.svg";
import { outOfReduxDependencies } from "src/config/dependencies";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { match } from "ts-pattern";
import type { Route } from "type-route";

export type ConventionImmersionPageRoute = Route<
  typeof frontRoutes.conventionImmersion
>;

interface ConventionImmersionPageProps {
  route: ConventionImmersionPageRoute;
}

const checkIsSharedConvention = (
  routeParamsWithoutJwtAndTrackers: Record<string, unknown>,
  conventionDraftId: string | undefined,
): boolean =>
  keys(routeParamsWithoutJwtAndTrackers).length > 0 || !!conventionDraftId;

const storeConventionRouteParamsOnDevice = (
  routeParams: ConventionImmersionPageRoute["params"],
) => {
  const { conventionDraftId } = routeParams;

  if (!conventionDraftId) return;

  outOfReduxDependencies.localDeviceRepository.set(
    "conventionDraftId",
    conventionDraftId,
  );
};

export const ConventionImmersionPage = ({
  route,
}: ConventionImmersionPageProps) => {
  const { jwt, skipIntro } = route.params;

  const { conventionDraftId, routeParamsWithoutJwtAndTrackers } =
    useMemo(() => {
      const {
        jwt: _,
        at_campaign: __,
        at_kwd: ___,
        at_medium: _____,
        skipIntro: ____,
        conventionDraftId,
        ...routeParamsWithoutJwtAndTrackers
      } = route.params;
      return { conventionDraftId, routeParamsWithoutJwtAndTrackers };
    }, [route.params]);

  const t = useConventionTexts("immersion");
  const showSummary = useAppSelector(conventionSelectors.showSummary);

  const isSharedConvention = checkIsSharedConvention(
    routeParamsWithoutJwtAndTrackers,
    conventionDraftId,
  );

  const [displaySharedConventionMessage, setDisplaySharedConventionMessage] =
    useState(isSharedConvention && !skipIntro);

  const getPageHeaderTitle = (
    jwt: string | undefined,
    showSummary: boolean,
  ) => {
    const createOrEditTitle = jwt
      ? t.intro.conventionEditTitle
      : t.intro.conventionTitle;
    return showSummary ? t.intro.conventionSummaryTitle : createOrEditTitle;
  };

  return (
    <HeaderFooterLayout>
      <MainWrapper
        layout={"default"}
        vSpacing={3}
        pageHeader={
          !displaySharedConventionMessage && (
            <PageHeader
              title={getPageHeaderTitle(jwt, showSummary)}
              breadcrumbs={<Breadcrumbs />}
            />
          )
        }
      >
        {displaySharedConventionMessage ? (
          <SharedConventionMessage
            route={route}
            onClickContinue={() => setDisplaySharedConventionMessage(false)}
          />
        ) : (
          <PageContent route={route} />
        )}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};

const PageContent = ({ route }: ConventionImmersionPageProps) => {
  const { isLoading } = useFeatureFlags();
  const initialRouteParams = useRef(route.params).current;
  const { conventionDraftId, routeParamsWithoutJwtAndTrackers } =
    useMemo(() => {
      const {
        jwt: _,
        at_kwd: __,
        at_campaign: ____,
        at_medium: _____,
        conventionDraftId,
        ...routeParamsWithoutJwtAndTrackers
      } = initialRouteParams;
      return { conventionDraftId, routeParamsWithoutJwtAndTrackers };
    }, [initialRouteParams]);

  const isSharedConvention = checkIsSharedConvention(
    routeParamsWithoutJwtAndTrackers,
    conventionDraftId,
  );

  const getMode = (): ConventionFormMode => {
    if ("jwt" in initialRouteParams) return "edit-convention";
    if (isSharedConvention) return "create-convention-from-shared";
    return "create-convention-from-scratch";
  };

  const mode = getMode();

  return match({
    isLoading,
    mode,
  })
    .with({ isLoading: true }, () => <Loader />)
    .with({ isLoading: false }, () => (
      <ConventionFormWrapper internshipKind="immersion" mode={mode} />
    ))
    .exhaustive();
};

const SharedConventionMessage = ({
  onClickContinue,
  route,
}: {
  onClickContinue: () => void;
  route: ConventionImmersionPageRoute;
}) => (
  <div className={fr.cx("fr-grid-row", "fr-grid-row--middle")}>
    <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
      <h1>Convention d’immersion en cours de complétion</h1>
      <p>
        Une demande de convention d’immersion vous attend. Il manque certaines
        informations de votre part pour compléter le document. Cliquez sur le
        bouton ci-dessous pour remplir les sections qui vous concernent et
        finaliser la convention en quelques minutes.
      </p>
      <Button
        onClick={() => onClickContinue()}
        iconId="fr-icon-arrow-right-line"
        iconPosition="right"
        id={
          domElementIds.conventionImmersion.fromSharedConventionContinueButton
        }
      >
        Compléter la demande de convention
      </Button>

      <p className={fr.cx("fr-mt-4w", "fr-mb-0")}>
        Vous êtes inscrits à France Travail en tant que bénéficiaire ?{" "}
        <a
          href={makeUrlWithQueryParams(
            `/api${authRoutes.initiateLoginByOAuth.url}`,
            {
              provider: "ftConnect",
              redirectUri: frontRoutes.conventionImmersion().href,
            },
          )}
          onClick={() => {
            storeConventionRouteParamsOnDevice(route.params);
          }}
          className={fr.cx("fr-link")}
        >
          Connectez-vous avec vos identifiants
        </a>
      </p>
    </div>
    <div
      className={fr.cx(
        "fr-col-12",
        "fr-col-md-4",
        "fr-hidden",
        "fr-unhidden-md",
        "fr-mb-6w",
      )}
    >
      <img src={illustrationShareConvention} alt="" />
    </div>
  </div>
);
