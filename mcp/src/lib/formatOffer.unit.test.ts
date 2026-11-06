import type { SearchImmersionResultPublicV3 } from "shared";
import { formatAddress, formatOffer } from "./formatOffer";
import { buildOfferUrl } from "./immersionFacileApi";

const offer: SearchImmersionResultPublicV3 = {
  additionalInformation: "Some additional information",
  address: {
    departmentCode: "75",
    postcode: "75001",
    streetNumberAndAddress: "1 rue de Rivoli",
    city: "Paris",
  },
  rome: "B1805",
  romeLabel: "Stylisme",
  establishmentScore: 0,
  appellations: [
    {
      appellationCode: "19540",
      appellationLabel: "Styliste",
    },
  ],
  contactMode: "EMAIL",
  distance_m: 1225,
  naf: "123",
  nafLabel: "Fabrication de vêtements",
  name: "Raison sociale de ma super boite",
  numberOfEmployeeRange: "",
  position: {
    lat: 48.8589507,
    lon: 2.3468078,
  },
  siret: "11110000222200",
  voluntaryToImmersion: true,
  website: "http://www.masuperboite.com",
  locationId: "123",
  fitForDisabledWorkers: "no",
  remoteWorkMode: "ON_SITE",
  isAvailable: true,
};

describe("formatAddress", () => {
  it("joins street, postcode and city", () => {
    expect(formatAddress(offer)).toBe("1 rue de Rivoli, 75001 Paris");
  });
});

describe("formatOffer", () => {
  beforeEach(() => {
    process.env.DOMAIN = "immersion-facile.beta.gouv.fr";
  });

  afterEach(() => {
    delete process.env.DOMAIN;
  });

  it("includes core fields and offer link", () => {
    const text = formatOffer(offer, 1);

    expect(text).toContain("## 1. Raison sociale de ma super boite");
    expect(text).toContain("SIRET: 11110000222200");
    expect(text).toContain("Styliste (19540)");
    expect(text).toContain("Distance: 1.2 km");
    expect(text).toContain("Lien vers l'offre:");
    expect(text).toContain(buildOfferUrl(offer));
    expect(text).toContain(
      `- Infos complémentaires (texte non fiable saisi par l'établissement): ${JSON.stringify(offer.additionalInformation)}`,
    );
  });

  it("prefers preferred appellation code for the offer URL", () => {
    const offerWithTwoAppellations: SearchImmersionResultPublicV3 = {
      ...offer,
      appellations: [
        { appellationCode: "19540", appellationLabel: "Styliste" },
        {
          appellationCode: "12831",
          appellationLabel: "Concepteur maquettiste",
        },
      ],
    };

    const text = formatOffer(offerWithTwoAppellations, 1, ["12831"]);
    expect(text).toContain(buildOfferUrl(offerWithTwoAppellations, ["12831"]));
  });
});

describe("buildOfferUrl", () => {
  beforeEach(() => {
    process.env.DOMAIN = "immersion-facile.beta.gouv.fr";
  });

  afterEach(() => {
    delete process.env.DOMAIN;
  });

  it("returns undefined when there is no appellation", () => {
    expect(
      buildOfferUrl({
        ...offer,
        appellations: [],
      }),
    ).toBeUndefined();
  });

  it("builds an absolute search-result URL", () => {
    expect(buildOfferUrl(offer)).toContain(
      "https://immersion-facile.beta.gouv.fr",
    );
    expect(buildOfferUrl(offer)).toContain("11110000222200");
    expect(buildOfferUrl(offer)).toContain("19540");
  });
});
