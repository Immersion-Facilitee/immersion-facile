import annuaireDesEntreprises from "./annuaire-des-entreprises.webp";
import candidate from "./candidate-illustration.webp";
import contact from "./contact.webp";
import discussions from "./discussions.webp";
import documentsAdministratifs from "./documents-administratifs.webp";
import error from "./error-illustration.webp";
import errorMissing from "./error-missing-illustration.webp";
import fillForm from "./fill-form.webp";
import infosImportantes from "./infos-importantes.webp";
import inscription from "./inscription.webp";
import job from "./job-illustration.webp";
import login from "./login-illustration.webp";
import miseEnRelation from "./mise-en-relation-illustration.webp";
import monCompte from "./mon-compte.webp";
import objective from "./objective-illustration.webp";
import reachData from "./reach-data.webp";
import search1 from "./search-illustration-0.webp";
import search2 from "./search-illustration-1.webp";
import search3 from "./search-illustration-2.webp";
import search4 from "./search-illustration-3.webp";
import structureAccueil from "./structure-accueil.webp";
import success from "./success-illustration.webp";

export const commonIllustrations = {
  error,
  warning: infosImportantes,
  job,
  objective,
  success,
  reachData,
  annuaireDesEntreprises,
  inscription,
  monCompte,
  documentsAdministratifs,
  contact,
  errorMissing,
  fillForm,
  structureAccueil,
  discussions,
  candidate,
  miseEnRelation,
};
export const searchIllustrations = [search1, search2, search3, search4];
export const loginIllustration = login;
export const nextStepIllustrations = [
  contact,
  documentsAdministratifs,
  commonIllustrations.warning,
];
export const formIllustration = fillForm;
