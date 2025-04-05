-- Create a public wrapper for the private update_subscription_status function
create or replace function public.update_subscription_status(
  user_id uuid,
  new_status jsonb
)
returns void
language sql security definer
as $$
  select private.update_subscription_status(user_id, new_status);
$$;

-- Grant execute permission on the public wrapper function to service role only
revoke all on function public.update_subscription_status from public, anon, authenticated;
grant execute on function public.update_subscription_status to service_role;
