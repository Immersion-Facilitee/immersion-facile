import { createTemplatesByName } from "html-templates";
import {
  type AbsoluteUrl,
  immersionFacileHelpdeskRootUrl,
} from "../AbsoluteUrl";
import {
  type ConventionId,
  type InternshipKind,
  labelsForImmersionObjective,
} from "../convention/convention.dto";
import type {
  DiscussionExchangeForbiddenParams,
  DiscussionExchangeForbiddenReason,
  ExchangeRole,
} from "../discussion/discussion.dto";
import { isDiscussionExchangeForbiddenParamsWithRequestEstablishmentRegistrationUrl } from "../discussion/discussion.schema";
import type { AgencyRole } from "../role/role.dto";
import { titleByRole } from "../role/role.utils";
import { frontRoutes, makeRouteAbsoluteUrl } from "../routes/routes";
import { isStringDate, toDisplayedDate } from "../utils/date";
import { displayDuration, oneMinuteInSeconds } from "../utils/durations";
import { joinWithCommasAnd } from "../utils/string";
import { advices } from "./advices";
import { defaultConventionFinalLegals } from "./defaultConventionFinalLegals";
import type { EmailParamsByEmailType } from "./EmailParamsByEmailType";
import { emailAttachements } from "./email.content";
import {
  immersionFacileContactEmail,
  immersionFacileDelegationEmail,
} from "./knownEmailsAddresses";

const defaultSignature = (internshipKind?: InternshipKind) =>
  internshipKind === "mini-stage-cci"
    ? `
    Bonne journée, 
    L’équipe de votre Chambre consulaire.
    `
    : `
    Bonne journée,
    L'équipe Immersion Facilitée
    `;

const displayDate = (date: string) => {
  return isStringDate(date)
    ? toDisplayedDate({ date: new Date(date) })
    : "DATE INVALIDE";
};

