/**
 * Penulis berkas .xlsx minimal, tanpa dependensi.
 *
 * Kenapa tidak memakai pustaka: SheetJS (`xlsx` di npm) memikul dua
 * kerentanan tingkat tinggi yang belum ada perbaikannya di registri npm
 * (prototype pollution dan ReDoS). Keduanya menyangkut MEMBACA berkas
 * asing, sementara di sini kita hanya MENULIS dari data sendiri — jadi
 * risikonya kecil, tetapi menambah dependensi bermasalah ke sistem berisi
 * data anak bukan hal yang perlu dilakukan demi fitur yang cakupannya
 * sesempit ini.
 *
 * Sebuah .xlsx sebenarnya berkas ZIP berisi beberapa XML. Yang ditulis di
 * sini hanya yang wajib, dengan seluruh sel sebagai teks (inline string)
 * supaya tidak perlu tabel sharedStrings, dan kompresi STORE (tanpa
 * pemampatan) supaya tidak perlu implementasi DEFLATE. Untuk beberapa
 * ratus baris, berkasnya tetap kecil dan Excel maupun Google Sheets
 * membukanya seperti biasa.
 */

/** Meloloskan karakter yang tidak sah di dalam XML. */
function amanXml(teks) {
  return String(teks ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Karakter kendali membuat Excel menolak membuka berkasnya.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** Nomor kolom (0-based) menjadi huruf: 0 -> A, 26 -> AA. */
function hurufKolom(i) {
  let hasil = '';
  let n = i + 1;
  while (n > 0) {
    const sisa = (n - 1) % 26;
    hasil = String.fromCharCode(65 + sisa) + hasil;
    n = Math.floor((n - 1) / 26);
  }
  return hasil;
}

/**
 * Nama sheet yang sah di Excel: maksimal 31 karakter dan tidak boleh
 * memuat : \ / ? * [ ]. Nama kelas seperti "2A" aman, tetapi pembersihan
 * ini menjaga kalau kelak ada nama yang lebih bebas.
 */
function amanNamaSheet(nama, cadangan) {
  const bersih = String(nama ?? '')
    .replace(/[:\\/?*[\]]/g, '-')
    .slice(0, 31)
    .trim();
  return bersih || cadangan;
}

function sheetXml(baris) {
  const isiBaris = baris
    .map((sel, i) => {
      const nomor = i + 1;
      const isiSel = sel
        .map((nilai, j) => {
          if (nilai === null || nilai === undefined || nilai === '') return '';
          const ref = `${hurufKolom(j)}${nomor}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${amanXml(
            nilai
          )}</t></is></c>`;
        })
        .join('');
      return `<row r="${nomor}">${isiSel}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${isiBaris}</sheetData>` +
    '</worksheet>'
  );
}

/* ---------------------------------------------------------------
   ZIP (metode STORE)
   --------------------------------------------------------------- */

const TABEL_CRC = (() => {
  const tabel = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c >>> 0;
  }
  return tabel;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABEL_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function keBytes(teks) {
  return new TextEncoder().encode(teks);
}

function tulisZip(berkas) {
  const potongan = [];
  const pusat = [];
  let offset = 0;

  const angka16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const angka32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  berkas.forEach((b) => {
    const nama = keBytes(b.nama);
    const isi = b.isi;
    const crc = crc32(isi);

    // Tanggal/waktu DOS dibiarkan tetap (1980-01-01) supaya berkas yang
    // dibuat dari data yang sama selalu identik byte-per-byte.
    const kepalaLokal = [
      ...angka32(0x04034b50),
      ...angka16(20), // versi minimum
      ...angka16(0),
      ...angka16(0), // metode 0 = STORE
      ...angka16(0),
      ...angka16(0x21),
      ...angka32(crc),
      ...angka32(isi.length),
      ...angka32(isi.length),
      ...angka16(nama.length),
      ...angka16(0),
    ];

    potongan.push(new Uint8Array(kepalaLokal), nama, isi);

    pusat.push({
      nama,
      crc,
      ukuran: isi.length,
      offset,
    });

    offset += kepalaLokal.length + nama.length + isi.length;
  });

  const awalPusat = offset;
  let panjangPusat = 0;

  pusat.forEach((p) => {
    const kepala = [
      ...angka32(0x02014b50),
      ...angka16(20),
      ...angka16(20),
      ...angka16(0),
      ...angka16(0),
      ...angka16(0),
      ...angka16(0x21),
      ...angka32(p.crc),
      ...angka32(p.ukuran),
      ...angka32(p.ukuran),
      ...angka16(p.nama.length),
      ...angka16(0),
      ...angka16(0),
      ...angka16(0),
      ...angka16(0),
      ...angka32(0),
      ...angka32(p.offset),
    ];
    potongan.push(new Uint8Array(kepala), p.nama);
    panjangPusat += kepala.length + p.nama.length;
  });

  potongan.push(
    new Uint8Array([
      ...angka32(0x06054b50),
      ...angka16(0),
      ...angka16(0),
      ...angka16(pusat.length),
      ...angka16(pusat.length),
      ...angka32(panjangPusat),
      ...angka32(awalPusat),
      ...angka16(0),
    ])
  );

  const total = potongan.reduce((n, p) => n + p.length, 0);
  const hasil = new Uint8Array(total);
  let posisi = 0;
  potongan.forEach((p) => {
    hasil.set(p, posisi);
    posisi += p.length;
  });
  return hasil;
}

/**
 * Menyusun berkas .xlsx dari beberapa lembar.
 *
 * @param {{nama: string, baris: Array<Array<string>>}[]} lembar
 * @returns {Blob} siap diunduh lewat URL.createObjectURL
 */
export function buatXlsx(lembar) {
  const daftar = lembar.map((l, i) => ({
    nama: amanNamaSheet(l.nama, `Sheet${i + 1}`),
    baris: l.baris,
  }));

  const tipe =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    daftar
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('') +
    '</Types>';

  const relsAkar =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    daftar
      .map(
        (l, i) =>
          `<sheet name="${amanXml(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('') +
    '</sheets></workbook>';

  const relsWorkbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    daftar
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('') +
    '</Relationships>';

  const berkas = [
    { nama: '[Content_Types].xml', isi: keBytes(tipe) },
    { nama: '_rels/.rels', isi: keBytes(relsAkar) },
    { nama: 'xl/workbook.xml', isi: keBytes(workbook) },
    { nama: 'xl/_rels/workbook.xml.rels', isi: keBytes(relsWorkbook) },
    ...daftar.map((l, i) => ({
      nama: `xl/worksheets/sheet${i + 1}.xml`,
      isi: keBytes(sheetXml(l.baris)),
    })),
  ];

  return new Blob([tulisZip(berkas)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Memicu unduhan berkas di browser. */
export function unduhBlob(blob, namaBerkas) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Ditunda sebentar: sebagian browser membatalkan unduhan kalau URL-nya
  // dicabut tepat setelah klik.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
