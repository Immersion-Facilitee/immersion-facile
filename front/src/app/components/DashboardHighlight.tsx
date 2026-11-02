import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { SectionHighlight } from "react-design-system";
import type { FeatureFlagHighlight } from "shared";

type DashboardHighlightProps = {
  highlight: FeatureFlagHighlight;
};

export const DashboardHighlight = ({ highlight }: DashboardHighlightProps) =>
  highlight.isActive && (
    <SectionHighlight>
      <h2 className={fr.cx("fr-h6", "fr-mb-1w")}>{highlight.value.title}</h2>
      <p className={fr.cx("fr-text--lg", "fr-mb-2w")}>
        {highlight.value.message}
      </p>
      <Button
        size="small"
        linkProps={{
          href: highlight.value.href,
          target: "_blank",
          rel: "noopener noreferrer",
        }}
      >
        {highlight.value.label}
      </Button>
    </SectionHighlight>
  );
