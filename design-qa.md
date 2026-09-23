# Student Dashboard Design QA

- Visual direction: Journey Rail
- Desktop viewport: passed
- Mobile viewport at 390 x 844: passed
- Personal registration data: passed
- Primary route search: passed
- Loading and route match states: passed
- Seat request confirmation: passed
- Route demand alternative: passed
- Profile and logout access: passed
- Reduced motion fallback: passed
- Browser console errors: none
- Daro integration: intentionally deferred by user
- Interactive pet initial wave: passed
- Wave to idle transition: passed
- Click and keyboard wave: passed
- Repeated-click guard: passed
- Desktop placement: passed
- Mobile placement at 390 x 844: passed
- Horizontal overflow: none
- Pet browser console errors: none
- Pet scope limited to student dashboard: passed
- Pointer and touch drag architecture: passed
- Drag remains inside viewport: passed
- Drag does not trigger wave: passed
- Desktop and mobile positions stored separately: passed
- Welcome message during wave: passed
- Interactive street map: passed
- Student area and university map markers: passed
- Route line and responsive map controls: passed
- Map browser console errors: none
- Multiple matching routes and sorting: passed
- Route details dialog: passed
- Duplicate request prevention: passed
- Request timelines and status actions: passed
- Waitlist and new-match states: passed
- Notification drawer and mark-all-read: passed
- Driver message distinction: passed
- Confirmed upcoming ride: passed
- Contextual Daro reactions: passed

## Notes

The dashboard journey card uses an interactive OpenStreetMap layer. It resolves the saved area and university when available, draws a driving route, and falls back to a governorate-level preview when a location cannot be resolved.

The shared pet component uses the supplied idle and wave sprite sheets. Sprite movement and future viewport movement are separated so more states can be added without restructuring the page.

final result: passed
