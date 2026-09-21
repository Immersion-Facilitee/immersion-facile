{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_conv_count_status ON {{ this }} (status_technical)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_agency_status ON {{ this }} (agency_status)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_date_start ON {{ this }} (date_start)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_validation_siret ON {{ this }} (date_validation) INCLUDE (siret)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_department ON {{ this }} (agency_department_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_region ON {{ this }} (agency_region_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_department_code ON {{ this }} (establishment_department_code)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_department ON {{ this }} (establishment_department_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_region ON {{ this }} (establishment_region_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_naf_code ON {{ this }} (establishment_naf_code)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_naf_label ON {{ this }} (establishment_naf_label)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_agency_id ON {{ this }} (agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_agency_name ON {{ this }} (agency_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_agency_grouping_filters ON {{ this }} (agency_name, agency_kind, status_technical, agency_status, date_start) INCLUDE (agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_siret ON {{ this }} (siret)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_immersion_objective ON {{ this }} (immersion_objective)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_rome_label ON {{ this }} (rome_label)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_appellation_label ON {{ this }} (appellation_label)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_immersion_postal_code ON {{ this }} (immersion_postal_code)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_immersion_department ON {{ this }} (immersion_department_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_immersion_region ON {{ this }} (immersion_region_name)",
      "CREATE INDEX IF NOT EXISTS idx_conv_count_establishment_postcode ON {{ this }} (establishment_postcode)",
    ]
  )
}}

select
    c.id,
    c.siret::text as siret,
    c.business_name,
    c.establishment_number_employees,
    a.id as agency_id,
    a.name as agency_name,
    c.status as status_technical,
    a.status as agency_status,
    a.kind as agency_kind,
    pdr.department_name as agency_department_name,
    pdr.region_name as agency_region_name,
    c.date_validation,
    c.date_submission,
    c.date_start,
    c.date_end,
    prd.code_rome as rome_code,
    prd.libelle_rome as rome_label,
    pad.libelle_appellation_long as appellation_label,
    estab.welcome_address_department_code as establishment_department_code,
    dept_estab.department_name as establishment_department_name,
    dept_estab.region_name as establishment_region_name,
    coalesce(mec.naf_code, estab.naf_code) as establishment_naf_code,
    naf.naf_label as establishment_naf_label,
    c.internship_kind,
    c.immersion_objective,
    ass.status as assessment_status,
    ass.ended_with_a_job as assessment_ended_with_a_job,
    ass.type_of_contract as assessment_type_of_contract,
    case
        when estab.siret is not null then true
        else false
    end as is_referenced_establishment,
    b.email as beneficiary_email,
    (c.schedule ->> 'totalHours')::numeric as schedule_total_hours,
    immersion_address.postal_code as immersion_postal_code,
    substring(c.immersion_address from '[0-9]{5}\s+(.*)') as immersion_city,
    dept_immersion.department_name as immersion_department_name,
    dept_immersion.region_name as immersion_region_name,
    estab.welcome_address_postcode as establishment_postcode,
    (
        b.extra_fields ->> 'birthdate'
    )::timestamp with time zone as beneficiary_birthdate,
    b.extra_fields ->> 'levelOfEducation' as beneficiary_level_of_education,
    b.extra_fields ->> 'schoolName' as beneficiary_school_name,
    b.extra_fields ->> 'isRqth' as beneficiary_is_rqth,
    estab.fit_for_disabled_workers as establishment_fit_for_disabled_workers,
    c.source_convention_draft_id
from {{ source('immersion', 'conventions') }} as c
cross join lateral (
    select (regexp_match(c.immersion_address, '\d{5}'))[1] as postal_code
) as immersion_address
left join {{ source('immersion', 'public_department_region') }} as dept_immersion
    on dept_immersion.department_code = case
        when left(immersion_address.postal_code, 3) in ('200', '201') then '2A'
        when left(immersion_address.postal_code, 3) in ('202', '206') then '2B'
        when left(immersion_address.postal_code, 3) in ('971', '972', '973', '974', '975', '976')
            then left(immersion_address.postal_code, 3)
        else left(immersion_address.postal_code, 2)
    end
inner join {{ source('immersion', 'agencies') }} as a
    on a.id = c.agency_id
left join {{ source('immersion', 'public_department_region') }} as pdr
    on pdr.department_code = a.department_code
inner join {{ source('immersion', 'public_appellations_data') }} as pad
    on pad.ogr_appellation = c.immersion_appellation
inner join {{ source('immersion', 'public_romes_data') }} as prd
    on pad.code_rome::bpchar = prd.code_rome
left join {{ source('immersion', 'marketing_establishment_contacts') }} as mec
    on mec.siret = c.siret
left join {{ source('immersion', 'establishments') }} as estab
    on estab.siret = c.siret
left join {{ source('immersion', 'public_department_region') }} as dept_estab
    on dept_estab.department_code = estab.welcome_address_department_code
left join {{ ref('naf_nomenclature') }} as naf
    on naf.naf_code = regexp_replace(upper(coalesce(mec.naf_code, estab.naf_code)), '[^0-9A-Z]', '', 'g')
left join {{ source('immersion', 'immersion_assessments') }} as ass
    on ass.convention_id = c.id
inner join {{ source('immersion', 'actors') }} as b
    on c.beneficiary_id = b.id
order by c.date_validation nulls last
