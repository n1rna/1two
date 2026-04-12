-- Sample marketplace data. Safe to re-run (uses fixed mp_seed_* ids with ON CONFLICT).
-- Authors are existing users in the dev database.

BEGIN;

-- ── Routines ──────────────────────────────────────────────────────────────

INSERT INTO life_marketplace_items (id, slug, kind, source_id, author_id, title, description, tags)
VALUES
  ('mp_seed_routine_1', 'morning-power-hour-a1b2c3',
   'routine', 'seed_src_rt1', 'RByR0jgRUPLLXRytaEZsV74VcDO7CS38',
   'Morning Power Hour',
   'A 60-minute morning routine: hydration, mobility, deep work, and a short walk.',
   ARRAY['morning','productivity','habit','focus']),
  ('mp_seed_routine_2', 'weekly-review-ritual-d4e5f6',
   'routine', 'seed_src_rt2', 'rjngkDgMdXFwr56pzsciogwW13HmaFoa',
   'Weekly Review Ritual',
   'Every Sunday: reflect on wins, review goals, plan the week. Based on GTD.',
   ARRAY['planning','gtd','weekly','reflection'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
VALUES
  ('mpv_seed_routine_1_v1', 'mp_seed_routine_1', 1, 'Morning Power Hour',
   'A 60-minute morning routine: hydration, mobility, deep work, and a short walk.',
   '{"name":"Morning Power Hour","type":"morning_routine","description":"A 60-minute morning routine: hydration, mobility, deep work, and a short walk.","schedule":{"frequency":"daily","time":"07:00"},"config":{"blocks":[{"label":"Hydrate + no phone","minutes":5},{"label":"Mobility flow","minutes":10},{"label":"Deep work #1","minutes":40},{"label":"Outdoor walk","minutes":5}],"notes":"No social media until walk is done."},"active":true}'::jsonb,
   'Initial version'),
  ('mpv_seed_routine_2_v1', 'mp_seed_routine_2', 1, 'Weekly Review Ritual',
   'Every Sunday: reflect on wins, review goals, plan the week. Based on GTD.',
   '{"name":"Weekly Review Ritual","type":"weekly_review","description":"Every Sunday: reflect on wins, review goals, plan the week. Based on GTD.","schedule":{"frequency":"weekly","days":[0],"time":"18:00"},"config":{"questions":["What went well?","What would I change?","Top 3 priorities next week?","Any projects stalled?"],"duration_minutes":45},"active":true}'::jsonb,
   'Initial version')
ON CONFLICT (id) DO NOTHING;

-- ── Gym sessions ──────────────────────────────────────────────────────────

INSERT INTO life_marketplace_items (id, slug, kind, source_id, author_id, title, description, tags)
VALUES
  ('mp_seed_gym_1', 'push-day-strength-7h8j9k',
   'gym_session', 'seed_src_gym1', 'BUmhr5pgie0yPBhpqbxKNxoqMZZbqzFR',
   'Push Day — Strength Focus',
   'Chest, shoulders, triceps. Heavy compounds first, then accessories.',
   ARRAY['gym','push','strength','chest','hypertrophy']),
  ('mp_seed_gym_2', 'leg-day-volume-x1y2z3',
   'gym_session', 'seed_src_gym2', 'XALngoXvOtLy1n9imBRXUAR7rxKExyWY',
   'Leg Day — Volume Killer',
   'Quads, hamstrings, glutes. High volume, short rest. Expect soreness.',
   ARRAY['gym','legs','volume','quads','glutes'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
VALUES
  ('mpv_seed_gym_1_v1', 'mp_seed_gym_1', 1, 'Push Day — Strength Focus',
   'Chest, shoulders, triceps. Heavy compounds first, then accessories.',
   '{"title":"Push Day — Strength Focus","description":"Chest, shoulders, triceps.","status":"published","difficulty_level":"intermediate","estimated_duration":70,"target_muscle_groups":["chest","shoulders","triceps"],"exercises":[{"exercise_name":"Barbell Bench Press","sets":5,"reps":"5","weight":"bodyweight+","rest_seconds":180,"sort_order":0,"notes":"Work up to top set","superset_group":null},{"exercise_name":"Overhead Press","sets":4,"reps":"6-8","weight":"","rest_seconds":150,"sort_order":1,"notes":"","superset_group":null},{"exercise_name":"Incline Dumbbell Press","sets":3,"reps":"10","weight":"","rest_seconds":90,"sort_order":2,"notes":"","superset_group":null},{"exercise_name":"Cable Flyes","sets":3,"reps":"12-15","weight":"","rest_seconds":60,"sort_order":3,"notes":"Squeeze at peak","superset_group":null},{"exercise_name":"Tricep Pushdown","sets":3,"reps":"12","weight":"","rest_seconds":60,"sort_order":4,"notes":"","superset_group":null}]}'::jsonb,
   'Initial version'),
  ('mpv_seed_gym_2_v1', 'mp_seed_gym_2', 1, 'Leg Day — Volume Killer',
   'Quads, hamstrings, glutes. High volume, short rest.',
   '{"title":"Leg Day — Volume Killer","description":"Quads, hamstrings, glutes.","status":"published","difficulty_level":"advanced","estimated_duration":75,"target_muscle_groups":["quadriceps","hamstrings","glutes"],"exercises":[{"exercise_name":"Back Squat","sets":4,"reps":"8","weight":"","rest_seconds":180,"sort_order":0,"notes":"","superset_group":null},{"exercise_name":"Romanian Deadlift","sets":4,"reps":"10","weight":"","rest_seconds":120,"sort_order":1,"notes":"","superset_group":null},{"exercise_name":"Walking Lunges","sets":3,"reps":"12 each leg","weight":"","rest_seconds":90,"sort_order":2,"notes":"","superset_group":null},{"exercise_name":"Leg Press","sets":3,"reps":"15","weight":"","rest_seconds":90,"sort_order":3,"notes":"","superset_group":null},{"exercise_name":"Seated Leg Curl","sets":3,"reps":"12","weight":"","rest_seconds":60,"sort_order":4,"notes":"","superset_group":null},{"exercise_name":"Standing Calf Raise","sets":4,"reps":"15","weight":"","rest_seconds":45,"sort_order":5,"notes":"","superset_group":null}]}'::jsonb,
   'Initial version')
ON CONFLICT (id) DO NOTHING;

-- ── Meal plans ────────────────────────────────────────────────────────────

INSERT INTO life_marketplace_items (id, slug, kind, source_id, author_id, title, description, tags)
VALUES
  ('mp_seed_meal_1', 'high-protein-cut-p4q5r6',
   'meal_plan', 'seed_src_meal1', 'rjngkDgMdXFwr56pzsciogwW13HmaFoa',
   'High-Protein Cut (2000 kcal)',
   '5-day meal plan, ~180g protein, minimal prep. Designed for a slow, sustainable cut.',
   ARRAY['meal-plan','cut','high-protein','fitness']),
  ('mp_seed_meal_2', 'mediterranean-balanced-m7n8o9',
   'meal_plan', 'seed_src_meal2', 'RByR0jgRUPLLXRytaEZsV74VcDO7CS38',
   'Mediterranean Balanced Week',
   '7-day Mediterranean-style plan. Olive oil, fish, whole grains. ~2200 kcal.',
   ARRAY['meal-plan','mediterranean','balanced','heart-healthy'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO life_marketplace_versions (id, item_id, version, title, description, content, changelog)
VALUES
  ('mpv_seed_meal_1_v1', 'mp_seed_meal_1', 1, 'High-Protein Cut (2000 kcal)',
   '5-day meal plan, ~180g protein, minimal prep.',
   '{"title":"High-Protein Cut (2000 kcal)","plan_type":"daily","diet_type":"high_protein","target_calories":2000,"content":{"meals":[{"meal_type":"breakfast","name":"Eggs + oats + berries","calories":480,"protein_g":32,"carbs_g":55,"fat_g":14},{"meal_type":"lunch","name":"Chicken + rice + broccoli","calories":620,"protein_g":55,"carbs_g":70,"fat_g":10},{"meal_type":"snack","name":"Greek yogurt + almonds","calories":280,"protein_g":24,"carbs_g":16,"fat_g":14},{"meal_type":"dinner","name":"Salmon + sweet potato + spinach","calories":620,"protein_g":42,"carbs_g":48,"fat_g":24}]}}'::jsonb,
   'Initial version'),
  ('mpv_seed_meal_2_v1', 'mp_seed_meal_2', 1, 'Mediterranean Balanced Week',
   '7-day Mediterranean-style plan.',
   '{"title":"Mediterranean Balanced Week","plan_type":"weekly","diet_type":"mediterranean","target_calories":2200,"content":{"meals":[{"day":"monday","meal_type":"breakfast","name":"Greek yogurt + honey + walnuts","calories":420,"protein_g":18,"carbs_g":42,"fat_g":20},{"day":"monday","meal_type":"lunch","name":"Chickpea salad + feta + olive oil","calories":620,"protein_g":24,"carbs_g":60,"fat_g":32},{"day":"monday","meal_type":"dinner","name":"Grilled sea bass + roasted veg","calories":680,"protein_g":42,"carbs_g":38,"fat_g":34},{"day":"tuesday","meal_type":"breakfast","name":"Oatmeal + berries + almonds","calories":440,"protein_g":14,"carbs_g":62,"fat_g":16},{"day":"tuesday","meal_type":"lunch","name":"Lentil soup + whole grain toast","calories":560,"protein_g":22,"carbs_g":78,"fat_g":12},{"day":"tuesday","meal_type":"dinner","name":"Chicken souvlaki + tzatziki + pita","calories":720,"protein_g":48,"carbs_g":62,"fat_g":28}]}}'::jsonb,
   'Initial version')
ON CONFLICT (id) DO NOTHING;

COMMIT;
