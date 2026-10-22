import type { EmailBlock } from "html-templates";

export const advices: EmailBlock[] = [
  {
    kind: "paragraph",
    content:
      "<strong>Nos conseils pour cette première prise de contact !</strong>",
  },
  {
    kind: "paragraph",
    content: "<strong>Comment présenter votre demande ?</strong>",
    marginBottom: "sm",
  },
  {
    kind: "list",
    items: [
      "Soyez direct, concret et courtois.",
      `Présentez-vous, indiquez que vous avez eu le nom et le numéro de téléphone de votre interlocutrice ou interlocuteur grâce à Immersion Facilitée puis présentez simplement votre projet et l’objectif que vous recherchez en effectuant une immersion.
        Par exemple : “Je souhaite devenir mécanicien auto et je voudrais découvrir comment ce métier se pratique dans un garage comme le vôtre. Ça me permettra de vérifier que ce métier correspond à l'idée que j'en ai.
        La personne qui m’accueillera et me présentera le métier pourra aussi vérifier si ce métier est fait pour moi.”`,
      "Votre interlocutrice ou interlocuteur sait dans les grandes lignes ce qu’est une immersion professionnelle. Vous pouvez lui rappeler que cette immersion sera encadrée par une convention signée par l'organisme qui vous suit, par elle/lui et par vous.",
      `Indiquez lui le moment où vous aimeriez faire une immersion et pourquoi vous voulez la faire à cette date.
        Par exemple : “Il faudrait que je fasse une immersion avant de m’inscrire à une formation.“`,
      "Indiquez également le nombre de semaines que vous aimeriez faire en immersion si vous le savez déjà.",
      "Concluez en lui demandant un rendez-vous pour qu’il/elle se rende compte du sérieux de votre projet.",
    ],
  },
  {
    kind: "paragraph",
    content: "<strong>Quelle est la durée d’une immersion ?</strong>",
    marginBottom: "sm",
  },
  {
    kind: "list",
    items: [
      "Les immersions se font le plus souvent pendant une semaine ou deux. Une immersion peut être reconduite une fois.",
      "Il n’est pas possible de dépasser un mois.",
      "Il est possible de faire une immersion de seulement un ou deux jours mais vous ne découvrirez pas parfaitement un métier.",
    ],
  },
  {
    kind: "paragraph",
    content:
      "<strong>Comment expliquer simplement ce qu’est une immersion ?</strong>",
    marginBottom: "sm",
  },
  {
    kind: "list",
    items: [
      "C’est un stage d’observation, strictement encadré d’un point de vue juridique qui permet de découvrir un métier, confirmer son projet professionnel ou se faire connaître auprès d'un recruteur.",
      "Vous conservez votre statut et êtes couvert par votre agence France Travail, votre Mission Locale ou le Conseil départemental, Cap Emploi, etc. (en fonction de votre situation).",
      "Pendant la durée de l'immersion, vous conservez votre indemnité habituelle. L'entreprise n'a pas à vous défrayer.",
      "Le rôle de celui qui vous accueillera est de vous présenter le métier et de vérifier avec vous que ce métier vous convient en vous faisant des retours les plus objectifs possibles.",
      "Pendant la durée de votre présence, vous pouvez aider les salariés en donnant un coup de main.",
    ],
  },
  {
    kind: "paragraph",
    content: "<strong>Bon à savoir</strong>",
    marginBottom: "sm",
  },
  {
    kind: "list",
    items: [
      "L'entreprise qui vous accueille n'a pas besoin de votre numéro de sécurité sociale ou de votre date de naissance. Elle n'a pas besoin non plus d'un justificatif de domicile ou d'une feuille d'imposition.",
      "Si on vous les demande, indiquez à l'entreprise de se mettre en relation avec votre conseiller emploi qui attestera de votre identité.",
    ],
  },
];