// to add a new EmailType, or changes the params of one, edit first EmailParamsByEmailType and let types guide you
export const emailTemplatesByName =
  createTemplatesByName<EmailParamsByEmailType>({
    AGENCY_ADMIN_NEW_USERS_TO_REVIEW_NOTIFICATION: {
      niceName: "Espace prescripteurs - Demande de rattachement",
      tags: [
        "template:espacePrescripteur_demandeDeRattachement",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:admin",
      ],
      createEmailVariables: ({
        firstName,
        lastName,
        agencies,
        immersionBaseUrl,
      }) => ({
        subject:
          "Immersion Facilitée - Des demandes de rattachement en attente pour vos organismes",
        greetings: `Bonjour ${firstName} ${lastName},`,
        content: `Vous avez des utilisateurs en attente de rattachement sur Immersion Facilitée.
        
        <strong>Récapitulatif des demandes en attente</strong> :
        <ul>
          ${agencies.map((agency) => `<li><strong>${agency.agencyName}</strong> : ${agency.numberOfUsersToReview} demande${agency.numberOfUsersToReview > 1 ? "s" : ""}</li>`).join("")}
        </ul>
        En validant ces demandes, vous permettez à vos collaborateurs d’accéder aux conventions et aux statistiques de vos organismes.`,
        buttons: [
          {
            label: "Accéder à mon espace",
            url: makeRouteAbsoluteUrl({
              route: frontRoutes.agencyDashboardAgencies(),
              baseUrl: immersionBaseUrl,
            }),
          },
        ],
        highlight: {
          content: `Besoin d'aide ? Consultez notre guide : <a href='${immersionFacileHelpdeskRootUrl}/article/administrateur-comment-gerer-les-acces-a-lespace-prescripteur-de-vos-collaborateurs-1cdg4de/' target='_blank'>Administrateur - Comment gérer les accès à l'espace prescripteur de vos collaborateurs</a>`,
        },
        subContent: `Ce récapitulatif vous est envoyé chaque matin tant que des demandes nécessitent votre action.
        ${defaultSignature("immersion")}
        `,
      }),
    },
    AGENCY_DELEGATION_CONVENTION_EXPIRED: {
      niceName:
        "Espace prescripteur - Prescripteurs - Expiration convention de délégation",
      tags: [
        "template:expirationConventionDelegation",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:admin",
        "role:valideur",
        "role:preValideur",
        "role:lecteur",
      ],
      createEmailVariables: ({
        agencyName,
        delegationAgencyName,
        delegationAgencyKind,
      }) => ({
        subject:
          "Action requise : Fermeture de votre accès à Immersion Facilitée (Convention expirée)",
        greetings: "Bonjour,",
        content: `
      Votre convention de délégation, vous autorisant à prescrire des immersions professionnelles (PMSMP) avec <strong>${agencyName}</strong>, est arrivée à échéance.

      À ce jour, nous n'avons pas reçu de nouvelle convention en cours de validité. Par conséquent, votre accès à la plateforme Immersion Facilitée est désormais suspendu.

      <strong>Comment réactiver votre accès ?</strong>

      <strong>• Vous avez votre nouvelle convention</strong>
      Transmettez-nous le document immédiatement à l'adresse : <a href="mailto:${immersionFacileDelegationEmail}" target="_blank">${immersionFacileDelegationEmail}</a>. Votre référencement sera réactivé dès sa réception.

      <strong>• Vous devez encore en faire la demande</strong>
      Adressez-vous directement à votre prescripteur de droit : <strong>${delegationAgencyName}</strong>.
      ${
        delegationAgencyKind === "pole-emploi"
          ? `• Pour France Travail : utilisez ce formulaire pour obtenir le bon interlocuteur : <a href="https://tally.so/r/w7WM49" target="_blank">https://tally.so/r/w7WM49</a>`
          : ""
      }

      Notre équipe est à votre disposition pour vous accompagner dans cette démarche.
      N'hésitez pas à nous contacter à l'adresse : <a href="mailto:${immersionFacileContactEmail}" target="_blank">${immersionFacileContactEmail}</a>
    `,
        subContent: `
      Bien cordialement,
      L'équipe Immersion Facilitée
    `,
      }),
    },
    AGENCY_DELEGATION_CONVENTION_EXPIRING_SOON: {
      niceName:
        "Espace prescripteur - Prescripteurs - Expiration prochaine de convention de délégation",
      tags: [
        "template:expirationProchaineConventionDelegation",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:admin",
        "role:valideur",
        "role:preValideur",
        "role:lecteur",
      ],
      createEmailVariables: ({
        agencyName,
        delegationEndDate,
        delegationAgencyName,
      }) => {
        const displayedDelegationEndDate = toDisplayedDate({
          date: new Date(delegationEndDate),
          withHours: false,
        });

        return {
          subject: `🚨 Renouvellement de votre convention de délégation avant fermeture de votre structure le ${displayedDelegationEndDate}`,
          greetings: "Bonjour,",
          content: `
      Votre structure <strong>${agencyName}</strong> bénéficie actuellement d'une convention de délégation délivrée par <strong>${delegationAgencyName}</strong>, vous permettant de prescrire des immersions professionnelles (PMSMP).

      Cette convention arrive à échéance le <strong>${displayedDelegationEndDate}</strong>.

      Afin de maintenir votre référencement sur la plateforme Immersion Facilitée, merci de nous transmettre votre nouvelle convention avant cette date.

      <strong>Deux situations possibles :</strong>
        
          <strong>• Vous avez déjà votre nouvelle convention</strong>
          Envoyez-nous le document dès maintenant à l'adresse suivante : <a href="mailto:${immersionFacileDelegationEmail}" target="_blank">${immersionFacileDelegationEmail}</a>
       
        
          <strong>• Vous n'avez pas encore la nouvelle convention</strong>
          Faites-en la demande dès que possible auprès du prescripteur de droit qui vous a délivré la première.
          • Pour une demande auprès de France Travail, vous pouvez utiliser ce formulaire pour obtenir le bon interlocuteur : <a href="https://tally.so/r/w7WM49" target="_blank">https://tally.so/r/w7WM49</a>
          • Besoin d'un modèle ? Un exemplaire standard est joint à cet email à titre indicatif.
          
      <strong>Que se passe-t-il si la date est dépassée ?</strong>

      Sans réception d'un document en cours de validité nous serons contraints de suspendre votre référencement le <strong>${displayedDelegationEndDate}</strong>. Il pourra bien sûr être réactivé dès réception de la nouvelle convention !

      Nous vous remercions et restons à votre disposition pour toute question à l'adresse <a href="mailto:${immersionFacileContactEmail}" target="_blank">${immersionFacileContactEmail}</a>
    `,
          subContent: `
      Bien cordialement,
      L'équipe Immersion Facilitée
    `,
        };
      },
    },
    AGENCY_DELEGATION_CONTACT_INFORMATION: {
      niceName: "Délégation - Information de contact DR",
      tags: [
        "template:délégationInfosContactDR", // pas top comme tag
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:utilisateurInitiateur", // ou bien initiateur ? C'est le champ email du form Tally,
      ],
      createEmailVariables: ({ delegationProviderMail }) => ({
        subject:
          "Envoyez la demande de délégation à votre Direction régionale France Travail !",
        greetings: "Bonjour,",
        content: `
        Vous souhaitez solliciter France Travail pour bénéficier d’une convention de délégation.

        Avant d’effectuer votre demande, vous devez vous avoir pris connaissance des <a href="https://travail-emploi.gouv.fr/les-periodes-de-mise-en-situation-en-milieu-professionnel-pmsmp#anchor-navigation-768" target="_blank">obligations légales</a>, notamment celles liées :

          • à la cotisation à l’URSSAF pour le risque AT/MP
          • à l’assurance pour les périodes d’immersion

        <strong>Pour finaliser votre demande, vous devez :</strong>

          1. Copier les éléments ci-dessous
          2. Les compléter
          3. Les envoyer à ${delegationProviderMail}

        Si vous n’avez pas de réponse sous trois semaines, merci de nous en informer à l’adresse suivante : <a href="mailto:delegation@immersion-facile.beta.gouv.fr" target="_blank">delegation@immersion-facile.beta.gouv.fr</a>
      `,
        subContent: `
        Bonne journée,
        L'équipe Immersion Facilitée
  
        <p style="border-top:1px solid #d9d9d9; border-bottom:1px solid #d9d9d9; font-style:italic; color:#4a4a4a; font-family:Arial, Helvetica, sans-serif; padding:0 0 20px 0;">
          Éléments à copier ci dessous (mail type à envoyer à la Direction Régionale)
        </p>
        Bonjour,

        Ma structure souhaite bénéficier d’une convention de délégation afin de pouvoir prescrire des immersions (PMSMP).

        Vous trouverez ci-dessous les informations nécessaires au traitement de ma demande :

        <strong>Informations légales de ma structure</strong>
        
          • SIRET :
          • Nom de la structure :
          • Adresse :
          • Nom et prénom de la personne représentant la structure :
          • Adresse mail de(s) personne(s) à contacter pour établir la convention de délégation :
          • Numéro de téléphone à joindre en cas de besoin :
          • Cette demande est-elle effectuée dans le cadre d’un marché de prestations ? (Oui / Non)
        
        <strong>Informations concernant les immersions</strong>
        
          • Descriptif du public qui sera concerné par les immersions
          • Le territoire concerné par la demande (périmètre géographique)
          • Estimation du nombre d’immersions prévues sur une année
        
        <strong>Informations complémentaires</strong>
        
          • Je confirme que ma structure va cotiser au risque AT/MP : (Oui / Non)
          • Je confirme que ma structure est assurée pour couvrir les périodes d’immersion : (Oui / Non)

        Cordialement,
      `,
      }),
    },
    AGENCY_FIRST_REMINDER: {
      niceName: "Convention - Premier rappel de validation à l'agence",
      tags: [
        "template:relance vérification manquante",
        "theme:convention",
        "acteur:prescripteur",
        "role:valideur",
        "role:preValideur",
      ],
      createEmailVariables: ({
        manageConventionLink,
        agencyReferentName,
        agencyName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        dateEnd,
        dateStart,
      }) => ({
        subject:
          "RAPPEL - Une demande de convention d'immersion démarrant d'ici 3 jours ouvrés doit être vérifiée",
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Merci de ne pas oublier de traiter la demande de convention d'immersion qui concerne :

      <strong>Bénéficiaire :</strong> ${beneficiaryFirstName} ${beneficiaryLastName}
      ${
        agencyReferentName &&
        `
        <strong>Conseiller :</strong> ${agencyReferentName}
        `
      }
      <strong>Entreprise :</strong> ${businessName}

      <strong>Structure d'accompagnement :</strong> ${agencyName}

      <strong>Dates de l'immersion :</strong>
      - du ${dateStart}
      - au ${dateEnd}

      Cette demande d'immersion a bien été signée par le bénéficiaire et l'entreprise d'accueil.`,
        buttons: [
          {
            label: "Voir la convention",
            url: manageConventionLink,
          },
        ],
        subContent: `Bonne journée,
      L'équipe Immersion Facilitée`,
      }),
    },
    AGENCY_HAS_BEEN_PUT_ON_HOLD: {
      niceName:
        "Suppression compte - Prescripteur - Absence d’admin ou de validateur",
      tags: [
        "template:suppressionCompte_absenceAdminOuValidateur",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:contact",
        "role:preValideur",
        "role:lecteur",
      ],
      createEmailVariables: ({ agencyName }) => ({
        subject: "",
        greetings: "Bonjour,",
        content: `Suite à une vérification automatique, ${agencyName} a été mise en attente sur Immersion Facilitée.
        
        <strong>Pourquoi ?</strong>
        Le compte administrateur de l’agence n’était plus actif depuis longtemps et aucun utilisateur avec le rôle de validateur n’est actuellement actif dans l’agence. Dans cette situation, l’agence ne peut plus gérer correctement ses conventions.

        <strong>Quelle est la conséquence ?</strong>
        Certaines actions sont temporairement bloquées (ex. validation de conventions).

        <strong>Que faire maintenant ?</strong>
        Pour réactiver votre structure, il est nécessaire qu’un utilisateur actif dispose du rôle de validateur ou administrateur.
        Contactez notre support en désignant le nom, prénom, fonction et numéro de téléphone de la personne qui prendra ce rôle.
        `,
        buttons: [
          {
            label: "Contacter le support Immersion Facilitée",
            url: immersionFacileHelpdeskRootUrl,
            target: "_blank",
          },
        ],
        subContent: `
      Nous restons disponibles pour vous accompagner.

      Bien cordialement,
      L’équipe Immersion Facilitée
      `,
      }),
    },
    AGENCY_LAST_REMINDER: {
      niceName: "Convention - Dernier rappel de validation à l'agence",
      tags: [
        "template:relance vérification manquante",
        "theme:convention",
        "acteur:prescripteur",
        "role:valideur",
        "role:preValideur",
      ],
      createEmailVariables: ({
        manageConventionLink,
        agencyReferentName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
      }) => ({
        subject:
          "RAPPEL URGENT - Une demande de convention d'immersion démarrant demain doit être vérifiée",
        greetings: greetingsWithConventionId(conventionId),
        content: `
      L'immersion demandée par Bénéficiaire <strong>${beneficiaryFirstName} ${beneficiaryLastName}</strong> au sein de l'entreprise <strong>${businessName}</strong> doit démarrer demain.
      ${
        agencyReferentName &&
        `
        <strong>Conseiller :</strong> ${agencyReferentName}
        `
      }
      Nous vous remercions d'examiner rapidement la demande de convention qui vous a été envoyée afin que votre décision soit transmise au bénéficiaire et à l'entreprise.`,
        buttons: [
          {
            label: "Voir la convention",
            url: manageConventionLink,
          },
        ],
        subContent: `
      Pour rappel, nous vous transmettons tous les renseignements nécessaires pour examiner la demande. Si vous la validez, la convention est automatiquement établie.

      Bonne journée,
      L'équipe Immersion Facilitée
      `,
      }),
    },
    AGENCY_OF_TYPE_OTHER_ADDED: {
      niceName: "Délégation - Agence de type autre ajoutée",
      tags: [
        "template:Agence de type autre ajoutée",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({ agencyLogoUrl, agencyName }) => ({
        subject: "Immersion Facilitée - Votre structure a été activée",
        greetings: "Bonjour,",
        content: `Vous recevez cet email suite à votre demande de référencement sur le site Immersion Facilitée. 
        Afin de finaliser le référencement de votre structure ${agencyName}, 
        envoyez-nous votre convention de délégation au format pdf à l'adresse : <a href="mailto:${immersionFacileDelegationEmail}" target="_blank">${immersionFacileDelegationEmail}</a> 
        `,
        agencyLogoUrl,
        highlight: {
          content:
            "Attention : votre structure ne sera activée qu'à la réception de la convention de délégation ! ",
        },
        subContent: defaultSignature("immersion"),
      }),
    },
    AGENCY_REGISTRATION_REQUEST_CONFIRMATION: {
      niceName:
        "Espace prescripteur - Prescripteurs - Confirmation Demande Rattachement",
      tags: [
        "template:confirmationDemandeRattachement",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({ agencies, immersionBaseUrl }) => {
        const isPlural = agencies.length > 1;
        const agenciesList = agencies
          .map(({ agencyName, adminEmails }) => {
            const agencyStatus =
              adminEmails.length > 0
                ? `demande transmise à : ${joinWithCommasAnd(adminEmails)}`
                : `aucun administrateur n'a été défini pour cet organisme, veuillez <a href=${immersionFacileHelpdeskRootUrl} target="_blank">contacter le support</a>.`;
            return `• <strong>${agencyName}</strong> : ${agencyStatus}`;
          })
          .join("\n\n");

        return {
          subject: "Confirmation de votre demande de rattachement",
          greetings: "Bonjour,",
          content: `Nous vous confirmons que votre demande de rattachement à ${
            isPlural ? "de nouveaux organismes" : "un nouvel organisme"
          } a bien été enregistrée.

        Votre demande va être étudiée prochainement par les administrateurs concernés.

        <strong>Pour votre information, voici les personnes en charge de valider vos accès :</strong>

        ${agenciesList}

        Vous recevrez un e-mail dès qu'une décision sera prise pour ${
          isPlural ? "chacune de vos demandes" : "votre demande"
        }.`,
          buttons: [
            {
              label: isPlural ? "Suivre mes demandes" : "Suivre ma demande",
              url: makeRouteAbsoluteUrl({
                route: frontRoutes.myAccountAgencies(),
                baseUrl: immersionBaseUrl,
              }),
            },
          ],
          subContent: `Pour toute question n'hésitez pas à nous contacter via le <a href=${immersionFacileHelpdeskRootUrl} target="_blank">support d’Immersion Facilitée</a>.
        ${defaultSignature("immersion")}`,
        };
      },
    },
    ARCHIVED_CONVENTION_REQUEST_RECEIVED: {
      niceName: "Convention - Demande archivée accusé de réception",
      tags: [
        "template:demandeArchiveAccuseReception",
        "theme:convention",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({ archivedConventionRequestId }) => ({
        subject: "Nous avons bien reçu votre demande de convention archivée",
        greetings: `<strong>Identifiant de la demande d'accès à une convention archivée : ${archivedConventionRequestId}</strong>`,
        content: `
          Bonjour,

          Nous vous confirmons la bonne réception de votre demande d'accès à une convention d'immersion archivée.

          <strong>Que va-t-il se passer ensuite ?</strong>
          <ul><li>Notre équipe va examiner votre demande (motif et informations fournies) pour s'assurer que nous pouvons vous transmettre ces documents de manière légitime.</li>
          <li>Si votre demande est validée, la convention ainsi que le bilan d'immersion vous seront envoyés directement par email d'ici quelques jours.</li></ul>
          Si nous avons besoin d'informations complémentaires pour retrouver votre convention, nous vous contacterons à cette adresse.

          Vous n'avez aucune autre action à réaliser pour le moment.
        `,
        subContent: defaultSignature("immersion"),
      }),
    },
    AGENCY_WAS_ACTIVATED: {
      niceName: "Espace prescripteur - Admin agence - Agence activée",
      tags: [
        "template:agenceActivee",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyName,
        agencyDashboardUrl,
        refersToOtherAgency,
        agencyReferdToName,
      }) => ({
        subject: "Immersion Facilitée - Votre structure a été activée",
        greetings: "Bonjour,",
        content: `<strong>Votre ${
          refersToOtherAgency
            ? `structure d'accompagnement`
            : "organisme prescripteur"
        } ${agencyName} est activée sur Immersion facilitée !</strong> 

        Vous pouvez dès à présent ${refersToOtherAgency ? "pré-valider" : "valider"} les conventions dématérialisées sur Immersion Facilitée.

        ${
          refersToOtherAgency &&
          `Elles seront ensuite validée par ${agencyReferdToName}.`
        }`,
        buttons: [
          {
            label: "Accèder à mon espace",
            url: agencyDashboardUrl,
            target: "_blank",
          },
        ],
        agencyLogoUrl,
        subContent: `
        <strong>Maîtrisez rapidement l’utilisation du site en 2 temps :</strong>
        
        • <strong>Pour les responsables de votre structure</strong> :
        <a href="https://app.livestorm.co/immersion-facilitee/immersion-facilitee-parametrer-les-acces-au-tableau-de-bord?s=6a2504e1-6eaf-4174-afc9-f9a4b48369ec" target="_blank">Un point pour bien paramétrer votre compte</a>
        (30 minutes)

        • <strong>Pour l'ensemble de vos collaborateurs</strong> :
        <a href="https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee" target="_blank">Un temps de présentation de toutes les fonctionnalités du site</a>
        (30 minutes de présentation et 30 minutes pour poser les questions)

        N'hésitez pas à leur partager ce lien :
        <a href="https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee" target="_blank">https://app.livestorm.co/immersion-facilitee/prescripteurs-et-structures-daccompagnement-decouvrir-immersion-facilitee</a>

        Si aucune date ne vous convient, inscrivez-vous et nous vous enverrons le replay.

        Pour toute question n'hésitez pas à nous contacter via le
        <a href=${immersionFacileHelpdeskRootUrl} target="_blank">
          support d’Immersion Facilitée
        </a>.

        ${defaultSignature("immersion")}`,
        attachmentUrls: [emailAttachements.memoAgencyRolesAndRisks],
      }),
    },
    AGENCY_WAS_REJECTED: {
      niceName: "Agence - Refusée",
      tags: [
        "template:rejet prescripteur",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:admin",
        "role:preValideur",
        "role:valideur",
        "role:lecteur",
      ],
      createEmailVariables: ({ agencyName, statusJustification }) => ({
        subject: `Rejet de ${agencyName} comme structure prescriptrice`,
        greetings: "Bonjour,",
        content: `La demande d'activation de : ${agencyName} sur Immersion Facilitée comme prescripteur a été refusée pour les raisons suivantes : ${statusJustification}.

Pour toute question concernant ce rejet, il est possible de nous contacter : contact@immersion-facile.beta.gouv.fr`,
        subContent: defaultSignature("immersion"),
      }),
    },
    AGENCY_CLOSED_FOR_INACTIVITY: {
      niceName: "Espace prescripteurs - Fermeture automatique",
      tags: [
        "template:espacePrescripteur_fermetureAutomatique",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:admin",
      ],
      createEmailVariables: ({
        agencyName,
        numberOfMonthsWithoutConvention,
      }) => ({
        subject:
          "Fermeture automatique de votre organisme sur Immersion Facilitée",
        greetings: "Bonjour,",
        content: `Votre organisme (${agencyName}) a été automatiquement fermé sur Immersion Facilitée en raison d’une période prolongée d’inactivité.

        Un organisme peut être considéré comme inactif lorsqu’il ne présente aucune convention validée ou en cours de validation depuis ${numberOfMonthsWithoutConvention} mois.

        Cette fermeture n’a pas d’impact sur les conventions qui auraient déjà été signées et archivées.
        
        Si cette fermeture ne correspond pas à votre situation, ou si l’organisme doit être rouvert, vous pouvez <a href=${immersionFacileHelpdeskRootUrl} target="_blank">contacter le support</a>.
        `,
        subContent: defaultSignature("immersion"),
      }),
    },
    AGENCY_WITH_REFERS_TO_ACTIVATED: {
      niceName:
        "Agence - notification de l'agence prescriptrice lors de l'activation d'une agence accompagnatrice",
      tags: [
        "template:notification agence prescriptrice activation agence accompagnatrice",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:valideur",
      ],
      createEmailVariables: ({
        nameOfAgencyRefering,
        refersToAgencyName,
        agencyLogoUrl,
        ...rest
      }) => ({
        subject:
          "Une structure d'accompagnement qui vous a désigné comme structure prescriptrice a été activée",
        greetings: "Bonjour,",
        content: `La structure d'accompagnement ${nameOfAgencyRefering} est activée sur Immersion facilitée.
        Elle a désigné comme prescripteur votre propre structure « ${refersToAgencyName} ».
        
        Cela signifie que vous allez recevoir des demandes de conventions initiées par des candidats ou entreprises qui sont accompagnés par la structure d'accompagnement ${nameOfAgencyRefering}.
        Ces demandes seront toutes examinées en premier lieu par la structure d'accompagnement. Si celle-ci confirme leur pertinence, vous les recevrez pour validation définitive (validées par ${rest.validatorEmails.join(
          ", ",
        )}).
        
        L'accompagnement lors du déroulement de l'immersion et du bilan relève de la responsabilité de la structure d'accompagnement.
        
        Merci à vous !`,
        agencyLogoUrl,
        subContent: defaultSignature("immersion"),
      }),
    },
    ASSESSMENT_AGENCY_NOTIFICATION: {
      niceName: "Bilan - Prescripteurs - Relance bilan non rempli",
      tags: [
        "template:relanceBilanNonRempli",
        "theme:bilan",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyReferentName,
        manageConventionLink,
        beneficiaryFirstName,
        beneficiaryLastName,
        tutorEmail,
        businessName,
        conventionId,
        internshipKind,
      }) => ({
        subject: `Immersion Facilitée - Le tuteur de ${beneficiaryFirstName} ${beneficiaryLastName} n'a pas encore rempli le bilan`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
        Nous constatons que le bilan ${
          internshipKind === "immersion"
            ? " de l'immersion professionnelle"
            : " du mini stage"
        } de ${beneficiaryFirstName} ${beneficiaryLastName} n'a pas encore été complété par l’entreprise ${businessName}.
      
      Afin de clôturer cette étape, vous pouvez:
      
      1. <a href="mailto:${tutorEmail}" target="_blank">Relancer directement l'entreprise</a> pour qu'elle remplisse le bilan en ligne.
      2. Les contacter par téléphone pour les accompagner dans la saisie du bilan.
      `,
        buttons: [
          {
            label: "Piloter la convention",
            url: manageConventionLink,
          },
        ],
        subContent: `
      ${
        agencyReferentName &&
        `
        <strong>Conseiller : </strong>${agencyReferentName}
        `
      }
      ${defaultSignature(internshipKind)}
      `,
        agencyLogoUrl,
      }),
    },
    ASSESSMENT_BENEFICIARY_NOTIFICATION: {
      niceName: "Bilan - Bénéficiaire - Accompagnement au remplissage",
      tags: [
        "template:bilan_bénéficiaire_accompagnementBilan",
        "theme:bilan",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        conventionId,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        internshipKind,
        establishmentTutorEmail,
      }) => ({
        subject: `Remplissez le bilan de fin ${
          internshipKind === "immersion" ? "d'immersion" : "de mini-stage"
        } avec votre tuteur`,
        greetings: greetingsWithConventionId(
          conventionId,
          `${beneficiaryFirstName} ${beneficiaryLastName}`,
        ),
        content: `
        Votre ${
          internshipKind === "immersion"
            ? "immersion professionnelle"
            : "mini-stage"
        } au sein de l'entreprise ${businessName} se termine.

        <strong>Préparez votre bilan avec votre tuteur</strong>

        Prenez quelques instants avec votre tuteur : il a reçu par mail l'accès au formulaire de bilan qu'il devra compléter en votre présence.

        Ce mail lui a été envoyé à l'adresse mentionnée sur la convention : ${establishmentTutorEmail}

        N'hésitez pas à lui demander s'il l'a bien reçu !

        <strong>Votre signature est nécessaire</strong>

        Une fois que votre tuteur aura complété le formulaire, vous recevrez un second mail vous invitant à :

        • Consulter et signer votre bilan en ligne
        • Ajouter votre propre commentaire si vous souhaitez apporter des précisions sur votre expérience
        
        <strong>Et après ?</strong>

        Une fois signé, le bilan final vous sera envoyé par mail ainsi qu'à votre conseiller.
        Ce document est précieux pour la suite de votre parcours professionnel, que ce soit pour une formation, une embauche ou une découverte de métier.
        `,
        subContent: defaultSignature(internshipKind),
      }),
    },
    ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION: {
      niceName: "Bilan - Candidat - Signature du bilan",
      tags: [
        "template:bilan_candidat_signatureBilan",
        "theme:bilan",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        internshipKind,
        assessmentSignatureLink,
        conventionId,
      }) => ({
        subject: `Votre bilan d'immersion est prêt à être signé`,
        greetings: greetingsWithConventionId(
          conventionId,
          `${beneficiaryFirstName} ${beneficiaryLastName}`,
        ),

        content: `
        <strong>Nous espérons que votre ${
          internshipKind === "immersion"
            ? "immersion professionnelle"
            : "mini-stage"
        } au sein de ${businessName} s’est bien déroulée et que cette expérience vous a été bénéfique.</strong>
       
        Votre tuteur a rempli le bilan de votre ${
          internshipKind === "immersion"
            ? "immersion professionnelle"
            : "mini-stage"
        }. Vous pouvez dès maintenant le consulter et le signer en ligne.
        `,
        buttons: [
          {
            label: "Consulter et signer le bilan",
            url: assessmentSignatureLink,
          },
        ],
        subContent: `<strong>Lors de la signature, vous aurez trois possibilités :</strong>
          • J’ai bien lu, je suis d’accord, rien à ajouter
          • J’ai bien lu, je suis d’accord, je veux commenter
          • J’ai bien lu, je ne suis pas d’accord, je veux commenter

        Si vous décidez d’ajouter un commentaire, il sera intégré directement dans le bilan final.

        Une fois signé, un lien vous permettant de télécharger le bilan vous sera automatiquement envoyé, ainsi qu'à l’entreprise et à votre accompagnateur au format PDF.
        ${defaultSignature(internshipKind)}
        `,
      }),
    },
    ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION: {
      niceName: "Bilan - Bénéficiaire - Bilan complété",
      tags: [
        "template:bilan_créé_bénéficiaire",
        "theme:bilan",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        internshipKind,
        conventionId,
        beneficiaryFirstName,
        beneficiaryLastName,
        magicLink,
      }) => {
        return {
          subject: `Immersion Facilitée - Le bilan de votre ${
            internshipKind === "immersion" ? "immersion" : "mini-stage"
          } est disponible !`,
          greetings: greetingsWithConventionId(
            conventionId,
            `${beneficiaryFirstName} ${beneficiaryLastName}`,
          ),
          content: `
          Vous avez signé le bilan de votre période ${
            internshipKind === "immersion" ? "d'immersion" : "de mini-stage"
          }.
          La version finale, comprenant votre signature ainsi que les éventuels commentaires que vous avez ajoutés, est désormais disponible au format PDF.

          Ce retour peut être un atout pour vos futures candidatures en mettant en valeur vos expériences et compétences acquises.
          
          Nous vous invitons à télécharger dès maintenant en cliquant sur le bouton ci-dessous. Ce lien a une validité de 1 mois.
          `,
          buttons: [{ label: "Consulter mon bilan", url: magicLink }],
          subContent: `
          Nous vous encourageons à intégrer ce document dans vos candidatures afin de valoriser votre expérience auprès de vos futurs employeurs.
          
          N'hésitez pas à revenir vers nous si vous avez des questions ou besoin d'aide supplémentaire.
           
          ${defaultSignature(internshipKind)}
          `,
        };
      },
    },
    ASSESSMENT_CREATED_ESTABLISHMENT_NOTIFICATION: {
      niceName: "Bilan - Établissement - Bilan complété",
      tags: [
        "template:bilan_etablissement_bilanComplete",
        "theme:bilan",
        "acteur:entreprise",
        "role:representantEntreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        recipientFullName,
        beneficiaryFullName,
        linkToAssessment,
        businessName,
        internshipKind,
      }) => ({
        subject: `Le bilan ${
          internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
        } de ${beneficiaryFullName} est complété`,
        greetings: `Bonjour ${recipientFullName},`,
        content: `Le bilan ${
          internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
        } de ${beneficiaryFullName} au sein de votre entreprise ${businessName} est désormais finalisé et signé par le candidat.
        
        Vous pouvez télécharger la version finale en PDF, incluant toutes les informations et éventuels commentaires du candidat, en cliquant sur le bouton ci-dessous.

        Ce lien a une validité de 1 mois. Vous pouvez également le télécharger en PDF en cliquant sur le bouton ci-dessous.
        `,
        buttons: [
          {
            label: "Consulter le bilan",
            url: linkToAssessment,
            target: "_blank",
          },
        ],
        subContent: `
        Merci pour votre engagement dans l'accueil des candidats en ${
          internshipKind === "immersion" ? "immersion" : "stage"
        }. Votre contribution est précieuse pour la réussite de leur parcours.
        ${defaultSignature(internshipKind)}`,
      }),
    },
    ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION: {
      niceName:
        "Bilan - Prescripteurs - Notification de création du bilan à l'agence (cas complet ou partiel)",
      tags: [
        "template:bilan_complet_ou_partiel_créé_prescripteur_confirmation",
        "theme:bilan",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyReferentName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        conventionDateEnd,
        immersionObjective,
        internshipKind,
        immersionAppellationLabel,
        assessment,
        numberOfHoursMade,
        manageConventionLink,
      }) => {
        const lastDayOfPresence =
          assessment.status === "COMPLETED"
            ? conventionDateEnd
            : assessment.lastDayOfPresence;
        return {
          subject: `Pour information : évaluation ${
            internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"
          } de ${beneficiaryFirstName} ${beneficiaryLastName}`,
          greetings: greetingsWithConventionId(conventionId),
          content: `Le bilan ${
            internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"
          } de ${beneficiaryFirstName} ${beneficiaryLastName} au sein de l'entreprise ${businessName} est désormais finalisé et signé par le candidat.
  
          <strong>📄 Informations principales</strong>
          <ul>
            <li>Métier observé : ${immersionAppellationLabel}</li>
            <li>Objectif ${
              internshipKind === "immersion"
                ? "de l'immersion"
                : "du mini-stage"
            } : ${immersionObjective}</li>
            <li>Immersion réalisée : Oui</li>
            <li>Nombre d'heures totales de l'immersion : ${numberOfHoursMade}</li>
            <li>Date réelle de fin de l'immersion : ${toDisplayedDate({
              date: new Date(lastDayOfPresence),
              withHours: false,
            })}</li>
          </ul>

          <strong>📊 Résultats de l'immersion :</strong>
          <ul>   
           <li>Embauche : ${assessment.endedWithAJob ? "Oui" : "Non"}</li>        
           ${
             assessment.endedWithAJob
               ? `          
             <li>Date d'embauche : ${toDisplayedDate({
               date: new Date(assessment.contractStartDate),
             })}</li>   
             <li>Type de contrat : ${assessment.typeOfContract}</li>`
               : ""
           }
          </ul>

          <strong>⭐ Evaluation de l'entreprise</strong>
          <ul>
            <li>Appréciation générale : ${assessment.establishmentFeedback}</li>
            <li>Conseils pour la suite : ${assessment.establishmentAdvices}</li>
          </ul>

          <strong>✍️ Validation du candidat</strong>
          <ul>
            <li>Choix exprimés : ${assessment.beneficiaryAgreement ? "J'ai bien lu, je suis d'accord" : "J'ai bien lu, je ne suis pas d'accord"}</li>
            ${
              assessment.beneficiaryFeedback
                ? `
            <li>Commentaire : ${assessment.beneficiaryFeedback}</li>
            `
                : ""
            }
          </ul>
          
          `,
          buttons: [
            {
              label: "Consulter le bilan",
              url: manageConventionLink,
            },
          ],
          subContent: `
          Ce document a également été communiqué à l’entreprise et au candidat.
          ${
            agencyReferentName &&
            `
            <strong>Conseiller : </strong>${agencyReferentName}
            `
          }

          ${defaultSignature(internshipKind)}`,
        };
      },
    },
    ASSESSMENT_CREATED_WITH_STATUS_DID_NOT_SHOW_AGENCY_NOTIFICATION: {
      niceName:
        "Bilan - Prescripteurs - Notification de création du bilan à l'agence - (cas absent)",
      tags: [
        "template:bilan_absent_créé_prescripteur_confirmation",
        "theme:bilan",
        "acteur:prescripteur",
        "role:valideur",
        "role:preValideur",
      ],
      createEmailVariables: ({
        agencyReferentName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        immersionObjective,
        internshipKind,
        immersionAppellationLabel,
      }) => {
        return {
          subject: `Pour information : évaluation ${
            internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"
          } de ${beneficiaryFirstName} ${beneficiaryLastName}`,
          greetings: greetingsWithConventionId(conventionId),
          content: `${
            internshipKind === "immersion" ? "L'immersion" : "Le mini-stage"
          } prévue pour ${beneficiaryFirstName} ${beneficiaryLastName}, au sein de l'entreprise ${businessName} n'a pas eu lieu.
  
          <strong>Métier observé : ${immersionAppellationLabel}</strong>
          <strong>Objectif ${
            internshipKind === "immersion" ? "de l'immersion" : "du mini-stage"
          } : ${immersionObjective}
          </strong>
          
          Nous vous invitons à contacter l'entreprise si vous souhaitez obtenir des précisions supplémentaires.
          
          ${
            agencyReferentName &&
            `
            <strong>Conseiller :</strong> ${agencyReferentName}
            `
          }
          `,

          subContent: defaultSignature(internshipKind),
        };
      },
    },
    ASSESSMENT_ESTABLISHMENT_NOTIFICATION: {
      niceName: "Bilan - Entreprise - Lien de creation du bilan",
      tags: [
        "template:bilan_entreprise_formulaireBilan",
        "theme:bilan",
        "acteur:entreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        beneficiaryFirstName,
        beneficiaryLastName,
        conventionId,
        establishmentTutorName,
        assessmentCreationLink,
        internshipKind,
      }) => ({
        subject: `Pour action : complétez le bilan ${
          internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
        } de ${beneficiaryFirstName} ${beneficiaryLastName}`,
        greetings: greetingsWithConventionId(
          conventionId,
          establishmentTutorName,
        ),
        content: `
      ${
        internshipKind === "immersion"
          ? "L'immersion professionnelle"
          : "Le mini stage"
      } de ${beneficiaryFirstName} ${beneficiaryLastName} au sein de votre entreprise est en passe de s'achever. 

      Nous vous remercions de votre accueil. 

      Pouvez-vous indiquer si ${
        internshipKind ? "cette immersion" : "ce mini stage"
      } s'est bien déroulée jusqu'à sa date de fin prévue ?`,
        buttons: [
          {
            label: "Compléter le bilan",
            url: assessmentCreationLink,
          },
        ],
        subContent: `
      Ces informations sont importantes pour la suite de son parcours professionnel. 

      En cas de difficulté, prévenez au plus vite la structure d’accompagnement pour que vous soyez conseillé au mieux.
       
      Merci  !      
      ${defaultSignature(internshipKind)}
      `,
        agencyLogoUrl,
      }),
    },
    ASSESSMENT_ESTABLISHMENT_REMINDER: {
      niceName: "Bilan - Entreprise - Relance",
      tags: [
        "template:bilan_entreprise_relance",
        "theme:bilan",
        "acteur:entreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        assessmentCreationLink,
        beneficiaryFirstName,
        beneficiaryLastName,
        establishmentTutorFirstName,
        establishmentTutorLastName,
        conventionId,
        internshipKind,
      }) => ({
        subject: `Immersion Facilitée - Bilan non complété pour l'immersion de ${beneficiaryFirstName}`,
        greetings: greetingsWithConventionId(
          conventionId,
          `${establishmentTutorFirstName} ${establishmentTutorLastName}`,
        ),
        content: `
        L'immersion de ${beneficiaryFirstName} ${beneficiaryLastName} au sein de votre établissement s'est terminée il y a quelques jours.
        
        Pour finaliser cette démarche, il vous reste à compléter le bilan de fin d’immersion.
        `,
        buttons: [
          {
            label: "Compléter le bilan",
            url: assessmentCreationLink,
          },
        ],
        subContent: `
        <strong>Ce bilan est essentiel :</strong>
        - Il permet au candidat d'avoir un retour sur son expérience,
        - Il aide les prescripteurs à mieux l'accompagner dans la suite de son parcours,
        - Il contribue à améliorer le fonctionnement de notre service.
        
        En cas de difficulté, prévenez au plus vite la structure d'accompagnement pour que vous soyez conseillé au mieux.
        
        Merci !
        
        ${defaultSignature(internshipKind)}
        `,
      }),
    },
    ASSESSMENT_DELETED_ESTABLISHMENT_NOTIFICATION: {
      niceName: "Bilan - Entreprise - Bilan supprimé",
      tags: [
        "template:bilanSupprimé",
        "theme:bilan",
        "acteur:entreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        assessmentCreationLink,
        beneficiaryName,
        establishmentTutorName,
        justification,
        internshipKind,
      }) => ({
        subject: `Le bilan d’immersion de ${beneficiaryName} a été supprimé.`,
        greetings: `Bonjour ${establishmentTutorName},`,
        content: `
        Le bilan ${
          internshipKind === "immersion" ? "de l’immersion" : "du mini-stage"
        } de ${beneficiaryName} a été supprimé par l’équipe Immersion Facilitée.

        <strong>Motif indiqué :</strong>
        <p>${justification}</p>

        <p> Un nouveau bilan peut désormais être complété :
        `,
        buttons: [
          {
            label: "Compléter à nouveau le bilan",
            url: assessmentCreationLink,
          },
        ],
        subContent: `Si besoin, l’équipe Immersion Facilitée reste disponible pour vous accompagner dans cette nouvelle saisie.

        ${defaultSignature(internshipKind)}`,
      }),
    },
    ASSESSMENT_DELETED_BENEFICIARY_NOTIFICATION: {
      niceName: "Bilan - Bénéficiaire - Bilan supprimé",
      tags: [
        "template:bilanSupprimé",
        "theme:bilan",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        beneficiaryName,
        conventionId,
        internshipKind,
      }) => ({
        subject:
          "Immersion Facilitée - Le bilan de votre immersion va être mis à jour",
        greetings: `Bonjour ${beneficiaryName},`,
        content: `
        Suite à une demande adressée à notre support, le bilan de votre ${internshipKind === "immersion" ? "immersion liée" : "mini-stage lié"}  à la convention ${conventionId} a été supprimé par l’équipe Immersion Facilitée.
        
        Cette suppression permet de corriger ou mettre à jour les informations du bilan. Un nouveau bilan vous sera transmis prochainement.
        `,
        highlight: {
          content: `
          Si vous avez déjà téléchargé votre bilan en PDF, nous vous invitons à ne pas en tenir compte, celui-ci n’étant plus valide.
          `,
        },
        subContent: `Vous serez informé(e) dès que le nouveau bilan sera disponible.
        
        Si besoin, notre équipe reste bien entendu à votre disposition pour vous accompagner.

        ${defaultSignature(internshipKind)}`,
      }),
    },
    CANCELLED_CONVENTION_NOTIFICATION: {
      niceName: "Convention - Annulée",
      tags: [
        "template:annulation demande d'immersion",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:preValideur",
        "role:valideur",
        "role:representantEntreprise",
        "role:representantLégal",
        "role:tuteur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        immersionProfession,
        internshipKind,
        signature,
        dateEnd,
        dateStart,
        justification,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Annulation de la demande d'immersion pour observer l'activité de ${immersionProfession} au sein de ${businessName}`
            : `Mini Stage - Annulation de la demande de mini stage pour l'activité de ${immersionProfession} au sein de ${businessName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Nous vous informons que la demande ${
        internshipKind === "immersion"
          ? "d'immersion professionnelle"
          : "de mini stage"
      } de ${beneficiaryFirstName} ${beneficiaryLastName} dans l'entreprise ${businessName}, qui devait se dérouler du ${displayDate(dateStart)} au ${displayDate(dateEnd)} a été annulée par ${agencyName}.
      
      La demande a été annulée pour la raison suivante :
      
      ${justification}
      
      Vous pouvez vous rapprocher de votre conseiller${
        internshipKind === "immersion"
          ? ""
          : " de la Chambre consulaire ayant émis la convention"
      } pour en échanger ou établir une nouvelle demande si nécessaire.      
      
      Bien cordialement,       
      ${signature} 
      `,
        agencyLogoUrl,
      }),
    },
    CONTACT_BY_EMAIL_CANDIDATE_CONFIRMATION: {
      niceName: "Candidat - Confirmation de la demande de contact",
      tags: [
        "template:confirmation_contact_email_candidat",
        "acteur:candidat",
        "theme:MER",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        kind,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        beneficiaryDashboardUrl,
      }) => ({
        subject: ` Immersion Facilitée - Confirmation de l’envoi de votre candidature auprès de ${businessName}`,
        greetings: `Bonjour ${beneficiaryFirstName} ${beneficiaryLastName},`,
        content: `<strong>Nous vous confirmons que votre candidature pour ${kind === "IF" ? "une immersion professionnelle" : "un stage"} a bien été transmise à ${businessName}</strong>. L'entreprise doit maintenant examiner votre demande.

        L'entreprise va maintenant examiner votre demande. Si elle l'accepte, elle vous contactera pour discuter des détails de votre ${kind === "IF" ? "immersion" : "stage"}.
        De votre côté, vous avez la possibilité d'échanger avec elle directement depuis votre espace personnel. C'est l'endroit idéal pour appuyer votre candidature, montrer votre motivation ou répondre à ses éventuelles questions.
        `,
        buttons: [
          {
            label: "Accéder à mon espace",
            url: beneficiaryDashboardUrl,
          },
        ],
        subContent: `<strong>Comment maximiser vos chances ?</strong>
          • Si l'entreprise ne répond pas sous <strong>15 jours</strong>, appelez-la directement.
          • Postulez à au moins <strong>3 entreprises</strong> pour multiplier vos opportunités.
          
          Les entreprises ne répondent pas toujours, mais cela ne remet pas en cause votre valeur. Gardez confiance !
          
          Si vous avez besoin d'aide pour préparer votre relance, n'hésitez pas à contacter votre conseiller.
          
          Bonne chance pour la suite de vos démarches ! Nous restons à votre disposition.
          ${defaultSignature("immersion")}`,
      }),
    },
    CONTACT_BY_EMAIL_REQUEST: {
      niceName: "Établissement - MER - instructions par mail",
      tags: [
        "template:mise en relation mail",
        "theme:MER",
        "acteur:entreprise",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: (params) => {
        const hasAdditionnalInformation =
          params.kind === "IF" &&
          params.potentialBeneficiaryExperienceAdditionalInformation;
        const hasLevelOfEducation =
          params.kind === "1_ELEVE_1_STAGE" && params.levelOfEducation;
        const hasResumeLink =
          params.kind === "IF" && params.potentialBeneficiaryResumeLink;

        return {
          subject: `${params.potentialBeneficiaryFirstName} ${params.potentialBeneficiaryLastName} vous contacte pour une demande d'immersion sur le métier de ${params.appellationLabel}`,
          greetings: "Bonjour,",
          content: `Un candidat souhaite faire une immersion dans votre entreprise ${params.businessName} (${params.businessAddress}).

<strong>Immersion souhaitée :</strong>
    • Métier : ${params.appellationLabel}.
    • Dates d’immersion envisagées : ${params.potentialBeneficiaryDatePreferences}.
    • ${
      params.immersionObjective
        ? `But de l'immersion : ${labelsForImmersionObjective[params.immersionObjective]}.`
        : ""
    }

    ${[
      hasAdditionnalInformation || hasLevelOfEducation || hasResumeLink
        ? "<strong>Profil du candidat :</strong>\n"
        : "",

      hasAdditionnalInformation &&
        `• Informations supplémentaires sur l'expérience du candidat : ${params.potentialBeneficiaryExperienceAdditionalInformation}.\n`,
      hasLevelOfEducation && `• Je suis en ${params.levelOfEducation}.\n`,
      hasResumeLink &&
        `• CV du candidat : ${params.potentialBeneficiaryResumeLink}.`,
    ]
      .filter(Boolean)
      .join("")}`,
          buttons: [
            {
              label: "Répondre au candidat via mon espace",
              target: "_blank",
              url: params.discussionUrl,
            },
          ],
          highlight: {
            content: `
          Ce candidat attend une réponse, vous pouvez :

          - répondre directement à cet email, il lui sera transmis. ${transferReplyWarning}

          - en cas d'absence de réponse par email, vous pouvez essayer de le contacter par tel : ${params.potentialBeneficiaryPhone}`,
          },
          subContent: `<strong>Si la connexion ne fonctionne pas et que vous ne recevez pas le lien de réinitialisation du mot de passe, c'est que vous n'avez pas encore créé votre compte</strong>.
        Créer votre compte avec le même mail que celui avec lequel les candidats vous contactent.

        ${defaultSignature("immersion")}`,
        };
      },
    },
    CONTACT_BY_EMAIL_REQUEST_LEGACY: {
      niceName: "Établissement - MER - instructions par mail (Legacy)",
      tags: [
        "template:mise en relation mail",
        "theme:MER",
        "acteur:entreprise",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        appellationLabel,
        businessName,
        immersionObjective,
        message,
        potentialBeneficiaryFirstName,
        potentialBeneficiaryLastName,
        businessAddress,
        potentialBeneficiaryPhone,
        potentialBeneficiaryResumeLink,
        replyToEmail,
      }) => ({
        subject: `${potentialBeneficiaryFirstName} ${potentialBeneficiaryLastName} vous contacte pour une demande d'immersion sur le métier de ${appellationLabel}`,
        greetings: "Bonjour,",
        content: `
        Un candidat souhaite faire une immersion ${
          immersionObjective
            ? `pour "${immersionObjective?.toLowerCase()}"`
            : ""
        } sur le métier de <strong>${appellationLabel}</strong> dans votre entreprise ${businessName} (${businessAddress}).

        Voici son message:

      "${message}"

      ${potentialBeneficiaryFirstName} 
      ${potentialBeneficiaryLastName}

      ${
        potentialBeneficiaryResumeLink
          ? `Plus d'info sur ce candidat: <a href="${potentialBeneficiaryResumeLink}">${potentialBeneficiaryResumeLink}</a>`
          : ""
      }
      
      `,
        buttons: [
          {
            label: "Écrire au candidat",
            url: `mailto:${replyToEmail}`,
          },
        ],
        highlight: {
          content: `
          Ce candidat attend une réponse, vous pouvez :

          - répondre directement à cet email, il lui sera transmis. ${transferReplyWarning}

          - en cas d'absence de réponse par email, vous pouvez essayer de le contacter par tel : ${potentialBeneficiaryPhone}`,
        },
        subContent: `Vous pouvez préparer votre échange grâce à notre <a href="https://immersion-facile.beta.gouv.fr/aide/article/etudier-une-demande-dimmersion-professionnelle-1ehkehm/">page d'aide</a>.
        ${defaultSignature("immersion")}`,
      }),
    },
    CONTACT_BY_PHONE_INSTRUCTIONS: {
      niceName: "Établissement - MER - instructions par téléphone",
      tags: [
        "template:mise en relation tel",
        "theme:MER",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        businessName,
        contactFirstName,
        contactLastName,
        contactPhone,
        kind,
        potentialBeneficiaryFirstName,
        potentialBeneficiaryLastName,
      }) => ({
        subject: `Coordonnées téléphoniques pour faire votre demande ${kind === "IF" ? "d'immersion" : "de stage"}`,
        greetings: `Bonjour ${potentialBeneficiaryFirstName} ${potentialBeneficiaryLastName},`,
        content: `
      Vous avez manifesté de l’intérêt pour réaliser ${kind === "IF" ? "une immersion professionnelle" : "un stage"} au sein de l’entreprise ${businessName}.
      Cette entreprise a souhaité être contactée par téléphone.

      Voici ses coordonnées :
      ${contactFirstName && contactLastName ? `- Personne à contacter : ${contactFirstName} ${contactLastName}` : ""}
      - Numéro de téléphone  :  ${contactPhone}      
      
      Ces informations sont personnelles et confidentielles. Elles ne peuvent pas être communiquées à d’autres personnes. 
      Merci !

      ${kind === "IF" ? advices : ""}
      `,
      }),
    },
    CONTACT_IN_PERSON_INSTRUCTIONS: {
      niceName: "Établissement - MER - instructions en personne",
      tags: [
        "template:mise en relation en personne",
        "theme:MER",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        welcomeAddress,
        businessName,
        contactFirstName,
        contactLastName,
        kind,
        potentialBeneficiaryFirstName,
        potentialBeneficiaryLastName,
      }) => ({
        subject: `Coordonnées de l'entreprise pour faire votre demande ${kind === "IF" ? "d'immersion" : "de stage"}`,
        greetings: `Bonjour ${potentialBeneficiaryFirstName} ${potentialBeneficiaryLastName},`,
        content: `Vous avez manifesté de l’intérêt pour réaliser ${kind === "IF" ? "une immersion professionnelle" : "un stage"} au sein de l’entreprise ${businessName}.

    Cette entreprise souhaite que vous vous rendiez sur place pour présenter votre demande. 

    Voici les coordonnées :
    ${contactFirstName && contactLastName ? `- Personne à contacter : <strong>${contactFirstName} ${contactLastName}</strong>` : ""}
    - Adresse de l'entreprise : <strong>${welcomeAddress}</strong>
    `,
        highlight: {
          content:
            "Ces informations sont personnelles et confidentielles. Elles ne peuvent pas être communiquées à d’autres personnes. ",
        },
        subContent: defaultSignature("immersion"),
      }),
    },
    CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION: {
      niceName: "Convention - Changement prescripteur pour agence",
      tags: [
        "template:changement prescripteur demande d'immersion pour prescripteur",
        "theme:convention",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        previousAgencyName,
        justification,
        manageConventionLink,
        conventionId,
        beneficiaryFirstName,
        beneficiaryLastName,
        beneficiaryEmail,
        beneficiaryPhone,
        internshipKind,
      }) => ({
        subject: `${previousAgencyName} vous a transmis une demande d'immersion`,
        greetings: greetingsWithConventionId(conventionId),
        content: `${previousAgencyName} a redirigé une demande d'immersion professionnelle vers votre structure pour la raison suivante :

${justification}

Vous pouvez vous rapprocher du candidat ${beneficiaryFirstName} ${beneficiaryLastName}
Email : ${beneficiaryEmail}
Tél : ${beneficiaryPhone}`,
        buttons: [
          {
            url: manageConventionLink,
            label: "Examiner la demande",
          },
        ],
        subContent: `
      ${defaultSignature(internshipKind)}
      `,
      }),
    },
    CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION: {
      niceName: "Convention - Changement prescripteur pour signataire",
      tags: [
        "template:changement prescripteur demande d'immersion pour signataire",
        "acteur:candidat",
        "acteur:entreprise",
        "theme:convention",
        "role:beneficiaire",
        "role:representantLégal",
        "role:employeurActuel",
        "role:representantEntreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        internshipKind,
        immersionProfession,
        previousAgencyName,
        newAgencyName,
        agencyAddress,
        businessName,
        justification,
        magicLink,
        conventionId,
      }) => ({
        subject: `Changement de prescripteur de la demande d'immersion pour observer l'activité de ${immersionProfession} au sein de ${businessName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `Nous vous informons que le prescripteur ${previousAgencyName} a redirigé votre demande d'immersion professionnelle vers un autre prescripteur pour la raison suivante :

        ${justification}
        
        Vous pouvez vous rapprocher de votre conseiller chez ${newAgencyName} - ${agencyAddress} pour suivre votre demande.`,
        buttons: [
          {
            url: magicLink,
            label: "Voir l'état de ma demande",
          },
        ],
        subContent: `
      ${defaultSignature(internshipKind)}
      `,
      }),
    },
    DEPRECATED_CONVENTION_NOTIFICATION: {
      niceName: "Convention - Obsolète",
      tags: [
        "template:dépreciation demande d'immersion",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
        "role:tuteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        dateEnd,
        dateStart,
        deprecationReason,
        immersionProfession,
        internshipKind,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Demande d'immersion pour observer l'activité de ${immersionProfession} au sein de ${businessName} obsolète`
            : `Mini Stage - Demande de mini stage pour l'activité de ${immersionProfession} au sein de ${businessName} obsolète`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Nous vous informons que la demande ${
        internshipKind === "immersion"
          ? "d'immersion professionnelle"
          : "de mini stage"
      } de ${beneficiaryFirstName} ${beneficiaryLastName} pour réaliser ${
        internshipKind === "immersion"
          ? "une immersion professionnelle"
          : "un mini stage"
      } du ${displayDate(dateStart)} au ${displayDate(dateEnd)} dans l'entreprise ${businessName} est supprimée.
      
      Les raisons en sont: ${deprecationReason}.         
      
      Bien cordialement,       
      `,
        subContent: defaultSignature(internshipKind),
      }),
    },
    DISCUSSION_BENEFICIARY_FOLLOW_UP: {
      niceName: "Établissement - MER - Relance par téléphone pour candidat",
      tags: [
        "template:mer_candidat_relanceParTelephone",
        "theme:MER",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        businessName,
        beneficiaryFirstName,
        beneficiaryLastName,
        contactFirstName,
        contactLastName,
        contactJob,
        contactPhone,
      }) => ({
        subject: `Toujours pas de réponse de l’entreprise ${businessName} ?`,
        greetings: `Bonjour ${beneficiaryFirstName} ${beneficiaryLastName},`,
        content: `
        Bonjour ${beneficiaryFirstName} ${beneficiaryLastName},

        Vous avez contacté l’entreprise ${businessName} il y a 15 jours par email pour demander une immersion, mais vous n’avez pas encore reçu de réponse.

        Vous pouvez relancer l’entreprise par téléphone :
        - Nom de la personne à contacter : ${contactFirstName} ${contactLastName}
        ${contactJob ? `- Fonction : ${contactJob}` : ""}
        - Numéro de téléphone : ${contactPhone}

        N’hésitez pas à vous présenter brièvement, à rappeler l’objet de votre demande, et à mentionner que vous avez obtenu ces informations via Immersion Facilitée.

        ⚠️ Ces informations sont personnelles et confidentielles. Merci de ne pas les transmettre à d’autres personnes.

        

        📝 <strong>Besoin de conseils ?</strong>

        Voici un exemple de phrase pour démarrer la conversation :
        « Bonjour, je m'appelle ${beneficiaryFirstName} ${beneficiaryLastName}, je vous contacte car j’ai envoyé une demande d’immersion via Immersion Facilitée il y a quelques jours. Je souhaite découvrir le métier de [nom du métier] dans votre entreprise et je voulais savoir si cela était possible. »



        N’hésitez pas à nous contacter si vous avez des questions.

        Bonne journée,
        <br/>
        L'équipe Immersion Facilitée
        `,
      }),
    },
    DISCUSSION_DEPRECATED_NOTIFICATION_BENEFICIARY: {
      niceName: "Établissement - MER - Clôture automatique pour candidat",
      tags: [
        "template:MER_candidat_clotureAutomatique",
        "theme:MER",
        "acteur:candidat",
        "role:beneficiaire",
      ],
      createEmailVariables: ({
        discussionCreatedAt,
        searchPageUrl,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
      }) => ({
        subject: `Votre demande d’immersion chez ${businessName} a été clôturée`,
        content: `Bonjour ${beneficiaryFirstName} ${beneficiaryLastName},

        La candidature pour une immersion au sein de l'entreprise ${businessName}, envoyée le ${toDisplayedDate({ date: new Date(discussionCreatedAt) })}, est restée sans réponse pendant plus de 3 mois. Nous l’avons donc automatiquement clôturée afin de garantir des échanges à jour sur Immersion Facilitée.

        <strong>Si vous êtes toujours intéressé(e) par une immersion, nous vous invitons à :</strong>

        • Relancer l'entreprise par téléphone
        • Rechercher d'autres opportunités d'immersion`,
        buttons: [
          {
            label: "Rechercher des offres d'immersion",
            url: searchPageUrl,
          },
        ],
        highlight: {
          kind: "info",
          content:
            "Si vous avez signé une convention avec l'entreprise entre-temps, vous pouvez ne pas tenir compte de ce message.",
        },
        subContent: `
        N'hésitez pas à nous contacter si vous avez des questions.

        ${defaultSignature("immersion")}
        `,
      }),
    },
    DISCUSSION_DEPRECATED_NOTIFICATION_ESTABLISHMENT: {
      niceName: "Établissement - MER - Clôture automatique pour entreprise",
      tags: [
        "template:MER_etablissement_clotureAutomatique",
        "acteur:entreprise",
        "theme:MER",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        beneficiaryFirstName,
        beneficiaryLastName,
        discussionCreatedAt,
        establishmentDashboardUrl,
        businessName,
      }) => ({
        subject: `La candidature de ${beneficiaryFirstName} ${beneficiaryLastName} a été clôturée`,
        content: `Bonjour,

        La candidature de ${beneficiaryFirstName} ${beneficiaryLastName} pour une immersion au sein de votre entreprise ${businessName}, envoyée le ${toDisplayedDate({ date: new Date(discussionCreatedAt) })}, est restée sans réponse pendant plus de 3 mois. Nous l’avons donc automatiquement clôturée afin de garantir des échanges à jour sur Immersion Facilitée.

        <strong>Nous vous recommandons de :</strong>

        • Mettre à jour votre fiche établissement et vos offres
        • Répondre rapidement aux prochaines demandes d'immersion`,
        buttons: [
          {
            label: "Accéder à votre tableau de bord",
            url: establishmentDashboardUrl,
          },
        ],
        subContent: `
        Nous restons disponible pour toute question.

        ${defaultSignature("immersion")}
        `,
      }),
    },
    DISCUSSION_EXCHANGE: {
      niceName:
        "Établissement - MER - Échange entre établissement et potentiel bénéficiaire",
      tags: [
        "template:échange établissement potentiel bénéficiaire",
        "theme:MER",
        "role:utilisateurDestinataire",
      ],
      createEmailVariables: ({ subject, htmlContent }) => ({
        bypassLayout: true,
        subject,
        content: `
          ⚠️ Important : ${transferReplyWarning}
          ${htmlContent}
        `,
      }),
    },
    DISCUSSION_EXCHANGE_FORBIDDEN: {
      niceName: "Établissement - MER - Réponse à candidature impossible",
      tags: [
        "template:réponse candidature impossible",
        "theme:MER",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: (params) => ({
        subject: "Réponse à la candidature impossible",
        greetings: "Bonjour",
        subContent: defaultSignature("immersion"),
        ...discussionExchangeForbiddenContents(params)[params.sender][
          params.reason
        ],
      }),
    },
    ESTABLISHMENT_CONTACT_REQUEST_REMINDER: {
      niceName: "Etablissement - Relance mise en relation",
      tags: [
        "template:relance_MER",
        "acteur:entreprise",
        "theme:MER",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        appellationLabel,
        beneficiaryReplyToEmail,
        beneficiaryFirstName,
        beneficiaryLastName,
        mode,
        domain,
      }) => ({
        subject: `[Demande d'immersion de ${beneficiaryFirstName} ${beneficiaryLastName}] Ce candidat attend toujours votre réponse.`,
        greetings: `Répondez vite à ${beneficiaryFirstName}`,
        content: `Bonjour,
        <strong>${beneficiaryFirstName} ${beneficiaryLastName}</strong> vous a contacté il y a ${
          mode === "3days" ? "3" : "7"
        } jours pour une demande d\`immersion pour le métier de <strong>${appellationLabel}</strong>.
        
        Votre réponse est importante : ${beneficiaryFirstName} ${beneficiaryLastName} a choisi votre entreprise et une immersion peut jouer un rôle clé dans son parcours professionnel.
        
        Ne tardez pas : répondez lui directement en utilisant le bouton ci-dessous : 
        `,
        buttons: [
          {
            label: `Répondre à ${beneficiaryFirstName}`,
            url: `mailto:${beneficiaryReplyToEmail}`,
          },
        ],
        subContent: `
        <strong>Vous avez déjà échangé avec lui ou elle ?</strong>

        Indiquez-le dans votre espace entreprise en marquant la candidature comme acceptée ou refusée, cela nous permet de mieux vous accompagner et de tenir à jour le suivi côté candidat.

        <a href="${makeRouteAbsoluteUrl({ route: frontRoutes.establishmentDashboard(), baseUrl: `https://${domain}` })}" class target="_blank">Se connecter à l'espace entreprise</a>


        Si la connexion ne fonctionne pas ou si vous ne recevez pas le lien de réinitialisation du mot de passe, c’est probablement que vous n’avez pas encore créé votre compte.
        Créez-le simplement avec <strong>la même adresse email</strong> que celle utilisée par les candidats pour vous contacter.
        

        A très vite sur Immersion Facilitée,
        L'équipe d'Immersion Facilitée`,
      }),
    },
    ESTABLISHMENT_DELETED: {
      niceName: "Établissement - Supprimé",
      tags: [
        "template:suppression entreprise",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
      ],
      createEmailVariables: ({ businessAddresses, businessName, siret }) => ({
        subject:
          "Votre entreprise a été supprimée de la liste des entreprises accueillantes d'Immersion Facilitée",
        greetings: "Bonjour,",
        content: `
        Suite à votre demande de suppression de votre établissement (SIRET ${siret} - ${businessName} - ${businessAddresses[0]}), nous vous confirmons que ce dernier a été supprimé définitivement de la liste des entreprises accueillantes exposées sur Immersion Facilitée.
        `,
        subContent: `Bien cordialement,
        l'équipe d'Immersion Facilitée`,
      }),
    },
    ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS: {
      niceName: "Espace entreprise - Entreprise - Entreprise bannie",
      tags: [
        "template:etablissement banni",
        "acteur:entreprise",
        "theme:espaceEntreprise",
        "role:admin",
        "role:contact",
        "theme:entrepriseBannie",
      ],
      createEmailVariables: ({ businessName, siret }) => ({
        subject: `Information concernant l'accès de ${businessName} à Immersion Facilitée`,
        greetings: "Bonjour,",
        content: `
        Nous vous informons que votre établissement ${businessName} (SIRET : ${siret}) n'a plus accès aux services d'Immersion Facilitée.
        
        <strong>Ce qu'il faut savoir :</strong>

        • Votre référencement sur notre site est supprimé.
        • Vos candidatures et conventions en cours sont annulées.
        • Vous ne pouvez plus créer de nouvelles conventions d’immersions.

        <strong>Pourquoi cette décision ?</strong>

        Cette mesure fait suite à des signalements concernant le non-respect des règles de l'immersion.

        Si vous estimez qu'il s'agit d'une erreur, vous pouvez <a href="https://aide.immersion-facile.beta.gouv.fr/fr/" >contacter notre support</a>.
        `,
        subContent: defaultSignature("immersion"),
      }),
    },
    ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY: {
      niceName: "Établissement - MER - Candidat - Entreprise bannie",
      tags: [
        "template:etablissement banni",
        "theme:MER",
        "acteur:candidat",
        "role:beneficiaire",
        "theme:entrepriseBannie",
      ],
      createEmailVariables: ({
        businessName,
        beneficiaryFirstName,
        beneficiaryLastName,
        immersionBaseUrl,
      }) => ({
        subject: `Information concernant votre demande auprès de ${businessName}`,
        greetings: `Bonjour${beneficiaryFirstName ? ` ${beneficiaryFirstName}` : ""}${beneficiaryLastName ? ` ${beneficiaryLastName}` : ""},`,
        content: `
        Vous avez une candidature ou une convention en cours avec l'entreprise ${businessName}.

        Nous vous informons que cette entreprise a été bannie de notre site car elle ne respectait pas la législation en matière d'immersion. Par conséquent, votre démarche ne peut pas continuer.

        <strong>Ce que cela implique pour vous :</strong>

          • <strong>Si vous aviez une candidature en cours :</strong> Celle-ci est désormais suspendue. Vous ne pouvez plus échanger avec cette entreprise..
          • <strong>Si vous aviez une convention en cours :</strong> Veuillez contacter rapidement votre conseiller pour procéder à son annulation.

        <strong>Comment rebondir ?</strong>
        
        Ne vous découragez pas ! De nombreuses autres entreprises sont prêtes à vous accueillir. Si vous souhaitez toujours réaliser une immersion, vous pouvez :

          • Rechercher d'autres immersions sur notre site.
          • Contacter votre conseiller pour vous aider dans vos recherches.
        `,
        buttons: [
          {
            label: "Voir les offres d'immersion",
            url: makeRouteAbsoluteUrl({
              route: frontRoutes.search(),
              baseUrl: immersionBaseUrl,
            }),
          },
        ],
        subContent: defaultSignature("immersion"),
      }),
    },
    ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR: {
      niceName:
        "Convention - Prescripteurs - EntrepriseBannieConventionValidée",
      tags: [
        "template:entrepriseBannieConventionValidée",
        "theme:convention",
        "acteur:prescripteur",
        "role:conseillerFTlié",
        "role:valideur",
        "role:preValideur",
        "theme:entrepriseBannie",
      ],
      createEmailVariables: ({
        conventionId,
        businessName,
        beneficiaryFirstName,
        beneficiaryLastName,
        immersionBaseUrl,
      }) => ({
        subject: `Urgent : Entreprise bannie - Convention à revoir pour ${beneficiaryFirstName} ${beneficiaryLastName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
        Nous vous contactons car une convention d'immersion a été validée pour ${beneficiaryFirstName} ${beneficiaryLastName} au sein de l'entreprise ${businessName}.

        Nous vous informons que <strong>cette entreprise a été bannie de notre plateforme</strong> suite à des signalements, car elle ne respectait pas la législation ou le cadre bienveillant exigé en matière d'immersion.

        <strong>Que pouvez-vous faire ?</strong>

          • <strong>Si l'immersion n'a pas encore commencé :</strong> Nous vous recommandons fortement de procéder à l'annulation de cette convention afin de protéger le bénéficiaire.
          • <strong>Si l'immersion est actuellement en cours :</strong> Nous vous conseillons de contacter le bénéficiaire dans les plus brefs délais pour faire un point sur sa situation au sein de l'établissement. S'il s'avère que les conditions d'accueil ne sont pas respectées, vous pouvez procéder à une rupture anticipée de l’immersion.
        `,
        buttons: [
          {
            label: "Voir la convention",
            url: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId,
              }),
              baseUrl: immersionBaseUrl,
            }),
          },
        ],
        subContent: `
        Le bénéficiaire a également reçu un email l'informant que l'entreprise a été bannie de notre site et lui demandant de se rapprocher de vous pour annuler sa démarche.
        Nous restons à votre entière disposition si vous avez des questions concernant cette situation exceptionnelle.

        ${defaultSignature("immersion")}
        `,
      }),
    },
    ESTABLISHMENT_LEAD_REMINDER: {
      niceName: "Establishment Lead - Premier rappel d'inscription",
      tags: [
        "template:relance inscription prospect",
        "theme:acquisitionEntreprise",
        "acteur:entreprise",
        "role:representantEntreprise",
      ],
      createEmailVariables: ({
        businessName,
        registerEstablishmentShortLink,
        unsubscribeToEmailShortLink,
      }) => ({
        subject:
          "Votre Immersion s'est bien passée ? Accueillez d'autres candidats quand vous le voulez !",
        greetings: "Bonjour,",
        content: `
        Nous sommes ravis que votre entreprise ${businessName} ait choisi l'immersion professionnelle pour faire découvrir votre métier et votre établissement.

        Préparez dès maintenant l'accueil de votre prochain candidat en devenant entreprise accueillante sur le site Immersion Facilitée.

        Être entreprise accueillante vous permet de gérer votre visibilité sur la plateforme pour recevoir des demandes d'immersion, à votre rythme, et en fonction de vos disponibilités.

        Devenez entreprise accueillante dès aujourd'hui.`,
        buttons: [
          {
            label: "S'inscrire en 2 minutes !",
            url: registerEstablishmentShortLink,
          },
        ],
        highlight: {
          content:
            "Pour gagner du temps lors de l’inscription, utilisez la même adresse email que celle indiquée dans la convention d’immersion. Certaines informations de votre entreprise pourront ainsi être préremplies automatiquement.",
          kind: "info",
        },
        subContent: `Bonne journée,
      L'équipe Immersion Facilitée`,
        legals: `<a href=${unsubscribeToEmailShortLink}>Je ne souhaite pas devenir entreprise accueillante</a>`,
      }),
    },
    ESTABLISHMENT_USER_RIGHTS_ADDED: {
      niceName: "Compte - Etablissement - Ajout d’un utilisateur",
      tags: [
        "template:compte_etablissement_ajoutUtilisateur",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        businessName,
        role,
        firstName,
        lastName,
        triggeredByUserFirstName,
        triggeredByUserLastName,
        immersionBaseUrl,
      }) => ({
        subject: `Votre accès ${businessName} sur Immersion Facilitée`,
        greetings: `Bonjour ${firstName && lastName ? `${firstName} ${lastName}` : ""},`,
        content: `
          Vous avez été ajouté(e) comme ${role === "establishment-admin" ? "administrateur" : "contact"} sur Immersion Facilitée pour l’établissement ${businessName} par ${triggeredByUserFirstName} ${triggeredByUserLastName}.

          ${
            role === "establishment-admin"
              ? "L’administrateur accède aux conventions, aux candidatures (lecture et réponse) et peut gérer la fiche entreprise et les utilisateurs de l’établissement."
              : "Le contact accède aux conventions et aux candidatures (lecture et réponse) de l’établissement."
          }

          Créez votre compte dès maintenant pour accéder à votre espace :
        `,
        buttons: [
          {
            label: "Créer mon compte",
            url: makeRouteAbsoluteUrl({
              route: frontRoutes.establishmentDashboard(),
              baseUrl: immersionBaseUrl,
            }),
          },
        ],
        subContent: defaultSignature("immersion"),
      }),
    },
    ESTABLISHMENT_USER_RIGHTS_UPDATED: {
      niceName: "Compte - Etablissement - Modification d’un utilisateur",
      tags: [
        "template:compte_etablissement_modificationUtilisateur",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        businessName,
        updatedRole,
        firstName,
        lastName,
        triggeredByUserFirstName,
        triggeredByUserLastName,
      }) => ({
        subject: "Votre rôle sur Immersion Facilitée a été mis à jour",
        greetings: `Bonjour ${firstName} ${lastName},`,
        content: `
          Votre rôle sur Immersion Facilitée pour l'établissement <strong>${businessName}</strong> a été modifié par ${triggeredByUserFirstName} ${triggeredByUserLastName}.
          
          <strong>Votre nouveau rôle :</strong> ${updatedRole === "establishment-admin" ? "Administrateur" : "Contact"}
          
          ${
            updatedRole
              ? `L'administrateur accède aux conventions, aux candidatures (lecture et réponse) et peut gérer la fiche entreprise et les utilisateurs de l'établissement.`
              : `Le contact accède aux conventions et aux candidatures (lecture et réponse) de l'établissement.`
          }

          Si cette modification ne vous semble pas justifiée, contactez ${triggeredByUserFirstName} ${triggeredByUserLastName} ou notre support.
        `,
        subContent: defaultSignature("immersion"),
      }),
    },
    ESTABLISHMENT_USER_RIGHTS_STATUS_UPDATED: {
      niceName: "Espace Entreprise - Entreprise - Statut demande rattachement",
      tags: [
        "template:compte_etablissement_statutRattachement",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
        "role:contact",
      ],
      createEmailVariables: ({
        businessName,
        firstName,
        lastName,
        updatedStatus,
        immersionBaseUrl,
      }) => {
        const userFullName =
          firstName && lastName ? ` ${firstName} ${lastName}` : "";
        return {
          subject: `Mise à jour de votre accès à l'entreprise ${businessName}`,
          greetings: `Bonjour${userFullName},`,
          content: `
          Un administrateur de l'entreprise ${businessName} a traité votre demande de rattachement
          <strong>Statut de votre demande : </strong>${updatedStatus === "ACCEPTED" ? "Acceptée" : "Refusée"}
         
         ${updatedStatus === "ACCEPTED" ? "Félicitations ! Vous pouvez désormais accéder aux conventions et aux candidatures de l'espace de l'entreprise." : "Votre demande n'a pas été accepté. Si vous pensez qu'il s'agit d'une erreur, nous vous invitons à contacter directement l'administrateur de l'établissement au sein de votre structure."}
        `,
          buttons:
            updatedStatus === "ACCEPTED"
              ? [
                  {
                    label: "Accéder à mon espace",
                    url: makeRouteAbsoluteUrl({
                      route: frontRoutes.establishmentDashboard(),
                      baseUrl: immersionBaseUrl,
                    }),
                  },
                ]
              : [],
          subContent: defaultSignature("immersion"),
        };
      },
    },

    FULL_PREVIEW_EMAIL: {
      niceName: "Tech - Preview email complet (tous les blocs)",
      tags: [
        "template:aperçu pour tests",
        "theme:MER",
        "theme:acquisitionEntreprise",
        "theme:authentification",
        "theme:bilan",
        "theme:convention",
        "theme:espaceEntreprise",
        "theme:espacePrescripteur",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:admin",
        "role:adminIF",
        "role:beneficiaire",
        "role:contact",
        "role:employeurActuel",
        "role:lecteur",
        "role:preValideur",
        "role:representantEntreprise",
        "role:representantLégal",
        "role:tuteur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        beneficiaryName,
        conventionId,
        internshipKind,
      }) => ({
        subject: "Test contenant toutes les blocs email",
        greetings: greetingsWithConventionId(conventionId, beneficiaryName),
        content: `Merci d'avoir confirmé votre demande ${
          internshipKind ? "d'immersion" : "de mini stage"
        }. Elle va être transmise à votre ${
          internshipKind === "immersion"
            ? "conseiller"
            : "conseiller de la Chambre consulaire ayant émis la convention"
        } référent.
      
      Il vous informera par mail de la validation ou non ${
        internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
      }. Le tuteur qui vous encadrera pendant cette période recevra aussi la réponse.`,
        legals: defaultConventionFinalLegals(internshipKind),
        buttons: [{ label: "Label de bouton", url: "http://www.example.com" }],
        subContent: `Il vous informera par mail de la validation ou non ${
          internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
        }. Le tuteur qui vous encadrera pendant cette période recevra aussi la réponse.
      
      ${defaultSignature(internshipKind)}
      `,
        highlight: {
          content: `Attention, ne démarrez pas ${
            internshipKind === "immersion" ? "cette immersion" : "ce mini stage"
          } tant que vous n'avez pas reçu cette validation !`,
        },
        agencyLogoUrl,
      }),
    },
    IC_USER_REGISTRATION_TO_AGENCY_REJECTED: {
      niceName: "ProConnect - Rejet de rattachement a une agence",
      tags: [
        "template:rejet de rattachement a une agence",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:utilisateurDestinataire",
      ],
      createEmailVariables: ({ agencyName, justification }) => ({
        subject:
          "Immersion Facilitée - Refus de la demande d’accès au tableau de bord",
        greetings: "Bonjour,",
        content: `<strong>Votre demande d’accès au tableau de bord a été rejetée.</strong>

        Votre demande d'accès au tableau de bord des conventions d'immersion de la structure : ${agencyName} a été refusée par l'administrateur d'Immersion Facilitée pour les raisons suivantes : ${justification}. 
      `,
        subContent: defaultSignature("immersion"),
      }),
    },
    IC_USER_RIGHTS_HAS_CHANGED: {
      niceName: "ProConnect - Changement de droit sur agence",
      tags: [
        "template:activation BO prescripteur",
        "theme:espacePrescripteur",
        "acteur:prescripteur",
        "role:utilisateurDestinataire",
      ],
      createEmailVariables: ({
        agencyName,
        isNotifiedByEmail,
        roles,
        firstName,
        lastName,
        email,
      }) => ({
        subject:
          "Immersion Facilitée - Activation de l’accès au back office de votre structure",
        greetings: `Bonjour ${firstName} ${lastName},`,
        content: `
        Vous pouvez désormais accéder au tableau de bord de votre structure&nbsp: ${agencyName}.

        <strong>Voici le récapitulatif de votre profil utilisateur :</strong>
        ${generateUserInfo(
          firstName,
          lastName,
          email,
          roles,
          isNotifiedByEmail,
          agencyName,
        )}
      `,
        subContent: defaultSignature("immersion"),
      }),
    },
    LOGIN_BY_EMAIL_REQUESTED: {
      niceName: "Connexion - Lien magique",
      tags: [
        "template:connexion_lienMagique",
        "theme:authentification",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({ loginLink, fullname, validMinutes }) => ({
        subject: "Votre lien de connexion à Immersion Facilitée",
        greetings: `Bonjour ${fullname ?? ""},`,
        content: `Voici votre lien de connexion à Immersion Facilitée.
          Cliquez sur le bouton ci-dessous pour accéder à votre espace :`,
        buttons: [
          {
            label: "Se connecter",
            url: loginLink,
          },
        ],
        subContent: `
          Ce lien est valable pendant ${displayDuration({ durationInSeconds: validMinutes * oneMinuteInSeconds, format: "minutes" })} et ne peut être utilisé qu’une seule fois.
          
          Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.
          
          À bientôt,
          L’équipe Immersion Facilitée
        `,
      }),
    },
    MAGIC_LINK_RENEWAL: {
      niceName: "Renouvellement de lien",
      tags: ["template:renouvellement de lien", "role:utilisateurInitiateur"],
      createEmailVariables: ({ conventionId, internshipKind, magicLink }) => ({
        subject: "Voici votre nouveau lien",

        greetings: conventionId
          ? greetingsWithConventionId(conventionId)
          : "Bonjour ,",
        content: `
      Vous venez de demander le renouvellement d'un lien sur Immersion Facilitée. 
      Veuillez le trouver ci-dessous :
      `,
        buttons: [
          {
            url: magicLink,
            label: "Mon lien renouvelé",
          },
        ],
        subContent: defaultSignature(internshipKind),
        highlight: {
          content:
            "Si vous n'êtes pas à l'origine de cette demande, veuillez contacter notre équipe.",
        },
      }),
    },
    NEW_CONVENTION_AGENCY_NOTIFICATION: {
      niceName: "Convention - Nouvelle convention à traiter par l'agence",
      tags: [
        "template:notification conseiller création demande d’immersion",
        "theme:convention",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyName,
        agencyReferentName,
        businessName,
        conventionId,
        dateEnd,
        dateStart,
        firstName,
        internshipKind,
        lastName,
        manageConventionLink,
        warning,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Une demande de convention d'immersion est déposée : ${firstName}, ${lastName} - ${businessName} - ${agencyName}.`
            : `Mini Stage - une demande de convention de mini stage est déposée : ${firstName}, ${lastName} - ${businessName} - ${agencyName}.`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      <strong>Une nouvelle demande ${
        internshipKind === "immersion"
          ? "d'immersion professionnelle"
          : "de mini stage"
      } a été enregistrée.</strong>

      

      Vous pouvez prendre connaissance de la demande en <a href="${manageConventionLink}" target="_blank">cliquant ici</a>.
      <ul>
        <li>Vous pouvez renvoyer un lien de signature par mail ou par SMS si son numéro de mobile est renseigné. Il vous suffit de cliquer sur le bouton "Relancer" dans l'encadré correspondant au signataire auquel vous souhaitez adresser le mail ou le SMS.</li>
        <li>Vous pouvez dès maintenant demander des modifications ou la refuser si nécessaire.</li>   
        <li>Vous ne pouvez pas la valider tant que le bénéficiaire et l'entreprise n'ont pas confirmé chacun leur accord pour cette demande.</li>
      </ul> 
      <strong>Dates ${
        internshipKind === "immersion" ? "de l'immersion" : "du mini stage"
      } :</strong> 
      - du ${displayDate(dateStart)}
      - au ${displayDate(dateEnd)} 

      <strong>Bénéficiaire :</strong> 
      ${firstName} ${lastName}    
      ${
        agencyReferentName &&
        `
        <strong>Conseiller :</strong>
        ${agencyReferentName}
        `
      }
      <strong>Entreprise :</strong>
      ${businessName}      

      <strong>Structure d'accompagnement :</strong>
      ${agencyName}
      `,
        highlight: {
          content: warning,
        },
        subContent: defaultSignature(internshipKind),
        attachmentUrls:
          internshipKind === "immersion"
            ? [emailAttachements.memoAgencyGeneral]
            : undefined,
        agencyLogoUrl,
      }),
    },
    NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE: {
      niceName: "Convention - Demande de signature",
      tags: [
        "template:demande signature demande de convention",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        beneficiaryCurrentEmployerName,
        beneficiaryName,
        beneficiaryRepresentativeName,
        businessName,
        conventionId,
        establishmentRepresentativeName,
        establishmentTutorName,
        internshipKind,
        conventionSignShortlink,
        signatoryName,
        renewed,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Pour action : ${
                renewed ? "Immersion en entreprise prolongée," : ""
              } signez votre demande de convention`
            : `Pour action : ${
                renewed ? "Mini-stage en entreprise prolongé," : ""
              } signez votre demande de mini stage`,
        greetings: greetingsWithConventionId(conventionId, signatoryName),
        content: `Une demande de convention ${
          internshipKind === "immersion" ? "d'immersion" : "de mini stage"
        } vient d'être enregistrée. Vous devez maintenant la confirmer.
          ${
            renewed
              ? `\nCette convention a été renouvelée par le conseiller depuis la convention numéro : ${renewed.from}.
          La raison est la suivante : ${renewed.justification}.\n`
              : ""
          }
          Pour rappel, cette demande concerne : 
             - Le bénéficiaire ${beneficiaryName}${
               beneficiaryRepresentativeName
                 ? `\n- Le représentant légal du bénéficiaire ${beneficiaryRepresentativeName}`
                 : ""
             }${
               beneficiaryCurrentEmployerName
                 ? `\n- L'employeur actuel du bénéficiaire ${beneficiaryCurrentEmployerName}`
                 : ""
             }
             - L'entreprise ${businessName} représentée par ${establishmentRepresentativeName}
             - Le tuteur dans l'entreprise ${establishmentTutorName}
          
            <strong>Votre signature est obligatoire</strong> pour permettre à votre ${
              internshipKind === "immersion"
                ? "conseiller"
                : "conseiller de la Chambre consulaire ayant émis la convention"
            } de valider la convention. Merci !
          
          <strong>Ouvrez la demande via le bouton ci-dessous puis vérifiez les informations :</strong>
          - Si les informations sont correctes, cliquez sur “Signer” puis “Je termine la signature” sur l’écran suivant.
          - Si les informations ne sont pas correctes, cliquez sur le bouton "Annuler les signatures et demander une modification".`,
        buttons: [{ url: conventionSignShortlink, label: "Ouvrir ma demande" }],
        highlight: {
          content: `Attention, ne démarrez pas votre ${
            internshipKind === "immersion" ? "immersion" : "mini stage"
          } tant que vous n'avez pas reçu cette validation ! Vous n'auriez pas de couverture en cas d'accident.`,
        },
        subContent: `La décision de votre ${
          internshipKind === "immersion"
            ? "conseiller"
            : "conseiller de la Chambre consulaire ayant émis la convention"
        } vous sera transmise par mail.
  
          ${defaultSignature(internshipKind)}
        `,
        attachmentUrls:
          internshipKind === "immersion"
            ? [emailAttachements.memoBeneficiary]
            : undefined,
        agencyLogoUrl,
      }),
    },
    NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION: {
      niceName: "Convention - Demande de signature après modification",
      tags: [
        "template:demande signature demande de convention après modification",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        conventionSignShortlink,
        internshipKind,
        justification,
        signatoryFirstName,
        signatoryLastName,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? "Pour action : demande de convention modifiée, signez la nouvelle version"
            : "Pour action : demande de mini stage modifiée, signez la nouvelle version",
        greetings: `
        <strong>Identifiant de la convention : ${conventionId}</strong>
        
        Bonjour ${signatoryFirstName} ${signatoryLastName},`,
        content: `La demande de convention pour ${
          internshipKind === "immersion" ? "l'immersion" : "le mini stage"
        }
        de ${beneficiaryFirstName} ${beneficiaryLastName} au sein de ${businessName} vient d'être modifiée.
        
        <strong>Les modifications sont&nbsp;:</strong>
        ${justification}
        
        Votre signature sur la première demande de convention a donc été annulée.`,
        buttons: [
          {
            url: conventionSignShortlink,
            label: "Signer ou modifier la demande",
          },
        ],
        highlight: {
          content: `Attention, ne démarrez pas votre immersion tant que vous n'avez pas reçu la validation de votre conseiller ! Vous n'auriez pas de couverture en cas d'accident.`,
        },
        subContent: `
        La décision de votre conseiller vous sera transmise par mail.

        ${defaultSignature(internshipKind)}
        `,
        agencyLogoUrl,
      }),
    },
    NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION: {
      niceName: "Convention - Entièrement signée à traiter par l'agence",
      tags: [
        "template:notification conseiller demande d’immersion signée à valider",
        "theme:convention",
        "acteur:prescripteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyReferentName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        internshipKind,
        manageConventionLink,
        possibleRoleAction,
        validatorName,
        peAdvisor,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Demande d'immersion à étudier: ${beneficiaryFirstName} ${beneficiaryLastName} - ${businessName}`
            : `Mini Stage - Demande de mini stage à étudier: ${beneficiaryFirstName} ${beneficiaryLastName} - ${businessName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      <strong>Une nouvelle demande ${
        internshipKind === "immersion" ? "d'immersion" : "de mini stage"
      } vous est envoyée${validatorName ? ` par ${validatorName} ` : " "}pour que vous l'examiniez.</strong>
      
      ${
        peAdvisor && !peAdvisor.recipientIsPeAdvisor
          ? `Vous recevez cet email en copie de ${peAdvisor.firstName} ${peAdvisor.lastName} (${peAdvisor.email}).
      C'est à ce conseiller d'examiner cette demande d'immersion en priorité. En cas d'absence de sa part, un autre conseiller peut l'examiner afin de ne pas retarder le candidat.`
          : ""
      }
      
      Elle concerne le bénéficiaire ${beneficiaryFirstName} ${beneficiaryLastName} dans l'entreprise ${businessName} 
      ${
        agencyReferentName &&
        `
        <strong>Conseiller :</strong> ${agencyReferentName}
        `
      }
      Nous vous remercions d'en prendre connaissance pour ${possibleRoleAction}.
      `,
        buttons: [
          {
            label: "Examiner la demande",
            url: manageConventionLink,
            target: "_blank",
          },
        ],
        subContent: defaultSignature(internshipKind),
        attachmentUrls:
          internshipKind === "immersion"
            ? [emailAttachements.memoAgencyGeneral]
            : undefined,
        agencyLogoUrl,
      }),
    },
    NEW_ESTABLISHMENT_CREATED_CONTACT_CONFIRMATION: {
      niceName: "Inscription - Entreprise - Référencement réussi",
      tags: [
        "template:inscription_entreprise_referencementReussi",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
      ],
      createEmailVariables: ({
        businessName,
        businessAddresses,
        appelationLabels,
      }) => ({
        subject: `Votre entreprise ${businessName} est désormais prête à accueillir des immersions !`,
        greetings: "Bonjour,",
        content: `
      Félicitations ! Vous venez d'enregistrer l'entreprise ${businessName} sur Immersion Facilitée pour accueillir des immersions professionnelles.      

      <strong>👤 Votre rôle en tant qu'administrateur</strong>

      Vous êtes maintenant admin de l'entreprise. À ce titre, vous pouvez :

        • gérer les informations et les offres de l'entreprise ;
        • suivre les demandes d'immersion ;
        • accéder aux conventions ;
        • ajouter ou retirer des administrateurs et des contacts.

      Les contacts peuvent consulter les conventions et les candidatures de l'entreprise, et y répondre.`,

        buttons: [
          {
            label: "Découvrir nos conseils pour démarrer",
            url: "https://pages.immersion-facile.beta.gouv.fr/ressources-entreprises/fiche-conseil-entreprise/",
          },
        ],
        subContent: `         
      <strong>🏢 Votre entreprise</strong>
      
      Votre entreprise apparaîtra dans les résultats de recherche correspondant aux critères suivants :
      
      <strong>Métier(s) :</strong>

      ${appelationLabels.map((label) => `• ${label}\n`).join("")}
      <strong>Lieu(x) d'immersion :</strong>

      ${businessAddresses.map((address) => `• ${address}\n`).join("")}
      Pour ces demandes, il n'est pas nécessaire de demander un CV. L'objectif est simplement de passer quelques jours ensemble pour une découverte réciproque. 

      Si une immersion se passe bien et que vous souhaitez aller plus loin, un conseiller emploi pourra vous accompagner et, si besoin, proposer un plan de formation sur mesure.
      ${defaultSignature("immersion")}`,
      }),
    },
    POLE_EMPLOI_ADVISOR_ON_CONVENTION_FULLY_SIGNED: {
      niceName:
        "Convention - Entièrement signée à traiter par le conseiller France Travail lié",
      tags: [
        "template:immersion à étudier (mail conseiller)",
        "theme:convention",
        "acteur:prescripteur",
        "role:preValideur",
      ],
      createEmailVariables: ({
        advisorFirstName,
        advisorLastName,
        agencyLogoUrl,
        beneficiaryEmail,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        dateEnd,
        dateStart,
        manageConventionLink,
        immersionAddress,
      }) => ({
        subject: `Pour action : la demande de convention d'immersion envoyée par ${beneficiaryFirstName} ${beneficiaryLastName} est totalement signée. À vous de la valider !`,
        greetings: greetingsWithConventionId(
          conventionId,
          `${advisorFirstName} ${advisorLastName}`,
        ),
        content: `
      <strong>La demande d'immersion de ${beneficiaryFirstName} ${beneficiaryLastName} est signée. 
      À vous de l'étudier !</strong>`,
        buttons: [
          {
            url: manageConventionLink,
            label: "Voir la demande",
            target: "_blank",
          },
        ],
        subContent: `
      Vous pouvez demander des modifications ou la refuser, si nécessaire  ou la valider si cette demande correspond au projet de ${beneficiaryFirstName} ${beneficiaryLastName}, ${beneficiaryEmail}.      
      
      N'hésitez pas à le joindre ou à appeler l'entreprise. Leurs coordonnées sont présentes dans la demande de convention.        
      
      <strong>Dates de l'immersion :</strong> 
      - du ${displayDate(dateStart)}
      - au ${displayDate(dateEnd)}
      
      <strong>Entreprise d'accueil :</strong>
      - ${businessName}
      - ${immersionAddress}

      ${defaultSignature("immersion")}
      `,
        attachmentUrls: [emailAttachements.memoAgencyGeneral],
        agencyLogoUrl,
      }),
    },
    REJECTED_CONVENTION_NOTIFICATION: {
      niceName: "Convention - Rejetée",
      tags: [
        "template:refus demande d'immersion",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
        "role:tuteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        agencyName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        immersionProfession,
        internshipKind,
        rejectionReason,
        signature,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Refus de la demande d'immersion pour observer l'activité de ${immersionProfession} au sein de ${businessName}`
            : `Mini Stage - Refus de la demande de mini stage pour l'activité de ${immersionProfession} au sein de ${businessName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Nous vous informons que la demande ${
        internshipKind === "immersion"
          ? "d'immersion professionnelle"
          : "de mini stage"
      } de ${beneficiaryFirstName} ${beneficiaryLastName} dans l'entreprise ${businessName} a été refusée par ${agencyName}.
      
      <strong>Les raisons sont&nbsp;:</strong>
      ${rejectionReason}       
      
      Vous pouvez vous rapprocher de votre conseiller${
        internshipKind === "immersion"
          ? ""
          : " de la Chambre consulaire ayant émis la convention"
      } pour en échanger.      
      
      Bien cordialement,       
      ${signature} 
      `,
        agencyLogoUrl,
      }),
    },
    SHARE_CONVENTION_DRAFT_RECIPIENT: {
      niceName: "Convention - Partage du formulaire par lien",
      tags: [
        "template:partage de convention",
        "theme:convention",
        "role:utilisateurDestinataire",
      ],
      createEmailVariables: ({
        additionalDetails,
        conventionFormUrl,
        internshipKind,
      }) => ({
        subject: `${
          internshipKind ? "Immersion Facilitée" : "Mini Stage"
        } - Pour action : une demande de convention préremplie vous est transmise pour que vous la complétiez`,
        greetings: "Bonjour,",
        content: `
        <strong>Une demande de convention ${
          internshipKind === "immersion" ? "d'immersion" : "de mini stage"
        } doit être complétée ${additionalDetails ? ":" : ""}</strong>
        ${
          additionalDetails
            ? `
          ${additionalDetails}
        `
            : ""
        }
        Vous pouvez désormais accéder à la demande pendant 30 jours grâce au lien ci-dessous :
      `,
        buttons: [{ label: "Compléter la demande", url: conventionFormUrl }],
        subContent: defaultSignature(internshipKind),
      }),
    },
    SHARE_CONVENTION_DRAFT_SENDER: {
      niceName: "Convention - Brouillon de convention",
      tags: [
        "template:convention_brouillonConvention",
        "theme:convention",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({ conventionFormUrl, internshipKind }) => ({
        subject: "Votre brouillon de convention",
        greetings: "Bonjour,",
        content: `
Vous avez demandé à recevoir le lien vers votre brouillon de convention. Vous pouvez désormais y accéder pendant 30 jours grâce au lien ci-dessous :
      `,
        buttons: [
          { label: "Mon brouillon de convention", url: conventionFormUrl },
        ],
        subContent: `
        Si vous avez choisi de partager la convention avec une autre personne pour vous aider à la remplir, elle recevra également ce lien et pourra compléter les informations nécessaires.
        
Vous pouvez reprendre votre demande quand vous le souhaitez. Si vous avez la moindre question, notre équipe reste à votre écoute.
        ${defaultSignature(internshipKind)}
          `,
      }),
    },
    SIGNATORY_REMINDER: {
      niceName: "Convention - Dernier rappel de signature",
      tags: [
        "template:relance signatures manquantes",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
        "role:tuteur",
      ],
      createEmailVariables: ({
        actorFirstName,
        actorLastName,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        magicLinkUrl,
        signatoriesSummary,
      }) => ({
        subject:
          "RAPPEL URGENT - La convention démarrant dans moins de 24h n'est pas complètement signée",
        greetings: greetingsWithConventionId(
          conventionId,
          `${actorFirstName} ${actorLastName}`,
        ),
        content: `
      Certains signataires n'ont pas encore signé la demande de convention d'immersion en milieu professionnel pour ${beneficiaryFirstName} ${beneficiaryLastName}.
      
      Voici, à date, l'état des signatures :
      ${signatoriesSummary}

      <strong>Sans toutes les signatures, la convention ne peut être établie et l'établissement ${businessName} ne pourra pas accueillir en immersion ${beneficiaryFirstName} ${beneficiaryLastName}.</strong>

      Nous vous remercions de confirmer au plus vite cette demande.`,
        buttons: magicLinkUrl && [
          {
            label: "Ouvrir la demande de convention",
            url: `${magicLinkUrl}`,
          },
        ],
        subContent: `Bonne journée,
      L'équipe Immersion Facilitée`,
      }),
    },
    SIGNEE_HAS_SIGNED_CONVENTION: {
      niceName: "Convention - Confirmation de signature",
      tags: [
        "template:confirmation de signature de convention",
        "theme:convention",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        conventionId,
        magicLink,
        internshipKind,
        signedAt,
        agencyName,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Confirmation de signature de l'immersion - ${conventionId}`
            : `Mini Stage - Confirmation de signature du mini stage - ${conventionId}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Nous confirmons que vous avez signé ${
        internshipKind === "immersion"
          ? "la convention d'immersion professionnelle"
          : "la convention de mini stage "
      } le ${
        isStringDate(signedAt)
          ? toDisplayedDate({
              date: new Date(signedAt),
              withHours: true,
            })
          : "DATE INVALIDE"
      }.
      `,
        highlight: {
          content: `
        Attention. Votre convention est en cours d'examen.
        Avant de débuter ${
          internshipKind === "immersion" ? "l'immersion" : "le mini stage"
        }, veuillez vous assurer que la convention a bien été validée par un conseiller de la structure d'accompagnement du bénéficiaire (${agencyName}).
        Vous recevrez une notification lorsque ce sera fait.

        Dans le cas contraire, il y a des risques :

        Risque juridique pour l’entreprise : elle s’expose à des sanctions en cas de contrôle par l’inspection du travail. Sans convention, l'immersion pourrait être considérée comme du travail dissimulé.

        Absence de protection pour le candidat : il ne bénéficiera pas de couverture sociale pour les accidents de travail ou les maladies professionnelles liées à l’activité de l’entreprise. En cas d’accident, il pourrait se retrouver sans indemnisation de la sécurité sociale.
        `,
        },
        subContent: defaultSignature(internshipKind),
        buttons: [
          {
            url: magicLink,
            label: "Voir l'état de ma demande",
            target: "_blank",
          },
        ],
        agencyLogoUrl,
      }),
    },
    ESTABLISHMENT_REENGAGEMENT_SUGGESTION: {
      niceName: "Établissement - Suggestion de mise à jour",
      tags: [
        "template:mise à jour fiche entreprise",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
      ],
      createEmailVariables: ({ businessName }) => ({
        subject:
          "Devenez une Super Entreprise et gagnez en visibilité sur Immersion Facilitée !",
        greetings: "Bonjour,",
        content: `Votre entreprise <strong>${businessName}</strong> fait déjà partie des entreprises accueillantes sur Immersion Facilitée, merci pour votre engagement !
        
        🌟 <strong>Devenez une Super Entreprise</strong>
        Les entreprises les plus actives peuvent désormais obtenir le <strong>label “Super Entreprise”</strong>. Ce label :
        • valorise votre engagement RSE,
        • vous fait remonter en tête des résultats de recherche,
        • et renforce votre attractivité auprès des candidats
        Une belle reconnaissance pour votre implication dans la découverte des métiers et de l’inclusion !

        🎥 <strong>Webinaire : “Comment devenir une Super Entreprise ?”</strong>
        Découvrez comment :
        • obtenir le label “Super Entreprise” engagée
        • booster la visibilité de vos offres d’immersion
        • utiliser tout le potentiel de votre espace entreprise

      `,
        subContent: `💡 <strong>Au quotidien, votre espace Immersion Facilitée vous permet de :</strong>
      • gérer vos candidatures reçues chaque mois
      • traiter efficacement les demandes d’immersion
      • gérer les utilisateurs reliés à votre espace entreprise
      • paramétrer vos offres pour attirer des talents
      Ces outils vous simplifient la gestion et renforcent votre visibilité.

      Votre engagement compte, et ensemble, nous facilitons la découverte des métiers partout en France.      
      ${defaultSignature("immersion")}`,
        legals:
          "* Pour les entreprises de 20 salariés et plus, les personnes en situation de handicap accueillies en immersion sont comptabilisées au titre de l'obligation d'emploi.",
        buttons: [
          {
            label: "Je m'inscris au webinaire",
            url: "https://app.livestorm.co/immersion-facilitee/session-express-boost",
          },
        ],
      }),
    },
    TEST_EMAIL: {
      niceName: "Email de test Immersion Facilitée",
      tags: [
        "template:test_email",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:admin",
        "role:adminIF",
        "role:beneficiaire",
        "role:contact",
        "role:employeurActuel",
        "role:lecteur",
        "role:preValideur",
        "role:representantEntreprise",
        "role:representantLégal",
        "role:tuteur",
        "role:utilisateurDestinataire",
        "role:utilisateurInitiateur",
        "role:valideur",
        "theme:MER",
        "theme:acquisitionEntreprise",
        "theme:authentification",
        "theme:bilan",
        "theme:convention",
        "theme:espaceEntreprise",
        "theme:espacePrescripteur",
      ],
      createEmailVariables: ({ input1, input2, url }) => ({
        subject: "[Immersion Facilitée] Un email de test",
        greetings: "Bonjour,",
        content: `
          Cet email vous a été envoyé dans le cadre d'un test.

          - Input1 : ${input1}
          - Input2 : ${input2}
        `,
        buttons: [
          {
            label: "Bouton de test",
            target: "_blank",
            url,
          },
        ],
        subContent: `A très vite sur Immersion Facilitée,
L'équipe d'Immersion Facilitée`,
      }),
    },
    VALIDATED_CONVENTION_FINAL_CONFIRMATION: {
      niceName: "Convention - Finale validée",
      tags: [
        "template:envoi convention",
        "theme:convention",
        "acteur:candidat",
        "acteur:entreprise",
        "acteur:prescripteur",
        "role:beneficiaire",
        "role:employeurActuel",
        "role:representantLégal",
        "role:representantEntreprise",
        "role:tuteur",
        "role:preValideur",
        "role:valideur",
      ],
      createEmailVariables: ({
        agencyLogoUrl,
        beneficiaryBirthdate,
        beneficiaryFirstName,
        beneficiaryLastName,
        businessName,
        conventionId,
        dateEnd,
        dateStart,
        emergencyContactInfos,
        establishmentTutorName,
        immersionAppellationLabel,
        internshipKind,
        magicLink,
        assessmentMagicLink,
        agencyReferentName,
        agencyName,
        validatorName,
      }) => ({
        subject:
          internshipKind === "immersion"
            ? `Validation et convention de l'immersion pour observer l'activité de ${immersionAppellationLabel} au sein de ${businessName}`
            : `Mini Stage - Validation et convention du mini stage pour observer l'activité de ${immersionAppellationLabel} au sein de ${businessName}`,
        greetings: greetingsWithConventionId(conventionId),
        content: `
      Bonne nouvelle ! 

      La demande faite par ${beneficiaryFirstName} ${beneficiaryLastName} (né(e) le ${
        isStringDate(beneficiaryBirthdate)
          ? toDisplayedDate({ date: new Date(beneficiaryBirthdate) })
          : "Date invalide"
      })${agencyReferentName ? `, suivi par ${agencyReferentName}` : ""} pour réaliser une immersion du ${dateStart} au ${dateEnd}, au sein de ${businessName} et encadrée par ${establishmentTutorName} a été validée par ${agencyName} représentée par ${validatorName} 
      et la convention est bien enregistrée. 
      
      ${internshipKind === "immersion" ? "L'immersion" : "Le mini stage"} peut donc démarrer aux dates convenues.       
      `,
        buttons: [
          {
            label:
              internshipKind === "immersion"
                ? "Voir la convention d'immersion"
                : "Voir la convention du mini-stage",
            url: magicLink,
          },
        ],
        subContent: `
      ${defaultSignature(internshipKind)}


      En cas de difficulté, prévenez au plus vite votre ${
        internshipKind === "immersion"
          ? "conseiller"
          : "conseiller de la Chambre consulaire ayant émis la convention"
      } pour qu'il vous conseille au mieux. 
      
      ${
        emergencyContactInfos
          ? `Si la situation l'impose, le contact d'urgence de ${beneficiaryFirstName} ${beneficiaryLastName} : ${emergencyContactInfos}`
          : ""
      }`,
        highlight: assessmentMagicLink
          ? {
              content: `
              Un imprévu ?

              Si l’immersion ne peut pas aller à son terme (abandon, arrêt anticipé, etc.), merci de nous le signaler dès que possible en <a href="${assessmentMagicLink}">déclarant une fin anticipée</a> , pour assurer un bon suivi.`,
            }
          : undefined,
        agencyLogoUrl,
      }),
    },
    ACCOUNT_DELETION_WARNING: {
      niceName: "Compte - Avertissement de suppression pour inactivité",
      tags: ["template:suppressionCompte_inactivité"],
      createEmailVariables: ({ fullName, deletionDate, loginUrl }) => ({
        subject: "Suppression prochaine de votre compte Immersion Facilitée",
        greetings: `Bonjour ${fullName},`,
        content: `Nous n'avons pas constaté de connexion à votre compte Immersion Facilitée depuis bientôt deux ans.

        Conformément à nos règles de conservation des données, votre compte et vos données personnelles vont être supprimés le <strong>${deletionDate}</strong>.

        Pour conserver votre compte, il suffit de vous connecter avant la suppression.`,
        buttons: [
          {
            label: "Se connecter à mon espace",
            url: loginUrl,
          },
        ],
        subContent: `Sans action de votre part, le compte sera supprimé automatiquement et l'accès ne sera plus possible.

        Bien cordialement,
        L'équipe Immersion Facilitée`,
      }),
    },
    WARN_DISCUSSION_DELIVERY_FAILED: {
      niceName:
        "Établissement - Alerte de problème d'envoi d'un échange dans une discussion",
      tags: [
        "template:envoi impossible",
        "theme:MER",
        "role:utilisateurInitiateur",
      ],
      createEmailVariables: ({ recipientsInEmailInError, errorMessage }) => ({
        bypassLayout: true,
        subject: "Échec d'envoi d'email",
        content: `
        <p>Bonjour,</p>
        <p>Votre email n'a pas pu être envoyé. Nous avons rencontré l'erreur suivante :</p>
        
        <p>${errorMessage}</p>
        
        <p>Les destinataires suivants n'ont pas reçu l'email :</p>
        <ul>
          ${recipientsInEmailInError.map((recipient) => `<li>${recipient}</li>`).join("")}
        </ul>
        
        <p>Vous pouvez essayer de renvoyer l'email en évitant les pièces jointes (ou bien en utilisant uniquement des formats pdf ou des images).</p>

        Bonne journée,
        <br/>
        L'équipe Immersion Facile`,
      }),
    },
    ESTABLISHMENT_USER_RIGHT_IS_PENDING: {
      niceName:
        "Espace Entreprise - Administrateur - Demande de rattachement en attente",
      tags: [
        "template:espaceEntreprise_demandeDeRattachement",
        "theme:espaceEntreprise",
        "acteur:entreprise",
        "role:admin",
      ],
      createEmailVariables: ({
        establishmentDashboardUrl,
        adminFirstName,
        adminLastName,
        pendingUserFirstName,
        pendingUserLastName,
        pendingUserRole,
        pendingUserEmail,
      }) => {
        const adminFullName =
          adminFirstName && adminLastName
            ? ` ${adminFirstName} ${adminLastName}`
            : "";
        const pendingUserFullNameOrEmail =
          pendingUserFirstName && pendingUserLastName
            ? `<strong>${pendingUserFirstName} ${pendingUserLastName}</strong> (${pendingUserEmail})`
            : `<strong>${pendingUserEmail}</strong>`;
        return {
          subject:
            "Immersion Facilitée - Demande de rattachement en attente pour votre entreprise",
          content: `
        Bonjour${adminFullName},

        Vous avez une nouvelle demande de rattachement à votre espace entreprise Immersion Facilitée :
        - ${pendingUserFullNameOrEmail} - ${titleByRole[pendingUserRole]}
        `,
          buttons: [
            {
              label: "Gérer les utilisateurs de mon entreprise",
              url: establishmentDashboardUrl,
            },
          ],
          subContent: `
        En acceptant cette demande, vous permettez à vos collaborateurs d’accéder aux conventions et aux candidatures de votre entreprise.
        
        <strong>Besoin d'aide ?</strong> Retrouvez notre article : <a href="https://aide.immersion-facile.beta.gouv.fr/fr/article/gestion-des-utilisateurs-et-droits-pour-une-entreprise-6w4pr9/">Comment gérer les collaborateurs de mon entreprise</a>

        ${defaultSignature("immersion")}`,
        };
      },
    },
  });

