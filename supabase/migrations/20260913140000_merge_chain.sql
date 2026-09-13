-- StallOrigins — 09: merge `chain_small` into `chain` (SPEC §3).
-- The independence axis no longer distinguishes small vs large chains — both are
-- just `chain`. Fold any existing rows over. The `chain_small` enum value is
-- left in place (unused) since Postgres cannot drop an enum value in place;
-- nothing writes it any more.
update public.brands set independence = 'chain' where independence = 'chain_small';
