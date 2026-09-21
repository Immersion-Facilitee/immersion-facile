import type { MigrationBuilder } from "node-pg-migrate";

type AppellationData = {
  appellationCode: string;
  libelleAppellationLong: string;
  libelleAppellationCourt: string;
};

type RomeData = {
  romeCode: string;
  libelleRome: string;
  appellations: AppellationData[];
};

const romeDatas: RomeData[] = [
  {
    romeCode: "G1601",
    libelleRome: "Chef / Cheffe de cuisine",
    appellations: [
      {
        appellationCode: "12110",
        libelleAppellationLong: "Chef / Cheffe de cuisine",
        libelleAppellationCourt: "Chef / Cheffe de cuisine",
      },
      {
        appellationCode: "12495",
        libelleAppellationLong: "Chef / Cheffe des cuisines",
        libelleAppellationCourt: "Chef des cuisines",
      },
      {
        appellationCode: "13384",
        libelleAppellationLong: "Conseiller / Conseillère culinaire",
        libelleAppellationCourt: "Conseiller / Conseillère culinaire",
      },
      {
        appellationCode: "13861",
        libelleAppellationLong: "Cuisinier / Cuisinière",
        libelleAppellationCourt: "Cuisinier / Cuisinière",
      },
      {
        appellationCode: "19354",
        libelleAppellationLong: "Second / Seconde de cuisine",
        libelleAppellationCourt: "Second / Seconde de cuisine",
      },
      {
        appellationCode: "12111",
        libelleAppellationLong: "Chef / Cheffe de cuisine traiteur / traiteuse",
        libelleAppellationCourt: "Chef de cuisine traiteur / traiteuse",
      },
      {
        appellationCode: "403765",
        libelleAppellationLong:
          "Chef cuisinier/pâtissier / Cheffe cuisinière/pâtissière",
        libelleAppellationCourt:
          "Chef cuisinier/pâtissier / Cheffe cuisinière/pâtissière",
      },
      {
        appellationCode: "403766",
        libelleAppellationLong: "Chef / Cheffe d'atelier de cuisine",
        libelleAppellationCourt: "Chef / Cheffe d'atelier de cuisine",
      },
      {
        appellationCode: "403767",
        libelleAppellationLong: "Directeur / Directrice de cuisine",
        libelleAppellationCourt: "Directeur / Directrice de cuisine",
      },
      {
        appellationCode: "403768",
        libelleAppellationLong: "Chef gérant / Cheffe gérante",
        libelleAppellationCourt: "Chef gérant / Cheffe gérante",
      },
      {
        appellationCode: "126511",
        libelleAppellationLong: "Chef / Cheffe de cuisine à domicile",
        libelleAppellationCourt: "Chef de cuisine à domicile",
      },
      {
        appellationCode: "12018",
        libelleAppellationLong: "Chef cuisinier / Cheffe cuisinière",
        libelleAppellationCourt: "Chef cuisinier / cuisinière",
      },
    ],
  },
  {
    romeCode: "F1110",
    libelleRome: "Dessinateur / Dessinatrice enveloppe du bâtiment",
    appellations: [
      {
        appellationCode: "403684",
        libelleAppellationLong:
          "Dessinateur-projeteur / Dessinatrice-projeteuse enveloppe du bâtiment",
        libelleAppellationCourt: "Projeteur / projeteuse enveloppe du bâtiment",
      },
      {
        appellationCode: "403685",
        libelleAppellationLong:
          "Dessinateur / Dessinatrice bureau d'études enveloppe du bâtiment",
        libelleAppellationCourt:
          "Dessinateur(trice) bureau d'études enveloppe du bâtiment",
      },
      {
        appellationCode: "403686",
        libelleAppellationLong:
          "Dessinateur / Dessinatrice exécution enveloppe du bâtiment",
        libelleAppellationCourt:
          "Dessinateur / Dessinatrice exécution enveloppe du bâtiment",
      },
      {
        appellationCode: "403687",
        libelleAppellationLong:
          "Technicien / Technicienne bureau d'études bâtiment",
        libelleAppellationCourt:
          "Technicien / Technicienne bureau d'études bâtiment",
      },
      {
        appellationCode: "403688",
        libelleAppellationLong:
          "Dessinateur / Dessinatrice enveloppe du bâtiment",
        libelleAppellationCourt:
          "Dessinateur / Dessinatrice enveloppe du bâtiment",
      },
      {
        appellationCode: "403689",
        libelleAppellationLong: "Projeteur / Projeteuse enveloppe du bâtiment",
        libelleAppellationCourt: "Projeteur(teuse) enveloppe du bâtiment",
      },
      {
        appellationCode: "403690",
        libelleAppellationLong: "BIM Modeleur / BIM Modeleuse du bâtiment",
        libelleAppellationCourt: "BIM Modeleur / BIM Modeleuse du bâtiment",
      },
    ],
  },
  {
    romeCode: "C1505",
    libelleRome: "Responsable d'agence immobilière",
    appellations: [
      {
        appellationCode: "18893",
        libelleAppellationLong: "Responsable de vente immobilière",
        libelleAppellationCourt: "Responsable de vente immobilière",
      },
      {
        appellationCode: "18686",
        libelleAppellationLong:
          "Responsable de clientèle en transaction immobilière",
        libelleAppellationCourt:
          "Responsable de clientèle en transaction immobilière",
      },
      {
        appellationCode: "403644",
        libelleAppellationLong: "Responsable d'agence en gestion locative",
        libelleAppellationCourt: "Responsable d'agence en gestion locative",
      },
      {
        appellationCode: "403645",
        libelleAppellationLong: "Chef / Cheffe d'agence immobilière",
        libelleAppellationCourt: "Chef / Cheffe d'agence immobilière",
      },
      {
        appellationCode: "403646",
        libelleAppellationLong: "Directeur / Directrice d'agence immobilière",
        libelleAppellationCourt: "Directeur / Directrice d'agence immobilière",
      },
      {
        appellationCode: "403647",
        libelleAppellationLong: "Manager transaction service",
        libelleAppellationCourt: "Manager transaction service",
      },
      {
        appellationCode: "403648",
        libelleAppellationLong: "Responsable de location immobilière",
        libelleAppellationCourt: "Responsable de location immobilière",
      },
      {
        appellationCode: "403649",
        libelleAppellationLong: "Manager d’agence immobilière",
        libelleAppellationCourt: "Manager d’agence immobilière",
      },
      {
        appellationCode: "18618",
        libelleAppellationLong: "Responsable d'agence immobilière",
        libelleAppellationCourt: "Responsable d'agence immobilière",
      },
    ],
  },
  {
    romeCode: "F1102",
    libelleRome: "Architecte d'intérieur",
    appellations: [
      {
        appellationCode: "13406",
        libelleAppellationLong: "Conseiller / Conseillère en architecture",
        libelleAppellationCourt: "Conseiller / Conseillère en architecture",
      },
      {
        appellationCode: "13902",
        libelleAppellationLong: "Décorateur / Décoratrice conseil",
        libelleAppellationCourt: "Décorateur / Décoratrice conseil",
      },
      {
        appellationCode: "13903",
        libelleAppellationLong: "Décorateur / Décoratrice d'intérieur",
        libelleAppellationCourt: "Décorateur / Décoratrice d'intérieur",
      },
      {
        appellationCode: "12809",
        libelleAppellationLong:
          "Concepteur aménageur / Conceptrice aménageuse d'espaces intérieurs",
        libelleAppellationCourt:
          "Concepteur(trice) aménageur(se) d'espaces intérieurs",
      },
      {
        appellationCode: "403679",
        libelleAppellationLong: "Responsable décoration et aménagement",
        libelleAppellationCourt: "Responsable décoration et aménagement",
      },
      {
        appellationCode: "403680",
        libelleAppellationLong: "Concepteur / Conceptrice agencement",
        libelleAppellationCourt: "Concepteur / Conceptrice agencement",
      },
      {
        appellationCode: "403681",
        libelleAppellationLong: "Chef / Cheffe de projet agencement",
        libelleAppellationCourt: "Chef / Cheffe de projet agencement",
      },
      {
        appellationCode: "403682",
        libelleAppellationLong: "Décorateur / Décoratrice",
        libelleAppellationCourt: "Décorateur / Décoratrice",
      },
      {
        appellationCode: "403683",
        libelleAppellationLong: "Agenceur / Agenceuse",
        libelleAppellationCourt: "Agenceur / Agenceuse",
      },
      {
        appellationCode: "11115",
        libelleAppellationLong: "Architecte décorateur / décoratrice",
        libelleAppellationCourt: "Architecte décorateur / décoratrice",
      },
      {
        appellationCode: "13905",
        libelleAppellationLong:
          "Décorateur ensemblier / Décoratrice ensemblière",
        libelleAppellationCourt:
          "Décorateur ensemblier / Décoratrice ensemblière",
      },
      {
        appellationCode: "13994",
        libelleAppellationLong: "Designer / Designeuse d'environnement",
        libelleAppellationCourt: "Designer / Designeuse d'environnement",
      },
      {
        appellationCode: "11117",
        libelleAppellationLong: "Architecte d'intérieur",
        libelleAppellationCourt: "Architecte d'intérieur",
      },
    ],
  },
  {
    romeCode: "E1109",
    libelleRome: "Directeur / Directrice de la communication",
    appellations: [
      {
        appellationCode: "12539",
        libelleAppellationLong:
          "Chef / Cheffe du service d'information et de communication",
        libelleAppellationCourt:
          "Chef du service d'information et de communication",
      },
      {
        appellationCode: "14263",
        libelleAppellationLong: "Directeur / Directrice de la communication",
        libelleAppellationCourt: "Directeur / Directrice de la communication",
      },
      {
        appellationCode: "18692",
        libelleAppellationLong: "Responsable de communication externe",
        libelleAppellationCourt: "Responsable de communication externe",
      },
      {
        appellationCode: "18693",
        libelleAppellationLong: "Responsable de communication interne",
        libelleAppellationCourt: "Responsable de communication interne",
      },
      {
        appellationCode: "18725",
        libelleAppellationLong: "Responsable de la communication",
        libelleAppellationCourt: "Responsable de la communication",
      },
      {
        appellationCode: "18776",
        libelleAppellationLong:
          "Responsable de l'information et de la communication",
        libelleAppellationCourt:
          "Responsable de l'information et de la communication",
      },
      {
        appellationCode: "403671",
        libelleAppellationLong:
          "Directeur / Directrice de la communication institutionnelle/corporate",
        libelleAppellationCourt:
          "Directeur / Directrice de la communication de l'organisation",
      },
      {
        appellationCode: "403672",
        libelleAppellationLong:
          "Directeur / Directrice marketing et communication",
        libelleAppellationCourt:
          "Directeur / Directrice marketing et communication",
      },
      {
        appellationCode: "403673",
        libelleAppellationLong: "Responsable communication (interne/externe)",
        libelleAppellationCourt: "Responsable communication (interne/externe)",
      },
      {
        appellationCode: "18691",
        libelleAppellationLong: "Responsable de communication en entreprise",
        libelleAppellationCourt: "Responsable de communication en entreprise",
      },
    ],
  },
  {
    romeCode: "C1208",
    libelleRome: "Courtier / Courtière en banque",
    appellations: [
      {
        appellationCode: "403639",
        libelleAppellationLong: "Courtier / Courtière en gestion de patrimoine",
        libelleAppellationCourt:
          "Courtier / Courtière en gestion de patrimoine",
      },
      {
        appellationCode: "403640",
        libelleAppellationLong: "Chargé / Chargée de clientèle de courtage",
        libelleAppellationCourt: "Chargé / Chargée de clientèle de courtage",
      },
      {
        appellationCode: "403641",
        libelleAppellationLong: "Courtier / Courtière en banque",
        libelleAppellationCourt: "Courtier / Courtière en banque",
      },
      {
        appellationCode: "403642",
        libelleAppellationLong: "Courtier / Courtière en crédit",
        libelleAppellationCourt: "Courtier / Courtière en crédit",
      },
      {
        appellationCode: "403643",
        libelleAppellationLong: "Courtier / Courtière en prêt",
        libelleAppellationCourt: "Courtier / Courtière en prêt",
      },
      {
        appellationCode: "38957",
        libelleAppellationLong: "Courtier / Courtière en prêts immobiliers",
        libelleAppellationCourt: "Courtier / Courtière en prêts immobiliers",
      },
    ],
  },
  {
    romeCode: "F1112",
    libelleRome: "Ingénieur / Ingénieure calcul et structure",
    appellations: [
      {
        appellationCode: "15597",
        libelleAppellationLong: "Ingénieur / Ingénieure calcul de structure",
        libelleAppellationCourt: "Ingénieur / Ingénieure calcul de structure",
      },
      {
        appellationCode: "403696",
        libelleAppellationLong:
          "Ingénieur / Ingénieure conception assistée par ordinateur",
        libelleAppellationCourt:
          "Ingénieur / Ingénieure conception assistée par ordinateur",
      },
      {
        appellationCode: "403697",
        libelleAppellationLong:
          "Ingénieur / Ingénieure de développement d'algorithmes",
        libelleAppellationCourt:
          "Ingénieur / Ingénieure de développement d'algorithmes",
      },
      {
        appellationCode: "403698",
        libelleAppellationLong:
          "Ingénieur / Ingénieure modélisation et simulation",
        libelleAppellationCourt:
          "Ingénieur / Ingénieure modélisation et simulation",
      },
      {
        appellationCode: "403699",
        libelleAppellationLong:
          "Ingénieur calculateur / Ingénieure calculatrice",
        libelleAppellationCourt:
          "Ingénieur calculateur / Ingénieure calculatrice",
      },
      {
        appellationCode: "403700",
        libelleAppellationLong:
          "Projeteur / Projeteuse calculateur en structure",
        libelleAppellationCourt:
          "Projeteur / Projeteuse calculateur en structure",
      },
      {
        appellationCode: "403701",
        libelleAppellationLong:
          "Ingénieur / Ingénieure recherche «calculs CFD»",
        libelleAppellationCourt:
          "Ingénieur / Ingénieure recherche «calculs CFD»",
      },
      {
        appellationCode: "403702",
        libelleAppellationLong: "Ingénieur concepteur / Ingénieure conceptrice",
        libelleAppellationCourt:
          "Ingénieur concepteur / Ingénieure conceptrice",
      },
      {
        appellationCode: "403703",
        libelleAppellationLong: "Ingénieur / Ingénieure calcul et structure",
        libelleAppellationCourt: "Ingénieur / Ingénieure calcul et structure",
      },
      {
        appellationCode: "403704",
        libelleAppellationLong: "Ingénieur / Ingénieure calcul scientifique",
        libelleAppellationCourt: "Ingénieur / Ingénieure calcul scientifique",
      },
      {
        appellationCode: "403705",
        libelleAppellationLong: "Ingénieur / Ingénieure d'études structure",
        libelleAppellationCourt: "Ingénieur / Ingénieure d'études structure",
      },
      {
        appellationCode: "403706",
        libelleAppellationLong: "Ingénieur / Ingénieure conception calcul",
        libelleAppellationCourt: "Ingénieur / Ingénieure conception calcul",
      },
      {
        appellationCode: "403707",
        libelleAppellationLong: "Calculateur / Calculatrice en structure",
        libelleAppellationCourt: "Calculateur / Calculatrice en structure",
      },
      {
        appellationCode: "403708",
        libelleAppellationLong: "Ingénieur / Ingénieure d'études calcul",
        libelleAppellationCourt: "Ingénieur / Ingénieure d'études calcul",
      },
      {
        appellationCode: "403709",
        libelleAppellationLong: "Chef / Cheffe de projet structure",
        libelleAppellationCourt: "Chef / Cheffe de projet structure",
      },
      {
        appellationCode: "403710",
        libelleAppellationLong: "Chef / Cheffe de secteur calculs",
        libelleAppellationCourt: "Chef / Cheffe de secteur calculs",
      },
      {
        appellationCode: "403711",
        libelleAppellationLong: "Ingénieur / Ingénieure structure",
        libelleAppellationCourt: "Ingénieur / Ingénieure structure",
      },
      {
        appellationCode: "403712",
        libelleAppellationLong: "Calculateur / Calculatrice",
        libelleAppellationCourt: "Calculateur / Calculatrice",
      },
      {
        appellationCode: "403713",
        libelleAppellationLong: "Responsable calculs",
        libelleAppellationCourt: "Responsable calculs",
      },
    ],
  },
];

