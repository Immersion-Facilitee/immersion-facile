import type { SectionStepsProps } from "react-design-system";
import type { InternshipKind } from "shared";

export const immersionStepsContent: Record<InternshipKind, SectionStepsProps> =
  {
    immersion: {
      title: "Le parcours d'une immersion en 5 étapes",
      steps: [
        {
          title: "Candidatures",
          description: "Trouvez le terrain d'immersion qui vous correspond",
        },
        {
          title: "Préparation",
          description:
            "Échangez avec l'entreprise sur les conditions de l'immersion",
        },
        {
          title: "Convention",
          description:
            "Complétez la convention avec l'aide de l'entreprise et de votre conseiller",
        },
        {
          title: "Confirmation",
          description:
            "Recevez la validation de la convention et démarrez l'immersion",
        },
        {
          title: "Bilan",
          description:
            "Faites le point sur votre expérience avec l'entreprise le dernier jour",
        },
      ],
    },
    "mini-stage-cci": {
      title: "Le parcours d'un mini-stage en 5 étapes",
      steps: [
        {
          title: "Candidatures",
          description: "Trouvez le terrain de mini-stage qui vous correspond",
        },
        {
          title: "Préparation",
          description:
            "Échangez avec l'entreprise sur les conditions du mini-stage",
        },
        {
          title: "Convention",
          description:
            "Complétez la convention avec l'aide de l'entreprise et de votre conseiller",
        },
        {
          title: "Confirmation",
          description:
            "Recevez la validation de la convention et démarrez le mini-stage",
        },
        {
          title: "Bilan",
          description:
            "Faites le point sur votre expérience avec l'entreprise le dernier jour",
        },
      ],
    },
  };
