import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import {
  type ElementRef,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Loader,
  MainWrapper,
  SectionSteps,
  useLayout,
} from "react-design-system";
import { Helmet } from "react-helmet-async";
import { useDispatch } from "react-redux";
import {
  type ConnectedUser,
  type ContactMode,
  domElementIds,
  frontRoutes,
  type InternshipKind,
  isInternalOfferDto,
  isPhysicalWorkMode,
  type OfferDto,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { FullPageFeedback } from "src/app/components/feedback/FullpageFeedback";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { SearchResultAbout } from "src/app/components/search/SearchResultAbout";
import { SearchResultCompany } from "src/app/components/search/SearchResultCompany";
import { SearchResultContactSection } from "src/app/components/search/SearchResultContactSection";
import { SearchResultHeader } from "src/app/components/search/SearchResultHeader";
import { SearchResultJob } from "src/app/components/search/SearchResultJob";
import { SearchResultLocation } from "src/app/components/search/SearchResultLocation";
import { defaultPageMetaContents } from "src/app/contents/meta/metaContents";
import {
  immersionStepsContent,
  searchResultContent,
} from "src/app/contents/search/content";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useSearchResultRoute } from "src/app/routes/routes.hooks";
import { commonIllustrations } from "src/assets/img/illustrations";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import { useStyles } from "tss-react/dsfr";
import "./SearchResultPage.scss";

const getMetaForSearchResult = (
  currentSearchResult: OfferDto | null,
): {
  title: string;
  description: string;
} => {
  if (!currentSearchResult) return { title: "", description: "" };
  const hasAppellations = currentSearchResult.appellations?.length;
  return {
    title: `${currentSearchResult.name}${
      hasAppellations
        ? ` - ${currentSearchResult.appellations
            .map((appellation) => `${appellation.appellationLabel}`)
            .join(", ")}`
        : ""
    }`,
    description: `Fiche présentant l'immersion proposée par l'entreprise ${
      currentSearchResult?.name
    }${
      hasAppellations
        ? `en tant que ${currentSearchResult.appellations.map(
            (appellation) => appellation.appellationLabel,
          )}`
        : ""
    }`,
  };
};

