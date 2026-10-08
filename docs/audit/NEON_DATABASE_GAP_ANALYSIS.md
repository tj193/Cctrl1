# فجوات مخطط نيون

## ما تحقق مباشرة

فُحصت فهارس `pg_catalog` و`information_schema` من اتصال محلي إلى مضيف `Neon` مع `sslmode=require` وجلسة `transaction_read_only=on`. لم يُستعلم عن صفوف الأعمال. المضيف المباشر ليس بصيغة المجمّع، لكن إعداد التجميع الفعلي خارج العميل غير مثبت. اسم فرع `Neon` غير قابل للتحديد من هذا الفحص؛ وثيقة المشروع تذكر فرع `production`، لذلك يجب معاملته كبيئة حساسة. يوجد 9 جداول و62 عمودًا و18 فهرسًا. لا يوجد جدول `alembic_version` ولا ملفات ترحيل في المستودع.

## الجداول الحية والعلاقات

| الجدول | الأعمدة الموجودة | العلاقات والقيود المؤكدة |
| --- | --- | --- |
| `user` | `id`, `name`, `email`, `password_hash`, `role`, `status`, `created_at` | مفتاح أساسي؛ فهرس فريد للبريد؛ لا جدول ملف طالب مستقل. |
| `driver_profile` | `id`, `Driver_id`, `phone_number`, `vehicle_name`, `vehicle_model`, `vehicle_plate`, `license_number`, `national_id`, ثلاثة عناوين صور، `verification_status`, `rejection_reason`, `reviewed_by`, `reviewed_at` | مفتاحان أجنبيان إلى `user`؛ فهارس فريدة للهاتف والرخصة والهوية، ولا فهرس فريد لـ`Driver_id` أو اللوحة. |
| `area` | `id`, `Area_name`, `city`, `status`, `created_at` | فهرس فريد مركب على الاسم والمدينة. |
| `university` | `id`, `University_name`, `status`, `created_at`, `governorate` | فهرس فريد للاسم وفهرس للمحافظة. |
| `route` | `id`, `driver_id`, `from_area_id`, `to_university_id`, `capacity`, `status`, `created_at` | مفاتيح أجنبية إلى `user` و`area` و`university`؛ لا قيد يمنع سعة صفرية أو سالبة. |
| `routestudents` | `id`, `student_id`, `route_id`, `status`, `joined_at` | مفاتيح أجنبية إلى `user` و`route`؛ لا فهرس يمنع تكرار التسجيل النشط. |
| `routedemand` | `id`, `student_id`, `from_area_id`, `to_university_id`, `preferred_time`, `status`, `created_at` | مفاتيح أجنبية إلى `user` و`area` و`university`؛ لا قيد لطلب نشط مكرر. |
| `report` | `id`, `report_id`, `target_id`, `target_type`, `reason`, `status`, `resolved_by`, `created_at` | `report_id` يعني صاحب البلاغ؛ ثلاثة مفاتيح أجنبية إلى `user`؛ الهدف إلزامي، ولا نوع أو موضوع أو وصف مستقل أو رد. |
| `playing_with_neon` | `id`, `name`, `value` | جدول إضافي خارج نماذج التطبيق. الغرض والمالك غير متحققين؛ يُترك دون تغيير. |

النماذج الثمانية في `SQLModel` تطابق أسماء الجداول والأعمدة الموجودة، لكن هذه المطابقة لا تثبت صحة البيانات أو كفاية القيود. الأنواع الحية: المعرّفات والسعة من نوع `integer`، الأسماء والحقول النصية `varchar`، التواريخ `timestamptz`، وحالة الدور/الحساب/الطلب/المسار/البلاغ أنواع `enum` في PostgreSQL. أعمدة `created_at` لا تحمل افتراضًا خادميًا في المخطط؛ ينشئها التطبيق عادةً. لا توجد قيود `CHECK` للأعمال في الجداول المفحوصة.

