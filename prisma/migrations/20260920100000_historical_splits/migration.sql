-- Leg splits on Hall of Fame results, so a year the app timed itself can show
-- how each competitor's swim, bike and run went and not just their total.
-- Nullable because they are often unknown: the 2018–2023 sheets record finishing
-- times only, and a race can be timed at the finish line alone.
ALTER TABLE "HistoricalResult" ADD COLUMN "swimSeconds" INTEGER;
ALTER TABLE "HistoricalResult" ADD COLUMN "bikeSeconds" INTEGER;
ALTER TABLE "HistoricalResult" ADD COLUMN "runSeconds" INTEGER;
