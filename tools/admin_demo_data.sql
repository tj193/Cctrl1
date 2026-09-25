-- Small operational examples for the admin presentation.
-- Run after admin_geography_catalog.sql. Does not create or alter driver accounts or applications.
-- All student accounts use reserved .invalid addresses and cannot log in.

INSERT INTO "user" (name, email, password_hash, role, status, created_at)
SELECT example.name, example.email, '!demo-only-no-login', 'STUDENT', 'ACTIVE', CURRENT_TIMESTAMP
FROM (VALUES
    ('Mariam Hassan', 'demo.student.mariam@darbgo.invalid'),
    ('Ali Kareem', 'demo.student.ali@darbgo.invalid'),
    ('Noor Ahmed', 'demo.student.noor@darbgo.invalid'),
    ('Zainab Mahmoud', 'demo.student.zainab@darbgo.invalid'),
    ('Omar Saad', 'demo.student.omar@darbgo.invalid'),
    ('Rana Saleh', 'demo.student.rana@darbgo.invalid'),
    ('Mustafa Abbas', 'demo.student.mustafa@darbgo.invalid'),
    ('Huda Fadhil', 'demo.student.huda@darbgo.invalid'),
    ('Yousef Nabil', 'demo.student.yousef@darbgo.invalid'),
    ('Sarah Hamid', 'demo.student.sarah@darbgo.invalid')
) AS example(name, email)
WHERE NOT EXISTS (SELECT 1 FROM "user" existing WHERE existing.email = example.email);

WITH approved_drivers AS (
    SELECT driver.id, ROW_NUMBER() OVER (ORDER BY driver.id) AS position
    FROM "user" driver
    JOIN driver_profile profile ON profile."Driver_id" = driver.id
    WHERE driver.role = 'DRIVER' AND driver.status = 'ACTIVE'
      AND profile.verification_status = 'APPROVED'
), route_examples AS (
    SELECT * FROM (VALUES
        (1, 'المنصور', 'Baghdad', 'جامعة بغداد', 4),
        (2, 'الكرادة', 'Baghdad', 'الجامعة المستنصرية', 3),
        (3, 'الأعظمية', 'Baghdad', 'الجامعة التكنولوجية', 4),
        (1, 'العشار', 'Basra', 'جامعة البصرة', 4),
        (2, 'الموصل', 'Nineveh', 'جامعة الموصل', 5),
        (3, 'عنكاوا', 'Erbil', 'جامعة صلاح الدين', 3)
    ) AS item(driver_position, area_name, governorate, university_name, capacity)
)
INSERT INTO route (driver_id, from_area_id, to_university_id, capacity, status, created_at)
SELECT driver.id, area.id, university.id, example.capacity, 'ACTIVE', CURRENT_TIMESTAMP
FROM route_examples example
JOIN approved_drivers driver ON driver.position = example.driver_position
JOIN area ON area."Area_name" = example.area_name AND area.city = example.governorate
JOIN university ON university."University_name" = example.university_name
WHERE NOT EXISTS (
    SELECT 1 FROM route existing
    WHERE existing.driver_id = driver.id AND existing.from_area_id = area.id
      AND existing.to_university_id = university.id
);

INSERT INTO routestudents (student_id, route_id, status, joined_at)
SELECT student.id, route.id, 'ACTIVE', CURRENT_TIMESTAMP
FROM (VALUES
    ('demo.student.mariam@darbgo.invalid', 'المنصور', 'Baghdad', 'جامعة بغداد'),
    ('demo.student.ali@darbgo.invalid', 'الكرادة', 'Baghdad', 'الجامعة المستنصرية'),
    ('demo.student.zainab@darbgo.invalid', 'الأعظمية', 'Baghdad', 'الجامعة التكنولوجية'),
    ('demo.student.rana@darbgo.invalid', 'العشار', 'Basra', 'جامعة البصرة'),
    ('demo.student.mustafa@darbgo.invalid', 'الموصل', 'Nineveh', 'جامعة الموصل'),
    ('demo.student.huda@darbgo.invalid', 'عنكاوا', 'Erbil', 'جامعة صلاح الدين')
) AS example(email, area_name, governorate, university_name)
JOIN "user" student ON student.email = example.email
JOIN area ON area."Area_name" = example.area_name AND area.city = example.governorate
JOIN university ON university."University_name" = example.university_name
JOIN route ON route.from_area_id = area.id AND route.to_university_id = university.id AND route.status = 'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM routestudents existing
    WHERE existing.student_id = student.id AND existing.route_id = route.id
);