قيم الأنواع الحالية: `userrole` = `ADMIN/STUDENT/DRIVER`؛ `status` = `ACTIVE/SUSPENDED/PENDING`؛ `applicationstatus` = `PENDING/APPROVED/REJECTED`؛ `routestatus` = `ACTIVE/DISABLED/FULL`؛ `routestudentstatus` = `ACTIVE/CANCELLED`؛ `routedemandstatus` = `ACTIVE/FULFILLED/CANCELLED`؛ `reportstatus` = `PENDING/INVESTIGATING/RESOLVED/DISMISSED`. عرض القيم البرمجي يستخدم الصيغ المقروءة بحرف أول كبير؛ راجع خطة التوافق قبل إضافة حالات جديدة.

## مقارنة المتطلبات بالمخطط

| الميزة | الجدول الحالي | الدعم الحالي | النقص | التغيير المقترح | الأولوية |
| --- | --- | --- | --- | --- | --- |
| هوية الطالب | `user` | الاسم والبريد والدور | الهاتف، منطقة/جامعة مفضلة، وقت وصول، موافقة بيانات | أعمدة ملف طالب محدودة أو جدول `student_profile` إذا تعددت التفضيلات؛ قرار تصميم قبل التنفيذ | مرتفعة |
| موافقة السائق | `user`, `driver_profile` | طلب ومراجعة وحالة | وحدانية ملف السائق ولوحة المركبة؛ حالة الوثيقة منفصلة | فهارس فريدة مناسبة، وتخزين حالة الوثائق فقط بعد بناء رفع آمن | مرتفعة |
| المواقع | `area`, `university` | معرّفات معيارية | بيانات الطالب المحلية أسماء نصية غير مرتبطة | ربط الملف بمعرّفات قائمة؛ سياسة توحيد الأسماء القديمة | مرتفعة |
| المسار | `route` | سائق ومنطقة وجامعة وسعة وحالة | وقت مغادرة/عودة، سعر، توقفات، تفاصيل؛ لا قيد سعة | أعمدة للمعلومات الأساسية، وجدول توقفات مرتب فقط إن لزم تعددها؛ قيد سعة موجبة | مرتفعة |
| طلب الانضمام | لا يوجد | لا شيء | دورة `Pending → Accepted/Declined`، أوقات ونسخة قرار | جدول `ride_request` جديد بمفاتيح الطالب والمسار، الحالة، أوقات القرار، وفهرس جزئي للطلب النشط | حاسمة |
| التسجيل المؤكد | `routestudents` | ربط طالب بمسار | منع التكرار وسعة ذرية | فهرس فريد جزئي للتسجيل النشط؛ قبول الطلب ضمن معاملة واحدة | حاسمة |
| قائمة الانتظار | `routedemand` | طلب منطقة وجامعة ووقت وحالة | التفريق بين انتظار حقيقي وطلب إداري أو تكرار الطالب | استخدام الجدول نفسه مع قاعدة مصدر/إزالة تكرار واضحة؛ فهرس نشط حسب زوج المنطقة والجامعة | مرتفعة |
| البلاغ | `report` | صاحب وهدف وسبب وحالة | النوع والموضوع والوصف والرد والتواريخ، وبلاغ دعم بلا هدف مستخدم | توسيع الجدول؛ جعل الهدف اختياريًا وفق النوع، وحفظ رد عام وملاحظات داخلية منفصلة | مرتفعة |
| الإشعارات | لا يوجد | تجريبي في المتصفح | مستلم وحالة قراءة وأحداث | جدول صغير بعد تثبيت أحداث الطلب والبلاغ؛ يمكن تأجيله إن كان التتبع داخل الصفحات كافيًا | لاحقة |
| سجل الإدارة | أعمدة مراجعة متفرقة | مراجعة طلب السائق فقط | قرارات التعليق والقبول بلا سجل موحد | سجل أحداث محدود للعمليات الحساسة بعد تثبيت عقودها | موصى بها |

## تصميم التغييرات الأساسية

### طلب الانضمام والتسجيل

