-- ================================================================
-- Status Check — TEST SEED (v3: projects + membership + pool)
-- Run in Supabase SQL Editor. Safe to re-run (wipes previous seed first).
-- Run AFTER setup.sql.
--
--   • project meta (deadline + description) for the 4 demo projects
--   • every executor is added to every project (so pools are visible)
--   • 4 "Нові" (assigned, unowned) tasks PER project  → 16 in the pool
--   • in_progress / to_check / expired / done … owned by executors
-- ================================================================

DELETE FROM commitments WHERE title LIKE '[seed]%';

-- project metadata (for the project cards)
UPDATE projects SET deadline = CURRENT_DATE + 30, description = 'Ядро продукту та API'           WHERE name = 'Platform';
UPDATE projects SET deadline = CURRENT_DATE + 21, description = 'Мобільний застосунок iOS/Android' WHERE name = 'Mobile App';
UPDATE projects SET deadline = CURRENT_DATE + 14, description = 'Маркетинг та залучення'           WHERE name = 'Marketing';
UPDATE projects SET deadline = CURRENT_DATE + 45, description = 'Інфраструктура та DevOps'         WHERE name = 'Infrastructure';

DO $$
DECLARE
  v_checker uuid;
  v_execs   uuid[];
  v_n       int;
BEGIN
  SELECT array_agg(id ORDER BY created_at) INTO v_execs FROM profiles WHERE role = 'user';
  IF v_execs IS NULL OR array_length(v_execs, 1) = 0 THEN
    RAISE EXCEPTION 'Немає жодного виконавця (role = user). Зареєструй executor-акаунт і запусти знову.';
  END IF;
  v_n := array_length(v_execs, 1);

  SELECT id INTO v_checker FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_checker IS NULL THEN v_checker := v_execs[1]; END IF;

  -- every executor → member of every project (so all pools are visible for the demo)
  INSERT INTO project_members (project_id, profile_id)
  SELECT p.id, e FROM projects p, unnest(v_execs) AS e
  ON CONFLICT (project_id, profile_id) DO NOTHING;

  INSERT INTO commitments
    (title, description, status, deadline, deadline_time, project_id, author_id, executor_id, checker_id)
  SELECT
    '[seed] ' || d.title,
    d.descr,
    d.status,
    CURRENT_DATE + d.doff,
    d.dtime,
    (SELECT id FROM projects WHERE name = d.proj),
    v_execs[1 + (d.i % v_n)],
    CASE WHEN d.status = 'assigned' THEN NULL ELSE v_execs[1 + (d.i % v_n)] END,
    CASE WHEN d.status = 'assigned' THEN NULL ELSE v_checker END
  FROM (VALUES
    -- ════ Нові (assigned, unowned) — 4 per project ════
    ( 0, 'Інтеграція Stripe',            'Підключити Stripe Checkout та вебхуки',       'assigned',  4,  '14:00'::time, 'Platform'),
    ( 1, 'Рефакторинг auth-модуля',      'Винести логіку сесій у окремий сервіс',       'assigned',  6,  NULL::time,    'Platform'),
    ( 2, 'Документація REST API',        'Описати ендпоінти у OpenAPI',                 'assigned',  9,  NULL::time,    'Platform'),
    ( 3, 'Rate limiting на API',         'Захист від зловживань, ліміти на ключ',       'assigned', 12,  NULL::time,    'Platform'),

    ( 4, 'Онбординг — фінальні макети',   'Завершити екрани онбордингу у Figma',         'assigned',  5,  NULL::time,    'Mobile App'),
    ( 5, 'Локалізація застосунку',       'Винести рядки у i18n, додати EN',             'assigned',  7,  NULL::time,    'Mobile App'),
    ( 6, 'Офлайн-режим',                 'Кешування даних та черга синхронізації',      'assigned', 11,  NULL::time,    'Mobile App'),
    ( 7, 'Дрібні баги UI',               'Список з беклогу QA',                         'assigned', 14,  '10:00'::time, 'Mobile App'),

    ( 8, 'A/B тест банерів',             'Експеримент на двох креативах',               'assigned',  3,  NULL::time,    'Marketing'),
    ( 9, 'SEO-оптимізація',              'Мета-теги, sitemap, швидкість',               'assigned',  8,  NULL::time,    'Marketing'),
    (10, 'Email-розсилка Q3',            'Підготувати шаблон і сегменти',               'assigned', 10,  '09:00'::time, 'Marketing'),
    (11, 'Контент-план на місяць',       '12 публікацій + графік',                      'assigned', 13,  NULL::time,    'Marketing'),

    (12, 'Оновлення CI/CD',              'Кеш залежностей і паралельні джоби',          'assigned',  6,  NULL::time,    'Infrastructure'),
    (13, 'Стратегія бекапів',            'Політика та автоматичні снапшоти',            'assigned',  9,  NULL::time,    'Infrastructure'),
    (14, 'Алерти моніторингу',           'Налаштувати правила в Grafana',               'assigned', 12,  NULL::time,    'Infrastructure'),
    (15, 'Оновлення Kubernetes',         'Мажорний апгрейд кластера',                   'assigned', 16,  NULL::time,    'Infrastructure'),

    -- ════ В процесі (claimed) ════
    (16, 'Пуш-нотифікації iOS',          'Реалізувати APNs та протестувати',            'in_progress', 2, '18:00'::time, 'Mobile App'),
    (17, 'Міграція БД на нову схему',     'Перенести таблиці й переписати запити',       'in_progress', 4, NULL::time,    'Infrastructure'),
    (18, 'Лендінг Q3 — верстка',         'Зверстати головну за новим дизайном',         'in_progress', 6, '12:00'::time, 'Marketing'),
    (19, 'Сесії та токени',              'Доробити refresh-токени',                     'in_progress', 5, NULL::time,    'Platform'),

    -- ════ На перевірці / далі ════
    (20, 'Код-рев''ю API endpoints',     'Перевірити нові ендпоінти авторизації',       'to_check',    1, '12:00'::time, 'Platform'),
    (21, 'Тести регресії checkout',      'Прогнати повний regress',                     'to_check',    0, '16:00'::time, 'Mobile App'),
    (22, 'SEO-аудит лендінгу',           'Звіт від зовнішньої агенції',                 'expired',    -3, '10:00'::time, 'Marketing'),
    (23, 'Бекап-стратегія — документ',    'Опис політики копіювання',                    'expired',    -6, NULL::time,    'Infrastructure'),
    (24, 'Реліз v1.9 hotfix',            'Гарячий фікс критичного бага',                'done',       -2, NULL::time,    'Platform'),
    (25, 'Інтеграція аналітики GA4',     'Підключити події та конверсії',               'done',       -8, NULL::time,    'Marketing'),
    (26, 'Налаштування Sentry',          'Моніторинг помилок на проді',                 'done',       -5, NULL::time,    'Infrastructure'),
    (27, 'Стара дизайн-система',         'Більше не використовується, архів',           'not_actual',-10, NULL::time,    'Mobile App'),
    (28, 'Apple Pay',                    'Ідея: оплата через Apple Pay',                'ideas_backlog',20,NULL::time,    'Platform'),
    (29, 'Темна тема застосунку',        'Ідея на майбутнє — повна dark theme',         'ideas_backlog',25,NULL::time,    'Mobile App')
  ) AS d(i, title, descr, status, doff, dtime, proj);

  RAISE NOTICE 'Seed v3: 16 у пулі (4/проєкт) + 4 в роботі + перевірка/готово, % виконавців у всіх проєктах', v_n;
END $$;
