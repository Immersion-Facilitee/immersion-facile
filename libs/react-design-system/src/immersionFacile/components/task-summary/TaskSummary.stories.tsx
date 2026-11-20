import type { ArgTypes, Meta, StoryObj } from "@storybook/react-vite";
import { TaskSummary, type TaskSummaryProps } from "./TaskSummary";

const Component = TaskSummary;
type Story = StoryObj<typeof Component>;
const argTypes: Partial<ArgTypes<TaskSummaryProps>> | undefined = {};

const componentDescription = `
\`\`\`tsx  
import { TaskSummary } from "react-design-system";
\`\`\`
`;

export default {
  title: "TaskSummary",
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
    count: 10,
    countLabel: "Actions urgentes",
    icon: "fr-icon-alert-fill",
    buttonProps: {
      children: "Traiter cette liste",
      onClick: () => {},
    },
  },
};

export const WithDetail: Story = {
  args: {
    count: 2,
    countLabel: "Rattachements en attente",
    icon: "fr-icon-edit-line",
    detail: "Gestion réservée aux administrateurs",
  },
};
