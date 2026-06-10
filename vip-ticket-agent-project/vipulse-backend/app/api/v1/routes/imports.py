"""
Ticket import routes.

POST /tickets/import/excel  — bulk import from .xlsx/.xls/.csv
POST /tickets/import/pdf    — AI extraction from PDF / image
GET  /tickets/template      — download sample Excel template
"""
import io
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from fastapi.responses import Response, StreamingResponse

from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.services.import_service import (
    generate_sample_excel,
    import_excel_tickets,
    parse_pdf_or_image,
    create_pdf_tickets,
)
from app.utils.response import success_response

router = APIRouter(prefix="/tickets", tags=["Ticket Import"])
logger = structlog.get_logger(__name__)

# ── Limits ────────────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB

ALLOWED_EXCEL_MIME = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.ms-excel",                                           # xls
    "text/csv",
    "text/plain",                                                          # some CSV uploads
    "application/csv",
    "application/octet-stream",                                           # generic binary
}

ALLOWED_PDF_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/octet-stream",
}

ALLOWED_EXCEL_EXT = {".xlsx", ".xls", ".csv"}
ALLOWED_PDF_EXT   = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def _validate_file(
    file: UploadFile,
    allowed_mime: set[str],
    allowed_ext: set[str],
    max_bytes: int,
) -> None:
    """Validate file MIME type, extension, and size. Raises HTTPException on failure."""
    filename = (file.filename or "").lower()
    ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""

    if ext not in allowed_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(allowed_ext))}",
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in allowed_mime:
        # Soft-warn for octet-stream mismatches but don't block
        logger.warning("unexpected_mime_type", mime=content_type, file=filename)


# ── GET /tickets/template ─────────────────────────────────────────────────────

@router.get("/template")
async def download_template(
    current_user: User = Depends(get_current_user),
):
    """
    Download a sample Excel template with correct column headers
    and 3 example rows.
    """
    try:
        xlsx_bytes = generate_sample_excel()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="vipulse_ticket_template.xlsx"',
            "Content-Length": str(len(xlsx_bytes)),
        },
    )


# ── POST /tickets/import/excel ────────────────────────────────────────────────

@router.post("/import/excel")
async def import_excel(
    file: Annotated[UploadFile, File(description="Excel or CSV file (.xlsx, .xls, .csv)")],
    current_user: User = Depends(get_current_user),
):
    """
    Bulk import tickets from an Excel/CSV file.

    Rules:
    - Max file size: 10 MB
    - Max rows: 1,000
    - Required columns: employee_id, employee_name, role, department,
                        issue_title, issue_description, severity
    - Severity must be: low | medium | high | critical (case-insensitive)
    - Invalid rows are reported but don't stop the import

    Returns a summary: { total_rows, created, failed, errors[], ticket_ids[] }
    """
    _validate_file(file, ALLOWED_EXCEL_MIME, ALLOWED_EXCEL_EXT, MAX_UPLOAD_BYTES)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
        )

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = file.filename or "upload.xlsx"
    logger.info("excel_import_start", user=current_user.user_id, file=filename, size=len(file_bytes))

    try:
        result = await import_excel_tickets(
            file_bytes=file_bytes,
            filename=filename,
            created_by=current_user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("excel_import_error", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import failed: {exc}")

    logger.info(
        "excel_import_complete",
        user=current_user.user_id,
        total=result.total_rows,
        created=result.created,
        failed=result.failed,
    )

    return success_response(
        data=result.to_dict(),
        message=f"{result.created} ticket(s) imported successfully.",
    )


# ── POST /tickets/import/pdf ──────────────────────────────────────────────────

@router.post("/import/pdf")
async def import_pdf(
    file: Annotated[UploadFile, File(description="PDF or image file")],
    employee_id: Annotated[str, Form()] = "",
    create_immediately: Annotated[bool, Form()] = False,
    current_user: User = Depends(get_current_user),
):
    """
    Extract ticket data from a PDF or image using AI (Groq LLM).

    Workflow:
    1. Text is extracted from the PDF/image.
    2. Groq LLM parses structured ticket fields from the text.
    3. Returns extracted ticket(s) for preview.

    If `create_immediately=true`, tickets are created without preview.
    Set `employee_id` to associate extracted tickets with a specific employee.

    Returns extracted ticket data for user review, or creation summary if immediate.
    """
    _validate_file(file, ALLOWED_PDF_MIME, ALLOWED_PDF_EXT, MAX_UPLOAD_BYTES)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.",
        )

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename  = file.filename or "upload.pdf"
    mime_type = (file.content_type or "application/pdf").split(";")[0].strip()

    logger.info("pdf_import_start", user=current_user.user_id, file=filename, size=len(file_bytes))

    try:
        extracted, raw_text = await parse_pdf_or_image(file_bytes, filename, mime_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("pdf_import_error", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {exc}")

    if not extracted:
        return success_response(
            data={
                "extracted":      [],
                "total_extracted": 0,
                "raw_text_preview": raw_text[:500] if raw_text else "",
                "message": "No ticket-worthy content found in the document.",
            }
        )

    # If immediate creation requested, create now
    if create_immediately:
        result = await create_pdf_tickets(
            extracted_tickets=extracted,
            employee_id=employee_id,
            created_by=current_user.user_id,
        )
        logger.info(
            "pdf_import_complete",
            user=current_user.user_id,
            created=result.created,
            failed=result.failed,
        )
        return success_response(
            data={
                **result.to_dict(),
                "extracted": extracted,
            },
            message=f"{result.created} ticket(s) created from PDF.",
        )

    # Otherwise return for preview
    return success_response(
        data={
            "extracted":          extracted,
            "total_extracted":    len(extracted),
            "raw_text_preview":   raw_text[:500] if raw_text else "",
        },
        message=f"Extracted {len(extracted)} ticket(s) from document. Review and confirm.",
    )


# ── POST /tickets/import/pdf/confirm ─────────────────────────────────────────

from pydantic import BaseModel
from typing import List, Any

class PdfConfirmRequest(BaseModel):
    employee_id: str = ""
    tickets: List[dict[str, Any]]


@router.post("/import/pdf/confirm")
async def confirm_pdf_import(
    payload: PdfConfirmRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create tickets from a previewed PDF extraction.
    Accepts the (possibly edited) ticket list from the frontend.
    """
    if not payload.tickets:
        raise HTTPException(status_code=400, detail="No tickets provided.")

    if len(payload.tickets) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 tickets per PDF import.")

    result = await create_pdf_tickets(
        extracted_tickets=payload.tickets,
        employee_id=payload.employee_id,
        created_by=current_user.user_id,
    )

    return success_response(
        data=result.to_dict(),
        message=f"{result.created} ticket(s) created successfully.",
    )
