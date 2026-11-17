# Immersion Facilitée recherche d'entreprises accueillantes API v2

Ceci est la documentation pour consommer l'api d'Immersion Facilitée.

Une clé API est nécessaire pour utiliser l'api. Veuillez vous mettre en contact avec l'équipe d'immersion facilité pour l'obtenir.

Les contacts seront diffusés (si nous les avons) car vous êtes authentifiés avec la clé.
⚠️ IL NE FAUT PAS LES EXPOSER PUBLIQUEMENT ⚠️

Url de staging:
<https://staging.immersion-facile.beta.gouv.fr/api/v2/>

Url de production:
<https://immersion-facile.beta.gouv.fr/api/v2/>

La clé API est à fournir en authorization header de toutes les requêtes.

## Candidatures

La candidature peut se faire sur la route :

POST`/contact-establishment`

schema body :

```typescript
type ContactEstablishmentRequestBody = {
  romeCode: string;
  siret: string;
  potentialBeneficiaryFirstName: string;
  potentialBeneficiaryLastName: string;
  potentialBeneficiaryEmail: string;
  contactMode: "EMAIL" | "IN_PERSON" | "PHONE";
  message: string; //EMAIL ONLY
  potentialBeneficiaryPhone: string; //EMAIL ONLY
  immersionObjective:
    | "Confirmer un projet professionnel"
    | "Découvrir un métier ou un secteur d'activité"
    | "Initier une démarche de recrutement"; //EMAIL ONLY
  potentialBeneficiaryResumeLink?: string; //EMAIL ONLY (optional)
};
```

Vous devez fournir le mode de contact qui a été renseigné par l'entreprise (dans les résultats de recherche).

Ce qui se passe:

- EMAIL : L’entreprise va recevoir le message du candidat par email et c’est la responsabilité de l'entreprise de recontacter le candidat (le mail du candidat est fourni à l'entreprise).

- PHONE : Dans le cas téléphone le candidat va recevoir un email avec le téléphone de la personne à contacter dans l’entreprise.

- IN_PERSON : Dans le cas en personne le candidat reçoit un email avec le nom de la personne, et l’addresse de l’entreprise et doit se présenter en personne.

Exemple de requête valide (EMAIL) :

```bash
  curl 'https://immersion-facile.beta.gouv.fr/api/v2/contact-establishment' \
  -H "authorization":"your-api-key" \
  -H 'Content-Type: application/json' \
  --data-raw '{"romeCode":"B1805","siret":"12345678901234","potentialBeneficiaryFirstName":"Jean","potentialBeneficiaryLastName":"Valjean","potentialBeneficiaryEmail":"Jean.Valjean@gmail.com","contactMode":"EMAIL","message":"Bonjour, \n\nJ’ai trouvé votre entreprise sur le site https://immersion-facile.beta.gouv.fr\n***Rédigez ici votre email de motivation en suivant nos conseils.***\n  \nPourriez-vous me contacter par mail ou par téléphone pour me proposer un rendez-vous ? \nJe pourrais alors vous expliquer directement mon projet. \n  \nEn vous remerciant,","potentialBeneficiaryPhone":"08635343637","immersionObjective":"Initier une démarche de recrutement","potentialBeneficiaryResumeLink":"http://Jeanb.com"}' \
  --compressed
```

Exemple de requête valide (PHONE) :

```bash
  curl 'https://immersion-facile.beta.gouv.fr/api/v2/contact-establishment' \
  -H "authorization":"your-api-key" \
  -H 'Content-Type: application/json' \
  --data-raw '{"romeCode":"B1805","siret":"12345678901234","potentialBeneficiaryFirstName":"Jean","potentialBeneficiaryLastName":"Valjean","potentialBeneficiaryEmail":"Jean.Valjean@gmail.com","contactMode":"PHONE"}' \
  --compressed
```

Exemple de requête valide (IN_PERSON) :

```bash
 curl 'https://immersion-facile.beta.gouv.fr/api/v2/contact-establishment' \
 -H "authorization":"your-api-key" \
 -H 'Content-Type: application/json' \
 --data-raw '{"romeCode":"B1805","siret":"12345678901234","potentialBeneficiaryFirstName":"Jean","potentialBeneficiaryLastName":"Valjean","potentialBeneficiaryEmail":"Jean.Valjean@gmail.com","contactMode":"IN_PERSON"}' \
 --compressed
```