const greetingsWithConventionId = (
  conventionId: ConventionId,
  actor?: string,
): string =>
  `<strong>Identifiant de la convention : ${conventionId}</strong>
        
Bonjour${actor ? ` ${actor}` : ""},`;

const descriptionByRole: Record<AgencyRole, string> = {
  validator:
    "<strong>Valideur</strong> (peut valider des conventions de l’agence et modifier leur statut)",
  counsellor:
    "<strong>Pré-Valideur</strong> (peut pré-valider les conventions de l’agence et modifier leur statut)",
  "agency-viewer":
    "<strong>Lecteur</strong> (peut consulter les conventions de l’agence)",
  "agency-admin":
    "<strong>Administrateur</strong> (Peut modifier les informations de l’agence, ajouter et supprimer des utilisateurs, modifier leurs rôles, consulter les conventions)",
  "to-review":
    "<strong>À valider</strong> (Souhaite être rattaché à l'organisme)",
};

const generateUserInfo = (
  firstName: string,
  lastName: string,
  email: string,
  roles: AgencyRole[],
  isNotified: boolean,
  agencyName: string,
): string => {
  const rolesDescriptionList = roles
    .filter((role) => role !== "to-review")
    .map((role) => `<li>${descriptionByRole[role]}</li>`)
    .join("\n");

  const nameDisplay =
    firstName && lastName ? `${firstName} ${lastName} - ${email}` : email;

  return `
    <ul style="list-style-type: none; border: 1px solid #ddd; padding: 16px;"><li><strong>${nameDisplay}</strong></li>
      ${rolesDescriptionList}
      <li>${
        isNotified
          ? "Reçoit les emails de toutes les conventions de "
          : "Ne reçoit aucun email pour "
      } ${agencyName}</li>
      <li><a href="https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence" target="_blank">Espace personnel</a></li></ul>
  `;
};

