package executor

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"
)

// RedisExecutor wraps a go-redis client and executes Redis commands against it.
type RedisExecutor struct {
	client *redis.Client
}

// NewRedis creates and validates a new RedisExecutor by parsing the URL and pinging.
func NewRedis(connStr string) (*RedisExecutor, error) {
	opts, err := redis.ParseURL(connStr)
	if err != nil {
		return nil, fmt.Errorf("invalid redis connection string: %w", err)
	}

	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("could not reach redis: %w", err)
	}

	return &RedisExecutor{client: client}, nil
}

// Execute runs a Redis command described by args (e.g. ["GET", "mykey"]).
// It uses the low-level Do() so any valid Redis command is supported.
func (e *RedisExecutor) Execute(ctx context.Context, args []string) (any, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("no command provided")
	}

	ifaces := make([]any, len(args))
	for i, a := range args {
		ifaces[i] = a
	}

	result, err := e.client.Do(ctx, ifaces...).Result()
	if err != nil && err != redis.Nil {
		return nil, err
	}
	// go-redis returns map[interface{}]interface{} for hash commands (HGETALL etc.)
	// and []interface{} for lists. json.Marshal can't handle map[interface{}]interface{}.
	//
	// The Upstash REST API and the hosted Redis proxy return HGETALL results as
	// flat arrays ["field1","value1","field2","value2",...] (standard RESP format).
	// The frontend expects this format. So we flatten maps to alternating arrays
	// and recursively convert all values to JSON-safe types.
	return flattenResult(result), nil
}

// flattenResult recursively converts go-redis result types to JSON-serializable
// forms that match the Upstash REST API / standard RESP output format.
// Maps (from HGETALL etc.) are flattened to alternating ["field","value",...] arrays.
func flattenResult(v any) any {
	switch val := v.(type) {
	case map[any]any:
		// Flatten to alternating array: ["k1","v1","k2","v2",...]
		flat := make([]any, 0, len(val)*2)
		for k, v2 := range val {
			flat = append(flat, fmt.Sprintf("%v", k), flattenResult(v2))
		}
		return flat
	case map[string]any:
		flat := make([]any, 0, len(val)*2)
		for k, v2 := range val {
			flat = append(flat, k, flattenResult(v2))
		}
		return flat
	case []any:
		out := make([]any, len(val))
		for i, v2 := range val {
			out[i] = flattenResult(v2)
		}
		return out
	default:
		return v
	}
}

// GetVersion returns the redis_version from INFO server.
func (e *RedisExecutor) GetVersion(ctx context.Context) (string, error) {
	info, err := e.client.Info(ctx, "server").Result()
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(info, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "redis_version:") {
			return strings.TrimPrefix(line, "redis_version:"), nil
		}
	}
	return "unknown", nil
}

// GetSchema samples the keyspace using DBSIZE and SCAN to build a synthetic
// schema representation grouped by key-name prefixes.
func (e *RedisExecutor) GetSchema(ctx context.Context) ([]SchemaTable, error) {
	dbSize, err := e.client.DBSize(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("DBSIZE failed: %w", err)
	}

	// Scan up to 500 keys to detect prefixes / key types.
	var cursor uint64
	const scanCount = 500
	keyTypeMap := make(map[string]string) // key -> type

	for {
		keys, next, err := e.client.Scan(ctx, cursor, "*", scanCount).Result()
		if err != nil {
			break
		}
		for _, k := range keys {
			t, err := e.client.Type(ctx, k).Result()
			if err != nil {
				t = "unknown"
			}
			keyTypeMap[k] = t
		}
		cursor = next
		if cursor == 0 || len(keyTypeMap) >= scanCount {
			break
		}
	}

	// Group keys by their first ":" prefix segment (or "default" if no prefix).
	prefixMap := make(map[string]map[string]struct{}) // prefix -> set of types
	for k, t := range keyTypeMap {
		prefix := "default"
		if idx := strings.Index(k, ":"); idx != -1 {
			prefix = k[:idx]
		}
		if prefixMap[prefix] == nil {
			prefixMap[prefix] = make(map[string]struct{})
		}
		prefixMap[prefix][t] = struct{}{}
	}

	tables := make([]SchemaTable, 0, len(prefixMap))
	for prefix, types := range prefixMap {
		typeList := make([]string, 0, len(types))
		for t := range types {
			typeList = append(typeList, t)
		}
		tables = append(tables, SchemaTable{
			Name: prefix,
			Columns: []SchemaColumn{
				{Name: "key_types", DataType: strings.Join(typeList, ", "), IsNullable: false},
			},
		})
	}

	// Append a synthetic summary table.
	tables = append(tables, SchemaTable{
		Name: "_keyspace_summary",
		Columns: []SchemaColumn{
			{Name: "total_keys", DataType: "integer", IsNullable: false, Default: strconv.FormatInt(dbSize, 10)},
		},
	})

	return tables, nil
}

// Close shuts down the Redis client.
func (e *RedisExecutor) Close() {
	_ = e.client.Close()
}
