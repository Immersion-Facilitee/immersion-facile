{{
  config(
    materialized='table',
    schema='analytics'
  )
}}

select
    slug,
    created_at,
    updated_at,
    name,
    hero_header_title,
    hero_header_description,
    hero_header_logo_url,
    hero_header_background_color
from {{ source('immersion', 'groups') }}
