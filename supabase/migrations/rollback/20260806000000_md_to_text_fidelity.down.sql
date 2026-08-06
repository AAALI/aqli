-- Restore the blunt emphasis rule and the table-unaware behaviour.
--
-- `body_text` is re-derived so the column matches whichever version of the
-- function is installed; the trigger is held off for the same reason as in the
-- forward migration.

create or replace function app.md_to_text(md text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  t text := coalesce(md, '');
begin
  t := regexp_replace(t, '```.*?```', ' ', 'g');
  t := regexp_replace(t, '~~~.*?~~~', ' ', 'g');
  t := regexp_replace(t, '`([^`]*)`', '\1', 'g');
  t := regexp_replace(t, '!\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  t := regexp_replace(t, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  t := regexp_replace(t, '^[ \t]*#{1,6}[ \t]+', '', 'gn');
  t := regexp_replace(t, '^[ \t]*>[ \t]?', '', 'gn');
  t := regexp_replace(t, '^[ \t]*([-*+]|[0-9]+\.)[ \t]+', '', 'gn');
  t := regexp_replace(t, '^[ \t]*(-[ \t]*){3,}$', ' ', 'gn');
  t := regexp_replace(t, '[*_~]{1,3}', '', 'g');
  t := regexp_replace(t, '<[^>]*>', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  return btrim(t);
end;
$function$;

alter table docs disable trigger docs_maintain_derived;

update docs
   set body_text = app.md_to_text(body_md),
       headings  = app.md_headings(body_md)
 where body_md is not null;

alter table docs enable trigger docs_maintain_derived;
