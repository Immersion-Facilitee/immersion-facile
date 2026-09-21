import type { ReactElement } from "react";
import { MainWrapper } from "react-design-system";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import type {
  ErrorButton,
  FrontErrorProps,
} from "src/app/contents/error/types";
import {
  ContactUsButton,
  FrontSpecificError,
  HomeButton,
} from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { ErrorPageContent } from "./ErrorPageContent";

type ErrorPageProperties = {
  error: FrontSpecificError | Error;
  title?: string;
  buttons?: ErrorButton[];
} & {
  feedbackTopic?: FeedbackTopic;
};

const getPageContentProps = (
  error: FrontSpecificError | Error,
  title?: string,
  buttons?: ErrorButton[],
): FrontErrorProps => {
  if (error instanceof FrontSpecificError) return error.props;

  return {
    title: title ?? "Erreur inattendue",
    description: error.message,
    buttons: buttons ?? [
      HomeButton,
      <ContactUsButton key={ContactUsButton.name} />,
    ],
  };
};

export const ErrorPage = ({
  error,
  title,
  buttons,
  feedbackTopic,
}: ErrorPageProperties): ReactElement => (
  <HeaderFooterLayout>
    <MainWrapper layout="default">
      <ErrorPageContent
        {...getPageContentProps(error, title, buttons)}
        feedbackTopic={feedbackTopic}
      />
    </MainWrapper>
  </HeaderFooterLayout>
);
