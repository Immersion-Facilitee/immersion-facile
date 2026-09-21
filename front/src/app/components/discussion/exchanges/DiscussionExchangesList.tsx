import { fr } from "@codegouvfr/react-dsfr";
import DOMPurify from "dompurify";
import { BorderedSection, ExchangeMessage } from "react-design-system";
import {
  type DiscussionReadDto,
  type ExchangeRead,
  type ExchangeRole,
  emailExchangeSplitters,
  getFormattedFirstnameAndLastname,
  splitTextOnFirstSeparator,
  toDisplayedDate,
} from "shared";
import {
  addLineBreakOnNewLines,
  convertHtmlToText,
} from "src/app/utils/html.utils";

export const DiscussionExchangesList = ({
  sortedExchanges,
  potentialBeneficiary,
  viewer,
}: {
  sortedExchanges: ExchangeRead[];
  potentialBeneficiary: DiscussionReadDto["potentialBeneficiary"];
  viewer: ExchangeRole;
}): JSX.Element => {
  return (
    <BorderedSection className={fr.cx("fr-mt-2w")}>
      {sortedExchanges.map((exchange) => {
        const currentMessage = addLineBreakOnNewLines(
          convertHtmlToText(exchange.message),
        );
        const messageToDisplay = splitTextOnFirstSeparator(
          currentMessage,
          emailExchangeSplitters,
        );
        return (
          <ExchangeMessage
            key={exchange.sentAt}
            viewer={viewer}
            sender={exchange.sender}
            title={
              exchange.sender === "establishment"
                ? `${exchange.firstname} ${exchange.lastname}`
                : getFormattedFirstnameAndLastname({
                    firstname: potentialBeneficiary.firstName,
                    lastname: potentialBeneficiary.lastName,
                  })
            }
            sentAt={toDisplayedDate({
              date: new Date(exchange.sentAt),
              withHours: true,
            })}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(messageToDisplay[0]),
              }}
            />
          </ExchangeMessage>
        );
      })}
    </BorderedSection>
  );
};
