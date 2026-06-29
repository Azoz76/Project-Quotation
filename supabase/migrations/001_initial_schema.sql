-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  full_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  status text not null default 'draft' check (status in ('draft', 'quoted', 'accepted', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uploads
create table public.uploads (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  public_url text not null,
  category text not null default 'document' check (category in ('image', 'document', 'drawing')),
  created_at timestamptz not null default now()
);

-- Quotations
create table public.quotations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  materials jsonb not null default '[]'::jsonb,
  total_cost numeric not null default 0,
  ai_analysis text,
  status text not null default 'pending' check (status in ('pending', 'generated', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notifications
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  message text not null,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

-- Chat messages
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Time slots
create table public.time_slots (
  id uuid default gen_random_uuid() primary key,
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer not null default 1,
  booked_count integer not null default 0,
  description text,
  created_at timestamptz not null default now()
);

-- Bookings
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  time_slot_id uuid references public.time_slots(id) on delete cascade not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit log
create table public.audit_log (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references public.users(id) on delete set null not null,
  action text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS Policies
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.uploads enable row level security;
alter table public.quotations enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;
alter table public.time_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_log enable row level security;

-- Users: users can read own profile, admins can read all
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Admins can view all users" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Admins can update any user" on public.users for update using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Projects: users see own, admins see all
create policy "Users can view own projects" on public.projects for select using (auth.uid() = user_id);
create policy "Admins can view all projects" on public.projects for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
create policy "Users can create own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects for update using (auth.uid() = user_id);

-- Uploads
create policy "Users can view own uploads" on public.uploads for select using (auth.uid() = user_id);
create policy "Users can create uploads" on public.uploads for insert with check (auth.uid() = user_id);
create policy "Admins can view all uploads" on public.uploads for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Quotations
create policy "Users can view own quotations" on public.quotations for select using (auth.uid() = user_id);
create policy "Admins can view all quotations" on public.quotations for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Notifications
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- Chat messages
create policy "Users can view own messages" on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can create messages" on public.chat_messages for insert with check (auth.uid() = user_id);

-- Time slots: anyone authenticated can view
create policy "Authenticated users can view time slots" on public.time_slots for select using (auth.uid() is not null);
create policy "Admins can manage time slots" on public.time_slots for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Bookings
create policy "Users can view own bookings" on public.bookings for select using (auth.uid() = user_id);
create policy "Users can create bookings" on public.bookings for insert with check (auth.uid() = user_id);
create policy "Users can update own bookings" on public.bookings for update using (auth.uid() = user_id);

-- Audit log: admins only
create policy "Admins can view audit log" on public.audit_log for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Enable realtime
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.quotations;

-- Indexes
create index idx_projects_user_id on public.projects(user_id);
create index idx_uploads_project_id on public.uploads(project_id);
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_chat_messages_session on public.chat_messages(session_id);
create index idx_bookings_user_id on public.bookings(user_id);
create index idx_bookings_time_slot on public.bookings(time_slot_id);
