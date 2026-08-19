{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_conventions_status ON {{ this }} (status_technical)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_status_french ON {{ this }} (status_french)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_agency_id ON {{ this }} (agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_agency_name ON {{ this }} (agency_name)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_agency_status ON {{ this }} (agency_status)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_agency_kind ON {{ this }} (agency_kind)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_siret ON {{ this }} (siret)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_establishment_naf_code ON {{ this }} (establishment_naf_code)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_date_start ON {{ this }} (date_start)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_date_end ON {{ this }} (date_end)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_date_submission ON {{ this }} (date_submission)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_date_approval ON {{ this }} (date_approval)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_date_validation ON {{ this }} (date_validation)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_agency_region ON {{ this }} (agency_region_name)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_estab_region ON {{ this }} (establishment_region_name)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_rome_code ON {{ this }} (rome_code)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_appellation_code ON {{ this }} (appellation_code)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_id ON {{ this }} (id)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_appellation_label ON {{ this }} (appellation_label)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_rome_label ON {{ this }} (rome_label)",
      "CREATE INDEX IF NOT EXISTS idx_conventions_analytics_assessment_completed ON {{ this }} (status_technical, internship_kind, updated_at) INCLUDE (date_end, assessment_signed_at, assessment_created_at) WHERE assessment_status IN ('COMPLETED', 'PARTIALLY_COMPLETED') AND assessment_signed_at IS NOT NULL AND assessment_created_at IS NOT NULL",
    ]
  )
}}

select
    -- Convention base fields
    c.id,
    c.status as status_technical,
    c.date_submission,
    c.date_validation,
    c.date_approval,
    c.date_start,
    c.date_end,
    c.immersion_objective,
    c.work_conditions,
    c.immersion_activities,
    c.immersion_skills,
    c.individual_protection,
    c.sanitary_prevention,
    c.sanitary_prevention_description,
    c.siret::text as siret,
    c.business_name,
    c.immersion_address,
    c.created_at,
    c.updated_at,
    c.internship_kind,
    c.business_advantages,
    c.status_justification,
    c.validators,
    c.renewed_from,
    c.renewed_justification,
    c.establishment_number_employees,
    c.individual_protection_description,
    c.acquisition_campaign as convention_acquisition_campaign,
    c.acquisition_keyword as convention_acquisition_keyword,

-- Status translation
cst.translation as status_french,

-- Schedule JSON extractions
c.schedule -> 'complexSchedule' as schedule_complex,
(c.schedule ->> 'workedDays')::numeric as schedule_worked_days,
(c.schedule ->> 'totalHours')::numeric as schedule_total_hours,

-- Postal code regex extraction
(
    regexp_match(c.immersion_address, '\d{5}')
) [1] as immersion_postal_code,

-- Validator fields from JSON
c.validators #>> '{agencyValidator, firstname}' as validator_firstname,
    c.validators #>> '{agencyValidator, lastname}' as validator_lastname,

-- Agency fields
a.id as agency_id,
a.name as agency_name,
a.status as agency_status,
a.agency_siret::text as agency_siret,
nullif(trim(concat(c.agency_referent_first_name, ' ', c.agency_referent_last_name)), '') as agency_referent_name,
refer_a.name as referring_agency_name,
a.kind as agency_kind,
pdr.department_name as agency_department_name,
pdr.region_name as agency_region_name,

-- FT Connect user fields
ftu.advisor_email as ft_advisor_email,
ftu.ft_connect_id as ft_connect_id,

-- Appellation and ROME fields
pad.ogr_appellation as appellation_code,
pad.libelle_appellation_long as appellation_label,
prd.code_rome as rome_code,
prd.libelle_rome as rome_label,

-- Establishment enrichment
case
    when estab.siret is not null then true
    else false
end as is_referenced_establishment,
estab.source_provider as establishment_source_provider,
coalesce(mec.naf_code, estab.naf_code) as establishment_naf_code,
naf.naf_label as establishment_naf_label,
estab.name as establishment_name,
estab.customized_name as establishment_customized_name,
estab.welcome_address_street_number_and_address as establishment_address,
estab.welcome_address_postcode as establishment_postcode,
estab.welcome_address_city as establishment_city,
estab.welcome_address_department_code as establishment_department_code,
dept_estab.department_name as establishment_department_name,
dept_estab.region_name as establishment_region_name,

-- Beneficiary fields
b.id as beneficiary_id,
b.first_name as beneficiary_first_name,
b.last_name as beneficiary_last_name,
concat(
    b.first_name,
    ' ',
    b.last_name
) as beneficiary_full_name,
b.email as beneficiary_email,
pn_b.phone_number as beneficiary_phone,
b.signed_at as beneficiary_signed_at,
case
    when b.signed_at is not null then true
    else false
end as is_signed_by_beneficiary,
(
    b.extra_fields ->> 'birthdate'
)::timestamp with time zone as beneficiary_birthdate,
b.extra_fields ->> 'emergencyContact' as beneficiary_emergency_contact,
pn_b_emergency.phone_number as beneficiary_emergency_contact_phone,
b.extra_fields ->> 'levelOfEducation' as beneficiary_level_of_education,
b.extra_fields ->> 'isRqth' as beneficiary_is_rqth,
b.extra_fields ->> 'schoolName' as beneficiary_school_name,
b.extra_fields ->> 'schoolPostcode' as beneficiary_school_postcode,

