# Review PR #5931

**PR :** [#5931](https://github.com/Immersion-Facilitee/immersion-facile/pull/5931) — `#5935 - Initialisation du MCP dans le monorepo`  
**Auteur :** enguerranws  
**Branche :** `init-mcp-server`  
**Verdict :** **Changes requested** — pas merge-ready.

Bon socle MCP + move des contrats public V3 vers `shared`. Direction bonne. L’auteur a déjà 6 self-comments utiles (encore ouverts). Il reste des risques sécurité / qualité à traiter avant RfR.

---

## (A) Self-review auteur

| Fichier | Verdict | Commentaire |
| --- | --- | --- |
| `mcp/src/lib/immersionFacileApi.ts` L17 | Partial | Defaults prod OK pour un client plugin ; sinon fail-fast + doc dans `.env.example`. Une seule source d’env préférable. |
| `mcp/src/lib/immersionFacileApi.ts` L19–L22 | Agree | Drop les aliases (`SearchImmersionOffersParams`, `ImmersionOffer`, `SearchImmersionOffersResult`) ; utiliser les types shared directement. |
| `mcp/src/lib/immersionFacileApi.ts` L41–L45 | Partial | Reconstruire l’URL API depuis un base front / `DOMAIN`. Ne pas importer `AppConfig` du back. |
| `mcp/src/lib/immersionFacileApi.ts` L91 | Agree | Passer par `createFetchSharedClient` ; drop axios si plus utilisé ailleurs. |
| `mcp/src/lib/registerTool.ts` L18–L32 | Agree (problème) | Le cast cache le mismatch zod. Fix = aligner `zod` monorepo (≥ peer MCP `^4.2`), pas « shared-routes » seul. |
| `mcp/src/tools/healthCheck.ts` | Agree | Supprimer le tool + son register dans `server.ts`. MCP a déjà un lifecycle/ping. |

Threads :

- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456904544
- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456911037
- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456921304
- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456936918
- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456953665
- https://github.com/Immersion-Facilitee/immersion-facile/pull/5931#discussion_r4456961012

---

## (B) Nouveaux findings

`mcp/src/server.ts:L48:` 🟡 risk: `listen(PORT)` sur toutes les interfaces, **sans auth MCP**. Le token API devient une capacité LAN. Bind `127.0.0.1` par défaut ; auth / reverse-proxy avant expo non-local.

`mcp/package.json` (PR : `zod: 4.0.17`) + `registerTool.ts:L18-L32:` 🔴 bug: peer MCP `zod ^4.2` vs pin `4.0.17`. Aligner zod ; retirer le cast.

`mcp/src/tools/searchImmersionOffers.ts:L33-L122:` 🟡 risk: `inputSchema` hand-rolled ≠ `getOffersFlatParamsSchemaPublicV3Schema` (drift champs d’acquisition, `.min(1)`, `place`…). Dériver du schema shared ou composer `.describe()` dessus.

`mcp/src/tools/getLegalInfo.ts:L40-L76:` 🟡 risk: dump légal + sources à chaque call ; `question` non utilisée pour filtrer. Coût tokens + echo de la question. Cache des reads ; tronquer / sections ; borner la longueur de `question`.

`mcp/skill/SKILL.md:L1-L11:` 🔴 bug: frontmatter cassé (`---` puis fermeture `-----…`). Utiliser des fences YAML `---` standard, sinon les loaders rejettent.

`mcp/README.md` vs `server.ts:L37-L39:` 🔵 nit: README V0 « no MCP » mais `get_legal_info` reste enregistré. Aligner la story produit.

`mcp/README.md:` 🔵 nit: doc stdio alors que le serveur est HTTP-only. Documenter l’endpoint HTTP / connector ChatGPT, ou ajouter un transport stdio.

`mcp/.env.example:L2:` 🔵 nit: `PORT=3000` collision probable avec le front. Défaut `3100+`.

`mcp/src/lib/immersionFacileApi.ts:L86-L96:` 🔵 nit: nouvel axios client à chaque `searchImmersionOffers`. Singleton.

`mcp/package.json:` 🟡 risk: zéro tests (`formatOffer`, `buildOfferUrl`, mapping d’erreurs API). Ajouter des tests unitaires ciblés avant RfR.

`shared/src/search/SearchImmersionResultPublicV3.dto.ts:L3:` 🔵 nit: public V3 = alias de `InternalOfferDto` — OK fonctionnel, mais le nom « Internal » fuit dans le contrat public. Documenter ou renommer l’export.

`shared/src/search/ContactEstablishmentPublicV3.dto.ts:` OK — mapping pur déplacé vers shared ; pas de fuite de side-effect back.

Move V3 → `shared` + package workspace `mcp/` : direction bonne.

---

## (C) Process

- Checklist PR incomplète (relecture, `/document-issue`, RfR).
- Checks CI souvent en skipping sur cette branche — à relancer avant merge.

---

## Plan d’action synthétique

1. **Bloquants** : aligner zod + drop cast ; bind `127.0.0.1` ; fixer frontmatter `SKILL.md` ; supprimer `health_check` ; réduire le dual schema search.
2. **Self-comments** : env / fetch / aliases.
3. **Qualité** : tests unitaires ciblés ; nits README / PORT / singleton client.
4. Compléter checklist + relancer CI avant RfR.
