(function (root) {
  'use strict';
  const WATERMARK = '測試樣張／範本待確認／不可對外正式報價';
  const encoder = new TextEncoder();
  function joinBytes(parts) {
    const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }
  function buildRasterPdf(images) {
    if (!Array.isArray(images) || !images.length || images.length > 100) throw new Error('測試 PDF 頁面數無效');
    const objects = {}, pages = []; let nextId = 3;
    for (const image of images) {
      if (!(image.bytes instanceof Uint8Array) || !image.bytes.length || !Number.isInteger(image.width) || image.width <= 0 || !Number.isInteger(image.height) || image.height <= 0) throw new Error('PDF 測試影像無效');
      const pageId = nextId++, imageId = nextId++, contentId = nextId++;
      const content = encoder.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n');
      pages.push(pageId);
      objects[pageId] = [encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)];
      objects[imageId] = [encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, encoder.encode('\nendstream')];
      objects[contentId] = [encoder.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoder.encode('endstream')];
    }
    const infoId = nextId++;
    objects[1] = [encoder.encode('<< /Type /Catalog /Pages 2 0 R >>')];
    objects[2] = [encoder.encode(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(id => id + ' 0 R').join(' ')}] >>`)];
    objects[infoId] = [encoder.encode('<< /Title (TEST SAMPLE - Template pending - Not an official quotation) /Producer (Jucheng local synthetic prototype) >>')];
    const chunks = [encoder.encode('%PDF-1.4\n% synthetic-test-only\n')], offsets = [0]; let length = chunks[0].length;
    for (let id = 1; id < nextId; id++) {
      offsets[id] = length;
      const block = joinBytes([encoder.encode(id + ' 0 obj\n'), ...objects[id], encoder.encode('\nendobj\n')]);
      chunks.push(block); length += block.length;
    }
    const xref = 'xref\n0 ' + nextId + '\n0000000000 65535 f \n' + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
    chunks.push(encoder.encode(xref + `trailer\n<< /Size ${nextId} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${length}\n%%EOF\n`));
    return joinBytes(chunks);
  }
  function lines(context, text, width) {
    const output = []; let line = '';
    for (const character of String(text || '')) {
      if (character === '\n') { output.push(line); line = ''; continue; }
      if (line && context.measureText(line + character).width > width) { output.push(line); line = character; }
      else line += character;
    }
    output.push(line); return output;
  }
  async function renderApprovedQuote(quote) {
    if (!quote?.testOnly || quote.status !== '已核准' || quote.review?.version !== quote.version || quote.salesConfirmation?.version !== quote.version) throw new Error('僅可產生目前已模擬核准版本的測試 PDF');
    const logo = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('原始品牌圖無法載入')); image.src = 'assets/kingtile-logo.svg'; });
    const canvases = [], width = 1190, height = 1684, margin = 72, bottom = height - 145;
    let canvas, context, y;
    const font = (size, weight = 400) => { context.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`; context.textBaseline = 'top'; };
    function write(text, x, top, size = 22, color = '#292522', weight = 400, align = 'left') { font(size, weight); context.fillStyle = color; context.textAlign = align; context.fillText(String(text), x, top); context.textAlign = 'left'; }
    function writeFit(text, right, top, maxWidth, size = 21, weight = 400) {
      font(size, weight); while (size > 10 && context.measureText(String(text)).width > maxWidth) font(--size, weight);
      write(text, right, top, size, '#292522', weight, 'right');
    }
    function begin(table = true) {
      canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; context = canvas.getContext('2d');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
      context.drawImage(logo, margin, 57, 272, 63);
      write('報價測試樣張', width - margin, 62, 35, '#603c26', 650, 'right');
      write('範本待確認 · 不可對外正式報價', width - margin, 107, 20, '#8a4837', 550, 'right');
      font(31, 600); const titleLines = lines(context, quote.title, width - margin * 2);
      let top = 163; for (const line of titleLines) { write(line, margin, top, 31, '#292522', 600); top += 40; }
      top += 10;
      font(22); for (const line of lines(context, '模擬客戶：' + quote.companyName, width - margin * 2)) { write(line, margin, top, 22); top += 30; }
      write('版本 v' + quote.version + ' · 合成測試資料', margin, top + 4, 20, '#756b62'); top += 43;
      font(21); const caseLines = lines(context, '關聯案件：' + quote.caseTitle, width - margin * 2);
      for (const line of caseLines) { write(line, margin, top, 21, '#756b62'); top += 29; }
      write('業務：' + quote.salesName + '　模擬核准：' + quote.reviewerName, margin, top + 6, 20, '#756b62');
      y = top + 58;
      if (table) {
        context.fillStyle = '#f1ece6'; context.fillRect(margin, y, width - margin * 2, 49);
        write('品項說明', margin + 14, y + 12, 21, '#603c26', 550);
        write('數量／單位', 690, y + 12, 21, '#603c26', 550, 'right');
        write('測試單價', 886, y + 12, 21, '#603c26', 550, 'right');
        write('測試金額', width - margin - 14, y + 12, 21, '#603c26', 550, 'right');
        y += 64;
      }
      canvases.push(canvas);
    }
    begin();
    for (const row of quote.items) {
      font(22); const description = lines(context, row.description, 455); font(21); const quantityLines = lines(context, row.quantity + ' ' + row.unit, 140), rowHeight = Math.max(70, Math.max(description.length, quantityLines.length) * 30 + 22);
      if (y + rowHeight > bottom) begin();
      description.forEach((line, index) => write(line, margin + 14, y + 5 + index * 30));
      quantityLines.forEach((line, index) => write(line, 690, y + 5 + index * 30, 21, '#292522', 400, 'right'));
      writeFit(row.unitPrice, 886, y + 5, 175);
      writeFit(root.CRM.formatQuoteMoney(row.amountMinor), width - margin - 14, y + 5, 185, 21, 500);
      context.strokeStyle = '#e6e0d9'; context.beginPath(); context.moveTo(margin, y + rowHeight); context.lineTo(width - margin, y + rowHeight); context.stroke();
      y += rowHeight + 12;
    }
    if (y + 190 > bottom) begin(false);
    write('測試小計 ' + quote.currency + ' ' + root.CRM.formatQuoteMoney(quote.totalMinor), width - margin, y + 16, 31, '#603c26', 600, 'right');
    y += 79;
    const note = '稅額、計價與正式範本尚待確認。本樣張只驗證合成報價流程，非公司正式價格。' + (quote.validUntil ? '\n測試有效日期：' + quote.validUntil : '') + (quote.note ? '\n測試備註：' + quote.note : '');
    font(21); for (const line of lines(context, note, width - margin * 2)) { if (y + 29 > bottom) begin(false); write(line, margin, y, 21, '#756b62'); y += 30; }
    const images = canvases.map((page, index) => {
      context = page.getContext('2d');
      context.save(); context.translate(width / 2, height / 2); context.rotate(-Math.PI / 6); context.globalAlpha = 0.10;
      write('測試樣張・不可對外正式報價', 0, -20, 64, '#603c26', 650, 'center'); context.restore();
      write(WATERMARK, margin, height - 94, 20, '#8a4837', 600);
      write('第 ' + (index + 1) + '／' + canvases.length + ' 頁', width - margin, height - 59, 18, '#756b62', 400, 'right');
      const raw = atob(page.toDataURL('image/jpeg', 0.93).split(',')[1]), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return { width, height, bytes };
    });
    return new Blob([buildRasterPdf(images)], { type: 'application/pdf' });
  }
  const api = { WATERMARK, buildRasterPdf, renderApprovedQuote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CRMQuotePDF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
