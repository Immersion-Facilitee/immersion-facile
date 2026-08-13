import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import ProConnectButton from "@codegouvfr/react-dsfr/ProConnectButton";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import Tile from "@codegouvfr/react-dsfr/Tile";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import {
  Loader,
  MainWrapper,
  type MainWrapperProps,
  PageHeader,
  SeparatedSection,
} from "react-design-system";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AllowedLoginSource,
  absoluteUrlSchema,
  authRoutes,
  domElementIds,
  type Email,
  emailSchema,
  frontRoutes,
  immersionFacileHelpdeskRootUrl,
  immersionFacileNoReplyEmail,
  isFederatedIdentityProvider,
  makeUrlWithQueryParams,
  toLowerCaseWithoutDiacritics,
  useRoute,
  withRedirectUriSchema,
} from "shared";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FrontAdminRouteTab } from "src/app/pages/admin/AdminTabs";
import type { ConventionTemplateFormRoute } from "src/app/pages/convention/ConventionTemplateForm";
import { commonIllustrations } from "src/assets/img/illustrations";
import { outOfReduxDependencies } from "src/config/dependencies";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { match } from "ts-pattern";
import type { Route } from "type-route";
import { z } from "zod";
import { WithFeedbackReplacer } from "../../components/feedback/WithFeedbackReplacer";
import {
  EmailValidationInput,
  makeStateRelated,
} from "../../components/forms/commons/EmailValidationInput";
import { makeFieldError } from "../../hooks/formContents.hooks";
import { LoginByEmailFeedbackPage } from "./LoginByEmailFeedbackPage";

export type FrontAdminRoute =
  | FrontAdminRouteTab
  | Route<typeof frontRoutes.adminUserDetail>
  | Route<typeof frontRoutes.adminUserDetailAgencies>
  | Route<typeof frontRoutes.adminUserDetailEstablishments>
  | Route<typeof frontRoutes.adminConventionDetail>
  | Route<typeof frontRoutes.adminAgencyDetail>;

export const agencyDashboardTabsList = [
  "agencyDashboardMain",
  "agencyDashboardAgencies",
  "agencyManagement",
  "establishmentManagement",
  "statsEstablishmentDetails",
] satisfies AgencyDashboardRouteName[];

export type AgencyTabRoute = (typeof agencyDashboardTabsList)[number];

export const agencyDashboardRoutes = [
  "agencyDashboardMain",
  "agencyDashboardAgencies",
  "agencyDashboardAgencyDetails",
  "agencyDashboardOnboarding",
  "statsEstablishmentDetails",
  "agencyManagement",
  "establishmentManagement",
] satisfies AgencyDashboardRouteName[];

export type BeneficiaryDashboardRouteName =
  FrontBeneficiaryDashboardRoute["name"];

export type FrontBeneficiaryDashboardRoute =
  | Route<typeof frontRoutes.beneficiaryDashboard>
  | Route<typeof frontRoutes.beneficiaryDashboardDiscussions>
  | Route<typeof frontRoutes.beneficiaryDashboardConventions>;

export type EstablishmentDashboardRouteName =
  FrontEstablishmentDashboardRoute["name"];

export type FrontEstablishmentDashboardRoute =
  | Route<typeof frontRoutes.establishmentDashboard>
  | Route<typeof frontRoutes.establishmentDashboardConventions>
  | Route<typeof frontRoutes.establishmentDashboardFormEstablishment>
  | Route<typeof frontRoutes.establishmentDashboardDiscussions>;

export const establishmentDashboardRoutes = [
  "establishmentDashboard",
  "establishmentDashboardConventions",
  "establishmentDashboardFormEstablishment",
  "establishmentDashboardDiscussions",
] satisfies EstablishmentDashboardRouteName[];

export type AgencyDashboardRouteName = FrontAgencyDashboardRoute["name"];

