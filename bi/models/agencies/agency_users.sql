{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON {{ this }} (agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_agency_users_user_id ON {{ this }} (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_agency_users_agency_admin_true ON {{ this }} (agency_id, user_id) WHERE agency_admin = true"
    ]
  )
}}

select
    au.agency_id,
    au.user_id,
    u.email as user_email,
    u.first_name as user_first_name,
    u.last_name as user_last_name,
    concat(u.first_name, ' ', u.last_name) as user_full_name,
    coalesce(au.roles ? 'agency-admin', false) as agency_admin,
    coalesce(au.roles ? 'validator', false) as validator,
    coalesce(au.roles ? 'counsellor', false) as counsellor,
    coalesce(au.roles ? 'agency-viewer', false) as agency_viewer,
    coalesce(au.roles ? 'to-review', false) as to_review,
    ua.user_id is not null as is_ambassador,
    au.is_notified_by_email,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    u.pro_connect_sub,
    u.last_login_at
from {{ source('immersion', 'users__agencies') }} as au
inner join {{ source('immersion', 'users') }} as u
    on u.id = au.user_id
left join {{ source('immersion', 'users_ambassadors') }} as ua
    on ua.user_id = au.user_id
