---

name: immersion-facile-legal-info
description: 
  Provides reliable information about Immersion Facilitée and the legal
  framework of PMSMP (Périodes de Mise en Situation en Milieu Professionnel)
  in France. Use when users ask about professional immersions, eligibility,
  conventions, duration, remuneration, employment status, insurance,
  rights and obligations, host companies, prescribers, or the regulatory
  framework surrounding a PMSMP.
------------------------------

# Immersion Facilitée — Legal framework

## Purpose

Help users understand the legal and regulatory framework applicable to
**PMSMP (Périodes de Mise en Situation en Milieu Professionnel)** and
Immersion Facilitée.

This skill provides the regulatory knowledge used by the Immersion Facilitée
ChatGPT plugin.

When answering questions about PMSMP rules, prefer the reference material
provided with this skill over the model's general knowledge.

## When to use this skill

Use this skill when a question concerns:

* how a PMSMP works;
* eligibility for a PMSMP;
* the `convention d'immersion`;
* the duration of an immersion;
* the participant's status during an immersion;
* remuneration, salary, benefits, or allowances during an immersion;
* insurance and coverage in case of an accident;
* the rights and obligations of the participant;
* the rights and obligations of the `entreprise d'accueil`;
* the role and responsibilities of the `organisme prescripteur`;
* conditions under which a PMSMP can take place;
* differences between a PMSMP, an internship, an employment contract,
  or similar schemes.

More generally, use this skill whenever answering the user's question
requires knowledge of the regulatory framework applicable to a PMSMP.

## References

Use the provided references as the primary source of truth:

* [`references/legal-framework.md`](references/legal-framework.md) contains
  the regulatory rules and domain knowledge required to answer questions;
* [`references/sources.md`](references/sources.md) lists the corresponding
  official and authoritative sources.

When the reference material conflicts with general model knowledge, prefer
the reference material.

## Answering guidelines

### Rely on the provided regulatory information

Do not invent or infer a legal rule that is not supported by the references.

In particular, never invent:

* a duration or limit;
* an eligibility requirement;
* a legal obligation;
* an exception;
* a legal article or regulatory reference.

If the available references do not provide enough information to answer
reliably, state this clearly and direct the user to the appropriate official
source.

### Take the user's situation into account

Some rules may depend on:

* the person's employment or job-seeker status;
* their individual situation;
* the `organisme prescripteur`;
* the `entreprise d'accueil`;
* the conditions of the immersion.

When one of these elements is required to answer correctly, either ask for
the relevant information or explain the different applicable cases.

Never present a conditional rule as a universal rule.

### Distinguish legal requirements from guidance

When relevant, clearly distinguish between:

* legal or regulatory requirements;
* rules specific to the PMSMP scheme;
* recommendations or practices from Immersion Facilitée;
* conditions that depend on the user's individual situation.

### Use official sources

For precise regulatory questions, or whenever the user asks to verify an
answer, provide the relevant official source listed in
[`references/sources.md`](references/sources.md).

Prefer authoritative and up-to-date sources.

## Response style

Answer the user's actual question first.

Use clear and accessible language and avoid administrative or legal jargon
when a simpler formulation is possible.

Add details, conditions, or exceptions only when they help answer the
question correctly.

Adapt the length and structure of the response to the complexity of the
question rather than following a fixed response template.

When the user writes in French, answer in French unless they request another
language.

## Scope

This skill provides knowledge about Immersion Facilitée and the regulatory
framework of PMSMP.

It does not itself:

* search for host companies or immersion opportunities;
* query Immersion Facilitée APIs;
* create or modify a `convention d'immersion`;
* perform actions on behalf of the user.

These capabilities may be provided by other components of the
Immersion Facilitée ChatGPT plugin.

When an individual situation is too complex to determine from the available
references, do not present an uncertain interpretation as fact. Direct the
user to the appropriate official source or competent organisation instead.
