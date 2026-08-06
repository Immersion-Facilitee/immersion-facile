export const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove all accents, e.g 'à' -> 'a'
    .toLowerCase();
