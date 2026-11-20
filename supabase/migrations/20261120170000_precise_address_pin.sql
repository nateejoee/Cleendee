alter table public.customer_addresses
  add column gps_accuracy_m double precision,
  add constraint customer_addresses_precise_pin
    check (gps_accuracy_m is not null and gps_accuracy_m > 0 and gps_accuracy_m <= 10
      and lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180) not valid;
