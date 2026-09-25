from enum import Enum
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint

class UserRole(str, Enum):
    
    ADMIN = "Admin"
    STUDENT = "Student"
    DRIVER = "Driver"

class Status(str, Enum):

    ACTIVE = "Active"
    SUSPENDED = "Suspended"
    PENDING = "Pending"

class UniversityStatus(str, Enum):

    ACTIVE = "Active"
    DISABLED = "Disabled"

class ApplicationStatus(str, Enum):

    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"

class RouteStatus(str, Enum):

    ACTIVE = "Active"
    DISABLED = "Disabled"
    FULL = "Full"

class RouteStudentStatus(str, Enum):

    ACTIVE = "Active"
    CANCELLED = "Cancelled"

class RouteDemandStatus(str, Enum):

    ACTIVE = "Active"
    FULFILLED = "Fulfilled"
    CANCELLED = "Cancelled"

class ReportStatus(str, Enum):

    PENDING = "Pending"
    INVESTIGATING = "Investigating"
    RESOLVED = "Resolved"
    DISMISSED = "Dismissed"

class User(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: UserRole
    status: Status = Field(default=Status.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class University(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    University_name: str = Field(index=True, unique=True)
    governorate: Optional[str] = Field(default=None, index=True)
    status: UniversityStatus = Field(default=UniversityStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Area(SQLModel, table=True):

    __table_args__ = (UniqueConstraint("Area_name", "city", name="uq_area_name_city"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    Area_name: str = Field(index=True)
    city: str = Field(index=True)
    status: UniversityStatus = Field(default=UniversityStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Driver_Profile(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    Driver_id: int = Field(foreign_key="user.id")
    phone_number: str = Field(index=True, unique=True)
    vehicle_name: str
    vehicle_model: str
    vehicle_plate: str
    license_number: str = Field(index=True, unique=True)
    national_id: str = Field(index=True, unique=True)
    vehicle_photo_url: str
    license_photo_url: str
    id_photo_url: str
    verification_status: ApplicationStatus = Field(default=ApplicationStatus.PENDING)
    rejection_reason: Optional[str] = Field(default=None)
    reviewed_by: Optional[int] = Field(default=None, foreign_key="user.id")
    reviewed_at: Optional[datetime] = Field(default=None)

class Route(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(foreign_key="user.id")
    from_area_id: int = Field(foreign_key="area.id")
    to_university_id: int = Field(foreign_key="university.id")
    capacity: int
    status: RouteStatus = Field(default=RouteStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteStudents(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    route_id: int = Field(foreign_key="route.id")
    status: RouteStudentStatus = Field(default=RouteStudentStatus.ACTIVE)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteDemand(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    from_area_id: int = Field(foreign_key="area.id")
    to_university_id: int = Field(foreign_key="university.id")
    preferred_time: Optional[datetime] = Field(default=None)
    status: RouteDemandStatus = Field(default=RouteDemandStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Report(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="user.id")
    target_id: int = Field(foreign_key="user.id")
    target_type: UserRole
    reason: str
    status: ReportStatus = Field(default=ReportStatus.PENDING) # <-- تم التصحيح هنا
    resolved_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
