import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { useEffect } from "react";
import {
  Loader,
  MainWrapper,
  PageHeader,
  useScrollTo,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  allSignatoryRoles,
  archivedConventionErrorMessage,
  type ConventionJwtPayload,
  decodeMagicLinkJwtWithoutSignatureCheck,
  errors,
  type frontRoutes,
  isSignatory,
  type SignatoryRole,
} from "shared";
import { ConventionSignForm } from "src/app/components/forms/convention/ConventionSignForm";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import { match } from "ts-pattern";
import { useStyles } from "tss-react/dsfr";
import type { Route } from "type-route";
import { conventionSlice } from "../../../core-logic/domain/convention/convention.slice";
import { HeaderFooterLayout } from "../../components/layout/HeaderFooterLayout";
import { useConventionTexts } from "../../contents/forms/convention/textSetup";
import { useConvention } from "../../hooks/convention.hooks";
import { ShowConventionErrorOrRenewExpiredJwt } from "./ShowConventionErrorOrRenewExpiredJwt";

interface ConventionSignPageProperties {
  route: Route<typeof frontRoutes.conventionToSign>;
}

const useClearConventionOnUnmount = () => {
  const dispatch = useDispatch();
  return useEffect(
    () => () => {
      dispatch(conventionSlice.actions.clearFetchedConvention());
    },
    [dispatch],
  );
};

export const ConventionSignPage = ({ route }: ConventionSignPageProperties) => {
  useClearConventionOnUnmount();
  if (!route.params?.jwt) throw errors.routeParams.missingJwt();
  if (
    !isSignatory(
      decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(
        route.params.jwt,
      ).role,
    )
  )
    throw errors.user.notConventionSignatory();
  return (
    <HeaderFooterLayout>
      <ConventionSignPageContent jwt={route.params.jwt} />
    </HeaderFooterLayout>
  );
};

type ConventionSignPageContentProperties = {
  jwt: string;
};

const ConventionSignPageContent = ({
  jwt,
}: ConventionSignPageContentProperties): JSX.Element => {
  const { cx } = useStyles();
  const dispatch = useDispatch();
  const { applicationId: conventionId } =
    decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(jwt);
  const { convention, isLoading } = useConvention({ jwt, conventionId });
  const conventionFormFeedback = useFeedbackTopic("convention-form");
  const fetchConventionError =
    conventionFormFeedback?.level === "error" &&
    conventionFormFeedback.on === "fetch";

  useEffect(() => {
    dispatch(
      conventionSlice.actions.currentSignatoryRoleChanged(extractRole(jwt)),
    );
  }, [jwt, dispatch]);

  useEffect(() => {
    const siret = convention?.siret;
    if (siret) {
      dispatch(
        siretSlice.actions.siretModified({
          feedbackTopic: "siret-input",
          siret: siret,
          addressAutocompleteLocator: "convention-immersion-address",
        }),
      );
    }
  }, [dispatch, convention?.siret]);

  const t = useConventionTexts(
    convention ? convention.internshipKind : "immersion",
  );

  useScrollTo(true);

  return (
    <>
      {match({
        hasConvention: convention !== null, // to avoid Type instantiation is excessively deep and possibly infinite error
        isLoading,
        fetchConventionError,
      })
        .with({ isLoading: true }, () => <Loader />)
        .with({ fetchConventionError: true }, () => {
          const message = conventionFormFeedback?.message ?? "";
          if (message.includes(archivedConventionErrorMessage))
            throw frontErrors.convention.archived({ conventionId });

          return (
            <ShowConventionErrorOrRenewExpiredJwt
              errorMessage={message}
              jwt={jwt}
            />
          );
        })
        .with({ hasConvention: false }, () => (
          <Alert
            severity="error"
            title="Convention introuvable"
            description={errors.convention.notFound({ conventionId }).message}
          />
        ))
        .with(
          {
            hasConvention: true,
          },
          () => (
            <MainWrapper
              layout={"default"}
              vSpacing={0}
              pageHeader={
                <PageHeader
                  title={t.intro.conventionSignTitle}
                  badge={
                    convention && (
                      <Badge
                        className={cx(
                          fr.cx("fr-mb-3w"),
                          labelAndSeverityByStatus[convention.status].color,
                        )}
                      >
                        {
                          labelAndSeverityByStatus[convention.status].label
                            .agency
                        }
                      </Badge>
                    )
                  }
                />
              }
            >
              {convention && (
                <div className={fr.cx("fr-mb-4w")}>
                  {/* <Feedback topics={["convention-action-edit"]} closable /> */}
                  {convention.status === "REJECTED" && (
                    <Alert
                      severity="error"
                      title={t.sign.rejected.title}
                      description={
                        <>
                          <p className={fr.cx("fr-mt-1w")}>
                            {t.sign.rejected.detail}
                          </p>
                          <p>{t.sign.rejected.contact}</p>
                        </>
                      }
                    />
                  )}
                  {convention.status === "DEPRECATED" && (
                    <Alert
                      severity="error"
                      title={t.sign.deprecated.title}
                      description={
                        <>
                          <p className={fr.cx("fr-mt-1w")}>
                            {t.sign.deprecated.detail}
                          </p>
                          {convention.statusJustification ? (
                            <p>
                              Les raisons sont :{" "}
                              {convention.statusJustification}
                            </p>
                          ) : null}
                        </>
                      }
                    />
                  )}
                  {convention.status !== "REJECTED" &&
                    convention.status !== "DEPRECATED" && (
                      <ConventionSignForm convention={convention} jwt={jwt} />
                    )}
                </div>
              )}
            </MainWrapper>
          ),
        )
        .exhaustive()}
    </>
  );
};

const extractRole = (jwt: string): SignatoryRole => {
  const role =
    decodeMagicLinkJwtWithoutSignatureCheck<ConventionJwtPayload>(jwt).role;
  if (isSignatory(role)) return role;
  throw new Error(
    `Only ${allSignatoryRoles.join(", ")} are allow to sign, received ${role}`,
  );
};
