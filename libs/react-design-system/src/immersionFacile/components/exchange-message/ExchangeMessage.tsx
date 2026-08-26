import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";
import type { Capitalize } from "../../utils";
import Styles from "./ExchangeMessage.styles";

type ExchangeRole = "establishment" | "potentialBeneficiary";
type ForViewer = `for${Capitalize<ExchangeRole>}`;

const forViewer = (viewer: ExchangeRole): ForViewer => {
  const capitalizedViewer = viewer[0].toUpperCase() + viewer.slice(1);
  return `for${capitalizedViewer}` as ForViewer;
};

const senderBadge: Record<
  ExchangeRole,
  { label: string; colorClassName: "blue-cumulus" | "green-archipel" }
> = {
  establishment: { label: "Entreprise", colorClassName: "blue-cumulus" },
  potentialBeneficiary: { label: "Candidat", colorClassName: "green-archipel" },
};

export type ExchangeMessageProps = {
  sender: ExchangeRole;
  viewer: ExchangeRole;
  title: ReactNode;
  sentAt: ReactNode;
  children: ReactNode;
};

export const ExchangeMessage = ({
  sender,
  viewer,
  title,
  sentAt,
  children,
}: ExchangeMessageProps) => {
  const { cx } = useStyles();
  const badge = senderBadge[sender];
  return (
    <section
      className={cx(
        fr.cx("fr-mb-2w"),
        Styles.root,
        Styles[sender],
        Styles[forViewer(viewer)],
      )}
    >
      <header
        className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-mb-2w")}
      >
        <div className={Styles.title}>
          <p
            className={fr.cx(
              "fr-badge",
              "fr-badge--icon-left",
              `fr-badge--${badge.colorClassName}`,
              `${sender === "establishment" ? "fr-icon-building-fill" : "fr-icon-user-fill"}`,
            )}
          />
          <h2 className={fr.cx("fr-h4", "fr-m-0")}>{title}</h2>
        </div>
        <div className={Styles.headerMeta}>
          <div className={cx(Styles.badge, fr.cx("fr-mb-2w"))}>
            <Badge
              className={fr.cx("fr-badge", `fr-badge--${badge.colorClassName}`)}
            >
              {badge.label}
            </Badge>
          </div>
          <span className={fr.cx("fr-hint-text")}>{sentAt}</span>
        </div>
      </header>
      <hr className={fr.cx("fr-hr")} />
      <section>{children}</section>
    </section>
  );
};
