-- Recover legacy team registrants: rows created before groupPref existed have a
-- NULL groupPref, which hid them from the competitors list, the lottery pool and
-- the admin "unassigned" panel. They were always meant to be in the available
-- pool, so mark them AVAILABLE.
UPDATE "Registrant" SET "groupPref" = 'AVAILABLE' WHERE "mode" = 'TEAM' AND "groupPref" IS NULL;
