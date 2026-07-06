-- Open relay-group legs: a group may be registered with some roles left unfilled
-- ("will be added later"), to be completed when teammates join the group.
ALTER TABLE "Group" ALTER COLUMN "swimRegistrantId" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "bikeRegistrantId" DROP NOT NULL;
ALTER TABLE "Group" ALTER COLUMN "runRegistrantId" DROP NOT NULL;
