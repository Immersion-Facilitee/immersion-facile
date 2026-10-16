# Immersion Facilitée — LLM Plugin

Plugin LLM permettant d'accéder aux services d'**Immersion Facilitée** directement depuis une interface conversationnelle.

L'objectif est de proposer progressivement une nouvelle façon de s'informer sur les immersions professionnelles, de rechercher une immersion et, à terme, d'accompagner la création d'une convention.

Le plugin s'appuie autant que possible sur les services et APIs déjà exposés par Immersion Facilitée.

## Fonctionnalités

### V0 — Cadre légal de l'immersion

La première version permet à ChatGPT de répondre aux questions concernant le cadre légal des **Périodes de Mise en Situation en Milieu Professionnel (PMSMP)**.

Cette fonctionnalité repose uniquement sur une **skill** et des ressources de référence officielles. Elle ne nécessite pas de serveur MCP.

Exemples de questions :

* Quelle est la durée maximale d'une immersion ?
* Puis-je faire une immersion si je suis salarié ?
* Suis-je rémunéré pendant une PMSMP ?
* Que se passe-t-il en cas d'accident pendant l'immersion ?
* Quelles sont les obligations de l'entreprise d'accueil ?

### V1 — Recherche d'immersion

Le serveur MCP expose le tool `search_immersion_offers`, qui interroge l'API publique Immersion Facilitée (v3) pour trouver des entreprises accueillantes.

Exemple :

> Je voudrais découvrir le métier de développeur web autour de Poitiers, idéalement à moins de 10 km.

#### Configuration

1. Obtenir une clé API auprès de l'équipe Immersion Facilitée (scope *recherche d'entreprise*) — [documentation API v3](https://immersion-facile.beta.gouv.fr/doc-api?version=v3).
2. Fournir le token au serveur MCP via la variable d'environnement `IMMERSION_FACILE_API_TOKEN` (voir `.env.example`).

En local, le serveur charge automatiquement le fichier `.env` du package `mcp` :

```bash
cd mcp
cp .env.example .env
# renseigner IMMERSION_FACILE_API_TOKEN=...
pnpm start
# ou depuis la racine du monorepo : pnpm mcp start
```

**Important :** redémarrer le serveur MCP après avoir modifié `.env`. Si le client démarre le process lui-même (stdio), vous pouvez aussi passer le token dans le bloc `env` de la config MCP.

Le token est envoyé dans le header `authorization` des appels à `GET /api/v3/offers`.

#### Paramètres du tool

Alignés sur `GetOffersFlatParamsPublicV3` (`shared/src/search/GetOffersPublicV3.dto.ts`) :

| Paramètre | Description |
| --- | --- |
| `appellationCodes` | Codes appellation ROME (5 ou 6 chiffres) |
| `place` | Libellé de lieu (analytics uniquement — ne filtre pas) |
| `latitude` / `longitude` / `distanceKm` | Filtre géographique (rayon max 100 km) |
| `departmentCodes` | Codes département |
| `locationIds` | UUIDs de locations |
| `sirets` | SIRET (14 chiffres) |
| `searchableBy` | `students` ou `jobSeekers` |
| `fitForDisabledWorkers` | Accessibilité travailleurs handicapés |
| `remoteWorkModes` | `ON_SITE`, `HYBRID`, `FULL_REMOTE` |
| `nafCodes` | Codes NAF |
| `showOnlyAvailableOffers` | Uniquement les offres disponibles |
| `sortBy` / `sortOrder` | Tri (`date`, `score` ou `distance`) — `distance` exige lat/lon/`distanceKm` |
| `page` / `perPage` | Pagination |

Pas de paramètre texte libre `job` : le métier passe par `appellationCodes`.

### À terme — Convention d'immersion

Permettre d'accompagner l'utilisateur dans la préparation d'une demande de convention, en s'appuyant sur les services d'Immersion Facilitée.

L'objectif n'est pas nécessairement de reproduire l'ensemble du parcours existant dans ChatGPT : certaines étapes pourront continuer à être réalisées sur Immersion Facilitée lorsque l'interface dédiée est plus adaptée.

