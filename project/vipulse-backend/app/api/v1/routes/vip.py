"""
VIP employee management routes.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, EmailStr, Field

from app.api.v1.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.ticket import VIPLevel
from app.models.user import User, UserRole
from app.utils.exceptions import ConflictException, NotFoundException
from app.utils.response import success_response

router = APIRouter(prefix="/vip", tags=["VIP Management"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmployeeCreateRequest(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: str = Field(..., min_length=1, max_length=100)
    department: str = Field(..., min_length=1, max_length=100)
    vip_level: VIPLevel = VIPLevel.STANDARD
    vip_score_override: Optional[float] = Field(None, ge=0, le=100)


class EmployeeUpdateRequest(BaseModel):
    vip_level: Optional[VIPLevel] = None
    vip_score_override: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class EmployeeResponse(BaseModel):
    employee_id: str
    name: str
    email: str
    role: str
    department: str
    vip_level: VIPLevel
    vip_score_override: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── GET /vip/employees ────────────────────────────────────────────────────────

@router.get("/employees")
async def list_vip_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    vip_level: Optional[VIPLevel] = Query(None, description="Filter by VIP level"),
    current_user: User = Depends(get_current_user),
):
    """Return all non-STANDARD employees, optionally filtered by VIP level."""
    query: dict = {"vip_level": {"$ne": VIPLevel.STANDARD.value}}
    if vip_level:
        query = {"vip_level": vip_level.value}

    skip = (page - 1) * page_size
    employees = await Employee.find(query).skip(skip).limit(page_size).to_list()
    total = await Employee.find(query).count()

    return success_response(
        data={
            "employees": [EmployeeResponse.model_validate(e.model_dump()).model_dump() for e in employees],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


# ── GET /vip/employees/{employee_id} ─────────────────────────────────────────

@router.get("/employees/{employee_id}")
async def get_vip_employee(
    employee_id: str,
    current_user: User = Depends(get_current_user),
):
    employee = await Employee.find_one(Employee.employee_id == employee_id)
    if not employee:
        raise NotFoundException("Employee", employee_id)
    return success_response(
        data=EmployeeResponse.model_validate(employee.model_dump()).model_dump()
    )


# ── POST /vip/employees ───────────────────────────────────────────────────────

@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_vip_employee(
    payload: EmployeeCreateRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    """Register a new VIP employee. Requires ADMIN or MANAGER role."""
    existing = await Employee.find_one(Employee.employee_id == payload.employee_id)
    if existing:
        raise ConflictException("Employee", "employee_id", payload.employee_id)

    existing_email = await Employee.find_one(Employee.email == payload.email)
    if existing_email:
        raise ConflictException("Employee", "email", payload.email)

    employee = Employee(
        employee_id=payload.employee_id,
        name=payload.name,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        vip_level=payload.vip_level,
        vip_score_override=payload.vip_score_override,
    )
    await employee.insert()

    return success_response(
        data=EmployeeResponse.model_validate(employee.model_dump()).model_dump(),
        message="VIP employee registered successfully.",
    )


# ── PATCH /vip/employees/{employee_id} ───────────────────────────────────────

@router.patch("/employees/{employee_id}")
async def update_vip_employee(
    employee_id: str,
    payload: EmployeeUpdateRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
):
    """Update VIP level, score override, or active status. Requires ADMIN or MANAGER."""
    employee = await Employee.find_one(Employee.employee_id == employee_id)
    if not employee:
        raise NotFoundException("Employee", employee_id)

    updates = payload.model_dump(exclude_none=True)
    if "vip_level" in updates and isinstance(updates["vip_level"], VIPLevel):
        updates["vip_level"] = updates["vip_level"].value
    updates["updated_at"] = datetime.now(timezone.utc)

    await employee.update({"$set": updates})

    # Reload
    updated = await Employee.find_one(Employee.employee_id == employee_id)
    return success_response(
        data=EmployeeResponse.model_validate(updated.model_dump()).model_dump(),
        message="VIP employee updated.",
    )


# ── DELETE /vip/employees/{employee_id} ──────────────────────────────────────

@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vip_employee(
    employee_id: str,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Permanently remove a VIP employee record. Requires ADMIN role."""
    employee = await Employee.find_one(Employee.employee_id == employee_id)
    if not employee:
        raise NotFoundException("Employee", employee_id)
    await employee.delete()
