{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_establishment_offers_siret ON {{ this }} (siret)",
      "CREATE INDEX IF NOT EXISTS idx_establishment_offers_appellation ON {{ this }} (appellation_code)",
      "CREATE INDEX IF NOT EXISTS idx_establishment_offers_rome ON {{ this }} (code_rome)"
    ]
  )
}}

select
    offers.siret::text as siret,
    offers.appellation_code,
    offers.created_at,
    offers.update_date,
    offers.remote_work_mode,
    appellations.code_rome,
    appellations.libelle_appellation_long as appellation_label,
    appellations.libelle_appellation_court as appellation_label_short,
    rome.libelle_rome as rome_label
from {{ source('immersion', 'immersion_offers') }} as offers
left join {{ source('immersion', 'public_appellations_data') }} as appellations
    on offers.appellation_code = appellations.ogr_appellation
left join {{ source('immersion', 'public_romes_data') }} as rome
    on appellations.code_rome = rome.code_rome
