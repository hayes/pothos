-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Metric" (
    "propertyId" TEXT NOT NULL,
    "endDate" DATETIME NOT NULL,
    "month" INTEGER NOT NULL,
    "fieldA" INTEGER NOT NULL,
    "fieldB" INTEGER NOT NULL,
    "fieldC" INTEGER NOT NULL,
    CONSTRAINT "Metric_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Metric_propertyId_endDate_key" ON "Metric"("propertyId", "endDate");
