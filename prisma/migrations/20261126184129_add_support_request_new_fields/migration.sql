-- CreateEnum
CREATE TYPE "SupportReplyStatus" AS ENUM ('DRAFTED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "reply" TEXT,
ADD COLUMN     "replyStatus" "SupportReplyStatus",
ADD COLUMN     "reviewReason" TEXT;
