# جرد واجهات البرمجة والعقود

## طريقة القراءة

هذه قائمة المسارات المسجلة فعليًا في `FastAPI` بعد مراجعة الموجهات وواجهة `OpenAPI`. `عام` يعني بلا رمز؛ `سائق` يعني `require_driver`؛ `مدير` يعني `require_admin`. تُرجع أخطاء التحقق عادة `422`، وأخطاء المصادقة `401` أو `403`، وعدم الوجود `404`، وتعارض التسجيل `409` حيث نُص عليه. كثير من استجابات الإدارة قواميس غير معرفة بنموذج إخراج صريح، لذلك يصف الجدول المفاتيح التي يعيدها المعالج، لا ضمانًا منشورًا في `OpenAPI`. جميع العمليات التي تقرأ/تكتب تستخدم جلسة `SQLModel` ما عدا الصحة.

## المصادقة والصحة

| الطريقة والمسار | المعالج والصلاحية | الطلب ← الاستجابة والكيانات | المستهلك والحالة |
| --- | --- | --- | --- |
| `POST /auth/driver-register` | `register_driver`؛ عام | `DriverRegistration` بصيغة `JSON` ← `application_id,status`; ينشئ `user`,`driver_profile` | واجهة تسجيل السائق؛ موجود، تحقق وتعارض، بلا وثائق مرفوعة. |
| `POST /auth/driver-applications` | `register_driver`؛ عام | العقد السابق نفسه | مسار توافق موجود بلا مستهلك واجهة حالي. |
| `POST /auth/driver-login` | `driver_login`؛ عام | نموذج `username,password` ← `access_token,token_type,name`; يقرأ `user`,`driver_profile` | الدخول المشترك؛ يمنع غير الموافق أو المعلق. |
| `GET /auth/driver-me` | `driver_me`؛ سائق | رمز `Bearer` ← `name,email,status=approved`; يقرأ `user`,`driver_profile` | واجهة السائق؛ الاستجابة محدودة عمدًا. |
| `POST /auth/student-login` | `student_login`؛ عام | نموذج `username,password` ← `name,email,role=student`; يقرأ `user` | الدخول المشترك؛ بلا رمز طالب، فلا يدعم عمليات طالب محمية. |
| `POST /auth/login` | `login`؛ عام | نموذج `username,password` ← `access_token,token_type`; يقرأ `user` | دخول الإدارة؛ حساب مدير نشط فقط. |
| `GET /health` | `health`؛ عام | بلا جسم ← `status=ok` | فحص تشغيل؛ لا يثبت اتصال قاعدة البيانات. |

## واجهات الإدارة الرئيسية

جميع الصفوف التالية تحت `src/admin/routers/admin_api.py` ومحمية بدور المدير. مفاتيح المسار والأجسام المذكورة جزء من العقد الحالي؛ لا تعني صلاحية السائق لاستعمالها.

