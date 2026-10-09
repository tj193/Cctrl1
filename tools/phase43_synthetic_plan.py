"""Deterministic, offline synthetic fixture plan. Never connects or writes."""

import json


def build_plan() -> dict:
    accounts = [
        {"key": "phase43-admin-01", "email": "phase43-admin-01@example.test", "role": "Admin", "status": "Active"},
        *({"key": f"phase43-driver-{i:02d}", "email": f"phase43-driver-{i:02d}@example.test",
           "role": "Driver", "status": "Suspended" if i == 5 else "Active",
           "approval": "Pending" if i == 4 else "Approved"}
          for i in range(1, 6)),
        *({"key": f"phase43-student-{i:02d}", "email": f"phase43-student-{i:02d}@example.test",
           "role": "Student", "status": "Active"}
          for i in range(1, 13)),
    ]
    return {
        "label": "SYNTHETIC OFFLINE PLAN - NOT DATABASE ROWS",
        "accounts": accounts,
        "driver_profile_policy": "Use non-dialable placeholders only; no real phone or ID values",
        "password_policy": "Obtain a local secret at seed time and hash with existing backend helper; never store plaintext",
        "reference_policy": "Resolve verified active PostgreSQL area and university IDs before constructing routes",
        "planned_counts_if_reference_gate_passes": {
            "admin": 1, "driver": 5, "student": 12, "route": 4,
            "ride_request_pending": 3, "ride_request_accepted": 2,
            "ride_request_declined": 2, "active_enrollment": 2,
            "report": 3, "route_demand": 3,
        },
        "cleanup_key": "phase43-*@example.test",
        "blockers": ["No validated area import", "No restorable current development snapshot evidence",
                     "No separate Neon write approval", "No local PostgreSQL test database"],
    }


if __name__ == "__main__":
    print(json.dumps(build_plan(), ensure_ascii=False, indent=2))
