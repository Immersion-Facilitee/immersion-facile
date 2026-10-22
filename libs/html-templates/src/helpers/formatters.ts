export const ignoreTabs = (str: string): string =>
  str.replace(/\n +/g, "\n").trim();

export const convertLineBreaksToHtml = (text: string): string =>
  ignoreTabs(text).split("\n").join("<br/>");

export const convertTextToHtml = (text: string): string =>
  `<p>${convertLineBreaksToHtml(text)}</p>`;
