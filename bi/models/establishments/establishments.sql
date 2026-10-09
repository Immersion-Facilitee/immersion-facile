{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_establishments_siret ON {{ this }} (siret)",
      "CREATE INDEX IF NOT EXISTS idx_establishments_status ON {{ this }} (status)",
      "CREATE INDEX IF NOT EXISTS idx_establishments_is_open ON {{ this }} (is_open)",
      "CREATE INDEX IF NOT EXISTS idx_establishments_source_provider ON {{ this }} (source_provider)",
      "CREATE INDEX IF NOT EXISTS idx_establishments_update_date ON {{ this }} (update_date)"
    ]
  )
}}

select
    siret::text as siret,
    name,
    customized_name,
    created_at,
    update_date,
    naf_code,
    naf_nomenclature,
    contact_mode,
    is_open,
    source_provider,
    number_employees,
    fit_for_disabled_workers,
    website,
    additional_information,
    searchable_by_students,
    searchable_by_job_seekers,
    max_contacts_per_month,
    next_availability_date,
    is_max_discussions_for_period_reached,
    last_insee_check_date,
    acquisition_campaign,
    acquisition_keyword,
    score,
    status,
    status_updated_at,
    welcome_address_street_number_and_address,
    welcome_address_postcode,
    welcome_address_city,
    welcome_address_department_code,
    welcome_address_lat,
    welcome_address_lon
from {{ source('immersion', 'establishments') }}
