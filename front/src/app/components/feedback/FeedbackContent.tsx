import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { fr } from "@codegouvfr/react-dsfr/fr";
import type { FrCoreClassName } from "@codegouvfr/react-dsfr/fr/generatedFromCss/classNames";
import { PageHeader, type TitleLevel } from "react-design-system";
import type { ExtractFromExisting } from "shared";
import { match, P } from "ts-pattern";

export type FeedbackContentProps = {
  title: string;
  illustration: string;
  content: React.ReactNode;
  buttons: ButtonProps[];
  titleAs?: TitleLevel;
  titleClassName?: ExtractFromExisting<FrCoreClassName, `fr-${TitleLevel}`>;
};

export const FeedbackContent = ({
  illustration,
  title,
  titleAs = "h1",
  titleClassName,
  content,
  buttons,
}: FeedbackContentProps) => (
  <PageHeader
    title={title}
    illustration={illustration}
    titleAs={titleAs}
    titleClassName={titleClassName ?? ""}
  >
    {content}
    <div>
      {match(buttons)
        .with([], () => null)
        .with([P.any], (buttons) => (
          <Button {...buttons[0]} className={fr.cx("fr-mt-4w")} />
        ))
        .with([P.any, ...P.array()], (buttons) => (
          <ButtonsGroup
            buttons={buttons}
            inlineLayoutWhen="always"
            className={fr.cx("fr-mt-4w")}
          />
        ))
        .otherwise(() => null)}
    </div>
  </PageHeader>
);
