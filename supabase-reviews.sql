create table if not exists public.reviews (
    id bigint generated always as identity primary key,
    product_id text not null,
    reviewer_name text not null check (char_length(btrim(reviewer_name)) between 2 and 60),
    reviewer_phone text not null check (btrim(reviewer_phone) ~ '^[+]?[0-9]{6,19}$'),
    rating smallint not null check (rating between 1 and 5),
    comment text check (comment is null or char_length(btrim(comment)) between 1 and 800),
    status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
    created_at timestamptz not null default now()
);

alter table public.reviews
add column if not exists reviewer_phone text;

alter table public.reviews
drop constraint if exists reviews_reviewer_phone_check;

alter table public.reviews
add constraint reviews_reviewer_phone_check
check (btrim(reviewer_phone) ~ '^[+]?[0-9]{6,19}$');

alter table public.reviews
alter column comment drop not null;

alter table public.reviews
drop constraint if exists reviews_comment_check;

alter table public.reviews
add constraint reviews_comment_check
check (comment is null or char_length(btrim(comment)) between 1 and 800);

create index if not exists reviews_product_status_created_idx
on public.reviews (product_id, status, created_at desc);

create or replace view public.review_summaries as
select
    product_id,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 1) as average_rating
from public.reviews
where status = 'approved'
group by product_id;

alter table public.reviews enable row level security;

drop policy if exists "Public approved reviews are readable" on public.reviews;
create policy "Public approved reviews are readable"
on public.reviews
for select
using (status = 'approved');

drop policy if exists "Public can add live reviews" on public.reviews;
create policy "Public can add live reviews"
on public.reviews
for insert
with check (
    status = 'approved'
);

grant usage on schema public to anon, authenticated;
grant select, insert on public.reviews to anon, authenticated;
grant select on public.review_summaries to anon, authenticated;