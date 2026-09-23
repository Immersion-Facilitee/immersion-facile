import type {
  EmailBlock,
  EmailButtonProps,
  HighlightKind,
} from "./components/email";

type FixedEmailParts = {
  bypassLayout?: boolean;
  subject: string;
  greetings?: string;
  signature?: string;
  legals?: string;
  agencyLogoUrl?: string;
  attachmentUrls?: string[];
};

type LegacyBodyParts = {
  content?: string;
  highlight?: {
    kind?: HighlightKind;
    content?: string;
  };
  highlightContentWithCTA?: {
    content?: string;
    button?: EmailButtonProps;
  };
  subContent?: string;
  buttons?: EmailButtonProps[];
};

type OrderedBodyParts = {
  blocks: EmailBlock[];
};

export type LegacyEmailVariables = FixedEmailParts & LegacyBodyParts;

export type OrderedEmailVariables = FixedEmailParts & OrderedBodyParts;

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

type EmailTemplateIdentity = {
  niceName: string;
  tags?: NormalizedEmailTag[];
};

export type HtmlTemplateEmailData<P> = EmailTemplateIdentity & {
  createEmailVariables: (
    params: P,
  ) => LegacyEmailVariables | OrderedEmailVariables;
};

export type OrderedEmailTemplateData<P> = EmailTemplateIdentity & {
  createEmailVariables: (params: P) => OrderedEmailVariables;
};

export const createTemplatesByName = <
  ParamsByEmailType extends { [K in string]: unknown } = never,
>(
  templatesByName: {
    [K in keyof ParamsByEmailType]: HtmlTemplateEmailData<ParamsByEmailType[K]>;
  },
) => templatesByName;
