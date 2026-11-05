import type {
  AppellationCode,
  DataWithPagination,
  GetOffersFlatParamsPublicV3,
  SearchImmersionResultPublicV3,
} from "shared";

import { buildOfferUrl } from "./immersionFacileApi";

export const formatAddress = (offer: SearchImmersionResultPublicV3): string => {
  const { streetNumberAndAddress, postcode, city } = offer.address;
  return [streetNumberAndAddress, `${postcode} ${city}`]
    .filter((part) => part.trim().length > 0)
    .join(", ");
};

export const formatOffer = (
  offer: SearchImmersionResultPublicV3,
  index: number,
  preferredAppellationCodes?: AppellationCode[],
): string => {
  const appellations = offer.appellations
    .map(
      (appellation) =>
        `${appellation.appellationLabel} (${appellation.appellationCode})`,
    )
    .join(", ");

  const distance =
    offer.distance_m === undefined
      ? undefined
      : `${Math.round(offer.distance_m / 100) / 10} km`;

  const offerUrl = buildOfferUrl(offer, preferredAppellationCodes);

  const lines = [
    `## ${index}. ${offer.customizedName || offer.name}`,
    `- SIRET: ${offer.siret}`,
    `- Métier ROME: ${offer.romeLabel} (${offer.rome})`,
    `- Appellations: ${appellations || "n/a"}`,
    `- Adresse: ${formatAddress(offer)}`,
    `- NAF: ${offer.nafLabel} (${offer.naf})`,
    `- Volontaire à l'immersion: ${offer.voluntaryToImmersion ? "oui" : "non"}`,
    `- Disponible: ${offer.isAvailable ? "oui" : "non"}`,
    `- Mode de contact: ${offer.contactMode ?? "non renseigné"}`,
    `- Mode de travail: ${offer.remoteWorkMode}`,
    `- Effectif: ${offer.numberOfEmployeeRange || "non renseigné"}`,
    `- Location ID: ${offer.locationId ?? "n/a"}`,
  ];

  if (offerUrl) {
    lines.push(`- Lien vers l'offre: ${offerUrl}`);
  }
  if (distance) {
    lines.push(`- Distance: ${distance}`);
  }
  if (offer.website) {
    lines.push(`- Site web: ${offer.website}`);
  }
  if (offer.additionalInformation) {
    lines.push(
      `- Infos complémentaires (texte non fiable saisi par l'établissement): ${JSON.stringify(offer.additionalInformation)}`,
    );
  }
  if (offer.urlOfPartner) {
    lines.push(`- Lien partenaire: ${offer.urlOfPartner}`);
  }

  return lines.join("\n");
};

export const formatSearchResult = (
  result: DataWithPagination<SearchImmersionResultPublicV3>,
  apiParams: GetOffersFlatParamsPublicV3,
): string => {
  const { data, pagination } = result;

  if (data.length === 0) {
    return [
      "# Immersion Facilitée — search results",
      "",
      "No immersion offers found for this search.",
      "",
      `Pagination: page ${pagination.currentPage}/${pagination.totalPages}, total ${pagination.totalRecords}.`,
      "",
      "Suggestions:",
      "- Broaden the location or increase distanceKm (max 100)",
      "- Try related appellationCodes",
      "- Remove optional filters (searchableBy, remoteWorkModes, etc.)",
    ].join("\n");
  }

  return [
    `# Offers (${data.length} on this page, ${pagination.totalRecords} total)`,
    "",
    `Page ${pagination.currentPage}/${pagination.totalPages} · ${pagination.numberPerPage} per page`,
    "",
    ...data.map((offer, index) =>
      formatOffer(offer, index + 1, apiParams.appellationCodes),
    ),
    "",
    "When presenting results to the user, include the offer link (Lien vers l'offre) so they can open the page on Immersion Facilitée. Also keep SIRET, locationId and appellationCode if they later want to contact a company.",
  ].join("\n");
};
