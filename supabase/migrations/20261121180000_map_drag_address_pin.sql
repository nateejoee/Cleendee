-- Address pins are now placed by moving the map (bTaskee style), so a GPS accuracy reading is optional.
alter table public.customer_addresses drop constraint customer_addresses_precise_pin;
alter table public.customer_addresses
  add constraint customer_addresses_pin
    check (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180
      and (gps_accuracy_m is null or gps_accuracy_m > 0)) not valid;
