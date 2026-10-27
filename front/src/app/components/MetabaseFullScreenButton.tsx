import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Tooltip from "@codegouvfr/react-dsfr/Tooltip";
import type { AbsoluteUrl } from "shared";

export const MetabaseFullScreenButton = ({
  id,
  url,
  tooltipText,
  label = "Ouvrir en plein écran",
}: {
  id?: string;
  url: AbsoluteUrl;
  label?: string;
  tooltipText?: string;
}) => {
  if (tooltipText)
    return (
      <Tooltip title={tooltipText}>
        <Button
          id={id}
          linkProps={{
            target: "_blank",
            rel: "noreferrer",
            href: url,
          }}
          size="small"
          priority="tertiary"
          className={fr.cx("fr-ml-auto")}
        >
          {label}
        </Button>
      </Tooltip>
    );

  return (
    <Button
      id={id}
      linkProps={{
        target: "_blank",
        rel: "noreferrer",
        href: url,
      }}
      size="small"
      priority="tertiary"
      className={fr.cx("fr-ml-auto")}
    >
      {label}
    </Button>
  );
};