الجدول المقترح `ride_request`: `id integer`, و`student_id integer`، و`route_id integer`، و`status` بقيم `Pending/Accepted/Declined`، و`created_at timestamptz`، و`decided_at timestamptz NULL`، و`decided_by integer NULL`، و`version integer`. ترتبط المفاتيح بجدولي `user` و`route`. يلزم فهرس على `(route_id,status,created_at)`، وفهرس فريد جزئي على `(student_id,route_id)` للحالة النشطة وفق قاعدة المنتج. لا يجوز فرض منع دائم للطلب بعد رفضه قبل تقرير سياسة إعادة التقديم.

يبقى `routestudents` مصدر التسجيل المؤكد. يُقترح فهرس فريد جزئي على `(student_id,route_id)` عندما تكون الحالة نشطة، وفهرس على `(route_id,status)` للعد. قبول الطلب يجب أن يقفل المسار أو يستعمل حدًا ذريًا مكافئًا، ثم يتحقق من عدد التسجيلات الفعالة ويسجل القرار والتسجيل في معاملة واحدة. الفهرس وحده لا يمنع تجاوز السعة بين طلبين مختلفين.

### المسار والمواقع

الحقول المطلوبة للعرض الحالي: `departure_time time`, و`return_time time`, و`price_iqd integer`, و`notes text NULL`. يفضل تحديد أيام التشغيل أو تاريخ الخدمة قبل تسمية مسار بأنه قادم. التوقفات المتعددة تحتاج جدولًا مرتبًا مثل `route_stop(route_id,area_id,position)` مع فريد على `(route_id,position)`؛ إذا اقتصر الحد الأدنى على نقطة انطلاق وجامعة، يمكن تأجيله. أضف تحققًا من `capacity > 0` و`price_iqd >= 0`. يجب التحقق من أن السعة الجديدة لا تقل عن التسجيلات النشطة داخل معاملة، لأن قيد `CHECK` وحده لا يقرأ جدول التسجيلات.

### الملف والبلاغ

توحيد ملف الطالب يحتاج قرارًا بشأن الهاتف والمنطقة والجامعة ووقت الوصول. إن كانت تفضيلات واحدة لكل طالب، تكفي علاقة واحد لواحد؛ إذا تعددت الرحلات والتفضيلات، لا تُكرر هذه الحقول في `user` قبل تثبيت حالات الاستخدام. لا يُخزن سر الحساب أو وثيقة الهوية في بيانات العرض التجريبية.

للبلاغ، أضف `type`, و`subject`, و`description`, و`public_resolution NULL`, و`internal_notes NULL`, و`updated_at timestamptz`, و`resolved_at timestamptz NULL`, و`related_route_id NULL` بعد تحديد سياسة البلاغات المتعلقة بالمستخدم أو المسار. يبقى `report_id` للتوافق مؤقتًا، ويمكن تسميته `reporter_id` في واجهة البيانات قبل إعادة تسمية العمود في ترحيل مستقل.

## أثر كل تغيير مقترح

