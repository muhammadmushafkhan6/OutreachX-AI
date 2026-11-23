import csv
import json
import uuid
from pathlib import Path

from openpyxl import Workbook

from app.config import get_settings

settings = get_settings()


class ExportService:
    def __init__(self):
        self.exports_dir = Path(settings.exports_dir)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def export(
        self, 
        job_id: uuid.UUID, 
        fmt: str, 
        extracted: dict | None = None, 
        ai: dict | None = None,
        leads: list[dict] | None = None
    ) -> Path:
        filename = f"{job_id}.{fmt}"
        path = self.exports_dir / filename

        if leads:
            if fmt == "json":
                path.write_text(json.dumps(leads, indent=2, default=str), encoding="utf-8")
            elif fmt == "csv":
                self._write_maps_csv(path, leads)
            elif fmt == "xlsx":
                self._write_maps_xlsx(path, leads)
            return path

        data = {"extracted": extracted or {}, "ai_analysis": ai or {}}
        if fmt == "json":
            path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        elif fmt == "csv":
            self._write_csv(path, extracted, ai)
        elif fmt == "xlsx":
            self._write_xlsx(path, extracted, ai)
        else:
            raise ValueError(f"Unsupported format: {fmt}")

        return path

    def _write_maps_csv(self, path: Path, leads: list[dict]) -> None:
        if not leads: return
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=leads[0].keys())
            writer.writeheader()
            writer.writerows(leads)

    def _write_maps_xlsx(self, path: Path, leads: list[dict]) -> None:
        if not leads: return
        wb = Workbook()
        ws = wb.active
        ws.title = "Leads"
        keys = list(leads[0].keys())
        for c, k in enumerate(keys, 1):
            ws.cell(row=1, column=c, value=k)
        for r, lead in enumerate(leads, 2):
            for c, k in enumerate(keys, 1):
                ws.cell(row=r, column=c, value=str(lead.get(k, "")))
        wb.save(path)

    def _write_csv(self, path: Path, extracted: dict | None, ai: dict | None) -> None:
        rows = []
        if extracted:
            rows.append({**{f"ext_{k}": v for k, v in extracted.items()}})
        if ai:
            rows.append({**{f"ai_{k}": v for k, v in ai.items()}})
        if not rows:
            rows = [{}]
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def _write_xlsx(self, path: Path, extracted: dict | None, ai: dict | None) -> None:
        wb = Workbook()
        ws = wb.active
        ws.title = "Results"
        row = 1
        for section, data in [("Extracted", extracted), ("AI", ai)]:
            if not data:
                continue
            ws.cell(row=row, column=1, value=section)
            row += 1
            for k, v in data.items():
                ws.cell(row=row, column=1, value=str(k))
                ws.cell(row=row, column=2, value=str(v))
                row += 1
        wb.save(path)
