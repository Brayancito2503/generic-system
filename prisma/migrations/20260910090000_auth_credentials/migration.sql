-- Auth: session credentials for users
ALTER TABLE "User" RENAME COLUMN "password" TO "passwordHash";
ALTER TABLE "User" ADD COLUMN "posPinHash" TEXT;