export type FrontAgencyDashboardRoute =
  | Route<typeof frontRoutes.agencyDashboardMain>
  | Route<typeof frontRoutes.agencyDashboardOnboarding>
  | Route<typeof frontRoutes.agencyDashboardAgencies>
  | Route<typeof frontRoutes.agencyDashboardAgencyDetails>
  | Route<typeof frontRoutes.agencyManagement>
  | Route<typeof frontRoutes.establishmentManagement>
  | Route<typeof frontRoutes.statsEstablishmentDetails>;

export type FrontDashboardRoute =
  | FrontAgencyDashboardRoute
  | FrontEstablishmentDashboardRoute
  | FrontBeneficiaryDashboardRoute
  | ConventionTemplateFormRoute;

type ConnectPrivateRoute =
  | FrontAdminRoute
  | FrontDashboardRoute
  | Route<typeof frontRoutes.formEstablishment>
  | Route<typeof frontRoutes.myAccount>
  | Route<typeof frontRoutes.myAccountAgencies>
  | Route<typeof frontRoutes.myAccountAgencyRegistration>
  | Route<typeof frontRoutes.myAccountEstablishments>
  | Route<typeof frontRoutes.myAccountEstablishmentRegistration>
  | Route<typeof frontRoutes.addAgency>
  | Route<typeof frontRoutes.archivedConventionRequest>
  | Route<typeof frontRoutes.manageConventionConnectedUser>
  | Route<typeof frontRoutes.beneficiaryDashboardDiscussions>;

type ConnectedPrivateRoutePageProps = {
  route: ConnectPrivateRoute;
  children: ReactNode;
  oAuthConnectionPageHeader: ReactElement;
  allowAdminOnly?: boolean;
  mainWrapperProps?: Omit<
    MainWrapperProps,
    "layout" | "children" | "useBackground" | "backgroundStyles"
  >;
};

export const loginByEmailFeedbackTopic: FeedbackTopic = "login-by-email";

