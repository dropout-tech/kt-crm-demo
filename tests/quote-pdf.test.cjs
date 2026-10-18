'use strict';
const test = require('node:test');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const PDF = require('../src/quote-pdf.js');
test('raster test PDF records byte-accurate streams, page references and xref offsets', () => {
  const bytes=PDF.buildRasterPdf([{bytes:new Uint8Array([0xff,0xd8,0,255,0xff,0xd9]),width:1190,height:1684},{bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:1190,height:1684}]);
  const raw=Buffer.from(bytes).toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4\n')); assert.match(raw,/\/Type \/Pages \/Count 2 \/Kids \[3 0 R 6 0 R\]/);
  assert.match(raw,/TEST SAMPLE - Template pending - Not an official quotation/);
  const xrefAt=Number(raw.match(/startxref\n(\d+)/)[1]); assert.equal(raw.slice(xrefAt,xrefAt+4),'xref');
  const entries=raw.slice(xrefAt).split('\n').slice(3,12);
  entries.forEach((entry,i)=>{const offset=Number(entry.slice(0,10));assert.equal(raw.slice(offset,offset+String(i+1).length+6),(i+1)+' 0 obj');});
  assert.match(raw,/\/Length 6 >>\nstream\n/); assert.ok(raw.endsWith('%%EOF\n'));
});
test('test PDF rejects missing or invalid raster pages and unapproved input', async () => {
  assert.throws(()=>PDF.buildRasterPdf([])); assert.throws(()=>PDF.buildRasterPdf([{bytes:new Uint8Array(),width:1,height:1}]));
  assert.throws(()=>PDF.buildRasterPdf([{bytes:new Uint8Array([1]),width:-1,height:1}]));
  await assert.rejects(PDF.renderApprovedQuote({testOnly:true,status:'草稿',version:1}),/目前已模擬核准/);
});
