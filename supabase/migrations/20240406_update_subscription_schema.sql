-- Add new fields to the subscription_status validation
create or replace function private.update_subscription_status(
  user_id uuid,
  new_status jsonb
)
returns void
language plpgsql
security definer
set search_path = private
as $$
begin
  -- Validate the new_status JSON structure
  if not (
    new_status ? 'plan' AND 
    new_status ? 'active' AND 
    new_status ? 'trial_used'
  ) then
    raise exception 'Invalid subscription status structure';
  end if;

  -- Ensure all fields are of correct type
  if not (
    (new_status->>'plan' is null or jsonb_typeof(new_status->'plan') = 'string') AND
    (new_status->>'active' is null or jsonb_typeof(new_status->'active') = 'boolean') AND
    (new_status->>'trial_used' is null or jsonb_typeof(new_status->'trial_used') = 'boolean') AND
    (new_status->>'cancelled' is null or jsonb_typeof(new_status->'cancelled') = 'boolean') AND
    (new_status->>'expires_at' is null or (
      jsonb_typeof(new_status->'expires_at') = 'string' AND
      (new_status->>'expires_at')::timestamp is not null
    ))
  ) then
    raise exception 'Invalid field types in subscription status';
  end if;

  -- Set default values for optional fields if not provided
  new_status = jsonb_build_object(
    'plan', coalesce(new_status->>'plan', 'free'),
    'active', coalesce((new_status->>'active')::boolean, false),
    'trial_used', coalesce((new_status->>'trial_used')::boolean, false),
    'cancelled', coalesce((new_status->>'cancelled')::boolean, false),
    'expires_at', coalesce(new_status->>'expires_at', null),
    'updated_at', new_status->>'updated_at'
  );

  update private.user_subscriptions
  set 
    subscription_status = new_status,
    updated_at = now()
  where id = user_id;

  -- Log the subscription update
  raise notice 'Subscription updated for user %: %', user_id, new_status;
end;
$$;

-- Update the default subscription status to include new fields
alter table private.user_subscriptions 
alter column subscription_status 
set default '{"plan": "free", "active": true, "trial_used": false, "cancelled": false}'::jsonb;

-- Add a function to get detailed subscription info
create or replace function public.get_detailed_subscription_info(user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_info jsonb;
begin
  select subscription_status into sub_info
  from private.user_subscriptions
  where id = user_id;

  return jsonb_build_object(
    'plan', sub_info->>'plan',
    'active', (sub_info->>'active')::boolean,
    'trial_used', (sub_info->>'trial_used')::boolean,
    'cancelled', coalesce((sub_info->>'cancelled')::boolean, false),
    'expires_at', sub_info->>'expires_at',
    'is_grace_period', 
      case 
        when (sub_info->>'cancelled')::boolean 
          and (sub_info->>'active')::boolean 
          and (sub_info->>'expires_at')::timestamp > now() 
        then true 
        else false 
      end
  );
end;
$$;

-- Grant access to the new function for authenticated users
grant execute on function public.get_detailed_subscription_info(uuid) to authenticated; 