export async function up(pgm: MigrationBuilder): Promise<void> {
  await Promise.all(
    romeDatas.map(async ({ romeCode, libelleRome, appellations }) => {
      //  do nothing on conflict
      await pgm.db.query(
        `
            INSERT INTO public_romes_data (code_rome, libelle_rome, libelle_rome_tsvector)
            VALUES ($1, $2::text, to_tsvector('french', $2::text))
            ON CONFLICT (code_rome) DO NOTHING;
        `,
        [romeCode, libelleRome],
      );

      await Promise.all(
        appellations.map(
          async ({
            appellationCode,
            libelleAppellationLong,
            libelleAppellationCourt,
          }) =>
            pgm.db.query(
              `
              INSERT INTO public_appellations_data
              (ogr_appellation, code_rome, libelle_appellation_long, libelle_appellation_court, libelle_appellation_long_tsvector, libelle_appellation_long_without_special_char)
              VALUES ($1, $2, $3::text, $4, to_tsvector('french', $3::text), unaccent(REGEXP_REPLACE($3, '[()]', '', 'g')))
              ON CONFLICT (ogr_appellation) DO NOTHING;
            `,
              [
                appellationCode,
                romeCode,
                libelleAppellationLong,
                libelleAppellationCourt,
              ],
            ),
        ),
      );
    }),
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query(`
    DELETE FROM public_appellations_data 
    WHERE public_appellations_data.code_rome in (${romeDatas
      .map((romeData) => `'${romeData.romeCode}'`)
      .join(", ")})
 `);

  await pgm.db.query(`
  DELETE FROM public_romes_data 
  WHERE public_romes_data.code_rome in (${romeDatas
    .map(({ romeCode }) => `'${romeCode}'`)
    .join(", ")});
  `);
}
