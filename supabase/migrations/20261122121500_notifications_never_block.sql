-- A notification must never stop the real change (booking, payment, refund...).
-- Each notification trigger now catches its own errors, logs a warning and lets the change through.
do $$
declare f text; def text;
begin
  foreach f in array array['_ntf_bookings','_ntf_payments','_ntf_refunds','_ntf_payouts','_ntf_claims','_ntf_maids',
    '_ntf_support_threads','_ntf_support_messages','_ntf_low_rating'] loop
    def := pg_get_functiondef(('public.' || f || '()')::regprocedure);
    if def like '%notify_failed%' then continue; end if;
    def := regexp_replace(def, 'return null;\s*end\s*\$function\$\s*$',
      E'return null;\nexception when others then\n  raise warning ''notify_failed %: %'', tg_table_name, sqlerrm;\n  return null;\nend\n$function$\n');
    if def not like '%notify_failed%' then raise exception 'could not patch %', f; end if;
    execute def;
  end loop;
end $$;
