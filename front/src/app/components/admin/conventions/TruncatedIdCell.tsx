import { fr } from "@codegouvfr/react-dsfr";
import { CopyButton } from "react-design-system";
import type { Link } from "type-route";
import Styles from "./TruncatedIdCell.styles";

type TruncatedIdCellProps = {
  id: string;
  copyButtonId: string;
  link?: Link & { id: string };
};

export const TruncatedIdCell = ({
  id,
  copyButtonId,
  link,
}: TruncatedIdCellProps): React.ReactNode => {
  const truncatedAndFullId = (
    <>
      <span aria-hidden="true">{`${id.slice(0, 4)}…`}</span>
      <span className={fr.cx("fr-sr-only")}>{id}</span>
    </>
  );

  return (
    <span className={Styles.root}>
      {link ? (
        <a {...link} title={id}>
          {truncatedAndFullId}
        </a>
      ) : (
        <span title={id}>{truncatedAndFullId}</span>
      )}
      <CopyButton
        id={copyButtonId}
        label={`Copier l'identifiant ${id}`}
        textToCopy={id}
        withIcon
        iconOnly
      />
    </span>
  );
};
