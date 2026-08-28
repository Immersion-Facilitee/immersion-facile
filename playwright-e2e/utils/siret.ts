export const e2eSiretEstablishments = [
  {
    siret: "12345678901234",
    businessName: "MA P'TITE BOITE",
    expectedAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
  },
  {
    siret: "77561959600155",
    businessName: "MA P'TITE BOITE 2",
    expectedAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
  },
  {
    siret: "24570135400111",
    businessName: "MA P'TITE BOITE 2",
    expectedAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
  },
] as const;

export const defaultE2eSiret = e2eSiretEstablishments[0].siret;
