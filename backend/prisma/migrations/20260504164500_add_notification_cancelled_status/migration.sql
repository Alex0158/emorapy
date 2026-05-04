-- Add a first-class cancelled notification state for Admin recall/cancel actions.
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'cancelled';
