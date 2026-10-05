{{
  config(
    materialized='table',
    schema='analytics',
    post_hook=[
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_occurred_at ON {{ this }} (occurred_at)",
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_consumer_name ON {{ this }} (consumer_name)",
      "CREATE INDEX IF NOT EXISTS idx_bf_analytics_convention_id ON {{ this }} (convention_id)",
    ]
  )
}}

select
    bf.id,
    bf.request_params ->> 'callbackUrl' as request_params_callback_url,
    bf.request_params ->> 'conventionId' as request_params_convention_id,
    bf.request_params ->> 'conventionStatus' as request_params_convention_status,
    bf.response ->> 'body' as response_body,
    bf.response -> 'body' ->> 'codeErreur' as response_body_code_erreur,
    (bf.response -> 'body' ->> 'codeHttp')::numeric as response_body_code_http,
    bf.response -> 'body' ->> 'message' as response_body_message,
    (bf.response ->> 'httpStatus')::numeric as response_http_status,
    bf.subscriber_error_feedback ->> 'message' as subscriber_error_feedback_message,
    bf.service_name,
    bf.request_params,
    bf.occurred_at,
    bf.handled_by_agency,
    bf.consumer_id,
    bf.consumer_name,
    bf.subscriber_error_feedback,
    bf.response,
    bf.convention_id,
    bf.agency_id
from {{ source('immersion', 'broadcast_feedbacks') }} as bf