export const ConnectedPrivateRoutePage = ({
  route,
  children,
  allowAdminOnly,
  mainWrapperProps,
}: ConnectedPrivateRoutePageProps) => {
  const dispatch = useDispatch();
  const isConnectedUser = useAppSelector(authSelectors.isConnectedUser);
  const authIsLoading = useAppSelector(authSelectors.isLoading);
  const isLoadingUser = useAppSelector(connectedUserSelectors.isLoading);
  const isAdminConnected = useAppSelector(authSelectors.isAdminConnected);

  const afterLoginRedirectionUrl = useAppSelector(
    authSelectors.afterLoginRedirectionUrl,
  );

  useEffect(() => {
    const { token, provider, idToken = "" } = route.params;

    if (
      token &&
      provider &&
      isFederatedIdentityProvider(provider) &&
      provider !== "ftConnect"
    ) {
      dispatch(
        authSlice.actions.federatedIdentityProvided({
          federatedIdentity: {
            provider,
            token,
            idToken,
          },
          feedbackTopic: "auth-global",
        }),
      );

      const { token: _, ...routeParams } = route.params;
      frontRoutes[route.name](routeParams as any).replace();
    }
  }, [route.params, dispatch, route.name]);

  useEffect(() => {
    if (!authIsLoading && !isConnectedUser) {
      const windowUrl = absoluteUrlSchema.parse(window.location.href);
      dispatch(
        authSlice.actions.saveRedirectionAfterLoginRequested({
          url: windowUrl,
        }),
      );
    }
    if (!authIsLoading && isConnectedUser && afterLoginRedirectionUrl)
      dispatch(authSlice.actions.redirectAndClearUrlAfterLoginRequested());
  }, [authIsLoading, isConnectedUser, afterLoginRedirectionUrl, dispatch]);

  const page = getAllowedStartAuthPage(route.name, route.params);

  const [selectedLoginPersona, setSelectedLoginPersona] =
    useState<LoginPersona | null>(loginPersonaByLoginSource[page]);

  const alreadyUsedAuthentication = route.params.alreadyUsedAuthentication;

  if (!isConnectedUser) {
    return (
      <WithFeedbackReplacer
        topic={loginByEmailFeedbackTopic}
        renderFeedback={({ level }) => (
          <LoginByEmailFeedbackPage
            mode={level === "success" ? "success" : "failed"}
            page={page}
          />
        )}
      >
        <HeaderFooterLayout>
          <MainWrapper
            layout="default"
            pageHeader={
              <PageHeader title={"Connexion ou création de compte"}>
                {alreadyUsedAuthentication && (
                  <Alert
                    className={fr.cx("fr-mb-2w")}
                    severity="warning"
                    title="Ce lien d'authentification a déjà été utilisé."
                    description="Veuillez renouveler votre demande de connexion."
                  />
                )}
                <p className={fr.cx("fr-text--lead")}>
                  La connexion crée votre compte automatiquement, sans démarche
                  supplémentaire.
                </p>

                <div>
                  <h2 className={fr.cx("fr-h4", "fr-mb-2w")}>Vous êtes...</h2>

                  <RadioButtons
                    id={domElementIds.loginPersona.radioButtons}
                    className={fr.cx("fr-mb-2w")}
                    classes={{ inputGroup: fr.cx("fr-col-4") }}
                    name="loginPersona"
                    orientation="horizontal"
                    options={[
                      {
                        label: "Un candidat",
                        hintText:
                          "Vous souhaitez découvrir un métier, initier une démarche de recrutement ou confirmer un projet pro ?",
                        illustration: (
                          <img
                            alt="Candidat"
                            src={commonIllustrations.candidate}
                          />
                        ),
                        nativeInputProps: {
                          value: "beneficiary",
                          checked: selectedLoginPersona === "beneficiary",
                          onChange: () =>
                            setSelectedLoginPersona("beneficiary"),
                        },
                      },
                      {
                        label: "Un professionnel",
                        hintText:
                          "Vous accueillez des personnes en immersion ou vous prescrivez des immersions pour vos bénéficiaires ?",
                        illustration: (
                          <img
                            alt="Professionnel"
                            src={commonIllustrations.miseEnRelation}
                          />
                        ),
                        nativeInputProps: {
                          value: "professional",
                          checked: selectedLoginPersona === "professional",
                          onChange: () =>
                            setSelectedLoginPersona("professional"),
                        },
                      },
                    ]}
                  />

                  {match(selectedLoginPersona)
                    .with("beneficiary", () => (
                      <div className={fr.cx("fr-col-12", "fr-col-lg-8")}>
                        <LoginWithEmail page={page} />
                      </div>
                    ))
                    .with("professional", () => (
                      <SeparatedSection
                        firstSection={<LoginWithEmail page={page} />}
                        secondSection={
                          <LoginWithProConnect
                            page={page}
                            redirectUri={route.href}
                          />
                        }
                      />
                    ))
                    .with(null, () => null)
                    .exhaustive()}

                  {selectedLoginPersona && (
                    <p className={fr.cx("fr-hint-text")}>
                      Si votre messagerie est protégée une anti-spam, pensez à
                      ajouter l’adresse{" "}
                      <strong>{immersionFacileNoReplyEmail}</strong> à votre
                      liste de contacts autorisés.
                    </p>
                  )}
                </div>
              </PageHeader>
            }
            vSpacing={2}
          >
            {selectedLoginPersona && (
              <section className={fr.cx("fr-mb-8w")}>
                <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
                  {loginCardsByPersona[selectedLoginPersona].map((card) => (
                    <div
                      className={fr.cx("fr-col-12", "fr-col-lg-4")}
                      key={card.description?.toString()}
                    >
                      <Tile
                        title={card.title}
                        desc={card.description}
                        imageUrl={card.illustration}
                        imageAlt=""
                        imageSvg={false}
                        detail={
                          card.link ? (
                            <a
                              href={card.link.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {card.link.label}
                            </a>
                          ) : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </MainWrapper>
        </HeaderFooterLayout>
      </WithFeedbackReplacer>
    );
  }

  if (isLoadingUser) return <Loader />;

  if (allowAdminOnly && !isAdminConnected)
    return (
      <HeaderFooterLayout>
        <MainWrapper layout="default">
          <Alert
            severity="error"
            title={"Accès refusé"}
            description={
              "Vous n'avez pas les droits nécessaires pour accéder à cette page."
            }
          />
        </MainWrapper>
      </HeaderFooterLayout>
    );
  return (
    <HeaderFooterLayout>
      <MainWrapper layout="default" {...mainWrapperProps}>
        {children}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};

const getAllowedStartAuthPage = (
  routeName: ConnectPrivateRoute["name"],
  routeParams: ConnectPrivateRoute["params"],
): AllowedLoginSource => {
  if (routeName === "myAccount") return "myAccount";
  if (routeName === "myAccountEstablishmentRegistration") return "myAccount";
  if (routeName === "beneficiaryDashboardDiscussions")
    return "beneficiaryDashboardDiscussions";
  if (routeName === "beneficiaryDashboardConventions")
    return "beneficiaryDashboardConventions";
  if (routeName === "beneficiaryDashboard") return "beneficiaryDashboard";
  if (routeName === "establishmentDashboardDiscussions")
    return "establishmentDashboardDiscussions";
  if (routeName === "manageConventionConnectedUser")
    return "manageConventionConnectedUser";
  if (routeName === "archivedConventionRequest")
    return "archivedConventionRequest";
  if (
    agencyDashboardRoutes.includes(routeName as AgencyDashboardRouteName) &&
    "isAgencyRegistration" in routeParams &&
    (routeParams as { isAgencyRegistration?: boolean }).isAgencyRegistration
  )
    return "addAgency";
  if (
    establishmentDashboardRoutes.includes(
      routeName as EstablishmentDashboardRouteName,
    )
  )
    return "establishmentDashboard";
  if (agencyDashboardRoutes.includes(routeName as AgencyDashboardRouteName))
    return "agencyDashboard";
  if (routeName === "formEstablishment") return "formEstablishment";
  return "admin";
};

type LoginPersona = "professional" | "beneficiary";

const loginPersonaByLoginSource: Record<
  AllowedLoginSource,
  LoginPersona | null
> = {
  formEstablishment: "professional",
  establishmentDashboard: "professional",
  establishmentDashboardDiscussions: "professional",
  addAgency: "professional",
  agencyDashboard: "professional",
  agencyDashboardAgencyDetails: "professional",
  manageConventionConnectedUser: "professional",
  admin: "professional",
  conventionTemplate: "professional",
  beneficiaryDashboard: "beneficiary",
  beneficiaryDashboardDiscussions: "beneficiary",
  beneficiaryDashboardConventions: "beneficiary",
  archivedConventionRequest: null,
  myAccount: null,
};

type LoginPersonaCard = {
  title: string;
  description: ReactNode;
  link?: {
    href?: string;
    label: string;
  };
  illustration: string;
};

const loginCardsByPersona: Record<LoginPersona, LoginPersonaCard[]> = {
  professional: [
    {
      title: "Vos démarches centralisées",
      description:
        "Retrouvez et pilotez facilement l'ensemble de vos démarches depuis votre espace.",
      illustration: commonIllustrations.warning,
    },
    {
      title: "Des démarches simplifiées",
      description:
        "Gagnez un temps précieux grâce à nos conventions d'immersion entièrement dématérialisées.",
      illustration: commonIllustrations.inscription,
    },
    {
      title: "Un accès simplifié",
      description:
        "Utilisez un seul identifiant pour vous connecter à l’ensemble des sites partenaires ProConnect.",
      illustration: commonIllustrations.monCompte,
    },
  ],
  beneficiary: [
    {
      title: "Gérer mes candidatures",
      description:
        "Retrouvez tous vos échanges. Répondez aux entreprises et suivez l'avancement de vos demandes en temps réel.",
      illustration: commonIllustrations.warning,
      link: {
        href: `${immersionFacileHelpdeskRootUrl}/article/mon-espace-candidat-1thteqo/`,
        label: "Comment fonctionne l'espace candidat ?",
      },
    },
    {
      title: "Suivre ma convention",
      description:
        "Suivez et gérez vos conventions et bilans à chaque étape, directement depuis vos mails ou votre espace.",
      illustration: commonIllustrations.inscription,
      link: {
        href: `${immersionFacileHelpdeskRootUrl}/article/comment-suivre-ma-demande-de-convention-1gbhxt4/`,
        label: "Comment suivre ma demande de convention ?",
      },
    },
    {
      title: "S'orienter et s'informer",
      description:
        "Vous avez des questions sur l'immersion ou vous n'êtes pas encore accompagné ? Trouvez les réponses dans notre guide.",
      illustration: commonIllustrations.monCompte,
      link: {
        href: `${immersionFacileHelpdeskRootUrl}/category/candidat-jikpz1/`,
        label: "Consulter le centre d'aide",
      },
    },
  ],
};

const LoginWithEmail = ({ page }: { page: AllowedLoginSource }) => {
  const route = useRoute();
  const methods = useForm<{
    email: Email;
  }>({
    resolver: zodResolver(z.object({ email: emailSchema })),
    mode: "onTouched",
  });
  const dispatch = useDispatch();
  const getFieldError = makeFieldError(methods.formState);
  const isRequestingLoginByEmail = useAppSelector(
    authSelectors.isRequestingLoginByEmail,
  );
  const [emailValidationFeedback, setEmailValidationFeedback] =
    useState<ReturnType<typeof makeStateRelated> | null>(null);

  const requestLoginByEmailIfValidEmail = async ({
    email,
  }: {
    email: Email;
  }) => {
    const feedback = makeStateRelated(
      await outOfReduxDependencies.technicalGateway.getEmailStatus(email),
    );
    setEmailValidationFeedback(feedback);

    if (feedback.state === "error") return;

    dispatch(
      authSlice.actions.loginByEmailRequested({
        email,
        redirectUri: route.href,
        feedbackTopic: loginByEmailFeedbackTopic,
      }),
    );
  };

  return (
    <>
      {isRequestingLoginByEmail && <Loader />}
      <p>
        <strong>Continuer avec un email</strong>, et recevez un lien directement
        pour accéder à votre espace sans délai.
      </p>
      <div className={fr.cx("fr-my-2w")}>
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(requestLoginByEmailIfValidEmail)}
          >
            <EmailValidationInput
              label={"Email"}
              nativeInputProps={{
                ...methods.register("email", {
                  setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
                  onChange: () => setEmailValidationFeedback(null),
                }),
                onBlur: (event) => {
                  methods.setValue(
                    "email",
                    toLowerCaseWithoutDiacritics(event.currentTarget.value),
                  );
                },
              }}
              {...(getFieldError("email") ?? emailValidationFeedback)}
              onEmailValidationFeedback={setEmailValidationFeedback}
            />
            <Button
              id={domElementIds[page].login.byEmailButton}
              nativeButtonProps={{
                onMouseDown: (event) => {
                  event.preventDefault();
                },
              }}
            >
              Recevoir le lien de connexion
            </Button>
          </form>
        </FormProvider>
      </div>
    </>
  );
};

const LoginWithProConnect = ({
  redirectUri,
  page,
}: {
  redirectUri: string;
  page: AllowedLoginSource;
}) => {
  const isRedirectUriAllowed = withRedirectUriSchema.safeParse({
    redirectUri,
  }).success;
  return (
    <>
      {!isRedirectUriAllowed && (
        <Alert
          severity="error"
          title="L'URL de redirection n'est pas autorisée"
        />
      )}
      <p>
        <strong>Connectez-vous avec ProConnect</strong>, et accédez à votre
        espace avec votre identité professionnelle sécurisée (24h de
        validation).
      </p>
      <div className={fr.cx("fr-my-2w")}>
        <ProConnectButton
          id={domElementIds[page].login.proConnectButton}
          url={makeUrlWithQueryParams(
            `/api${authRoutes.initiateLoginByOAuth.url}`,
            {
              provider: "proConnect",
              redirectUri,
            },
          )}
        />
      </div>
    </>
  );
};