| الطريقة والمسار | المعالج | الطلب ← الاستجابة والكيانات | المستهلك / القيد |
| --- | --- | --- | --- |
| `POST /admin/admins` | `create_admin` | `NewAdmin{name,email,password}` ← `id,name,email`; `user` | صفحة إنشاء مدير؛ فحص تعارض البريد. |
| `GET /admin/dashboard/metrics` | `metrics` | بلا جسم ← خمس قيم عدّ؛ معظم الجداول | نظرة عامة؛ تحميل كل الجداول في الذاكرة. |
| `GET /admin/dashboard/recent-approvals` | `recent_approvals` | بلا جسم ← أول خمسة طلبات معلقة؛ `driver_profile,user` | نظرة عامة. |
| `GET /admin/dashboard/recent-reports` | `recent_reports` | بلا جسم ← أول خمسة بلاغات مفتوحة؛ `report,user` | نظرة عامة. |
| `GET /admin/driver-applications` | `driver_applications` | بلا جسم ← ملف الطلب وهاتف/مركبة/أرقام وثائق؛ `driver_profile,user` | موافقات السائق؛ بيانات حساسة للمدير. |
| `PATCH /admin/driver-applications/{profile_id}/status` | `review_application` | `{status: approved\|rejected,notes}` ← الحالة؛ `driver_profile,user` | موافقات السائق؛ سبب الرفض إلزامي، ويمكن إعادة تغيير الحالة دون سياسة انتقال. |
| `GET /admin/route-demand` | `route_demand` | بلا جسم ← `area_id,university_id,student_count,route_exists,status` لكل مجموعة نشطة؛ `routedemand,route,area,university` | فرص الإدارة؛ لا وقت مفضل في الاستجابة. |
| `GET /admin/available-drivers` | `available_drivers` | بلا جسم ← `id,name,capacity=null`; `user,driver_profile` | إنشاء مسار إداري؛ لا سعة مركبة مخزنة. |
| `POST /admin/routes` | `create_route` | `{area_id,university_id,driver_id,capacity>0}` ← `id`; `route` | إنشاء إداري؛ لا وقت أو سعر أو توقفات، والمالك معرّف بالطلب الإداري. |
| `GET /admin/routes` | `routes` | بلا جسم ← `id,driver_name,origin_area,university_name,enrolled_students,max_capacity,status`; `route,routestudents` | الإدارة والمؤشرات؛ بلا معرّفات المنطقة/الجامعة أو وقت أو سعر. |
| `PATCH /admin/routes/{route_id}/status` | `route_status` | `{status:active\|disabled,notes}` ← الحالة؛ `route` | إدارة المسارات؛ `notes` لا تُحفظ. |
| `GET /admin/drivers` | `drivers` | بلا جسم ← السائقون الموافقون مع الهاتف والمركبة والعدد والحالة؛ `user,driver_profile,route,routestudents` | إدارة السائقين؛ لا يعيد المعلقين غير الموافقين. |
| `GET /admin/route-demand/analytics` | `route_demand_analytics` | بلا جسم ← صف لكل طلب نشط مع معرّفات/أسماء/وقت/تاريخ/تغطية؛ `routedemand,route` | التحليل ولوحة البداية؛ لا تاريخ للحالات المنتهية. |
| `PATCH /admin/drivers/{user_id}/status` | `driver_status` | `{status:active\|suspended,notes}` ← الحالة؛ `user` | إدارة السائقين؛ لا معالجة للمسارات ولا حفظ ملاحظات. |
| `GET /admin/reports` | `reports` | بلا جسم ← `id,reporter_name,reporter_role,reported_target_name,subject,description,created_at,status`; `report,user` | الشكاوى؛ `subject` و`description` كلاهما من `reason`. |
| `PATCH /admin/reports/{report_id}/status` | `report_status` | `{status:resolved\|dismissed,notes}` ← الحالة؛ `report` | الشكاوى؛ يحفظ الحالة والمنفذ، ويتجاهل `notes`. |
| `GET /admin/students` | `students` | بلا جسم ← `id,full_name,phone=null,university_name,area_name,current_route,account_status`; `user,routestudents,routedemand` | إدارة الطلاب؛ اختيار آخر طلب/تسجيل قائم يعتمد ترتيب الصفوف. |
| `PATCH /admin/students/{user_id}/status` | `student_status` | `{status:active\|suspended,notes}` ← الحالة؛ `user` | إدارة الطلاب؛ لا حفظ ملاحظات. |
| `GET /admin/universities` | `universities` | بلا جسم ← `id,name,governorate,status`; `university` | قائمة الجامعات؛ مسار قراءة فعلي. |
| `GET /admin/areas` | `areas` | بلا جسم ← `id,name,city,status`; `area` | قائمة المناطق؛ مسار قراءة فعلي. |
| `GET /admin/me` | `me` | رمز المدير ← `name,email`; `user` | إعدادات الإدارة. |
| `PUT /admin/me` | `update_profile` | `{name,email}` ← `name,email`; `user` | إعدادات الإدارة؛ فحص تعارض البريد. |
| `POST /admin/me/password` | `update_password` | `{current_password,new_password}` ← رسالة؛ `user` | إعدادات الإدارة؛ يبطّل الرموز القديمة بتغير بصمة كلمة المرور. |

## موجهات إدارية إضافية موجودة

هذه الموجهات تُضمّن مع `Depends(require_admin)` في `src/admin/main.py`. لا تستعملها واجهات السائق أو الطالب. قد تعيد نماذج `SQLModel` مباشرة، بما فيها حقول أكثر من الحاجة.

| الطريقة والمسار | المعالج | الطلب ← الاستجابة / الكيانات | المستهلك والحالة |
| --- | --- | --- | --- |
| `GET /drivers/` | `get_drivers` | مرشح `status` اختياري ← قائمة `Driver_Profile` | لا مستهلك حالي؛ بيانات وثائق حساسة. |
| `GET /drivers/{driver_id}` | `get_driver_details` | معرّف ← `Driver_Profile` | لا مستهلك حالي. |
| `PATCH /drivers/{driver_id}/review` | `review_driver` | `action`, و`admin_id`, و`rejection_reason` في معاملات الطلب ← `Driver_Profile` | لا مستهلك؛ يقبل `admin_id` من العميل بدل اشتقاقه من الرمز. |
| `POST /locations/universities` | `create_university` | نموذج `University` كامل ← صف محفوظ | لا مستهلك واجهة؛ إدخال نموذج قاعدة مباشر. |
| `GET /locations/universities` | `get_universities` | بلا جسم ← قائمة `University` | لا مستهلك؛ الإدارة تستخدم `/admin/universities`. |
| `PATCH /locations/universities/{university_id}/status` | `update_university_status` | `new_status` معامل طلب ← صف `University` | لا مستهلك. |
| `POST /locations/areas` | `create_area` | نموذج `Area` كامل ← صف محفوظ | لا مستهلك؛ واجهة الإضافة غير موصولة. |
| `GET /locations/areas` | `get_areas` | بلا جسم ← قائمة `Area` | لا مستهلك. |
| `GET /routes/` | `get_routes` | مرشح `status` اختياري ← قائمة `Route` | لا مستهلك؛ قراءة إدارية مختلفة عن `/admin/routes`. |
| `PATCH /routes/{route_id}/status` | `update_route_status` | `new_status` معامل طلب ← `Route` | لا مستهلك؛ عقد مختلف عن واجهة التحديث الإدارية. |
| `GET /routes/demands` | `get_route_demands` | مرشح `status` اختياري ← قائمة `RouteDemand` | لا مستهلك؛ سجلات فردية لا تجميع. |
| `GET /reports/` | `get_reports` | مرشح `status` اختياري ← قائمة `Report` | لا مستهلك؛ صفوف خام. |
| `GET /reports/{report_id}` | `get_report_details` | معرّف ← `Report` | لا مستهلك؛ للمدير فقط. |
| `PATCH /reports/{report_id}/status` | `update_report_status` | `new_status`, و`admin_id` معاملات طلب ← `Report` | لا مستهلك؛ يقبل `admin_id` من العميل بدل اشتقاقه من الرمز. |

