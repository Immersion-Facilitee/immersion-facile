import { fr } from "@codegouvfr/react-dsfr/fr";
import { useState } from "react";
import { MainWrapper, NavCard, PageHeader } from "react-design-system";
import {
  authRoutes,
  domElementIds,
  frontRoutes,
  makeUrlWithQueryParams,
} from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";

const useInitiateConventionRoute =
  makeUseTypedRoute<(typeof frontRoutes.initiateConvention)["name"]>();

export const InitiateConventionPage = () => {
  const route = useInitiateConventionRoute(["initiateConvention"]);
  const [showCandidateOptions, setShowCandidateOptions] = useState<boolean>(
    route.params.skipFirstStep !== undefined,
  );

  return (
    <HeaderFooterLayout>
      <MainWrapper
        layout="default"
        pageHeader={
          <PageHeader
            title={
              showCandidateOptions
                ? "Qui vous accompagne dans votre projet d'immersion ?"
                : "Remplir la demande de convention"
            }
            breadcrumbs={<Breadcrumbs />}
          />
        }
      >
        {!showCandidateOptions && (
          <section>
            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
              <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
                <NavCard
                  title="Je vais faire une immersion dans une entreprise"
                  icon="fr-icon-user-line"
                  overtitle="Candidat"
                  total={1}
                  type="candidate"
                  id={domElementIds.initiateConvention.navCards.candidate}
                  onClick={() => setShowCandidateOptions(true)}
                  withBorder
                  alternateTitle="Je vais faire une immersion dans une entreprise : je suis un candidat et je souhaite remplir une convention"
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
                <NavCard
                  title="Je vais accueillir un candidat dans mon entreprise"
                  icon="fr-icon-building-line"
                  overtitle="Entreprise"
                  total={1}
                  type="establishment"
                  id={domElementIds.initiateConvention.navCards.establishment}
                  link={frontRoutes.conventionImmersion().link}
                  withBorder
                  alternateTitle="Je vais accueillir un candidat dans mon entreprise : je suis un employeur et je souhaite initier une demande de convention"
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
                <NavCard
                  title="J'accompagne un bénéficiaire d'immersion"
                  icon="fr-icon-map-pin-user-line"
                  overtitle="Prescripteur"
                  total={1}
                  type="agency"
                  id={domElementIds.initiateConvention.navCards.agency}
                  link={frontRoutes.conventionImmersion().link}
                  withBorder
                  alternateTitle="J'accompagne un bénéficiaire d'immersion : je suis un conseiller en insertion professionnelle (Mission locale, CAP Emploi, France Travail, etc) et je souhaite remplir une convention pour un candidat"
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
                <NavCard
                  title="J'ai déjà rempli une convention mais j'ai un problème"
                  icon="fr-icon-alarm-warning-line"
                  overtitle="Tous"
                  total={1}
                  type="default"
                  id={domElementIds.initiateConvention.navCards.help}
                  link={{
                    href: "https://tally.so/r/mBdQQe",
                    target: "_blank",
                  }}
                  withBorder
                  alternateTitle="J'ai déjà rempli une convention mais j'ai un problème, j'ai besoin d'aide"
                />
              </div>
            </div>
            <div
              className={fr.cx(
                "fr-mt-5w",
                "fr-btns-group",
                "fr-btns-group--center",
              )}
            >
              <a
                id={domElementIds.initiateConvention.dontKnowCategoryButton}
                href="https://immersion-facile.beta.gouv.fr/aide/category/guide-de-limmersion-v19aod/"
                className={fr.cx(
                  "fr-link",
                  "fr-icon-arrow-right-line",
                  "fr-link--icon-right",
                )}
              >
                Je ne sais pas à quelle catégorie j'appartiens
              </a>
            </div>
          </section>
        )}

        {showCandidateOptions && (
          <section>
            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
              <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
                <NavCard
                  title="Je suis accompagné(e) par mon conseiller France Travail"
                  icon="fr-icon-parent-line"
                  type="candidate"
                  total={1}
                  id={domElementIds.initiateConvention.ftConnectButton}
                  link={{
                    href: makeUrlWithQueryParams(
                      `/api${authRoutes.initiateLoginByOAuth.url}`,
                      {
                        provider: "ftConnect",
                        redirectUri: `/${frontRoutes.conventionImmersion().href}`,
                      },
                    ),
                  }}
                  alternateTitle="Je suis accompagné(e) par mon conseiller France Travail et je peux me connecter via FranceConnect"
                  withBorder
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
                <NavCard
                  title="Je suis accompagné(e) par une autre structure"
                  icon="fr-icon-team-line"
                  type="candidate"
                  total={1}
                  id={domElementIds.initiateConvention.otherStructureButton}
                  link={frontRoutes.conventionImmersion().link}
                  withBorder
                  alternateTitle="Je suis accompagné(e) par une autre structure : si vous n'êtes pas accompagné par France Travail (CAP Emploi, Mission locale, etc), cliquez ici"
                />
              </div>
              <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
                <NavCard
                  title="Je n'ai pas encore de structure d'accompagnement"
                  icon="fr-icon-alarm-warning-line"
                  type="candidate"
                  total={1}
                  alternateTitle="Je n'ai pas encore de structure d'accompagnement : je n'ai pas de conseiller en insertion professionnelle ou je ne suis pas accompagné par une structure d'insertion"
                  id={domElementIds.initiateConvention.noStructureButton}
                  link={{
                    href: "https://immersion-facile.beta.gouv.fr/aide/article/je-nai-pas-de-structure-daccompagnement-et-je-veux-faire-une-immersion-1x15rdp/",
                    target: "_blank",
                  }}
                  withBorder
                />
              </div>
            </div>
            <div
              className={fr.cx(
                "fr-mt-5w",
                "fr-btns-group",
                "fr-btns-group--center",
              )}
            >
              <a
                id={domElementIds.initiateConvention.canIFillOnline}
                href="https://tally.so/r/w2X7xV"
                target="_blank"
                className={fr.cx(
                  "fr-link",
                  "fr-icon-arrow-right-line",
                  "fr-link--icon-right",
                )}
                rel="noreferrer"
              >
                Je ne sais pas si je peux remplir une convention en ligne dans
                mon cas
              </a>
            </div>
          </section>
        )}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};
