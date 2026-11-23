import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { frontRoutes, useRoute } from "shared";
import { AddEstablishmentsByBatch } from "src/app/components/admin/establishments/AddEstablishmentsByBatch";
import { AdminEstablishmentListSection } from "src/app/components/admin/establishments/AdminEstablishmentListSection";
import { Feedback } from "src/app/components/feedback/Feedback";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { makeStyles } from "tss-react/dsfr";
import type { Route } from "type-route";

export const EstablishmentsTab = () => {
  const route = useRoute() as Route<typeof frontRoutes.adminEstablishments>;
  const { siret } = route.params;
  const { cx } = useStyles();
  const dispatch = useDispatch();

  useEffect(
    () => () => {
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics(["ban-establishment"]),
      );
    },
    [dispatch, siret],
  );

  if (siret)
    return (
      <>
        <Button
          linkProps={frontRoutes.adminEstablishments().link}
          iconId="fr-icon-arrow-go-back-line"
          iconPosition="left"
          size="small"
          priority="tertiary"
          className={cx("fr-mb-2w")}
        >
          Retour
        </Button>
        <Feedback
          topics={["ban-establishment"]}
          className={fr.cx("fr-mb-2w")}
        />
        <EstablishmentForm mode="admin" />
      </>
    );

  return (
    <div className={cx("admin-tab__import-establishments")}>
      <AdminEstablishmentListSection />
      <AddEstablishmentsByBatch />
    </div>
  );
};

const useStyles = makeStyles()({});
