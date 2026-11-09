import { Button, type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { fr } from "@codegouvfr/react-dsfr/fr";
import type { ReactNode } from "react";
import { useStyles } from "tss-react/dsfr";

export type TableSortDirection = "asc" | "desc" | false;

export type SortableTableHeaderProps = {
  content: ReactNode;
  direction: TableSortDirection;
  onClick: () => void;
};

const sortIconIdByDirection = {
  false: "fr-icon-arrow-up-down-line",
  asc: "fr-icon-arrow-up-line",
  desc: "fr-icon-arrow-down-line",
} as const satisfies Record<`${TableSortDirection}`, ButtonProps["iconId"]>;

const sortTitleByDirection = {
  false: "Trier",
  asc: "Tri croissant",
  desc: "Tri décroissant",
} as const satisfies Record<`${TableSortDirection}`, string>;

export const SortableTableHeader = ({
  content,
  direction,
  onClick,
}: SortableTableHeaderProps) => {
  const { cx } = useStyles();

  return (
    <div className={cx(fr.cx("fr-grid-row", "fr-grid-row--middle"))}>
      <span>{content}</span>
      <Button
        type="button"
        className={fr.cx("fr-ml-auto")}
        priority="tertiary"
        size="small"
        iconId={sortIconIdByDirection[`${direction}`]}
        title={sortTitleByDirection[`${direction}`]}
        onClick={onClick}
      />
    </div>
  );
};
