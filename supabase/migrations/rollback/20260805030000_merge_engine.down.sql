-- Rollback for the step-4 merge engine.
--
-- Safe to run while proposals exist: this drops the functions that write them,
-- not the rows. `proposals.body_json` is dropped because nothing outside the
-- merge engine reads it.

begin;

drop function if exists public.submit_proposal(uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid, text[], uuid, text, boolean, boolean);
drop function if exists public.merge_proposal(uuid, uuid, boolean);
drop function if exists public.reject_proposal(uuid, uuid, text);

drop function if exists app.submit_proposal(uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid, text[], uuid, text, boolean, boolean);
drop function if exists app.merge_proposal(uuid, uuid, boolean);
drop function if exists app.reject_proposal(uuid, uuid, text);
drop function if exists app.decide_disposition(review_policy, doc_origin, agent_scope[], doc_class);

alter table proposals drop column if exists body_json;

-- Restoring NOT NULL is only possible if nothing landed with a null space.
do $$
begin
  if not exists (select 1 from proposals where space_id is null) then
    alter table proposals alter column space_id set not null;
  else
    raise warning 'proposals.space_id left nullable: % rows have no space',
      (select count(*) from proposals where space_id is null);
  end if;
end $$;

commit;
