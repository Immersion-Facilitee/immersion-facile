import { type Dispatch, type SetStateAction, useState } from "react";
import type { ContactErrorKind } from "src/core-logic/ports/SearchGateway";

type ErrorTitleAndDescription = {
  title: string;
  description: string;
};

const errorKindToTitleAndDescription = {
  alreadyContactedRecently: {
    title: "Candidature déjà effectuée",
    description:
      "Vous avez déjà contacté cette entreprise il y a moins de 7 jours. Elle a bien reçu votre demande. Il n'est pas nécessaire de la contacter de nouveau.",
  },
} satisfies Record<ContactErrorKind, ErrorTitleAndDescription>;

type ActiveError =
  | { isActive: false }
  | { isActive: true; title: string; description: string };

export const useContactEstablishmentError = (): {
  activeError: ActiveError;
  setActiveErrorKind: Dispatch<SetStateAction<ContactErrorKind | null>>;
} => {
  const [activeErrorKind, setActiveErrorKind] =
    useState<ContactErrorKind | null>(null);

  return {
    activeError:
      activeErrorKind === null
        ? { isActive: false }
        : {
            isActive: true,
            title: errorKindToTitleAndDescription[activeErrorKind].title,
            description:
              errorKindToTitleAndDescription[activeErrorKind].description,
          },
    setActiveErrorKind,
  };
};
