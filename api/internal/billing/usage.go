package billing

import (
	"context"
	"database/sql"
	"time"
)

// currentPeriodStart returns the first of the current month in UTC.
func currentPeriodStart() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// GetUserPlanTier returns the active plan tier for a user, defaulting to "free".
func GetUserPlanTier(ctx context.Context, db *sql.DB, userID string) string {
	var tier string
	err := db.QueryRowContext(ctx,
		`SELECT plan_tier FROM billing_subscriptions
		 WHERE user_id = $1 AND status IN ('active', 'trialing')
		 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&tier)
	if err != nil || tier == "" {
		return "free"
	}
	return tier
}

// GetCurrentUsage returns the usage count for the current billing period.
func GetCurrentUsage(ctx context.Context, db *sql.DB, userID, meterSlug string) (int64, error) {
	var count int64
	err := db.QueryRowContext(ctx,
		`SELECT count FROM billing_usage
		 WHERE user_id = $1 AND meter_slug = $2 AND period_start = $3`,
		userID, meterSlug, currentPeriodStart()).Scan(&count)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

// IncrementUsage atomically increments the usage counter and returns the new count.
func IncrementUsage(ctx context.Context, db *sql.DB, userID, meterSlug string) (int64, error) {
	var count int64
	err := db.QueryRowContext(ctx,
		`INSERT INTO billing_usage (user_id, meter_slug, period_start, count, updated_at)
		 VALUES ($1, $2, $3, 1, NOW())
		 ON CONFLICT (user_id, meter_slug, period_start)
		 DO UPDATE SET count = billing_usage.count + 1, updated_at = NOW()
		 RETURNING count`,
		userID, meterSlug, currentPeriodStart()).Scan(&count)
	return count, err
}

// CheckLimit checks if a user is allowed to perform an action based on their plan limits.
// Returns: allowed, currentCount, limit.
func CheckLimit(ctx context.Context, db *sql.DB, userID, meterSlug string) (bool, int64, int64, error) {
	tier := GetUserPlanTier(ctx, db, userID)
	limits := Plans[tier]
	limit := MeterLimit(tier, meterSlug)

	current, err := GetCurrentUsage(ctx, db, userID, meterSlug)
	if err != nil {
		return false, 0, limit, err
	}

	// If overage is enabled, always allow (Polar handles billing)
	if limits.OverageEnabled {
		return true, current, limit, nil
	}

	// Hard limit for free tier
	return current < limit, current, limit, nil
}

// GetPolarCustomerID returns the cached Polar customer ID for a user.
func GetPolarCustomerID(ctx context.Context, db *sql.DB, userID string) (string, error) {
	var id string
	err := db.QueryRowContext(ctx,
		`SELECT polar_customer_id FROM billing_customers WHERE user_id = $1`, userID).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return id, err
}
