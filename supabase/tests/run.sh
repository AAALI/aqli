#!/usr/bin/env bash
# Run the SQL tests against a scratch Postgres.
#
#   ./supabase/tests/run.sh                  # boot a throwaway cluster
#   DATABASE_URL=postgres://... ./run.sh     # or point at one you already have
#
# With no DATABASE_URL this initdbs a cluster under $TMPDIR, replays
# `tests/base.sql` (the schema as it stood before the markdown-canonical
# migration) followed by every file in `supabase/migrations/`, then runs each
# `*.sql` test. Every test file rolls back, so an existing database is left as
# it was found.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
tmp="${TMPDIR:-/tmp}/aqli-pgtest"

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql_base=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
else
  pgbin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)"
  [[ -n "$pgbin" ]] || { echo "no local postgres found; set DATABASE_URL" >&2; exit 1; }
  export PATH="$pgbin:$PATH"

  port="${PGTEST_PORT:-55432}"
  data="$tmp/data"
  sock="$tmp/sock"

  trap 'pg_ctl -D "$data" stop -m immediate >/dev/null 2>&1 || true' EXIT

  rm -rf "$tmp"; mkdir -p "$data" "$sock"
  # initdb refuses to run as root, so drop to an unprivileged user when needed.
  if [[ "$(id -u)" == "0" ]]; then
    runas=(su nobody -s /bin/bash -c)
    chown nobody "$tmp" "$data" "$sock"
  else
    runas=(bash -c)
  fi
  "${runas[@]}" "PATH=$pgbin:\$PATH initdb -D $data -U postgres --auth=trust" >/dev/null
  # Unix socket only — a TCP listener would collide with anything already on
  # the port and this cluster is never reached from outside the script.
  "${runas[@]}" "PATH=$pgbin:\$PATH pg_ctl -D $data -o \"-p $port -k $sock -h ''\" -l $tmp/pg.log start" >/dev/null

  psql_base=(psql -h "$sock" -p "$port" -U postgres -v ON_ERROR_STOP=1 -q)
  "${psql_base[@]}" -c "create database aqli_test;" >/dev/null
  psql_base+=(-d aqli_test)

  "${psql_base[@]}" -f "$here/base.sql" >/dev/null
  # No fixture, no injected rows: this replays exactly what `supabase db push`
  # does against an empty project. Step 6 used to need its backfill gate handed
  # to it here, which meant the runner was working around a failure every new
  # install would hit; it now records the gate itself when there is nothing to
  # back-fill, and `canonical_flip.sql` asserts the guard still refuses when
  # there is.
  for m in "$repo"/supabase/migrations/*.sql; do
    if ! out="$("${psql_base[@]}" -f "$m" 2>&1)"; then
      echo "migration failed: $(basename "$m")" >&2
      echo "$out" | sed 's/^/    /' >&2
      exit 1
    fi
  done
fi

status=0
for f in "$here"/*.sql; do
  name="$(basename "$f")"
  [[ "$name" == "base.sql" ]] && continue
  printf '%-28s ' "$name"
  if out="$("${psql_base[@]}" -f "$f" 2>&1)"; then
    echo "ok"
  else
    echo "FAILED"
    echo "$out" | sed 's/^/    /'
    status=1
  fi
done

exit $status
