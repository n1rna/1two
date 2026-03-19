package billing

// PlanLimits defines the resource limits for each subscription tier.
type PlanLimits struct {
	PastesPerMonth      int64
	OgViewsPerMonth     int64
	AiTokensPerMonth    int64
	OgCollections       int   // -1 = unlimited
	DatabasesMax        int   // max Postgres databases
	SqliteDbsMax        int   // max hosted SQLite databases
	SqliteMaxSizeMB     int64 // max upload size per SQLite file in MB
	RedisMax            int   // max Upstash Redis databases
	StorageBucketsMax   int   // max logical storage buckets per user
	StorageMaxGB        int64 // max total storage across all buckets in GB
	StorageMaxFileSizeMB int64 // max single file upload size in MB
	OverageEnabled      bool
}

// Plans maps plan tier names to their limits.
var Plans = map[string]PlanLimits{
	"free": {PastesPerMonth: 5, OgViewsPerMonth: 1000, AiTokensPerMonth: 0, OgCollections: 1, DatabasesMax: 0, SqliteDbsMax: 0, SqliteMaxSizeMB: 0, RedisMax: 0, StorageBucketsMax: 0, StorageMaxGB: 0, StorageMaxFileSizeMB: 0, OverageEnabled: false},
	"pro":  {PastesPerMonth: 100, OgViewsPerMonth: 10000, AiTokensPerMonth: 100000, OgCollections: 10, DatabasesMax: 1, SqliteDbsMax: 3, SqliteMaxSizeMB: 10, RedisMax: 1, StorageBucketsMax: 2, StorageMaxGB: 1, StorageMaxFileSizeMB: 50, OverageEnabled: true},
	"max":  {PastesPerMonth: 500, OgViewsPerMonth: 50000, AiTokensPerMonth: 500000, OgCollections: -1, DatabasesMax: 3, SqliteDbsMax: 10, SqliteMaxSizeMB: 50, RedisMax: 3, StorageBucketsMax: 5, StorageMaxGB: 5, StorageMaxFileSizeMB: 100, OverageEnabled: true},
}

// MeterLimit returns the monthly limit for a given tier and meter slug.
func MeterLimit(tier, meterSlug string) int64 {
	limits, ok := Plans[tier]
	if !ok {
		limits = Plans["free"]
	}
	switch meterSlug {
	case "paste-created":
		return limits.PastesPerMonth
	case "og-image-view":
		return limits.OgViewsPerMonth
	case "ai-token-used":
		return limits.AiTokensPerMonth
	default:
		return 0
	}
}
