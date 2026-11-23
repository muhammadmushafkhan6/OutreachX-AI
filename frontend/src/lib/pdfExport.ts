import type { MapLead } from "@/types";

interface ExportPDFOptions {
  leads: MapLead[];
  title?: string;
  category?: string;
  city?: string;
  country?: string;
  type?: "all" | "emails" | "phones";
}

/**
 * Exports a list of leads as an executive, sales-ready PDF sheet.
 * Uses dynamic import so Vite does not suffer from stale optimize-dep issues.
 */
export async function exportLeadsToPDF({
  leads,
  title,
  category = "All Categories",
  city = "Unknown City",
  country = "",
  type = "all",
}: ExportPDFOptions) {
  if (!leads || leads.length === 0) return;

  try {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const autoTable =
      (autoTableModule as any).default ||
      (autoTableModule as any).autoTable ||
      autoTableModule;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Metrics summary
    const totalLeads = leads.length;
    const withPhone = leads.filter((l) => Boolean(l.phone || l.whatsapp)).length;
    const withEmail = leads.filter((l) => Boolean(l.email || (l.emails && l.emails.length > 0))).length;
    const highPriority = leads.filter((l) => (l.lead_score || "").toUpperCase() === "HIGH").length;

    // Header Banner (Top Slate Bar)
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 28, "F");

    // Emerald Accent Line
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 27, pageWidth, 1.5, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    const mainTitle =
      title ||
      (type === "emails"
        ? "VERIFIED EMAIL LEADS DIRECTORY"
        : type === "phones"
        ? "COLD CALLING SALES DIRECTORY"
        : "TARGETED B2B LEADS & OPPORTUNITIES SHEET");
    doc.text(mainTitle, 14, 12);

    // Subtitle / Scope
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate-400
    const locationText = [city, country].filter(Boolean).join(", ");
    const queryInfo = `Niche: ${category}${locationText ? ` | Territory: ${locationText}` : ""} | Generated: ${new Date().toLocaleString()}`;
    doc.text(queryInfo, 14, 19);

    // Badge on the right
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.roundedRect(pageWidth - 66, 6, 52, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(52, 211, 153); // Emerald-400
    doc.text("SALES TEAM DISPATCH", pageWidth - 40, 12, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.text("Confidential Prospect Sheet", pageWidth - 40, 18, { align: "center" });

    // Quick KPI Mini Badges
    const badgeY = 32;
    const metrics = [
      { label: "Total Leads", val: totalLeads.toString(), color: [241, 245, 249] },
      { label: "Phone Ready", val: withPhone.toString(), color: [236, 253, 245] },
      { label: "Verified Emails", val: withEmail.toString(), color: [239, 246, 255] },
      { label: "High Priority", val: highPriority.toString(), color: [254, 243, 199] },
    ];

    let currentX = 14;
    metrics.forEach((m) => {
      doc.setFillColor(m.color[0], m.color[1], m.color[2]);
      doc.roundedRect(currentX, badgeY, 34, 10, 1.5, 1.5, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), currentX + 3, badgeY + 4);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(m.val, currentX + 3, badgeY + 8.5);
      currentX += 37;
    });

    // Table Configuration based on type
    let head: string[][] = [];
    let body: (string | number)[][] = [];
    let colWidths: { [key: number]: number } = {};

    if (type === "emails") {
      head = [
        ["#", "Business Name", "Verified Email", "Phone / WhatsApp", "Website", "Rating", "Recommended Pitch", "Sales Notes"],
      ];
      body = leads.map((l, idx) => {
        const email = l.email || (l.emails && l.emails.length > 0 ? l.emails.join(", ") : "N/A");
        const phone = l.phone || l.whatsapp || "N/A";
        const website = l.website ? l.website : "No Website";
        const rating = l.rating ? `${l.rating} ★ (${l.reviews || 0})` : "N/A";
        const opp = l.recommended_service || "Cold Email Outreach";
        return [idx + 1, l.business_name || "Unknown", email, phone, website, rating, opp, ""];
      });

      colWidths = {
        0: 8,
        1: 46,
        2: 50,
        3: 32,
        4: 36,
        5: 22,
        6: 45,
        7: 30,
      };
    } else if (type === "phones") {
      head = [
        ["#", "Business Name", "Phone Number", "WhatsApp", "Call Status", "Website", "Opportunity", "Call Notes / Outcome"],
      ];
      body = leads.map((l, idx) => {
        const phone = l.phone || "N/A";
        const wa = l.whatsapp || (l.phone ? "Available" : "N/A");
        const website = l.website ? l.website : "No Website";
        const opp = l.recommended_service || "Cold Call Offer";
        return [
          idx + 1,
          l.business_name || "Unknown",
          phone,
          wa,
          "[ ] Connected\n[ ] Voicemail\n[ ] Follow-up",
          website,
          opp,
          "",
        ];
      });

      colWidths = {
        0: 8,
        1: 48,
        2: 36,
        3: 26,
        4: 28,
        5: 35,
        6: 44,
        7: 44,
      };
    } else {
      // "all" leads sheet
      head = [
        ["#", "Business & Address", "Rating", "Contact (Phone / Email)", "Website", "Lead Score", "Opportunity / Pitch", "Sales Notes"],
      ];
      body = leads.map((l, idx) => {
        const bizName = l.business_name || "Unknown";
        const address = l.address ? `\n${l.address}` : "";
        const bizCell = `${bizName}${address}`;

        const rating = l.rating ? `${l.rating} ★ (${l.reviews || 0})` : "N/A";

        const phone = l.phone || l.whatsapp || "";
        const email = l.email || (l.emails && l.emails[0]) || "";
        const contactArr = [phone ? `Tel: ${phone}` : null, email ? `Email: ${email}` : null].filter(Boolean);
        const contactCell = contactArr.length > 0 ? contactArr.join("\n") : "No Direct Contact";

        const website = l.website ? l.website : "No Website";
        const score = (l.lead_score || "HIGH").toUpperCase();
        const opp = l.recommended_service || "Website Development / Speed Optimization";

        return [idx + 1, bizCell, rating, contactCell, website, score, opp, ""];
      });

      colWidths = {
        0: 8,
        1: 54,
        2: 20,
        3: 46,
        4: 36,
        5: 22,
        6: 48,
        7: 35,
      };
    }

    // Draw Table with autoTable
    autoTable(doc, {
      head: head,
      body: body,
      startY: 45,
      margin: { top: 16, left: 14, right: 14, bottom: 16 },
      theme: "striped",
      showHead: "everyPage",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 3,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2.8,
        textColor: [30, 41, 59],
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: colWidths[0] },
        1: { cellWidth: colWidths[1] },
        2: { cellWidth: colWidths[2] },
        3: { cellWidth: colWidths[3] },
        4: { cellWidth: colWidths[4] },
        5: { cellWidth: colWidths[5] },
        6: { cellWidth: colWidths[6] },
        7: { cellWidth: colWidths[7] },
      },
      didParseCell: (data: any) => {
        if (type === "all" && data.section === "body" && data.column.index === 5) {
          const text = String(data.cell.raw).toUpperCase();
          if (text === "HIGH") {
            data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
            data.cell.styles.fontStyle = "bold";
          } else if (text === "MEDIUM") {
            data.cell.styles.textColor = [217, 119, 6]; // Amber-600
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body") {
          const cellRaw = String(data.cell.raw);
          if (cellRaw === "No Website") {
            data.cell.styles.textColor = [225, 29, 72]; // Rose-600
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: (data: any) => {
        const str = `Page ${data.pageNumber} • Confidential Sales Lead Sheet • Target: ${category} in ${locationText || "Region"}`;
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(str, pageWidth / 2, pageHeight - 8, { align: "center" });

        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      },
    });

    const safeCity = city.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeCat = category.replace(/[^a-zA-Z0-9_-]/g, "_");
    const prefix = type === "emails" ? "Email_Leads" : type === "phones" ? "Calling_Sheet" : "Sales_Leads";
    const filename = `${prefix}_${safeCity}_${safeCat}_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.save(filename);
    return true;
  } catch (err) {
    console.error("jsPDF generation error, using fallback print sheet:", err);
    printLeadsSheetHTML({ leads, category, city, country, type });
    return true;
  }
}

/**
 * Exports a single lead dossier / 1-page sales briefing PDF for an individual business.
 */
export async function exportSingleLeadDossierPDF(lead: MapLead) {
  if (!lead) return;

  try {
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Dark Banner
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 38, "F");

    // Emerald Accent Line
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.rect(0, 37, pageWidth, 1.5, "F");

    // Tag & Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(52, 211, 153); // Emerald-400
    doc.text("SALES INTELLIGENCE DOSSIER • CONFIDENTIAL", 16, 12);

    // Business Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(lead.business_name || "Target Prospect", 16, 21);

    // Category & Location
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    const subtitle = [lead.category, lead.address].filter(Boolean).join(" • ");
    doc.text(subtitle || "Verified Business Lead", 16, 28);

    // Score Pill on Banner
    const score = (lead.lead_score || "HIGH").toUpperCase();
    doc.setFillColor(score === "HIGH" ? 5 : 217, score === "HIGH" ? 150 : 119, score === "HIGH" ? 105 : 6);
    doc.roundedRect(pageWidth - 48, 14, 32, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${score} PRIORITY`, pageWidth - 32, 20.5, { align: "center" });

    let curY = 46;

    // Section 1: Contact Intelligence Grid
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Contact Intelligence", 16, curY);
    curY += 5;

    const contactItems = [
      { label: "Phone / Direct Line", val: lead.phone || lead.whatsapp || "No phone listed" },
      { label: "WhatsApp Status", val: lead.whatsapp ? "Available" : lead.phone ? "Possible" : "None" },
      { label: "Verified Email", val: lead.email || (lead.emails && lead.emails.join(", ")) || "No direct email (Phone Outreach Preferred)" },
      { label: "Website", val: lead.website || "NO WEBSITE (HIGH CONVERSION OPPORTUNITY)" },
      { label: "Google Rating", val: lead.rating ? `${lead.rating} / 5.0 Stars (${lead.reviews || 0} reviews)` : "Unrated" },
      { label: "Google Maps Link", val: lead.maps_url || "Search via Business Name" },
    ];

    contactItems.forEach((c) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(16, curY, pageWidth - 32, 9, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label.toUpperCase(), 20, curY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      if (c.val.includes("NO WEBSITE")) {
        doc.setTextColor(225, 29, 72); // Rose-600
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(c.val, 75, curY + 6);
      curY += 11;
    });

    curY += 4;

    // Section 2: AI Opportunity & Strategic Pitch Angle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("2. AI Recommended Pitch & Opportunity", 16, curY);
    curY += 6;

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(16, curY, pageWidth - 32, 28, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    const oppTitle = lead.recommended_service || (!lead.website ? "Complete Website Development + Local Booking Funnel" : "Website Modernization & Speed Optimization");
    doc.text(`Primary Pitch Angle: ${oppTitle}`, 20, curY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(4, 120, 87);
    const pitchAdvice = !lead.website
      ? "• Prospect is currently losing inbound local searches to competitors with websites.\n• Pitch: Modern fast-loading mobile site, Google Maps SEO rank booster, and WhatsApp instant booking widget.\n• Emphasize zero-friction setup and quick turnaround."
      : "• Prospect already has web presence but likely lacks automated lead capture, fast mobile performance, or AI integrations.\n• Pitch: Website speed optimization, AI automated chatbot / booking agent, and CRM lead capture.";
    doc.text(pitchAdvice, 20, curY + 13);

    curY += 34;

    // Section 3: Sales Rep Script / Cold Call Talking Points
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Sales Rep Call Framework", 16, curY);
    curY += 5;

    const scriptBoxText = [
      `Opener: "Hi, am I speaking with the owner or manager at ${lead.business_name || "the business"}?"`,
      `Hook: "I was looking at top-rated ${lead.category || "services"} in your area—congrats on the ${lead.rating || "5-star"} rating!"`,
      `Value Prop: "${!lead.website ? "I noticed you don't have a direct website linked on Google Maps, which means you're missing out on daily direct bookings." : "We help local businesses automate booking inquiries so no customer calls go unanswered."}"`,
      `Call to Action: "Can I show you a quick 2-minute mock demo built specifically for ${lead.business_name} this week?"`,
    ];

    scriptBoxText.forEach((script) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(16, curY, pageWidth - 32, 8.5, 1, 1, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(script, 20, curY + 5.5);
      curY += 10.5;
    });

    curY += 4;

    // Section 4: Call Outcome & Meeting Notes Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("4. Rep Call Log & Outcome Notes", 16, curY);
    curY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("[  ] Connected - Interested       [  ] Requested Email Info       [  ] Meeting Booked       [  ] Gatekeeper / Callback", 18, curY + 3);
    curY += 7;

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(16, curY, pageWidth - 32, 32, 2, 2, "D");
    for (let lineY = curY + 8; lineY < curY + 30; lineY += 7) {
      doc.setDrawColor(241, 245, 249);
      doc.line(18, lineY, pageWidth - 18, lineY);
    }
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Write meeting notes, objection details, or follow-up date here...", 20, curY + 5);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("CONFIDENTIAL SALES BRIEFING • Generated by AI Radar Prospect Engine", pageWidth / 2, pageHeight - 8, { align: "center" });

    const safeBiz = (lead.business_name || "Lead").replace(/[^a-zA-Z0-9_-]/g, "_");
    doc.save(`Sales_Dossier_${safeBiz}_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
  } catch (err) {
    console.error("Failed to generate PDF dossier:", err);
    window.print();
    return true;
  }
}

/**
 * Beautiful HTML Printable Sheet Fallback
 */
export function printLeadsSheetHTML({
  leads,
  category = "All Categories",
  city = "City",
  country = "",
  type = "all",
}: ExportPDFOptions) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate print sheet");
    return;
  }

  const rowsHtml = leads
    .map((l, i) => {
      const email = l.email || (l.emails && l.emails[0]) || "N/A";
      const phone = l.phone || l.whatsapp || "N/A";
      const website = l.website ? `<a href="${l.website}" target="_blank">${l.website}</a>` : '<span style="color:#e11d48;font-weight:bold;">No Website</span>';
      const rating = l.rating ? `${l.rating} ★ (${l.reviews || 0})` : "N/A";
      const score = (l.lead_score || "HIGH").toUpperCase();
      const opp = l.recommended_service || "Website Development";

      return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><strong>${l.business_name || "Unknown"}</strong><br/><small style="color:#64748b;">${l.address || ""}</small></td>
        <td>${rating}</td>
        <td><strong>${phone}</strong><br/><small style="color:#2563eb;">${email}</small></td>
        <td>${website}</td>
        <td><span style="background:${score === "HIGH" ? "#d1fae5" : "#fef3c7"};color:${score === "HIGH" ? "#065f46" : "#92400e"};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;">${score}</span></td>
        <td style="font-size:11px;">${opp}</td>
        <td style="border:1px dashed #cbd5e1;min-width:90px;"></td>
      </tr>
    `;
    })
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Leads Sheet - ${category} (${city})</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 800; margin: 0; }
          .subtitle { color: #64748b; font-size: 11px; margin-top: 4px; }
          .badge { background: #0f172a; color: #34d399; padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: left; font-size: 11px; }
          td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:15px;display:flex;gap:10px;">
          <button onclick="window.print()" style="background:#10b981;color:#000;font-weight:bold;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;">🖨️ Print / Save as PDF</button>
        </div>
        <div class="header">
          <div>
            <h1 class="title">TARGETED B2B LEADS & OPPORTUNITIES SHEET</h1>
            <div class="subtitle">Niche: ${category} | Territory: ${city}, ${country} | Total Leads: ${leads.length} | Exported: ${new Date().toLocaleString()}</div>
          </div>
          <div class="badge">CONFIDENTIAL SALES SHEET</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:25px;text-align:center;">#</th>
              <th>Business & Address</th>
              <th style="width:70px;">Rating</th>
              <th>Contact Details</th>
              <th>Website</th>
              <th style="width:65px;">Lead Score</th>
              <th>Opportunity / Pitch</th>
              <th style="width:100px;">Rep Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