| التغيير وسبب الحاجة | الأعمدة والعلاقات والفهارس المقترحة | أثر السجلات والخادم ومخاطر الترحيل | للحد الأدنى |
| --- | --- | --- | --- |
| ملف طالب معياري للبحث والطلب | `student_profile(user_id integer PK/FK, phone varchar NULL, area_id integer FK NULL, university_id integer FK NULL, arrival_time time NULL)`؛ فهارس المفاتيح الخارجية عند الحاجة | لا يمكن تحويل أسماء المتصفح المحلية آليًا بلا مطابقة مراجعة؛ يلزم واجهة ملف وهوية طالب. أضف صفوفًا جديدة فقط بعد اختيار المعرفات الصحيحة. | نعم، الحقول اللازمة للبحث. |
| وحدانية ملف السائق وبيانات المركبة | فريد على `driver_profile.Driver_id`؛ فريد على `vehicle_plate` بعد قرار تنسيق اللوحات؛ حالة وثائق مستقلة لاحقًا إن صار رفع حقيقيًا | افحص التكرارات القائمة قبل الفهرس؛ التسجيل والمراجعة يحتاجان معالجة تعارض متزامن. لا تفترض أن روابط الصور الفارغة تحقق الوثائق. | وحدانية الملف نعم؛ حالة الصور لاحقة. |
| بيانات المسار التشغيلية | `departure_time time NULL`, `return_time time NULL`, `price_iqd integer NULL`, `notes text NULL` مع `CHECK (capacity > 0)` و`CHECK (price_iqd >= 0)` عند الامتلاء؛ فهارس `(driver_id,status)` و`(from_area_id,to_university_id,status)` | الأعمدة اختيارية أولًا حتى لا تُنسب أوقات أو أسعار مختلقة للمسارات القديمة؛ تحديث DTO والبحث والإنشاء. فحص سعات قائمة قبل القيد. | الوقت والسعر والقيد نعم. |
| توقفات متعددة إذا أكدها نطاق المنتج | `route_stop(route_id integer FK,area_id integer FK,position integer)`، فريد `(route_id,position)` وفهرس `(area_id)` | جدول جديد دون تغيير المسارات القديمة؛ يحتاج ترتيبًا صحيحًا وقاعدة منع تكرار الموقع. يمكن تأجيله إذا كان البحث الأساسي لا يستخدم التوقفات. | لا، إن اقتصر العرض على الأصل والجامعة. |
| طلب انضمام قابل للتتبع | `ride_request` بالحقول والعلاقات المذكورة أعلاه؛ فهرس `(route_id,status,created_at)` وفريد جزئي للطلب النشط | لا توجد سجلات قديمة مقابلة في القاعدة لنقلها؛ لا تنقل طلبات المتصفح كحقائق. يلزم موجهات الطالب والسائق وخدمة قرار ذري. | نعم. |
| منع تسجيل مؤكد مكرر | فريد جزئي على `routestudents(student_id,route_id)` للحالة `Active`، وفهرس `(route_id,status)` | افحص التكرارات قبل الفهرس؛ خدمة القبول يجب أن تتعامل مع تعارض الفهرس وتغلق المسار لحماية السعة. | نعم. |
| انتظار موحد | استخدم `routedemand`؛ فهرس `(from_area_id,to_university_id,status)`، وفريد جزئي للطالب والزوج النشط فقط بعد اعتماد قاعدة إعادة التقديم | قد توجد طلبات مكررة؛ لا تُنشئ فهرسًا فريدًا قبل العد والمراجعة. يلزم API الطالب والسائق وقاعدة إزالة تكرار التحليل. | موصى به إذا كان الانتظار ضمن العرض. |
| بلاغ قابل للتحقيق والرد | `type varchar`, `subject varchar`, `description text`, `public_resolution text NULL`, `internal_notes text NULL`, `updated_at timestamptz NULL`, `resolved_at timestamptz NULL`, `related_route_id integer FK NULL`؛ فهرس `(report_id,created_at)` و`(status,created_at)` | احتفظ بـ`reason` قديمًا واملأ الموضوع/الوصف فقط من معنى موثوق؛ هدف المستخدم الإلزامي يحتاج ترحيلًا منفصلًا بعد سياسة بلاغ الدعم. تحديث الإدارة وواجهات المالك. | نعم بالحقول الأساسية. |
| إشعار دائم | `notification(id integer,recipient_id integer FK,event_type varchar,related_type varchar,related_id integer,message text,read_at timestamptz NULL,created_at timestamptz)`؛ فهرس `(recipient_id,read_at,created_at)` | جدول جديد لا يمس السجلات القديمة؛ يحتاج أحداثًا موثقة وتصفية ملكية. يمكن الاكتفاء بتتبع الصفحة أولًا. | لا. |
| سجل قرارات الإدارة | `admin_audit(id integer,actor_id integer FK,action varchar,entity_type varchar,entity_id integer,created_at timestamptz,change_summary jsonb)`؛ فهرس `(entity_type,entity_id,created_at)` | جدول جديد؛ يمنع وضع أسرار أو مستندات كاملة في `change_summary`. يضيف كتابة ضمن قرار إداري. | موصى به للقرارات الحساسة. |

