import {
  addLineBreakOnNewLines,
  convertHtmlToText,
} from "src/app/utils/html.utils";

describe("html.utils", () => {
  describe("convertHtmlToText", () => {
    it("keeps paragraphs and list items on separate lines", () => {
      const message = `<p style="margin: 0;">Bonjour,</p>
<ul style="margin: 0 0 0 24px; padding: 0;"><li style="margin: 0 0 4px 0;"><strong>Métier :</strong> Boulanger</li><li style="margin: 0 0 0px 0;"><strong>Durée :</strong> 1 semaine</li></ul>
<p style="margin: 0;">À bientôt,<br/>L'équipe Immersion Facilitée</p>`;

      expect(addLineBreakOnNewLines(convertHtmlToText(message))).toBe(
        "Bonjour,<br>Métier : Boulanger<br>Durée : 1 semaine<br>À bientôt,<br/>L'équipe Immersion Facilitée",
      );
    });
  });
});