export const SearchResultPage = ({ isExternal }: { isExternal: boolean }) => {
  const route = useSearchResultRoute([
    "searchResult",
    "searchResultForStudent",
    "searchResultExternal",
  ]);
  const currentSearchResult = useAppSelector(
    searchSelectors.currentSearchResult,
  );
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const defaultMetaContents = defaultPageMetaContents.searchResult;
  const isLoading = useAppSelector(searchSelectors.isLoading);
  const { isLayoutDesktop } = useLayout();
  const { cx } = useStyles();
  const formContactRef = useRef<ElementRef<"div">>(null);
  const dispatch = useDispatch();
  const params = route.params;
  const searchResultIds = domElementIds[route.name];
  const internshipKind: InternshipKind =
    route.name === "searchResultForStudent" ? "mini-stage-cci" : "immersion";

  const isLocationMissing =
    !isExternal && !("location" in params && params.location);
  const shouldShowError =
    isLocationMissing ||
    !("appellationCode" in params && "siret" in params) ||
    (!isLoading && !currentSearchResult);
  const [showConfirmationMessage, setShowConfirmationMessage] =
    useState<ReactNode | null>(null);

  useEffect(() => {
    if (!isExternal) {
      dispatch(
        searchSlice.actions.fetchSearchResultRequested({
          searchResult: {
            siret: params.siret,
            appellationCode: params.appellationCode[0],
            locationId:
              "location" in params && params.location
                ? params.location
                : undefined,
          },
          feedbackTopic: "search-result",
        }),
      );
    }
    if (isExternal) {
      dispatch(
        searchSlice.actions.externalSearchResultRequested({
          siretAndAppellation: {
            appellationCode: params.appellationCode[0],
            siret: params.siret,
          },
          feedbackTopic: "search-result",
        }),
      );
    }
  }, [dispatch, isExternal, params]);

  const onFormSubmitSuccess = () => {
    document.body.scrollIntoView({
      behavior: "smooth",
    });
    setShowConfirmationMessage(
      getFeedBackContent(
        currentUser,
        onGoBackClick,
        currentSearchResult?.contactMode,
      )?.content,
    );
  };
  const scrollToContactForm = () => {
    formContactRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };
  const onGoBackClick = () => {
    window.history.length > 2
      ? window.history.back()
      : frontRoutes.search({}).push();
  };

  const shouldShowPhysicalWorkModeInfos =
    currentSearchResult &&
    isInternalOfferDto(currentSearchResult) &&
    isPhysicalWorkMode(currentSearchResult.remoteWorkMode);

  return (
    <HeaderFooterLayout>
      <Helmet>
        <title>
          {getMetaForSearchResult(currentSearchResult).title} :{" "}
          {defaultMetaContents?.title}
        </title>
        <meta
          name="description"
          content={getMetaForSearchResult(currentSearchResult).description}
        />
      </Helmet>
      <MainWrapper layout="fullscreen" vSpacing={0}>
        <div className={fr.cx("fr-container")}>
          {isLoading && <Loader />}
          {shouldShowError && (
            <>
              {isLocationMissing && (
                <Alert
                  title={searchResultContent.error.locationMissingTitle}
                  description={
                    searchResultContent.error.locationMissingDescription
                  }
                  severity="error"
                  className={fr.cx("fr-my-4w")}
                />
              )}
              <Feedback topics={["search-result"]} />
              <Button
                id={searchResultIds.backToSearchButton}
                type="button"
                onClick={onGoBackClick}
                priority="tertiary"
                iconId="fr-icon-arrow-left-line"
                iconPosition="left"
                className={fr.cx("fr-mt-4w")}
              >
                {searchResultContent.error.backToSearchButton}
              </Button>
            </>
          )}
          {currentSearchResult && showConfirmationMessage === null && (
            <SearchResultHeader
              searchResult={currentSearchResult}
              ids={searchResultIds}
            />
          )}
          {currentSearchResult?.contactMode && showConfirmationMessage && (
            <FullPageFeedback
              {...feedbackMessageByContactMode({ currentUser, onGoBackClick })[
                currentSearchResult.contactMode
              ]}
              includeWrapper={false}
            />
          )}
        </div>
        {currentSearchResult && showConfirmationMessage === null && (
          <div
            className={cx(
              "im-search-result-page__content",
              fr.cx("fr-py-2w", "fr-py-md-5w"),
            )}
          >
            <div className={fr.cx("fr-container")}>
              <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
                <div className={fr.cx("fr-col-12", "fr-col-lg-8")}>
                  <div
                    className={
                      isLayoutDesktop
                        ? undefined
                        : cx(
                            "im-search-result-page__accordions",
                            fr.cx("fr-accordions-group", "fr-mb-2w"),
                          )
                    }
                  >
                    <SearchResultAbout
                      searchResult={currentSearchResult}
                      asAccordion={!isLayoutDesktop}
                      ids={searchResultIds}
                    />
                    <SearchResultJob
                      searchResult={currentSearchResult}
                      asAccordion={!isLayoutDesktop}
                      ids={searchResultIds}
                    />
                  </div>
                  {!currentSearchResult.voluntaryToImmersion && (
                    <div className={fr.cx("fr-mb-3w")}>
                      <p>
                        Cette entreprise n'est pas inscrite comme entreprise
                        accueillante mais peut recruter sur le métier que vous
                        souhaitez tester en immersion.
                      </p>
                      <ButtonsGroup
                        inlineLayoutWhen="md and up"
                        buttons={[
                          {
                            onClick: scrollToContactForm,
                            children: "Voir nos conseils",
                            priority: "secondary",
                          },
                          {
                            linkProps: {
                              href: currentSearchResult.urlOfPartner,
                              target: "_blank",
                            },
                            children: "Voir l'offre sur La Bonne Boite",
                          },
                        ]}
                      />
                    </div>
                  )}
                  <SearchResultContactSection
                    onFormSubmitSuccess={onFormSubmitSuccess}
                    formContactRef={formContactRef}
                    currentSearchResult={currentSearchResult}
                    onButtonClick={onGoBackClick}
                    ids={searchResultIds}
                  />
                </div>
                <div className={fr.cx("fr-col-12", "fr-col-lg-4")}>
                  {shouldShowPhysicalWorkModeInfos && (
                    <SearchResultLocation
                      searchResult={currentSearchResult}
                      isExternal={isExternal}
                      ids={searchResultIds}
                    />
                  )}
                  <SearchResultCompany
                    searchResult={currentSearchResult}
                    ids={searchResultIds}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </MainWrapper>
      {currentSearchResult && showConfirmationMessage === null && (
        <SectionSteps {...immersionStepsContent[internshipKind]} />
      )}
    </HeaderFooterLayout>
  );
};

type CreateDiscussionFeedbackContent = {
  content: ReactNode;
  illustration: string;
  title: string;
  buttons: ButtonProps[];
};

const getFeedBackContent = (
  currentUser: ConnectedUser | null,
  onGoBackClick: () => void,
  contactMode?: ContactMode,
): CreateDiscussionFeedbackContent | null =>
  contactMode
    ? feedbackMessageByContactMode({ currentUser, onGoBackClick })[contactMode]
    : null;

const feedbackMessageByContactMode = ({
  currentUser,
  onGoBackClick,
}: {
  currentUser: ConnectedUser | null;
  onGoBackClick: () => void;
}): Record<ContactMode, CreateDiscussionFeedbackContent> => ({
  EMAIL: {
    content: (
      <>
        <p>
          L’entreprise a bien reçu votre e-mail. Laissez-lui quelques jours pour
          vous répondre avant de la relancer.
        </p>
        <p>
          Gardez à l'esprit que les entreprises manquent parfois de temps et ne
          peuvent pas répondre à toutes les sollicitations : une absence de
          retour ne remet pas en cause votre valeur ! Contactez en moyenne 3
          entreprises pour maximiser vos chances d'obtenir une réponse
          favorable.
        </p>
        <Highlight>
          <strong>Suivez l'avancée de votre demande</strong> : Vous pouvez
          retrouver cette candidature et répondre aux futurs messages de
          l'entreprise directement depuis votre espace personnel.
        </Highlight>
      </>
    ),
    illustration: commonIllustrations.contact,
    title: "Votre demande de contact a bien été envoyée !",
    buttons: [
      {
        children: currentUser ? "Accéder à mon espace" : "Me connecter",
        onClick: () => {
          frontRoutes.beneficiaryDashboard().push();
        },
      },
      {
        children: "Retour à la recherche",
        onClick: onGoBackClick,
        priority: "secondary",
      },
    ],
  },
  PHONE: {
    content: (
      <>
        Cette entreprise souhaite être contactée <strong>par téléphone</strong>.
        Ses coordonnées vous ont été envoyées par email.
      </>
    ),
    illustration: commonIllustrations.inscription,
    title: "Merci pour votre intérêt !",
    buttons: [
      {
        children: "Retour à la recherche",
        onClick: onGoBackClick,
      },
    ],
  },
  IN_PERSON: {
    content: (
      <>
        Cette entreprise souhaite que vous vous{" "}
        <strong>rendiez sur place</strong>. Ses coordonnées vous ont été
        envoyées par email.
      </>
    ),
    illustration: commonIllustrations.annuaireDesEntreprises,
    title: "Merci pour votre intérêt !",
    buttons: [
      {
        children: "Retour à la recherche",
        onClick: onGoBackClick,
      },
    ],
  },
});
