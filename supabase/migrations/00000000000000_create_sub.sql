-- Create a secure schema for our application
create schema if not exists private;

-- Create user subscriptions table if it doesn't exist
create table if not exists private.user_subscriptions (
  id uuid references auth.users on delete cascade primary key,
  email text,
  subscription_status jsonb default '{"plan": "free", "active": true, "trial_used": false}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create function to handle new user subscriptions
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = private
as $$
begin
  insert into private.user_subscriptions (id, email, subscription_status)
  values (
    new.id,
    new.email,
    json_build_object(
      'plan', 'free',
      'active', true,
      'trial_used', false,
      'created_at', now(),
      'updated_at', now()
    )::jsonb
  );
  return new;
end;
$$;

-- Create trigger for new user subscriptions
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Enable RLS
alter table private.user_subscriptions enable row level security;

-- Revoke all access to the user_subscriptions table by default
revoke all on private.user_subscriptions from public, anon, authenticated;

-- Grant specific access to authenticated users
grant usage on schema private to authenticated;
grant select on private.user_subscriptions to authenticated;

-- Create policy to allow users to read only their own subscription
create policy "Users can read own subscription only"
  on private.user_subscriptions for select
  using (auth.uid() = id);

-- Create policy to allow users to update only their own email
create policy "Users can update own email only"
  on private.user_subscriptions for update
  using (auth.uid() = id AND 
        (select true 
         from private.user_subscriptions 
         where id = auth.uid() 
         and subscription_status = (select subscription_status 
                                  from private.user_subscriptions 
                                  where id = auth.uid())));

-- Create policy to prevent any deletion
create policy "No manual deletion allowed"
  on private.user_subscriptions for delete
  using (false);

-- Create policy to prevent manual insertion except by trigger
create policy "Only trigger can insert"
  on private.user_subscriptions for insert
  with check (false);

-- Create function to update subscription status (to be used by webhooks/service role only)
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

  update private.user_subscriptions
  set 
    subscription_status = new_status,
    updated_at = now()
  where id = user_id;
end;
$$;

-- Grant execute permission on the update function to service role only
revoke all on function private.update_subscription_status from public, anon, authenticated;
grant execute on function private.update_subscription_status to service_role; 