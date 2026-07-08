-- Age is now collected only for the children's brackets; make it optional.
ALTER TABLE "Registrant" ALTER COLUMN "age" DROP NOT NULL;
