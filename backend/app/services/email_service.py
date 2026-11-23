import logging
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import List, Dict, Any, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    def __init__(self):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.username = settings.smtp_username
        self.password = settings.smtp_password
        self.use_tls = settings.smtp_use_tls
        self.from_email = settings.smtp_from_email
        self.from_name = settings.smtp_from_name

    def is_configured(self) -> bool:
        return all([
            self.host,
            self.username,
            self.password,
            self.from_email,
        ])

    def _send_sync(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise Exception("SMTP is not configured. Please set SMTP_* variables in .env")

        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((self.from_name or "", self.from_email))
        msg["To"] = to_email
        msg["Subject"] = subject

        if reply_to:
            msg["Reply-To"] = reply_to
        if cc:
            msg["Cc"] = ", ".join(cc)
        if bcc:
            msg["Bcc"] = ", ".join(bcc)

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        recipients = [to_email]
        if cc:
            recipients.extend(cc)
        if bcc:
            recipients.extend(bcc)

        try:
            if self.use_tls:
                server = smtplib.SMTP(self.host, self.port, timeout=30)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=30)

            server.login(self.username, self.password)
            server.sendmail(self.from_email, recipients, msg.as_string())
            server.quit()

            return {
                "success": True,
                "to": to_email,
                "subject": subject,
                "from": self.from_email,
            }
        except Exception as e:
            logger.error("Email send failed to %s: %s", to_email, e)
            raise e

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._send_sync(
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                reply_to=reply_to,
                cc=cc,
                bcc=bcc,
                attachments=attachments,
            ),
        )

    async def send_bulk(
        self,
        recipients: List[Dict[str, Any]],
        subject_template: str,
        html_template: str,
        personalize: bool = True,
        delay_seconds: float = 1.0,
    ) -> List[Dict[str, Any]]:
        results = []
        for i, rec in enumerate(recipients):
            try:
                email = rec.get("email")
                if not email:
                    results.append({"success": False, "error": "no_email", "recipient": rec})
                    continue

                subject = subject_template
                html_body = html_template
                if personalize:
                    for key, value in rec.items():
                        if isinstance(value, str):
                            placeholder = "{{" + key + "}}"
                            subject = subject.replace(placeholder, value)
                            html_body = html_body.replace(placeholder, value)

                result = await self.send_email(
                    to_email=email,
                    subject=subject,
                    html_body=html_body,
                )
                results.append({**result, "recipient_index": i})
            except Exception as e:
                results.append({
                    "success": False,
                    "error": str(e),
                    "recipient_index": i,
                    "recipient": rec,
                })
            if delay_seconds > 0 and i < len(recipients) - 1:
                await asyncio.sleep(delay_seconds)
        return results

    async def test_connection(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "configured": False,
                "success": False,
                "message": "SMTP settings not configured in .env",
            }
        try:
            loop = asyncio.get_running_loop()

            def _test():
                if self.use_tls:
                    server = smtplib.SMTP(self.host, self.port, timeout=15)
                    server.starttls()
                else:
                    server = smtplib.SMTP_SSL(self.host, self.port, timeout=15)
                server.login(self.username, self.password)
                server.quit()
                return True

            await loop.run_in_executor(None, _test)
            return {
                "configured": True,
                "success": True,
                "message": "SMTP connection successful",
                "from": self.from_email,
            }
        except Exception as e:
            return {
                "configured": True,
                "success": False,
                "message": f"SMTP connection failed: {str(e)}",
            }
