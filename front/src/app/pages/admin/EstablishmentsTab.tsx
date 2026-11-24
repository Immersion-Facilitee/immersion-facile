import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import { frontRoutes, useRoute } from "shared";
import { AddEstablishmentsByBatch } from "src/app/components/admin/establishments/AddEstablishmentsByBatch";
import { ManageEstablishment } from "src/app/components/admin/establishments/ManageEstablishment";
import { Feedback } from "src/app/components/feedback/Feedback";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { MetabaseView } from "src/app/components/MetabaseView";
import { makeStyles } from "tss-react/dsfr";
import type { Route } from "type-route";
import { useAdminDashboard } from "./useAdminDashboard";

export const EstablishmentsTab = () => {
  const route = useRoute() as Route<typeof frontRoutes.adminEstablishments>;
  const { siret } = route.params;
  const { url, error } = useAdminDashboard({ name: "adminEstablishments" });
  const { cx } = useStyles();

  if (error)
    return <Alert severity="error" title="Erreur" description={error} />;

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
        <EstablishmentForm mode="admin" />
      </>
    );

  return (
    <div className={cx("admin-tab__import-establishments")}>
      <Feedback topics={["ban-establishment"]} className={fr.cx("fr-mb-2w")} />
      <ManageEstablishment />
      <MetabaseView title="Consulter les entreprises" url={url} />
      <AddEstablishmentsByBatch />
    </div>
  );
};

const useStyles = makeStyles()({});
