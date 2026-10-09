import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { Group } from "shared";
import { makeStyles } from "tss-react/dsfr";

const useStyles = makeStyles({ name: "GroupHeroHeader" });

export const GroupHeroHeader = ({ groupData }: { groupData: Group }) => {
  const { classes, cx } = useStyles(() => ({
    heroHeader: {
      background: groupData.options.heroHeader.backgroundColor,
    },
  }))();

  return (
    <section
      className={cx(fr.cx("fr-py-8w", "fr-py-md-16w"), classes.heroHeader)}
    >
      <div
        className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-container")}
      >
        <div className={fr.cx("fr-col", "fr-col-12", "fr-col-md-8")}>
          <h1>{groupData.options.heroHeader.title}</h1>
          <p>{groupData.options.heroHeader.description}</p>
          <Button priority="secondary" onClick={() => {}}>
            Trouver une immersion
          </Button>
        </div>
        {groupData.options.heroHeader.logoUrl && (
          <div
            className={fr.cx(
              "fr-col-12",
              "fr-col-md-3",
              "fr-col-offset-md-1",
              "fr-hidden",
              "fr-unhidden-md",
            )}
          >
            <img
              src={groupData.options.heroHeader.logoUrl}
              alt={groupData.name}
            />
          </div>
        )}
      </div>
    </section>
  );
};
