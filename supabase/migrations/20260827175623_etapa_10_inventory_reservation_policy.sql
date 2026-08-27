-- Explicitly document the only role allowed to read/write inventory
-- reservations. RLS remains deny-by-default for anonymous and authenticated
-- clients; checkout reaches it only through SECURITY DEFINER functions.
drop policy if exists product_inventory_reservations_service_role on public.product_inventory_reservations;
create policy product_inventory_reservations_service_role
  on public.product_inventory_reservations
  for all
  to service_role
  using (true)
  with check (true);
