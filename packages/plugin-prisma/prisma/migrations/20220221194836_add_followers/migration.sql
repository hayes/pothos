-- CreateTable
CREATE TABLE "Follow" (
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,

    PRIMARY KEY ("fromId", "toId"),
    CONSTRAINT "Follow_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Follow_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