## أثر السجلات القديمة ومخاطر الترحيل

- لا تُحذف سجلات أو جداول قائمة، خصوصًا `playing_with_neon` الذي لم يُعرف مالكه.
- افحص وجود تكرارات أو قيم غير صالحة باستعلامات عدّ محدودة قبل إنشاء فهارس فريدة أو قيود جديدة؛ لم يُجر هذا الفحص ضمن التدقيق.
- أضف الأعمدة القابلة للإلغاء أولًا، واملأ القيم الموثقة على فرع تطوير، ثم شدد القيود بعد مراجعة السجلات. لا تملأ أوقاتًا أو أسعارًا افتراضية تظهر كحقائق.
- عالج قيم `enum` بإضافة متوافقة بدل إعادة تسمية مباشرة. يلزم نشر الخادم والواجهة المتوافقة قبل إيقاف القيم القديمة.
- أنشئ ترحيلات مرتبة مع نسخة احتياطية ونقطة رجوع واختبار على فرع قاعدة تطوير. لا توجد آلية ترحيل حالية أو تاريخ يثبت كيفية إنشاء الجداول الموجودة.
- لا يُستنتج توفر نسخ احتياطي أو خطة استعادة من وجود `Neon` وحده؛ لم يُتحقق من سياسة الاستعادة أو اسم الفرع المتصل.

## استعلامات تحقق لاحقة آمنة

تُنفذ فقط على فرع مصرح به وبحساب قراءة، وبعد التأكد من البيئة. لا تعرض صفوف مستخدمين:

```sql
BEGIN READ ONLY;
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
ROLLBACK;
```

## ملحق المخطط الحي: الأعمدة والقيود والفهارس

هذا الملحق مولد من فحص الفهارس الحية للقراءة فقط. `—` يعني عدم وجود قيمة افتراضية في قاعدة البيانات، لا في نموذج التطبيق.

