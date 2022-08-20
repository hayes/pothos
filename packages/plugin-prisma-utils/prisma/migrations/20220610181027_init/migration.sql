-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "uploadedById" INTEGER,
    CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bio" TEXT,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT
);

-- CreateTable
CREATE TABLE "Follow" (
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,

    PRIMARY KEY ("fromId", "toId"),
    CONSTRAINT "Follow_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Follow_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unrelated" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT
);

-- CreateTable
CREATE TABLE "WithID" (
    "id" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "WithUnique" (
    "id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WithCompositeID" (
    "a" TEXT NOT NULL,
    "b" TEXT NOT NULL,

    PRIMARY KEY ("a", "b")
);

-- CreateTable
CREATE TABLE "WithCompositeUnique" (
    "a" TEXT NOT NULL,
    "c" TEXT,
    "b" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FindUniqueRelations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "withID_id" TEXT NOT NULL,
    "withUnique_id" TEXT NOT NULL,
    "withCompositeID_a" TEXT NOT NULL,
    "withCompositeID_b" TEXT NOT NULL,
    "withCompositeUnique_a" TEXT NOT NULL,
    "withCompositeUnique_b" TEXT NOT NULL,
    CONSTRAINT "FindUniqueRelations_withID_id_fkey" FOREIGN KEY ("withID_id") REFERENCES "WithID" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindUniqueRelations_withUnique_id_fkey" FOREIGN KEY ("withUnique_id") REFERENCES "WithUnique" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindUniqueRelations_withCompositeID_a_withCompositeID_b_fkey" FOREIGN KEY ("withCompositeID_a", "withCompositeID_b") REFERENCES "WithCompositeID" ("a", "b") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FindUniqueRelations_withCompositeUnique_a_withCompositeUnique_b_fkey" FOREIGN KEY ("withCompositeUnique_a", "withCompositeUnique_b") REFERENCES "WithCompositeUnique" ("a", "b") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_createdAt_key" ON "Post"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_createdAt_key" ON "Comment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WithUnique_id_key" ON "WithUnique"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WithCompositeUnique_c_key" ON "WithCompositeUnique"("c");

-- CreateIndex
CREATE UNIQUE INDEX "WithCompositeUnique_a_c_key" ON "WithCompositeUnique"("a", "c");

-- CreateIndex
CREATE UNIQUE INDEX "WithCompositeUnique_a_b_key" ON "WithCompositeUnique"("a", "b");
