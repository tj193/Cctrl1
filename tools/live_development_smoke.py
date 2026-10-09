"""Focused, idempotent live API smoke on the approved synthetic development data."""

import json
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
PASSWORDS = json.loads((ROOT / ".artifacts" / "demo-credentials.json").read_text(encoding="utf-8"))
BASE = "http://127.0.0.1:8001"


def expect(response, status=200):
    if response.status_code != status:
        raise RuntimeError(f"Unexpected API status {response.status_code}; expected {status}")
    return response.json()


def login(client, path, email, role):
    result = expect(client.post(path, data={"username": email, "password": PASSWORDS[role]}))
    return {"Authorization": f"Bearer {result['access_token']}"}


def main():
    checks = []
    with httpx.Client(base_url=BASE, timeout=30) as client:
        expect(client.get("/health"))
        checks.append("health")
        admin = login(client, "/auth/login", "phase43-admin-01@example.test", "Admin")
        driver = login(client, "/auth/driver-login", "phase43-driver-01@example.test", "Driver")
        student = login(client, "/auth/student-login", "phase43-student-03@example.test", "Student")
        checks.append("three_role_login")
        expect(client.get("/student/routes", headers={"Authorization": "Bearer invalid"}), 401)
        expect(client.get("/admin/routes", headers=student), 401)
        checks.append("invalid_token_and_role_guard")

        applications = expect(client.get("/admin/driver-applications", headers=admin))
        pending_driver = next(row for row in applications if row["full_name"] == "Demo Driver 04")
        pending_response = client.post("/auth/driver-login", data={
            "username": "phase43-driver-04@example.test", "password": PASSWORDS["Driver"]
        })
        if pending_driver["status"] == "Pending":
            expect(pending_response, 403)
            expect(client.patch(f"/admin/driver-applications/{pending_driver['id']}/status",
                                headers=admin, json={"status": "approved", "notes": ""}))
        else:
            assert pending_driver["status"] == "Approved"
        login(client, "/auth/driver-login", "phase43-driver-04@example.test", "Driver")
        expect(client.post("/auth/driver-login", data={
            "username": "phase43-driver-05@example.test", "password": PASSWORDS["Driver"]
        }), 403)
        checks.append("admin_approval_and_suspended_driver")

        routes = expect(client.get("/driver/routes", headers=driver))
        route = next(row for row in routes if row["origin_area"] == "المنصور")
        route_id = route["id"]
        before = route["occupied_seats"]
        requests = expect(client.get("/driver/ride-requests", headers=driver))
        request = next(row for row in requests if row["route_id"] == route_id and row["student_name"] == "Demo Student 03")
        if request["status"] == "Pending":
            expect(client.post(f"/driver/ride-requests/{request['id']}/accept", headers=driver))
            expected_occupied = before + 1
        else:
            assert request["status"] == "Accepted"
            expected_occupied = before
        after = expect(client.get(f"/driver/routes/{route_id}", headers=driver))
        assert after["occupied_seats"] == expected_occupied
        assert after["available_seats"] == after["capacity"] - expected_occupied
        student_requests = expect(client.get("/student/ride-requests", headers=student))
        assert any(row["id"] == request["id"] and row["status"] == "Accepted" for row in student_requests)
        student_route = expect(client.get(f"/student/routes/{route_id}", headers=student))
        assert student_route["occupied_seats"] == expected_occupied
        admin_route = next(row for row in expect(client.get("/admin/routes", headers=admin)) if row["id"] == route_id)
        assert admin_route["occupied_seats"] == expected_occupied
        checks.append("driver_acceptance_and_cross_role_seats")

        full_route = next(row for row in routes if row["capacity"] == 2)
        assert full_route["available_seats"] == 0
        expect(client.post("/student/ride-requests", headers=student,
                           json={"route_id": full_route["id"]}), 409)
        checks.append("full_route_rejection")
        report_owner = login(client, "/auth/student-login", "phase43-student-01@example.test", "Student")
        reports = expect(client.get("/student/reports", headers=report_owner))
        assert reports and "internal_notes" not in reports[0]
        checks.append("report_owner_privacy")
    print(json.dumps({"checks_passed": checks, "count": len(checks)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never print response bodies, credentials, or authorization headers.
        print(f"Live smoke stopped: {type(error).__name__}")
        raise SystemExit(1) from None
