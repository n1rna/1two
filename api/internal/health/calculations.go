package health

import "math"

func CalculateBMI(weightKg, heightCm float64) float64 {
	if heightCm <= 0 {
		return 0
	}
	heightM := heightCm / 100
	return math.Round(weightKg/(heightM*heightM)*10) / 10
}

func BMICategory(bmi float64) string {
	switch {
	case bmi < 18.5:
		return "Underweight"
	case bmi < 25:
		return "Normal weight"
	case bmi < 30:
		return "Overweight"
	default:
		return "Obese"
	}
}

func CalculateBMR(weightKg, heightCm float64, age int, gender string) float64 {
	if weightKg <= 0 || heightCm <= 0 || age <= 0 {
		return 0
	}
	base := 10*weightKg + 6.25*heightCm - 5*float64(age)
	if gender == "female" {
		base -= 161
	} else {
		base += 5
	}
	return math.Round(base*10) / 10
}

func ActivityMultiplier(level string) float64 {
	switch level {
	case "sedentary":
		return 1.2
	case "light":
		return 1.375
	case "moderate":
		return 1.55
	case "active":
		return 1.725
	case "very_active":
		return 1.9
	default:
		return 1.55
	}
}

func CalculateTDEE(bmr float64, activityLevel string) float64 {
	return math.Round(bmr * ActivityMultiplier(activityLevel))
}

func CalculateTargetCalories(tdee float64, goal string) int {
	switch goal {
	case "lose":
		return int(math.Round(tdee * 0.80))
	case "gain":
		return int(math.Round(tdee * 1.15))
	default:
		return int(math.Round(tdee))
	}
}

type Macros struct {
	ProteinG int `json:"proteinG"`
	CarbsG   int `json:"carbsG"`
	FatG     int `json:"fatG"`
}

type macroRatio struct {
	ProteinPct, CarbsPct, FatPct float64
}

var dietMacroRatios = map[string]macroRatio{
	"balanced":      {0.30, 0.40, 0.30},
	"keto":          {0.20, 0.05, 0.75},
	"low_carb":      {0.30, 0.20, 0.50},
	"high_protein":  {0.40, 0.30, 0.30},
	"mediterranean": {0.25, 0.45, 0.30},
	"paleo":         {0.30, 0.25, 0.45},
	"vegan":         {0.25, 0.50, 0.25},
}

func CalculateMacros(calories int, dietType string) Macros {
	ratio, ok := dietMacroRatios[dietType]
	if !ok {
		ratio = dietMacroRatios["balanced"]
	}
	cals := float64(calories)
	return Macros{
		ProteinG: int(math.Round(cals * ratio.ProteinPct / 4)),
		CarbsG:   int(math.Round(cals * ratio.CarbsPct / 4)),
		FatG:     int(math.Round(cals * ratio.FatPct / 9)),
	}
}

func DietTypeLabel(dietType string) string {
	labels := map[string]string{
		"balanced": "Balanced", "keto": "Keto", "low_carb": "Low Carb",
		"high_protein": "High Protein", "mediterranean": "Mediterranean",
		"paleo": "Paleo", "vegan": "Vegan",
	}
	if l, ok := labels[dietType]; ok {
		return l
	}
	return dietType
}

func FitnessGoalLabel(goal string) string {
	labels := map[string]string{
		"strength": "Strength", "hypertrophy": "Hypertrophy",
		"endurance": "Endurance", "weight_loss": "Weight Loss",
		"general_fitness": "General Fitness",
	}
	if l, ok := labels[goal]; ok {
		return l
	}
	return goal
}

func RecalculateProfile(weightKg, heightCm float64, age int, gender, activityLevel, dietType, dietGoal string) map[string]any {
	bmi := CalculateBMI(weightKg, heightCm)
	bmr := CalculateBMR(weightKg, heightCm, age, gender)
	tdee := CalculateTDEE(bmr, activityLevel)
	targetCals := CalculateTargetCalories(tdee, dietGoal)
	macros := CalculateMacros(targetCals, dietType)
	return map[string]any{
		"bmi": bmi, "bmr": bmr, "tdee": tdee, "target_calories": targetCals,
		"protein_g": macros.ProteinG, "carbs_g": macros.CarbsG, "fat_g": macros.FatG,
	}
}

func StringSliceToPgArray(s []string) string {
	if len(s) == 0 {
		return "{}"
	}
	quoted := make([]string, len(s))
	for i, v := range s {
		quoted[i] = `"` + v + `"`
	}
	return "{" + join(quoted, ",") + "}"
}

func join(s []string, sep string) string {
	if len(s) == 0 {
		return ""
	}
	r := s[0]
	for _, v := range s[1:] {
		r += sep + v
	}
	return r
}