export const discussionExchangeForbiddenContents = (
  params: DiscussionExchangeForbiddenParams,
): Record<
  ExchangeRole,
  Record<
    DiscussionExchangeForbiddenReason,
    {
      emailContent: {
        content: string;
        buttons?: {
          label: string;
          url: string;
        }[];
      };
      errorMessageFeedback: string;
    }
  >
> => ({
  establishment: {
    user_unknown_or_missing_rights_on_establishment: {
      emailContent: {
        content: `
          Vous avez tenté de répondre à un candidat depuis un email de candidature Immersion Facilitée.
          Malheureusement, <strong>votre message n’a pas pu être transmis</strong> : vous ne disposez pas des droits nécessaires pour répondre au nom de l’entreprise concernée.
          
          Pour pouvoir répondre au candidat via Immersion Facilitée, vous devez être inscrit(e) dans l’espace entreprise avec les bons droits. 
      `,
        buttons:
          isDiscussionExchangeForbiddenParamsWithRequestEstablishmentRegistrationUrl(
            params,
          )
            ? [
                {
                  label: "Demander le rattachement",
                  url: params.requestEstablishmentRegistrationUrl,
                },
              ]
            : undefined,
      },
      errorMessageFeedback:
        "Vous n'avez pas les droits nécessaires pour répondre à cette candidature.",
    },
    discussion_completed: {
      emailContent: {
        content: `
          La candidature à laquelle vous souhaitez répondre n'est plus en cours.
          Le candidat ne recevra pas votre message.`,
      },
      errorMessageFeedback: "La candidature n'est plus en cours.",
    },
    establishment_missing: {
      emailContent: {
        content: `
          L'entreprise liée à cette candidature s’est récemment désinscrite d’Immersion Facilitée.
        Le candidat ne recevra pas votre message.

          Nous vous invitons à réinscrire votre entreprise si vous souhaitez de nouveau répondre aux candidatures.`,
      },
      errorMessageFeedback:
        "L'entreprise liée à cette candidature s'est récemment désinscrite.",
    },
    establishment_banned: {
      emailContent: {
        content: `
          Vous avez tenté de répondre à un candidat via Immersion Facilitée depuis un email de candidature Immersion Facilitée.

          Malheureusement, <strong>votre message n’a pas pu être transmis</strong> :
          <ul>
            <li>Votre établissement ${params.establishmentName} n'a plus accès aux services d'Immersion Facilitée.</li>
            <li>Vous ne pouvez plus échanger avec les candidats via notre plateforme.</li>
            <li>Toutes vos demandes en cours sont annulées.</li>
          </ul>
          Si vous estimez qu'il s'agit d'une erreur, vous pouvez <a href="mailto:${immersionFacileContactEmail}">contacter notre support</a>.
        `,
      },
      errorMessageFeedback:
        "Votre établissement est banni et n'a plus accès aux services d'Immersion Facilitée.",
    },
  },
  potentialBeneficiary: {
    user_unknown_or_missing_rights_on_establishment: {
      emailContent: {
        content: `
          Vous n'êtes pas le candidat associé à cette candidature.
        `,
      },
      errorMessageFeedback:
        "Vous n'êtes pas le candidat associé à cette candidature.",
    },
    discussion_completed: {
      emailContent: {
        content: `
          La candidature à laquelle vous souhaitez répondre n'est plus en cours.
          L'entreprise ne recevra pas votre message.

          Nous vous invitons à chercher une autre entreprise dans l’annuaire pour poursuivre votre démarche.`,
      },
      errorMessageFeedback: "La candidature n'est plus en cours.",
    },
    establishment_missing: {
      emailContent: {
        content: `
          L’entreprise que vous souhaitez contacter s’est récemment désinscrite d’Immersion Facilitée.
          Elle ne recevra pas votre message et ne propose plus d’immersion pour le moment.

          Nous vous invitons à chercher une autre entreprise dans l’annuaire pour poursuivre votre démarche`,
      },
      errorMessageFeedback:
        "L'entreprise liée à cette candidature s'est récemment désinscrite.",
    },
    establishment_banned: {
      emailContent: {
        content: `
          Vous avez tenté d'envoyer un message à l'entreprise ${params.establishmentName} concernant votre immersion.

          Malheureusement, <strong>votre message n’a pas pu être transmis</strong> :
          <ul>
            <li>L'entreprise ${params.establishmentName} n'est plus disponible sur notre site.</li>
            <li>Les échanges avec cet établissement sont désormais fermés.</li>
            <li>Votre candidature auprès de cette entreprise est annulée.</li>
          </ul>
          Si vous estimez qu'il s'agit d'une erreur, vous pouvez <a href="mailto:${immersionFacileContactEmail}">contacter notre support</a>.
        `,
      },
      errorMessageFeedback: "L'entreprise liée à cette candidature est bannie.",
    },
  },
});

const transferReplyWarning =
  "Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.";

export const renderCTAInEmailContent = ({
  url,
  label,
}: {
  url: AbsoluteUrl;
  label: string;
}) => `
    <a href="${url}" style="display: inline-flex; align-items: center; margin: 1.5rem 0; font-weight: 500; font-size: 0.875rem; line-height: 1.5rem; min-height: 2rem; padding: 0.25rem 0.75rem; background-color: #000091; color: #f5f5fe; text-decoration: none;">${label}</a>
  `;
