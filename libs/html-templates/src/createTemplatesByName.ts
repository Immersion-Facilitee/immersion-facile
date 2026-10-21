import type { EmailVariables, RawEmailVariables } from "./email/emailVariables";

type CreateEmailVariable<P> = (params: P) => EmailVariables | RawEmailVariables;

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
