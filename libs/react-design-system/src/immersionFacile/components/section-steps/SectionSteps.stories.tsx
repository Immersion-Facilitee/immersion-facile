import type { ArgTypes, Meta, StoryObj } from "@storybook/react-vite";
import { SectionSteps, type SectionStepsProps } from "./SectionSteps";

const Component = SectionSteps;
type Story = StoryObj<typeof Component>;
const argTypes: Partial<ArgTypes<SectionStepsProps>> | undefined = {};

const componentDescription = `
\`\`\`tsx
import { SectionSteps } from "react-design-system";
\`\`\`
`;

export default {
  title: "SectionSteps",
  component: Component,
  argTypes,
  parameters: {
    docs: {
      description: {
        component: componentDescription,
      },
    },
  },
} as Meta<typeof Component>;

export const Default: Story = {
  args: {
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
};
