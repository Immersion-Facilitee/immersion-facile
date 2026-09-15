import type { EmailButtonProps } from "./components/email";

type CreateEmailVariable<P> = (params: P) => {
  bypassLayout?: boolean;
  subject: string;
  greetings?: string;
  content?: string;
  highlight?: {
    kind?: "success" | "error" | "warning" | "info";
    content?: string;
  };
  highlightContentWithCTA?: {
    content?: string;
    button?: EmailButtonProps;
  };
  subContent?: string;
  legals?: string;
  agencyLogoUrl?: string;
  buttons?: EmailButtonProps[];
  attachmentUrls?: string[];
};

type Theme =
  | "authentification"
  | "espacePrescripteur"
  | "espaceEntreprise"
  | "acquisitionEntreprise"
  | "MER"
  | "bilan"
  | "convention"
  | "entrepriseBannie";
type ThemeTag = `theme:${Theme}`;

type Actor = "candidat" | "prescripteur" | "entreprise";
type ActorTag = `acteur:${Actor}`;

type Role =
  | "utilisateurInitiateur"
  | "utilisateurDestinataire"
  | "beneficiaire"
  | "representantLégal"
  | "employeurActuel"
  | "representantEntreprise"
  | "tuteur"
  | "admin"
  | "contact"
  | "valideur"
  | "preValideur"
  | "lecteur"
  | "adminIF"
  | "conseillerFTlié";
type RoleTag = `role:${Role}`;

type TemplateTag = `template:${string}`;

type NormalizedEmailTag = ThemeTag | ActorTag | RoleTag | TemplateTag;

export type HtmlTemplateEmailData<P> = {
  niceName: string;
  tags?: NormalizedEmailTag[];
  createEmailVariables: CreateEmailVariable<P>;
};

export const createTemplatesByName = <
  ParamsByEmailType extends { [K in string]: unknown } = never,
>(
  templatesByName: {
    [K in keyof ParamsByEmailType]: HtmlTemplateEmailData<ParamsByEmailType[K]>;
  },
) => templatesByName;
