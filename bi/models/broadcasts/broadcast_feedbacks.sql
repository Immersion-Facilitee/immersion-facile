{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_convention_id ON {{ this }} (convention_id)",
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_occurred_at ON {{ this }} (occurred_at)",
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_consumer_name ON {{ this }} (consumer_name)",
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_agency_kind ON {{ this }} (agency_kind)",
    ]
  )
}}

with classified_broadcast_feedbacks as (
    select
        bf.*,
        case
            when bf.subscriber_error_feedback is null then null
            when bf.subscriber_error_feedback ->> 'message' in (
            'Aucun dossier trouvé pour les critères d''identité transmis',
            'Aucune mission locale trouvée pour le numéro de SIRET fourni',
            'L''email transmis par le partenaire ne correspond pas à l''email renseigné dans le dossier du jeune',
            'Aucun employeur trouvé pour le code renseigné',
            'Le téléphone transmis par le partenaire ne correspond pas au téléphone renseigné dans le dossier du jeune',
            'Aucun métier trouvé pour le code ROME renseigné',
            'L''email et le téléphone transmis par le partenaires ne correspondent pas aux email et téléphone renseignés dans le dossier du jeune',
            'Plusieurs dossiers trouvés pour les critères transmis',
            'Identifiant National DE non trouvé',
            'Identifiant National DE trouvé mais écart sur la date de naissance',
            'Identifiant National DE trouvé, le bénéficiaire est un candidat',
            'Identifiant National DE trouvé mais écart sur la date de naissance, le bénéficiaire est un candidat',
            'Identifiant national non trouvé',
            'Identifiant national non trouvé avec le numéro de téléphone',
            'Identifiant national trouvé avec le mail, bénéficiaire est un candidat',
            'Identifiant national trouvé avec le téléphone, bénéficiaire est un candidat ',
            'Identifiant national DE trouvé avec le mail mais écart sur la date de naissance',
            'Identifiant National DE trouvé avec le téléphone, mais écart sur la date de naissance',
            'Identifiant National trouvé avec le mail, mais écart sur la date de naissance, bénéficiaire est un candidat',
            'Identifiant National trouvé avec le téléphone, mais écart sur la date de naissance, bénéficiaire est un candidat',
            'Plusieurs Identifiant National DE trouvés',
            'Plusieurs Identifiants nationaux DE trouvés avec mail',
            'Plusieurs Identifiants nationaux DE trouvés avec téléphone',
            'Plusieurs Identifiants nationaux DE trouvés avec mail et téléphone ',
            'Le bénéficiaire FT connect est un candidat',
            'Accord non signé pour ce type de structure d''accompagnement'
            ) then 'functional'
            else 'technical'
        end as error_kind
    from {{ source('immersion', 'broadcast_feedbacks') }} as bf
)

select
    bf.id,
    (bf.request_params ->> 'conventionId')::uuid as convention_id,
    bf.request_params ->> 'conventionStatus' as convention_status,
    a.id as agency_id,
    a.kind as agency_kind,
    a.department_code as agency_department_code,
    bf.occurred_at,
    bf.consumer_name,
    (bf.response ->> 'httpStatus')::integer as http_status,
    bf.subscriber_error_feedback ->> 'message' as error_message,
    bf.response -> 'body' ->> 'codeErreur' as error_code,
    bf.error_kind,
    case
        when bf.error_kind = 'technical' then bf.response ->> 'body'
    end as technical_error_response_body,
    bf.handled_by_agency
from classified_broadcast_feedbacks as bf
left join {{ source('immersion', 'conventions') }} as c
    on c.id = (bf.request_params ->> 'conventionId')::uuid
left join {{ source('immersion', 'agencies') }} as a
    on a.id = c.agency_id
