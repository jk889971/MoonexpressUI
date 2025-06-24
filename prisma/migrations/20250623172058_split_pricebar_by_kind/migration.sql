-- 1) add the new column WITH a DEFAULT so existing rows get a value
ALTER TABLE "PriceBar"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'price';

-- 2) (optional) if you already had rows for market-cap in some other table,
--    you’d insert them here.  Otherwise all existing rows default to 'price'.

-- 3) now that existing rows are backfilled, drop the default
ALTER TABLE "PriceBar"
ALTER COLUMN "kind" DROP DEFAULT;

-- 4) add the composite unique constraint & index on the new triplet
ALTER TABLE "PriceBar"
ADD CONSTRAINT "PriceBar_launchAddress_bucketMs_kind_key"
UNIQUE ("launchAddress", "bucketMs", "kind");

CREATE INDEX "PriceBar_launchAddress_bucketMs_kind_idx"
ON "PriceBar" ("launchAddress", "bucketMs", "kind");