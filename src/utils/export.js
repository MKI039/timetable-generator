import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export a class timetable to Excel (.xlsx)
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
            row.push(`${getSubjectName(cell.subjectId)}\n${getFacultyName(cell.facultyId)}`);
          } else {
            row.push('---');
          }
        }
      }
      sheetData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{ wch: 14 }, ...allSlots.map(() => ({ wch: 22 }))];
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
        .map((a) => `${getSubjectName(a.subjectId)} (${getClassName(a.classId)})`)
        .join('; ');
      row.push(entries || '---');
    }
    facSheet.push(row);
  }
  const fws = XLSX.utils.aoa_to_sheet(facSheet);
  fws['!cols'] = [{ wch: 20 }, ...activeDays.map(() => ({ wch: 30 }))];
  XLSX.utils.book_append_sheet(wb, fws, 'Faculty Overview');

  XLSX.writeFile(wb, `${timetable.name || 'timetable'}.xlsx`);
}

/**
 * Export a timetable grid element to PDF.
 * @param {HTMLElement} element - the DOM element to capture
 * @param {string} filename
 */
export async function exportToPDF(element, filename = 'timetable') {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = (canvas.height * pdfW) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
  pdf.save(`${filename}.pdf`);
}
