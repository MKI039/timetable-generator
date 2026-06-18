import XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';

/**
 * Export a class timetable to Excel (.xlsx) with premium styling
 * @param {Object} timetable  - full timetable object
 * @param {Object} lookup     - { faculty: [], subjects: [], classes: [], settings }
 */
export function exportToExcel(timetable, lookup) {
  const { faculty, subjects, classes, settings } = lookup;
  const { classTimetable, facultyTimetable } = timetable;

  const wb = XLSX.utils.book_new();

  const getFacultyName = (id) => faculty.find((f) => f.id === id)?.name || id;
  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || id;
  const getClassName = (id) => classes.find((c) => c.id === id)?.name || id;

  const activeDays = settings.days.slice(0, settings.daysPerWeek);
  const allSlots = settings.slots;

  // --- Helper to style a worksheet ---
  const styleWorksheet = (ws) => {
    if (!ws || !ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_ref]) continue;

        // Default cell styling
        ws[cell_ref].s = {
          font: { name: 'Arial', size: 10 },
          alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } },
          }
        };

        // Header Row Styling (R === 0)
        if (R === 0) {
          ws[cell_ref].s.fill = { fgColor: { rgb: '0A1520' } }; // Dark blue background
          ws[cell_ref].s.font = { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } };
        } else if (C === 0) {
          // Day / Faculty Label Column Styling
          ws[cell_ref].s.fill = { fgColor: { rgb: '111F2E' } }; // Card dark blue background
          ws[cell_ref].s.font = { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } };
          ws[cell_ref].s.alignment = { vertical: 'center', horizontal: 'left', wrapText: true };
        } else {
          // Body Cell styling based on content
          const val = ws[cell_ref].v;
          if (val && typeof val === 'string') {
            if (val.includes('(Lab)') || val.includes('🔬 Lab')) {
              ws[cell_ref].s.fill = { fgColor: { rgb: 'EBFDF2' } }; // Light green tint
              ws[cell_ref].s.font.color = { rgb: '2F855A' }; // Dark green text
            } else if (val === '---' || val.toLowerCase().includes('break')) {
              if (val.toLowerCase().includes('break')) {
                ws[cell_ref].s.fill = { fgColor: { rgb: 'FFF8F2' } }; // Light orange tint
                ws[cell_ref].s.font.color = { rgb: 'DD6B20' }; // Orange text
                ws[cell_ref].s.font.bold = true;
              } else {
                ws[cell_ref].s.font.color = { rgb: '999999' };
              }
            } else {
              // Theory subjects
              ws[cell_ref].s.fill = { fgColor: { rgb: 'EBF8FF' } }; // Light blue tint
              ws[cell_ref].s.font.color = { rgb: '2B6CB0' }; // Dark blue text
            }
          }
        }
      }
    }
  };

  // --- Sheet per class ---
  for (const [classId, dayMap] of Object.entries(classTimetable)) {
    const sheetData = [];
    // Header row
    const header = ['Day / Time', ...allSlots.map((s) => s.label)];
    sheetData.push(header);

    for (const day of activeDays) {
      const row = [day];
      for (const slot of allSlots) {
        if (slot.isBreak) {
          row.push(slot.breakLabel || 'Break');
        } else {
          const cell = dayMap?.[day]?.[String(slot.id)];
          if (cell) {
            const labTag = cell.isLab ? ' (Lab)' : '';
            row.push(`${getSubjectName(cell.subjectId)}${labTag}\n${getFacultyName(cell.facultyId)}`);
          } else {
            row.push('---');
          }
        }
      }
      sheetData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{ wch: 14 }, ...allSlots.map(() => ({ wch: 22 }))];
    styleWorksheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, getClassName(classId).slice(0, 31));
  }

  // --- Faculty sheet ---
  const facSheet = [];
  facSheet.push(['Faculty', ...activeDays]);
  for (const [facultyId, dayMap] of Object.entries(facultyTimetable)) {
    const row = [getFacultyName(facultyId)];
    for (const day of activeDays) {
      const slots = dayMap?.[day] || {};
      const entries = Object.values(slots)
        .filter(Boolean)
        .map((a) => {
          const labTag = a.isLab ? ' (Lab)' : '';
          return `${getSubjectName(a.subjectId)}${labTag} (${getClassName(a.classId)})`;
        })
        .join('; ');
      row.push(entries || '---');
    }
    facSheet.push(row);
  }
  const fws = XLSX.utils.aoa_to_sheet(facSheet);
  fws['!cols'] = [{ wch: 20 }, ...activeDays.map(() => ({ wch: 30 }))];
  styleWorksheet(fws);
  XLSX.utils.book_append_sheet(wb, fws, 'Faculty Overview');

  XLSX.writeFile(wb, `${timetable.name || 'timetable'}.xlsx`);
}

/**
 * Export a timetable dynamically to a landscape vector PDF layout
 * @param {Object} timetable  - full timetable object
 * @param {Object} lookup     - { faculty: [], subjects: [], classes: [], settings }
 */