| الجدول | العمود | نوع PostgreSQL | قابل للإلغاء | الافتراض الخادمي |
| --- | --- | --- | --- | --- |
| `area` | `id` | `integer` | لا | `nextval('area_id_seq'::regclass)` |
| `area` | `Area_name` | `character varying` | لا | — |
| `area` | `city` | `character varying` | لا | — |
| `area` | `status` | `universitystatus` | لا | — |
| `area` | `created_at` | `timestamp with time zone` | لا | — |
| `driver_profile` | `id` | `integer` | لا | `nextval('driver_profile_id_seq'::regclass)` |
| `driver_profile` | `Driver_id` | `integer` | لا | — |
| `driver_profile` | `phone_number` | `character varying` | لا | — |
| `driver_profile` | `vehicle_name` | `character varying` | لا | — |
| `driver_profile` | `vehicle_model` | `character varying` | لا | — |
| `driver_profile` | `vehicle_plate` | `character varying` | لا | — |
| `driver_profile` | `license_number` | `character varying` | لا | — |
| `driver_profile` | `national_id` | `character varying` | لا | — |
| `driver_profile` | `vehicle_photo_url` | `character varying` | لا | — |
| `driver_profile` | `license_photo_url` | `character varying` | لا | — |
| `driver_profile` | `id_photo_url` | `character varying` | لا | — |
| `driver_profile` | `verification_status` | `applicationstatus` | لا | — |
| `driver_profile` | `rejection_reason` | `character varying` | نعم | — |
| `driver_profile` | `reviewed_by` | `integer` | نعم | — |
| `driver_profile` | `reviewed_at` | `timestamp with time zone` | نعم | — |
| `playing_with_neon` | `id` | `integer` | لا | `nextval('playing_with_neon_id_seq'::regclass)` |
| `playing_with_neon` | `name` | `text` | لا | — |
| `playing_with_neon` | `value` | `real` | نعم | — |
| `report` | `id` | `integer` | لا | `nextval('report_id_seq'::regclass)` |
| `report` | `report_id` | `integer` | لا | — |
| `report` | `target_id` | `integer` | لا | — |
| `report` | `target_type` | `userrole` | لا | — |
| `report` | `reason` | `character varying` | لا | — |
| `report` | `status` | `reportstatus` | لا | — |
| `report` | `resolved_by` | `integer` | نعم | — |
| `report` | `created_at` | `timestamp with time zone` | لا | — |
| `route` | `id` | `integer` | لا | `nextval('route_id_seq'::regclass)` |
| `route` | `driver_id` | `integer` | لا | — |
| `route` | `from_area_id` | `integer` | لا | — |
| `route` | `to_university_id` | `integer` | لا | — |
| `route` | `capacity` | `integer` | لا | — |
| `route` | `status` | `routestatus` | لا | — |
| `route` | `created_at` | `timestamp with time zone` | لا | — |
| `routedemand` | `id` | `integer` | لا | `nextval('routedemand_id_seq'::regclass)` |
| `routedemand` | `student_id` | `integer` | لا | — |
| `routedemand` | `from_area_id` | `integer` | لا | — |
| `routedemand` | `to_university_id` | `integer` | لا | — |
| `routedemand` | `preferred_time` | `timestamp with time zone` | نعم | — |
| `routedemand` | `status` | `routedemandstatus` | لا | — |
| `routedemand` | `created_at` | `timestamp with time zone` | لا | — |
| `routestudents` | `id` | `integer` | لا | `nextval('routestudents_id_seq'::regclass)` |
| `routestudents` | `student_id` | `integer` | لا | — |
| `routestudents` | `route_id` | `integer` | لا | — |
| `routestudents` | `status` | `routestudentstatus` | لا | — |
| `routestudents` | `joined_at` | `timestamp with time zone` | لا | — |
| `university` | `id` | `integer` | لا | `nextval('university_id_seq'::regclass)` |
| `university` | `University_name` | `character varying` | لا | — |
| `university` | `status` | `universitystatus` | لا | — |
| `university` | `created_at` | `timestamp with time zone` | لا | — |
| `university` | `governorate` | `character varying` | نعم | — |
| `user` | `id` | `integer` | لا | `nextval('user_id_seq'::regclass)` |
| `user` | `name` | `character varying` | لا | — |
| `user` | `email` | `character varying` | لا | — |
| `user` | `password_hash` | `character varying` | لا | — |
| `user` | `role` | `userrole` | لا | — |
| `user` | `status` | `status` | لا | — |
| `user` | `created_at` | `timestamp with time zone` | لا | — |

### قيود المفاتيح والفحص

| الجدول | الاسم | النوع | التعريف |
| --- | --- | --- | --- |
| `area` | `area_pkey` | أساسي | `PRIMARY KEY (id)` |
| `driver_profile` | `driver_profile_Driver_id_fkey` | أجنبي | `FOREIGN KEY ("Driver_id") REFERENCES "user"(id)` |
| `driver_profile` | `driver_profile_pkey` | أساسي | `PRIMARY KEY (id)` |
| `driver_profile` | `driver_profile_reviewed_by_fkey` | أجنبي | `FOREIGN KEY (reviewed_by) REFERENCES "user"(id)` |
| `playing_with_neon` | `playing_with_neon_pkey` | أساسي | `PRIMARY KEY (id)` |
| `report` | `report_pkey` | أساسي | `PRIMARY KEY (id)` |
| `report` | `report_report_id_fkey` | أجنبي | `FOREIGN KEY (report_id) REFERENCES "user"(id)` |
| `report` | `report_resolved_by_fkey` | أجنبي | `FOREIGN KEY (resolved_by) REFERENCES "user"(id)` |
| `report` | `report_target_id_fkey` | أجنبي | `FOREIGN KEY (target_id) REFERENCES "user"(id)` |
| `route` | `route_driver_id_fkey` | أجنبي | `FOREIGN KEY (driver_id) REFERENCES "user"(id)` |
| `route` | `route_from_area_id_fkey` | أجنبي | `FOREIGN KEY (from_area_id) REFERENCES area(id)` |
| `route` | `route_pkey` | أساسي | `PRIMARY KEY (id)` |
| `route` | `route_to_university_id_fkey` | أجنبي | `FOREIGN KEY (to_university_id) REFERENCES university(id)` |
| `routedemand` | `routedemand_from_area_id_fkey` | أجنبي | `FOREIGN KEY (from_area_id) REFERENCES area(id)` |
| `routedemand` | `routedemand_pkey` | أساسي | `PRIMARY KEY (id)` |
| `routedemand` | `routedemand_student_id_fkey` | أجنبي | `FOREIGN KEY (student_id) REFERENCES "user"(id)` |
| `routedemand` | `routedemand_to_university_id_fkey` | أجنبي | `FOREIGN KEY (to_university_id) REFERENCES university(id)` |
| `routestudents` | `routestudents_pkey` | أساسي | `PRIMARY KEY (id)` |
| `routestudents` | `routestudents_route_id_fkey` | أجنبي | `FOREIGN KEY (route_id) REFERENCES route(id)` |
| `routestudents` | `routestudents_student_id_fkey` | أجنبي | `FOREIGN KEY (student_id) REFERENCES "user"(id)` |
| `university` | `university_pkey` | أساسي | `PRIMARY KEY (id)` |
| `user` | `user_pkey` | أساسي | `PRIMARY KEY (id)` |

