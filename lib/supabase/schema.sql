-- Create the memos table
create table memos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text,
  audio_url text,
  transcription text,
  summary text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create the todos table
create table todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  memo_id uuid references memos(id),
  title text not null,
  description text,
  is_completed boolean default false,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table memos enable row level security;
alter table todos enable row level security;

-- Create policies for memos
create policy "Users can create their own memos"
  on memos for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own memos"
  on memos for select
  using (auth.uid() = user_id);

create policy "Users can update their own memos"
  on memos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own memos"
  on memos for delete
  using (auth.uid() = user_id);

-- Create policies for todos
create policy "Users can create their own todos"
  on todos for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own todos"
  on todos for select
  using (auth.uid() = user_id);

create policy "Users can update their own todos"
  on todos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own todos"
  on todos for delete
  using (auth.uid() = user_id);

-- Create indexes for better performance
create index memos_user_id_idx on memos(user_id);
create index todos_user_id_idx on todos(user_id);
create index todos_memo_id_idx on todos(memo_id); 