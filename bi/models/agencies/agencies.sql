{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
          "CREATE INDEX IF NOT EXISTS idx_agencies_id ON {{ this }} (id)",
          "CREATE INDEX IF NOT EXISTS idx_agencies_name ON {{ this }} (name)",
          "CREATE INDEX IF NOT EXISTS idx_agencies_kind ON {{ this }} (kind)",
          "CREATE INDEX IF NOT EXISTS idx_agencies_status ON {{ this }} (status)",
    ]
  )
}}

select
    a.id,
    a.name,
    a.kind,
    a.questionnaire_url,
    a.email_signature,
    a.legacy_address,
    a.position,
    a.created_at,
    a.updated_at,
    a.status,
    a.agency_siret::text as agency_siret,
    a.code_safir,
    a.logo_url,
    a.street_number_and_address,
    a.post_code,
    a.city,
    a.department_code,
    pdr.department_name,
    pdr.region_name,
    a.refers_to_agency_id,
    refersToAgencies.name as refers_to_agency_name,
    a.status_justification,
    a.covered_departments,
    a.acquisition_campaign,
    a.acquisition_keyword,
    a.delegation_info ->> 'delegationAgencyKind' as delegation_agency_kind,
    a.delegation_info ->> 'delegationAgencyName' as delegation_agency_name,
    (a.delegation_info ->> 'delegationEndDate')::date as delegation_end_date,
    pn.phone_number
from {{ source('immersion', 'agencies') }} as a
left join {{ source('immersion', 'public_department_region') }} as pdr
    on pdr.department_code = a.department_code
left join {{ source('immersion', 'agencies') }} as refersToAgencies
    on refersToAgencies.id = a.refers_to_agency_id
left join {{ source('immersion', 'phone_numbers') }} as pn
    on pn.id = a.phone_id