import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContentCard } from "./ContentCard";

const Component = ContentCard;
type Story = StoryObj<typeof Component>;

const componentDescription = `
Affiche un bloc de contenu bordé avec un titre optionnel, ou un accordéon DSFR quand \`accordionId\` est fourni.

\`\`\`tsx
import { ContentCard } from "react-design-system";
\`\`\`
`;

const content = (
  <p className={fr.cx("fr-mb-0")}>
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus.
  </p>
);

export default {
  title: "ContentCard",
  component: Component,
  parameters: {
    docs: {
      description: {
        component: componentDescription,
      },
    },
  },
} satisfies Meta<typeof Component>;

export const Default: Story = {
  args: {
    title: "À propos de l'entreprise",
    children: content,
  },
};

export const WithoutTitle: Story = {
  args: {
    children: content,
  },
};

export const WithTitleAside: Story = {
  args: {
    title: "Contacter l'entreprise",
    titleAside: <Badge severity="success">Répond rapidement</Badge>,
    children: content,
  },
};

export const WithLargePadding: Story = {
  args: {
    title: "À propos de l'entreprise",
    hasLargePadding: true,
    children: content,
  },
};

export const AsAccordion: Story = {
  args: {
    title: "Métier proposé",
    accordionId: "content-card-accordion-story",
    children: content,
  },
};
