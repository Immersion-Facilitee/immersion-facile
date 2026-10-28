import { fr } from "@codegouvfr/react-dsfr";
import { useEffect } from "react";
import { useStyles } from "tss-react/dsfr";
import { useDevice } from "../../hooks";
import { keys } from "../../utils";

export type NPSFormProps = {
  title?: string;
  formId: string;
  mode: "popup" | "embed";
  conventionInfos: {
    id: string;
    role: string;
    status: string;
  };
};
type TallyWindow = Window & {
  TallyConfig: Record<string, unknown> & {
    popup: {
      key?: string;
      layout?: "default" | "modal";
      width?: number;
      alignLeft?: boolean;
      hideTitle?: boolean;
      overlay?: boolean;
      emoji?: {
        text: string;
        animation:
          | "none"
          | "wave"
          | "tada"
          | "heart-beat"
          | "spin"
          | "flash"
          | "bounce"
          | "rubber-band"
          | "head-shake";
      };
      autoClose?: number;
      open?: {
        trigger: "time" | "scroll" | "exit";
        ms: number;
      };
      showOnce?: boolean;
      doNotShowAfterSubmit?: boolean;
      customFormUrl?: string;
      hiddenFields?: {
        [key: string]: any;
      };
      onOpen?: () => void;
      onClose?: () => void;
      onPageView?: (page: number) => void;
      onSubmit?: (payload: any) => void;
    };
  };
};
const componentName = "im-nps-form";

export const NPSForm = ({
  title,
  conventionInfos,
  formId,
  mode,
}: NPSFormProps) => {
  const { cx } = useStyles();
  const device = useDevice();
  const paramsAsString = [
    ...keys(conventionInfos).map((key) => `${key}=${conventionInfos[key]}`),
    `device=${device}`,
  ].join("&");

  useEffect(() => {
    if (mode === "popup") {
      const script = document.createElement("script");
      script.src = "https://tally.so/widgets/embed.js";
      document.body.appendChild(script);
      (window as unknown as TallyWindow).TallyConfig = {
        formId,
        popup: {
          emoji: {
            text: "👋",
            animation: "wave",
          },
          hiddenFields: {
            id: conventionInfos.id,
            role: conventionInfos.role,
            device,
          },
          open: {
            trigger: "time",
            ms: 2000,
          },
        },
      };
    }
  }, []);

  return mode === "embed" ? (
    <section className={cx(componentName)}>
      <hr className={fr.cx("fr-hr", "fr-my-4w")} />
      <iframe
        src={`https://tally.so/embed/${formId}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&${paramsAsString}`}
        loading="lazy"
        width="100%"
        height="290"
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        title={title}
        className={cx(`${componentName}__embed`)}
      />
    </section>
  ) : null;
};