## اختلافات العقود ونقاط النقص

1. `POST /auth/student-login` لا يعيد رمزًا؛ لا يمكن استخدامه لإثبات ملكية طلب أو بلاغ طالب.
2. `GET /auth/driver-me` يعيد الاسم والبريد والموافقة فقط؛ صفحة السائق لا تستطيع ملء المركبة أو حالة الحساب من مصدر موثوق.
3. `POST /admin/routes` مخصص للمدير ويخزن أربعة حقول فقط؛ واجهة السائق تتطلب أوقاتًا وسعرًا وتوقفات وملاحظات ومعرّفات معيارية.
4. `GET /admin/routes` يعيد أسماء مواقع وعددًا محسوبًا، بلا معرّفات موقع أو وقت، فلا يكفي لقائمة مسارات سائق قابلة للتعديل.
5. `GET /admin/route-demand` يعد سجلات الطلب النشط، لا طلابًا فريدين بالضرورة؛ لا وقت مفضل في المجموعة. لا يجوز تسميته حجوزات.
6. `GET /admin/students` يعيد الهاتف `null`، و`GET /admin/reports` لا يعيد هاتف صاحب البلاغ أو ردًا عامًا.
7. `notes` في تحديث حالات المسار والسائق والطالب والبلاغ لا تُحفظ، رغم قبولها في أجسام الإدارة.
8. حالات الطالب التجريبية أوسع من حالات قاعدة البيانات، و`status=approved` في ملف السائق النصي ليس قيمة `ApplicationStatus` الخام. يلزم تحويل صريح عند الربط.
9. موجهات `/drivers`, و`/routes`, و`/reports`, و`/locations` المكررة تملك أشكال طلب/استجابة مختلفة وتحتاج قرار توحيد قبل اعتمادها كمصدر واجهة.

## واجهات مقترحة غير موجودة بعد

هذه أسماء عمل للتخطيط فقط؛ لا يرسل إليها أي جزء من الواجهة الحالية طلبًا:

| الدور | العقد المقترح | شرط التنفيذ |
| --- | --- | --- |
| طالب | `POST /student/register`, و`GET /student/me` | هوية طالب موثقة، ومعرّفات منطقة وجامعة. |
| طالب | `GET /student/routes`, و`GET /student/routes/{id}` | صفوف مسارات حية مع المقاعد والوقت والسعر. |
| طالب | `POST /student/requests`, و`GET /student/requests` | منع التكرار وملكية الطلب. |
| طالب | `POST /student/waitlist`, و`GET /student/waitlist` | توحيد مع `routedemand` وإزالة التكرار. |
| سائق | `GET/POST /driver/routes`, و`PATCH /driver/routes/{id}` | اشتقاق مالك المسار من الرمز وفحص السعة. |
| سائق | `GET /driver/requests`, و`POST /driver/requests/{id}/decision` | قرار ذري مع التسجيل والمقاعد. |
| سائق | `GET /driver/students`, و`GET /driver/route-demand`, و`GET /driver/me` | قوائم مملوكة وبيانات دنيا مناسبة للدور. |
| طالب وسائق | `GET/POST /{role}/reports`, و`GET /{role}/reports/{id}` | ملكية البلاغ ورد عام دون ملاحظات الإدارة. |

أخطاء العقد المقترحة: `401` عند غياب الجلسة، و`403` عند دور غير مخول، و`404` للعنصر غير المملوك أو غير الموجود بحسب سياسة عدم كشف الوجود، و`409` للنسخة القديمة أو السعة الممتلئة أو الطلب المكرر، و`422` للمدخلات. يجب تحديد الترقيم والتوقيتات بوضوح؛ لا توجد صفحات ترقيم خادمية للواجهات الإدارية الحالية.