export async function exportToPDF(timetable, lookup) {
  const { faculty, subjects, classes, settings } = lookup;
  const { classTimetable } = timetable;

  const getFacultyName = (id) => faculty.find((f) => f.id === id)?.name || id;
  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name || id;
  const getClassName = (id) => classes.find((c) => c.id === id)?.name || id;

  const activeDays = settings.days.slice(0, settings.daysPerWeek);
  const allSlots = settings.slots;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = 841.89;
  const pageHeight = 595.28;

  const classIds = Object.keys(classTimetable);
  let isFirst = true;

  for (const classId of classIds) {
    if (!isFirst) {
      pdf.addPage();
    }
    isFirst = false;

    const dayMap = classTimetable[classId] || {};
    const className = getClassName(classId);

    // Title & Metadata
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(13, 27, 42); // Navy title
    pdf.text(`${className} - Class Timetable`, 40, 45);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(74, 100, 120); // Muted grey
    pdf.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} · Local Storage Backup`, 40, 60);

    // Grid Coordinates
    const startX = 40;
    const startY = 85;
    const totalWidth = pageWidth - 80;
    const totalHeight = pageHeight - 130;

    const rowCount = activeDays.length + 1; // Days + Header
    const colCount = allSlots.length + 1;  // Slots + Day Labels

    const colWidths = [];
    const dayColWidth = 75; // Wider Day Label col
    colWidths.push(dayColWidth);
    
    const slotColWidth = (totalWidth - dayColWidth) / allSlots.length;
    for (let i = 0; i < allSlots.length; i++) {
      colWidths.push(slotColWidth);
    }

    const rowHeight = totalHeight / rowCount;

    for (let r = 0; r < rowCount; r++) {
      const currentY = startY + r * rowHeight;
      const day = activeDays[r - 1];

      let currentX = startX;
      for (let c = 0; c < colCount; c++) {
        const w = colWidths[c];
        const h = rowHeight;

        if (r === 0) {
          // Header Row
          pdf.setFillColor(10, 21, 32); // Header fill
          pdf.rect(currentX, currentY, w, h, 'F');
          pdf.setDrawColor(30, 49, 72); // Grid lines
          pdf.rect(currentX, currentY, w, h, 'S');

          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(255, 255, 255);
          
          const text = c === 0 ? 'Day / Time' : allSlots[c - 1].label;
          const textWidth = pdf.getTextWidth(text);
          pdf.text(text, currentX + (w - textWidth) / 2, currentY + h / 2 + 3);
        } else {
          // Content Rows
          if (c === 0) {
            // Day Labels Col
            pdf.setFillColor(16, 37, 60);
            pdf.rect(currentX, currentY, w, h, 'F');
            pdf.setDrawColor(30, 49, 72);
            pdf.rect(currentX, currentY, w, h, 'S');

            pdf.setFont('Helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(232, 237, 242);
            const textWidth = pdf.getTextWidth(day);
            pdf.text(day, currentX + (w - textWidth) / 2, currentY + h / 2 + 3);
          } else {
            // Time Slot Cells
            const slotObj = allSlots[c - 1];
            if (slotObj.isBreak) {
              // Break slots: orange accent
              pdf.setFillColor(244, 162, 97, 0.08);
              pdf.rect(currentX, currentY, w, h, 'F');
              pdf.setDrawColor(244, 162, 97, 0.25);
              pdf.rect(currentX, currentY, w, h, 'S');

              pdf.setFont('Helvetica', 'bold');
              pdf.setFontSize(9);
              pdf.setTextColor(244, 162, 97);
              const text = slotObj.breakLabel || 'Break';
              const textWidth = pdf.getTextWidth(text);
              pdf.text(text, currentX + (w - textWidth) / 2, currentY + h / 2 + 3);
            } else {
              // Scheduled Classes
              const cell = dayMap?.[day]?.[String(slotObj.id)];
              if (cell) {
                const isLab = cell.isLab;
                if (isLab) {
                  pdf.setFillColor(72, 187, 120, 0.12); // Light Green Lab
                  pdf.rect(currentX, currentY, w, h, 'F');
                  pdf.setDrawColor(72, 187, 120, 0.35);
                  pdf.rect(currentX, currentY, w, h, 'S');
                } else {
                  pdf.setFillColor(99, 179, 237, 0.1); // Light Blue Theory
                  pdf.rect(currentX, currentY, w, h, 'F');
                  pdf.setDrawColor(30, 49, 72);
                  pdf.rect(currentX, currentY, w, h, 'S');
                }

                // Render Subject text
                pdf.setFont('Helvetica', 'bold');
                pdf.setFontSize(8.5);
                pdf.setTextColor(232, 237, 242);
                let subName = getSubjectName(cell.subjectId);
                if (isLab) subName = `${subName} (Lab)`;
                const subNameTrunc = pdf.splitTextToSize(subName, w - 8);
                pdf.text(subNameTrunc[0] || '', currentX + 6, currentY + h / 2 - 4);

                // Render Faculty text
                pdf.setFont('Helvetica', 'normal');
                pdf.setFontSize(7.5);
                pdf.setTextColor(244, 162, 97);
                const facName = getFacultyName(cell.facultyId);
                const facNameTrunc = pdf.splitTextToSize(facName, w - 8);
                pdf.text(facNameTrunc[0] || '', currentX + 6, currentY + h / 2 + 8);
              } else {
                // Empty slot cell
                pdf.setFillColor(17, 31, 46);
                pdf.rect(currentX, currentY, w, h, 'F');
                pdf.setDrawColor(30, 49, 72);
                pdf.rect(currentX, currentY, w, h, 'S');

                pdf.setFont('Helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(74, 100, 120);
                pdf.text('—', currentX + w / 2 - 2, currentY + h / 2 + 3);
              }
            }
          }
        }
        currentX += w;
      }
    }
  }

  pdf.save(`${timetable.name || 'timetable'}.pdf`);
}
