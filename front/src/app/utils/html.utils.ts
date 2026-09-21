export const convertHtmlToText = (message: string): string => {
  const bodyRegex: RegExp = /<body[^>]*>([\s\S]*?)<\/body>/;
  const matches: RegExpMatchArray | null = message.match(bodyRegex);

  const body = matches?.[0] ?? message;

  return body.replace(/<(?!br\s*\/?)[^>]+>/g, "") || "Pas de contenu";
};

export const addLineBreakOnNewLines = (text: string): string =>
  cleanTextWithSingleLineBreaks(text).replace(/(?:\r\n|\r|\n)/g, "<br>");

const cleanTextWithSingleLineBreaks = (text: string): string => {
  let cleanedText = text.replace(/(\r\n|\r|\n){2,}/g, "\n");
  cleanedText = cleanedText.replace(/[ \t]+/g, " ");
  cleanedText = cleanedText.replace(/\s*\n\s*/g, "\n");
  return cleanedText.trim();
};
