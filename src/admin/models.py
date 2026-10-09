from enum import Enum
from datetime import datetime, time, timezone
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import CheckConstraint, Column, DateTime, Enum as SAEnum, Index, Integer, String, Text, Time, UniqueConstraint, func, text

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

class RideRequestStatus(str, Enum):

    PENDING = "Pending"
    ACCEPTED = "Accepted"
    DECLINED = "Declined"

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

    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_route_capacity_positive"),
        CheckConstraint("price_iqd >= 0", name="ck_route_price_iqd_nonnegative"),
        Index("ix_route_driver_status", "driver_id", "status"),
        Index("ix_route_origin_university_status", "from_area_id", "to_university_id", "status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(foreign_key="user.id")
    from_area_id: int = Field(foreign_key="area.id")
    to_university_id: int = Field(foreign_key="university.id")
    capacity: int
    status: RouteStatus = Field(default=RouteStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    departure_time: Optional[time] = Field(default=None, sa_column=Column(Time(), nullable=True))
    return_time: Optional[time] = Field(default=None, sa_column=Column(Time(), nullable=True))
    price_iqd: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text(), nullable=True))

class StudentProfile(SQLModel, table=True):

    __tablename__ = "student_profile"
    __table_args__ = (
        Index("ix_student_profile_area_university", "area_id", "university_id"),
    )

    user_id: int = Field(primary_key=True, foreign_key="user.id")
    phone: Optional[str] = Field(default=None)
    area_id: Optional[int] = Field(default=None, foreign_key="area.id")
    university_id: Optional[int] = Field(default=None, foreign_key="university.id")
    preferred_arrival_time: Optional[time] = Field(
        default=None, sa_column=Column(Time(), nullable=True)
    )

class RouteStudents(SQLModel, table=True):

    __table_args__ = (
        Index("uq_routestudents_active_student_route", "student_id", "route_id", unique=True,
              postgresql_where=text("status = 'ACTIVE'::routestudentstatus"),
              sqlite_where=text("status = 'ACTIVE'")),
        Index("ix_routestudents_route_status", "route_id", "status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    route_id: int = Field(foreign_key="route.id")
    status: RouteStudentStatus = Field(default=RouteStudentStatus.ACTIVE)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RideRequest(SQLModel, table=True):

    __tablename__ = "ride_request"
    __table_args__ = (
        Index("uq_ride_request_pending_student_route", "student_id", "route_id", unique=True,
              postgresql_where=text("status = 'PENDING'::riderequeststatus"),
              sqlite_where=text("status = 'PENDING'")),
        Index("ix_ride_request_route_status_created_at", "route_id", "status", "created_at"),
        CheckConstraint("version > 0", name="ck_ride_request_version_positive"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    route_id: int = Field(foreign_key="route.id")
    status: RideRequestStatus = Field(
        default=RideRequestStatus.PENDING,
        sa_column=Column(SAEnum(RideRequestStatus, name="riderequeststatus"), nullable=False,
                         server_default=text("'PENDING'")),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now()),
    )
    decided_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    decided_by: Optional[int] = Field(default=None, foreign_key="user.id")
    version: int = Field(default=1, sa_column=Column(Integer, nullable=False, server_default=text("1")))

class RouteDemand(SQLModel, table=True):

    __table_args__ = (
        Index("uq_routedemand_active_student_journey", "student_id", "from_area_id",
              "to_university_id", unique=True,
              postgresql_where=text("status = 'ACTIVE'::routedemandstatus"),
              sqlite_where=text("status = 'ACTIVE'")),
        Index("ix_routedemand_origin_university_status", "from_area_id",
              "to_university_id", "status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id")
    from_area_id: int = Field(foreign_key="area.id")
    to_university_id: int = Field(foreign_key="university.id")
    preferred_time: Optional[datetime] = Field(default=None)
    status: RouteDemandStatus = Field(default=RouteDemandStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Report(SQLModel, table=True):

    __table_args__ = (
        Index("ix_report_reporter_created_at", "report_id", "created_at"),
        Index("ix_report_status_created_at", "status", "created_at"),
        Index("ix_report_related_route_id", "related_route_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(foreign_key="user.id")
    target_id: Optional[int] = Field(default=None, foreign_key="user.id")
    target_type: Optional[UserRole] = Field(default=None)
    reason: Optional[str] = Field(default=None)
    status: ReportStatus = Field(default=ReportStatus.PENDING)
    resolved_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    type: Optional[str] = Field(default=None, sa_column=Column(String(32), nullable=True))
    subject: Optional[str] = Field(default=None, sa_column=Column(String(120), nullable=True))
    description: Optional[str] = Field(default=None, sa_column=Column(Text(), nullable=True))
    public_resolution: Optional[str] = Field(default=None, sa_column=Column(Text(), nullable=True))
    internal_notes: Optional[str] = Field(default=None, sa_column=Column(Text(), nullable=True))
    related_route_id: Optional[int] = Field(default=None, foreign_key="route.id")
    updated_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    resolved_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
