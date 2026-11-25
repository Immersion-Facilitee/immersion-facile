import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { type ReactNode, useEffect, useState } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type EstablishmentFormOffer,
  establishmentFormOfferSchema,
  frontRoutes,
  getDisplayedBusinessName,
  replaceAtIndex,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import {
  type CurrentOffer,
  emptyOffer,
  OfferFields,
  offerFieldsErrorsFromIssues,
} from "src/app/components/forms/establishment/sections/offer/OfferFields";
import {
  establishmentEditSubmitLabel,
  establishmentOfferPageContent,
} from "src/app/contents/forms/establishment/formEstablishment";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import type { Route } from "type-route";
import type { $ZodIssue } from "zod/v4/core";

type EstablishmentOfferPageProps = {
  route: Route<typeof frontRoutes.establishmentDashboardEstablishmentOffer>;
};

export const EstablishmentOfferPage = ({
  route,
}: EstablishmentOfferPageProps): ReactNode => {
  const { siret, appellationCode } = route.params;
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const formEstablishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );
  const isLoading = useAppSelector(establishmentSelectors.isLoading);
  const feedback = useFeedbackTopic("form-establishment");
  const isOfferSaved =
    feedback?.on === "update" && feedback.level === "success";

  useEffect(() => {
    if (!connectedUserJwt) return;
    dispatch(
      establishmentSlice.actions.fetchEstablishmentRequested({
        establishmentRequested: { siret, jwt: connectedUserJwt },
        feedbackTopic: "form-establishment",
      }),
    );
    return () => {
      dispatch(establishmentSlice.actions.clearEstablishmentRequested());
    };
  }, [dispatch, connectedUserJwt, siret]);

  if (formEstablishment.siret !== siret)
    return isLoading ? (
      <Loader />
    ) : (
      <Feedback topics={["form-establishment"]} />
    );

  const offerIndex = formEstablishment.offers.findIndex(
    (offer) => offer.appellationCode === appellationCode,
  );

  return (
    <>
      <h1 className={fr.cx("fr-mb-1v")}>
        {establishmentOfferPageContent.title}
      </h1>
      <p className={fr.cx("fr-mb-4w")}>
        {establishmentOfferPageContent.subtitle(
          getDisplayedBusinessName(formEstablishment),
        )}
      </p>
      <Feedback topics={["form-establishment"]} />
      {isOfferSaved ? (
        <Button
          type="button"
          priority="secondary"
          id={
            domElementIds.establishmentDashboardEstablishmentOffer
              .backToEstablishmentDetailsButton
          }
          size="small"
          className={fr.cx("fr-mt-2w")}
          onClick={() => {
            dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
            frontRoutes
              .establishmentDashboardEstablishmentDetails({ siret })
              .push();
          }}
        >
          {establishmentOfferPageContent.backToEstablishmentDetailsLabel}
        </Button>
      ) : (
        <OfferEditionForm
          initialOffer={formEstablishment.offers[offerIndex] ?? emptyOffer}
          onOfferSubmitted={(offer) => {
            if (!connectedUserJwt) return;
            dispatch(
              establishmentSlice.actions.updateEstablishmentRequested({
                establishmentUpdate: {
                  formEstablishment: {
                    ...formEstablishment,
                    offers:
                      offerIndex === -1
                        ? [...formEstablishment.offers, offer]
                        : replaceAtIndex(
                            formEstablishment.offers,
                            offerIndex,
                            offer,
                          ),
                  },
                  jwt: connectedUserJwt,
                },
                feedbackTopic: "form-establishment",
              }),
            );
          }}
        />
      )}
      {isLoading && <Loader />}
    </>
  );
};

const OfferEditionForm = ({
  initialOffer,
  onOfferSubmitted,
}: {
  initialOffer: CurrentOffer;
  onOfferSubmitted: (offer: EstablishmentFormOffer) => void;
}): ReactNode => {
  const [offer, setOffer] = useState(initialOffer);
  const [issues, setIssues] = useState<$ZodIssue[]>([]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const result = establishmentFormOfferSchema.safeParse(offer);
        if (!result.success) return setIssues(result.error.issues);
        onOfferSubmitted(result.data);
      }}
    >
      <OfferFields
        mode="edit"
        offer={offer}
        onOfferChange={(offer) => {
          setIssues([]);
          setOffer(offer);
        }}
        {...offerFieldsErrorsFromIssues(issues)}
      />
      <Button
        type="submit"
        iconId="fr-icon-save-line"
        id={domElementIds.establishmentDashboardEstablishmentOffer.submitButton}
      >
        {establishmentEditSubmitLabel}
      </Button>
    </form>
  );
};