### الفهارس

| الجدول | الاسم | التعريف |
| --- | --- | --- |
| `area` | `area_pkey` | `CREATE UNIQUE INDEX area_pkey ON public.area USING btree (id)` |
| `area` | `ix_area_Area_name` | `CREATE INDEX "ix_area_Area_name" ON public.area USING btree ("Area_name")` |
| `area` | `ix_area_city` | `CREATE INDEX ix_area_city ON public.area USING btree (city)` |
| `area` | `uq_area_name_city` | `CREATE UNIQUE INDEX uq_area_name_city ON public.area USING btree ("Area_name", city)` |
| `driver_profile` | `driver_profile_pkey` | `CREATE UNIQUE INDEX driver_profile_pkey ON public.driver_profile USING btree (id)` |
| `driver_profile` | `ix_driver_profile_license_number` | `CREATE UNIQUE INDEX ix_driver_profile_license_number ON public.driver_profile USING btree (license_number)` |
| `driver_profile` | `ix_driver_profile_national_id` | `CREATE UNIQUE INDEX ix_driver_profile_national_id ON public.driver_profile USING btree (national_id)` |
| `driver_profile` | `ix_driver_profile_phone_number` | `CREATE UNIQUE INDEX ix_driver_profile_phone_number ON public.driver_profile USING btree (phone_number)` |
| `playing_with_neon` | `playing_with_neon_pkey` | `CREATE UNIQUE INDEX playing_with_neon_pkey ON public.playing_with_neon USING btree (id)` |
| `report` | `report_pkey` | `CREATE UNIQUE INDEX report_pkey ON public.report USING btree (id)` |
| `route` | `route_pkey` | `CREATE UNIQUE INDEX route_pkey ON public.route USING btree (id)` |
| `routedemand` | `routedemand_pkey` | `CREATE UNIQUE INDEX routedemand_pkey ON public.routedemand USING btree (id)` |
| `routestudents` | `routestudents_pkey` | `CREATE UNIQUE INDEX routestudents_pkey ON public.routestudents USING btree (id)` |
| `university` | `ix_university_University_name` | `CREATE UNIQUE INDEX "ix_university_University_name" ON public.university USING btree ("University_name")` |
| `university` | `ix_university_governorate` | `CREATE INDEX ix_university_governorate ON public.university USING btree (governorate)` |
| `university` | `university_pkey` | `CREATE UNIQUE INDEX university_pkey ON public.university USING btree (id)` |
| `user` | `ix_user_email` | `CREATE UNIQUE INDEX ix_user_email ON public."user" USING btree (email)` |
| `user` | `user_pkey` | `CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id)` |