INSERT INTO routedemand (student_id, from_area_id, to_university_id, preferred_time, status, created_at)
SELECT student.id, area.id, university.id, CURRENT_DATE + example.arrival_time,
       'ACTIVE', CURRENT_TIMESTAMP - example.days_ago * INTERVAL '1 day'
FROM (VALUES
    ('demo.student.mariam@darbgo.invalid', 'المنصور', 'Baghdad', 'جامعة بغداد', TIME '08:00', 0),
    ('demo.student.ali@darbgo.invalid', 'الكرادة', 'Baghdad', 'الجامعة المستنصرية', TIME '08:30', 1),
    ('demo.student.noor@darbgo.invalid', 'الأعظمية', 'Baghdad', 'جامعة بغداد', TIME '08:00', 2),
    ('demo.student.zainab@darbgo.invalid', 'الأعظمية', 'Baghdad', 'الجامعة التكنولوجية', TIME '09:00', 0),
    ('demo.student.omar@darbgo.invalid', 'الكاظمية', 'Baghdad', 'جامعة بغداد', TIME '08:00', 1),
    ('demo.student.rana@darbgo.invalid', 'العشار', 'Basra', 'جامعة البصرة', TIME '08:30', 2),
    ('demo.student.mustafa@darbgo.invalid', 'الموصل', 'Nineveh', 'جامعة الموصل', TIME '09:00', 3),
    ('demo.student.huda@darbgo.invalid', 'عنكاوا', 'Erbil', 'جامعة صلاح الدين', TIME '08:00', 0),
    ('demo.student.yousef@darbgo.invalid', 'المنصور', 'Baghdad', 'جامعة بغداد', TIME '08:00', 1),
    ('demo.student.sarah@darbgo.invalid', 'الكرادة', 'Baghdad', 'الجامعة المستنصرية', TIME '08:30', 2),
    ('demo.student.noor@darbgo.invalid', 'زيونة', 'Baghdad', 'الجامعة التكنولوجية', TIME '09:00', 1),
    ('demo.student.omar@darbgo.invalid', 'المنصور', 'Baghdad', 'جامعة النهرين', TIME '08:00', 0),
    ('demo.student.rana@darbgo.invalid', 'المعقل', 'Basra', 'جامعة البصرة', TIME '08:30', 1),
    ('demo.student.mustafa@darbgo.invalid', 'حي الجامعة', 'Nineveh', 'جامعة الموصل', TIME '09:00', 2),
    ('demo.student.huda@darbgo.invalid', 'بختياري', 'Erbil', 'جامعة صلاح الدين', TIME '08:00', 3),
    ('demo.student.zainab@darbgo.invalid', 'الكرادة', 'Baghdad', 'جامعة بغداد', TIME '08:30', 0)
) AS example(email, area_name, governorate, university_name, arrival_time, days_ago)
JOIN "user" student ON student.email = example.email
JOIN area ON area."Area_name" = example.area_name AND area.city = example.governorate
JOIN university ON university."University_name" = example.university_name
WHERE NOT EXISTS (
    SELECT 1 FROM routedemand existing
    WHERE existing.student_id = student.id AND existing.from_area_id = area.id
      AND existing.to_university_id = university.id
);