-- Establishment tutor fields
et.id as establishment_tutor_id,
et.first_name as establishment_tutor_first_name,
et.last_name as establishment_tutor_last_name,
concat(
    et.first_name,
    ' ',
    et.last_name
) as establishment_tutor_full_name,
et.extra_fields ->> 'job' as establishment_tutor_job,
concat(
    et.first_name,
    ' ',
    et.last_name,
    ' ',
    et.extra_fields ->> 'job'
) as establishment_tutor_full_name_with_job,
et.email as establishment_tutor_email,
pn_et.phone_number as establishment_tutor_phone,
et.signed_at as establishment_tutor_signed_at,

-- Establishment representative fields
er.id as establishment_representative_id,
er.first_name as establishment_representative_first_name,
er.last_name as establishment_representative_last_name,
concat(
    er.first_name,
    ' ',
    er.last_name
) as establishment_representative_full_name,
er.email as establishment_representative_email,
pn_er.phone_number as establishment_representative_phone,
er.signed_at as establishment_representative_signed_at,
case
    when er.signed_at is not null then true
    else false
end as is_signed_by_establishment_representative,

-- Beneficiary representative fields
br.id as beneficiary_representative_id,
br.first_name as beneficiary_representative_first_name,
br.last_name as beneficiary_representative_last_name,
concat(
    br.first_name,
    ' ',
    br.last_name
) as beneficiary_representative_full_name,
br.email as beneficiary_representative_email,
pn_br.phone_number as beneficiary_representative_phone,
br.signed_at as beneficiary_representative_signed_at,
case
    when c.beneficiary_representative_id is null then null
    when br.signed_at is not null then true
    else false
end as is_signed_by_beneficiary_representative,

-- Beneficiary current employer fields
bce.id as beneficiary_current_employer_id,
bce.first_name as beneficiary_current_employer_first_name,
bce.last_name as beneficiary_current_employer_last_name,
concat(
    bce.first_name,
    ' ',
    bce.last_name
) as beneficiary_current_employer_full_name,
bce.email as beneficiary_current_employer_email,
pn_bce.phone_number as beneficiary_current_employer_phone,
bce.signed_at as beneficiary_current_employer_signed_at,
case
    when c.beneficiary_current_employer_id is null then null
    when bce.signed_at is not null then true
    else false
end as is_signed_by_beneficiary_current_employer,

-- Assessment fields


ass.status as assessment_status,
    ass.created_at as assessment_created_at,
    ass.ended_with_a_job as assessment_ended_with_a_job,
    ass.type_of_contract as assessment_type_of_contract,
    ass.establishment_feedback as assessment_establishment_feedback,
    ass.number_of_hours_actually_made as assessment_hours_actually_made,
    ass.signed_at as assessment_signed_at

from {{ source('immersion', 'conventions') }} as c

-- Agency joins
inner join {{ source('immersion', 'agencies') }} as a
    on a.id = c.agency_id
left join {{ source('immersion', 'agencies') }} as refer_a
    on a.refers_to_agency_id = refer_a.id
left join {{ source('immersion', 'public_department_region') }} as pdr
    on pdr.department_code = a.department_code

-- FT Connect users (via junction table)
left join {{ source('immersion', 'conventions__ft_connect_users') }} as cftu
    on c.id = cftu.convention_id
left join {{ source('immersion', 'ft_connect_users') }} as ftu
    on ftu.ft_connect_id = cftu.ft_connect_id

-- Appellation and ROME reference data
inner join {{ source('immersion', 'public_appellations_data') }} as pad
    on pad.ogr_appellation = c.immersion_appellation
inner join {{ source('immersion', 'public_romes_data') }} as prd
    on pad.code_rome::bpchar = prd.code_rome

-- Establishment enrichment
left join {{ source('immersion', 'marketing_establishment_contacts') }} as mec
    on mec.siret = c.siret
left join {{ source('immersion', 'establishments') }} as estab
    on estab.siret = c.siret
left join {{ source('immersion', 'public_department_region') }} as dept_estab
    on dept_estab.department_code = estab.welcome_address_department_code
left join {{ ref('naf_nomenclature') }} as naf
    on naf.naf_code = regexp_replace(upper(coalesce(mec.naf_code, estab.naf_code)), '[^0-9A-Z]', '', 'g')

-- Assessment
left join {{ source('immersion', 'immersion_assessments') }} as ass
    on ass.convention_id = c.id

-- Actors (5 different roles)


inner join {{ source('immersion', 'actors') }} as b
    on c.beneficiary_id = b.id
left join {{ source('immersion', 'phone_numbers') }} as pn_b
    on pn_b.id = b.phone_id
left join {{ source('immersion', 'phone_numbers') }} as pn_b_emergency
    on pn_b_emergency.id = b.emergency_contact_phone_id

inner join {{ source('immersion', 'actors') }} as et
    on c.establishment_tutor_id = et.id
left join {{ source('immersion', 'phone_numbers') }} as pn_et
    on pn_et.id = et.phone_id

inner join {{ source('immersion', 'actors') }} as er
    on c.establishment_representative_id = er.id
left join {{ source('immersion', 'phone_numbers') }} as pn_er
    on pn_er.id = er.phone_id

left join {{ source('immersion', 'actors') }} as br
    on c.beneficiary_representative_id = br.id
left join {{ source('immersion', 'phone_numbers') }} as pn_br
    on pn_br.id = br.phone_id

left join {{ source('immersion', 'actors') }} as bce
    on c.beneficiary_current_employer_id = bce.id
left join {{ source('immersion', 'phone_numbers') }} as pn_bce
    on pn_bce.id = bce.phone_id

-- Status translation
inner join {{ source('immersion', 'convention_status_translations') }} as cst
    on c.status = cst.status

where c.date_end >= (current_date - interval '25 months')
