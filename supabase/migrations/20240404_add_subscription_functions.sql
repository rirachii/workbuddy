-- Function to get user subscription status
create or replace function public.get_user_subscription_status(user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select subscription_status
    from private.user_subscriptions
    where id = user_id
  );
end;
$$;

-- Grant access to the function for authenticated users
grant execute on function public.get_user_subscription_status(uuid) to authenticated;

-- Function to get subscription management URL
create or replace function public.get_subscription_management_url(user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  management_url text;
begin
  select subscription_status->>'managementUrl'
  into management_url
  from private.user_subscriptions
  where id = user_id;

  return jsonb_build_object('management_url', management_url);
end;
$$;

-- Grant access to the function for authenticated users
grant execute on function public.get_subscription_management_url(uuid) to authenticated; 