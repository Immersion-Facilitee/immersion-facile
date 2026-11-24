import { fr } from "@codegouvfr/react-dsfr";
import {
  Tag as DsfrTag,
  type TagProps as DsfrTagProps,
} from "@codegouvfr/react-dsfr/Tag";

import { useStyles } from "tss-react/dsfr";
import Styles from "./Tag.styles";

type ThemeTag =
  | "rqth"
  | "superEnterprise"
  | "lbb"
  | "voluntaryToImmersion"
  | "prescripteur"
  | "structureAccompagnement"
  | "etablissement";

type TagProps = {
  theme: ThemeTag;
  label?: string;
  className?: string;
};

type Themes = Record<
  ThemeTag,
  {
    label: string;
    iconId: DsfrTagProps.WithIcon["iconId"];
  }
>;

const themes: Themes = {
  rqth: {
    label: "Personnes en situation de handicap bienvenues",
    iconId: "fr-icon-account-line",
  },
  superEnterprise: {
    label: "Super entreprise",
    iconId: "fr-icon-star-line",
  },
  lbb: {
    label: "Tentez votre chance",
    iconId: "fr-icon-draft-line",
  },
  voluntaryToImmersion: {
    label: "Entreprise accueillante",
    iconId: "fr-icon-team-line",
  },
  prescripteur: {
    iconId: "fr-icon-map-pin-user-line",
    label: "Prescripteur",
  },
  structureAccompagnement: {
    iconId: "fr-icon-parent-line",
    label: "Prescripteur",
  },
  etablissement: {
    iconId: "fr-icon-building-line",
    label: "Entreprise",
  },
};

export const Tag = ({ theme, label, className }: TagProps) => {
  const selectedTheme = themes[theme];
  const { cx } = useStyles();
  return (
    <DsfrTag
      className={cx(
        fr.cx("fr-mx-1w", "fr-my-1v", "fr-text--xs"),
        Styles.root,
        Styles[theme],
        className,
      )}
      iconId={selectedTheme.iconId}
    >
      {label ?? selectedTheme.label}
    </DsfrTag>
  );
};
