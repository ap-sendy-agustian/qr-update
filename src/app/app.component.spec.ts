// import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
// import { FormsModule } from '@angular/forms';
// import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { AppComponent } from './app.component';
// /**
//  * =============================================================
//  * CONTOH QRIS VALID - dipakai berulang di banyak test.
//  * Ini QRIS statis nyata dengan CRC yang sudah benar (B1D0),
//  * jadi bisa dipakai untuk memvalidasi generateChecksum() secara
//  * akurat terhadap nilai CRC asli, bukan cuma cek konsistensi.
//  * =============================================================
//  */
// const VALID_QRIS_WITHOUT_AMOUNT =
//   '00020101021126640018ID.CO.ASTRAPAY.WWW01189360082233215181260209' +
//   '3215181260303UMI51400014ID.CO.QRIS.WWW0211ID3215181260303UMI' +
//   '52045499530336058' + '02ID5919Asep Testing SIT BE6007JAKARTA' +
//   '61053811362080704A0016304B1D0';

// // QRIS valid yang sudah punya tag 54 (amount 11000000), CRC asli B1D0
// const VALID_QRIS_WITH_AMOUNT =
//   '00020101021126640018ID.CO.ASTRAPAY.WWW0118936008223321518126020932' +
//   '15181260303UMI51400014ID.CO.QRIS.WWW0211ID3215181260303UMI52045499' +
//   '5303360540811000000' + '5802ID5919Asep Testing SIT BE6007JAKARTA' +
//   '61053811362080704A0016304B1D0';

// describe('AppComponent', () => {
//   let component: AppComponent;
//   let fixture: ComponentFixture<AppComponent>;

//   beforeEach(async () => {
//     await TestBed.configureTestingModule({
//       declarations: [AppComponent],
//       imports: [FormsModule],
//       schemas: [CUSTOM_ELEMENTS_SCHEMA] // biar <qrcode> & SVG unknown element tidak error
//     }).compileComponents();

//     fixture = TestBed.createComponent(AppComponent);
//     component = fixture.componentInstance;

//     // Ganti codeReader asli dengan spy object, supaya decode QR
//     // sepenuhnya terkontrol di test (tidak bergantung ZXing asli).
//     component.codeReader = jasmine.createSpyObj('BrowserQRCodeReader', [
//       'decodeFromCanvas'
//     ]);

//     fixture.detectChanges();
//   });

//   // ================================================================
//   // generateChecksum()
//   // ================================================================
//   describe('generateChecksum', () => {
//     it('should produce the correct CRC16 for a known valid QRIS payload', () => {
//       const payloadWithoutCrc = VALID_QRIS_WITHOUT_AMOUNT.slice(0, -4);
//       const checksum = component.generateChecksum(payloadWithoutCrc + '6304');
//       expect(checksum).toBe('B1D0');
//     });

//     it('should be deterministic (same input -> same output)', () => {
//       const c1 = component.generateChecksum('000201010211');
//       const c2 = component.generateChecksum('000201010211');
//       expect(c1).toBe(c2);
//     });

//     it('should produce different checksums for different inputs', () => {
//       const c1 = component.generateChecksum('000201010211');
//       const c2 = component.generateChecksum('000201010212');
//       expect(c1).not.toBe(c2);
//     });

//     it('should always return a 4-character uppercase hex string', () => {
//       const checksum = component.generateChecksum('A');
//       expect(checksum.length).toBe(4);
//       expect(checksum).toMatch(/^[0-9A-F]{4}$/);
//     });

//     it('should handle empty string input without throwing', () => {
//       expect(() => component.generateChecksum('')).not.toThrow();
//     });
//   });

//   // ================================================================
//   // parseAllTags() - private, diakses lewat (component as any)
//   // ================================================================
//   describe('parseAllTags', () => {
//     const parse = (text: string) => (component as any).parseAllTags(text);

//     it('should correctly parse a simple TLV string', () => {
//       const result = parse('000201');
//       expect(result.get('00')).toEqual(
//         jasmine.objectContaining({ tag: '00', value: '01' })
//       );
//     });

//     it('should parse multiple sequential tags correctly', () => {
//       const result = parse('0002010102115802ID');
//       expect(result.get('00').value).toBe('01');
//       expect(result.get('01').value).toBe('11');
//       expect(result.get('58').value).toBe('ID');
//     });

//     it('should track correct start/valueStart/valueEnd positions', () => {
//       const result = parse('000201010211');
//       const tag01 = result.get('01');
//       expect(tag01.start).toBe(6);
//       expect(tag01.valueStart).toBe(10);
//       expect(tag01.valueEnd).toBe(12);
//     });

//     it('should return an empty map for an empty string', () => {
//       const result = parse('');
//       expect(result.size).toBe(0);
//     });

//     it('should stop parsing gracefully on non-numeric length field', () => {
//       // "XY" bukan angka valid untuk length
//       const result = parse('00XY01');
//       expect(result.size).toBe(0);
//     });

//     it('should stop parsing gracefully when declared length exceeds remaining string (truncated/corrupt data)', () => {
//       // tag 00 declares length 99, tapi string cuma sisa 2 char
//       const result = parse('009901');
//       expect(result.size).toBe(0);
//     });

//     it('should not falsely match a tag whose value happens to contain another tag-like substring', () => {
//       // Value dari tag 59 sengaja diisi teks yang MENGANDUNG pola "5303360"
//       // (mirip tag 53 currency) - ini edge case yang jadi alasan awal
//       // kenapa parsing harus struktural, bukan string search literal.
//       const merchantNameContainingFakeTag = '5303360Store';
//       const qr = `5912${merchantNameContainingFakeTag}`;
//       const result = parse(qr);
//       expect(result.size).toBe(1);
//       expect(result.get('59').value).toBe(merchantNameContainingFakeTag);
//       expect(result.has('53')).toBeFalse();
//     });

//     it('should overwrite duplicate tags with the later occurrence (Map behavior)', () => {
//       const result = parse('54023100540431415');
//       expect(result.get('54').value).toBe('3141');
//     });
//   });

//   // ================================================================
//   // validateQrisFormat() - private, diakses lewat (component as any)
//   // ================================================================
//   describe('validateQrisFormat', () => {
//     const validate = (text: string) => (component as any).validateQrisFormat(text);

//     it('should accept a valid MPM QRIS payload', () => {
//       expect(validate(VALID_QRIS_WITHOUT_AMOUNT)).toBeNull();
//     });

//     it('should reject an empty string', () => {
//       expect(validate('')).toContain('kosong');
//     });

//     it('should reject a whitespace-only string', () => {
//       expect(validate('   ')).toContain('kosong');
//     });

//     it('should reject a string that is too short', () => {
//       expect(validate('000201')).toContain('terlalu pendek');
//     });

//     it('should reject payload not starting with "000201"', () => {
//       const invalid = '999999' + VALID_QRIS_WITHOUT_AMOUNT.slice(6);
//       expect(validate(invalid)).toContain('Payload Format Indicator');
//     });

//     it('should reject CRC that is not valid 4-char hex', () => {
//       const invalid = VALID_QRIS_WITHOUT_AMOUNT.slice(0, -4) + 'ZZZZ';
//       expect(validate(invalid)).toContain('CRC checksum');
//     });

//     it('should reject when Point of Initiation Method (tag 01) is missing', () => {
//       // buang tag 01 dari payload
//       const withoutTag01 =
//         '000201' +
//         VALID_QRIS_WITHOUT_AMOUNT.slice(12);
//       expect(validate(withoutTag01)).toContain('Point of Initiation Method');
//     });

//     it('should reject when Point of Initiation Method value is neither "11" nor "12"', () => {
//       const invalid = VALID_QRIS_WITHOUT_AMOUNT.replace('010211', '010299');
//       expect(validate(invalid)).toContain('bukan format QRIS MPM');
//     });

//     it('should accept Point of Initiation Method "12" (dynamic) as valid too', () => {
//       const dynamicVariant = VALID_QRIS_WITHOUT_AMOUNT.replace('010211', '010212');
//       // Karena payload lain tidak berubah, CRC lama mungkin sudah tidak match,
//       // tapi validasi CRC hanya cek FORMAT (4 hex char), bukan kebenaran matematisnya,
//       // jadi ini tetap harus lolos sampai ke titik pengecekan tag01.
//       const result = validate(dynamicVariant);
//       expect(result === null || !result.includes('Point of Initiation')).toBeTrue();
//     });

//     it('should reject when no Merchant Account Information tag is present', () => {
//       const noMerchantAccount =
//         '000201' + '010211' + '52045499' + '5303360' + '5802ID' +
//         '5904Test' + '6004City' + '63040000';
//       expect(validate(noMerchantAccount)).toContain('Merchant Account Information');
//     });

//     it('should reject when Merchant Category Code (tag 52) is missing', () => {
//       const noMcc =
//         '000201' + '010211' + '26020A' + '5303360' + '5802ID' +
//         '5904Test' + '6004City' + '63040000';
//       expect(validate(noMcc)).toContain('Merchant Category Code');
//     });

//     it('should reject when currency (tag 53) is missing', () => {
//       const noCurrency =
//         '000201' + '010211' + '26020A' + '52045499' + '5802ID' +
//         '5904Test' + '6004City' + '63040000';
//       expect(validate(noCurrency)).toContain('tag mata uang');
//     });

//     it('should reject when currency is not 360 (IDR)', () => {
//       const wrongCurrency = VALID_QRIS_WITHOUT_AMOUNT.replace('5303360', '5303840');
//       expect(validate(wrongCurrency)).toContain('bukan Rupiah');
//     });

//     it('should reject when Country Code (tag 58) is not "ID"', () => {
//       const wrongCountry = VALID_QRIS_WITHOUT_AMOUNT.replace('5802ID', '5802US');
//       expect(validate(wrongCountry)).toContain('Country Code');
//     });

//     it('should reject when Merchant Name (tag 59) is missing', () => {
//       const noMerchantName =
//         '000201' + '010211' + '26020A' + '52045499' + '5303360' +
//         '5802ID' + '6004City' + '63040000';
//       expect(validate(noMerchantName)).toContain('Merchant Name');
//     });

//     it('should reject when Merchant City (tag 60) is missing', () => {
//       const noCity =
//         '000201' + '010211' + '26020A' + '52045499' + '5303360' +
//         '5802ID' + '5904Test' + '63040000';
//       expect(validate(noCity)).toContain('Merchant City');
//     });

//     it('should reject completely garbled/random text', () => {
//       expect(validate('this is definitely not a qris payload at all!!')).not.toBeNull();
//     });

//     it('should reject a string shorter than 8 chars gracefully without throwing', () => {
//       expect(() => validate('0002011')).not.toThrow();
//     });
//   });

//   // ================================================================
//   // insertStringAt()
//   // ================================================================
//   describe('insertStringAt', () => {
//     it('should insert a string at the correct index', () => {
//       expect(component.insertStringAt('ABCDEF', 'XY', 3)).toBe('ABCXYDEF');
//     });

//     it('should insert at index 0 (beginning)', () => {
//       expect(component.insertStringAt('ABC', 'XY', 0)).toBe('XYABC');
//     });

//     it('should insert at the end when index equals string length', () => {
//       expect(component.insertStringAt('ABC', 'XY', 3)).toBe('ABCXY');
//     });

//     it('should clamp index to string length when index exceeds it', () => {
//       expect(component.insertStringAt('ABC', 'XY', 999)).toBe('ABCXY');
//     });

//     it('should handle inserting an empty string (no-op content-wise)', () => {
//       expect(component.insertStringAt('ABC', '', 1)).toBe('ABC');
//     });

//     it('should handle inserting into an empty original string', () => {
//       expect(component.insertStringAt('', 'XY', 0)).toBe('XY');
//     });
//   });

//   // ================================================================
//   // replaceQrText() - inti logic insert/update tag 54
//   // ================================================================
//   describe('replaceQrText', () => {
//     it('should do nothing if originalQrText is null', () => {
//       component.originalQrText = null;
//       component.replaceQrText();
//       expect(component.generatedQrText).toBeNull();
//     });

//     it('should insert tag 54 with the given amount when tag 54 does not exist yet', () => {
//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '15000';
//       component.replaceQrText();

//       expect(component.generatedQrText).toContain('540515000');
//     });

//     it('should default amount to "0" when newAmount is empty', () => {
//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '';
//       component.replaceQrText();

//       expect(component.generatedQrText).toContain('540100');
//     });

//     it('should default amount to "0" when newAmount is only whitespace', () => {
//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '   ';
//       component.replaceQrText();

//       expect(component.generatedQrText).toContain('540100');
//     });

//     it('should UPDATE (not duplicate) tag 54 when it already exists in the QR', () => {
//       component.originalQrText = VALID_QRIS_WITH_AMOUNT; // sudah punya 5408 11000000
//       component.newAmount = '25000000';
//       component.replaceQrText();

//       expect(component.generatedQrText).toContain('540825000000');
//       // Pastikan TIDAK ada dua TLV tag 54 numpuk (bug lama)
//       const occurrences = (component.generatedQrText!.match(/54\d{2}/g) || []).length;
//       expect(occurrences).toBe(1);
//     });

//     it('should recalculate CRC correctly after modification', () => {
//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '10000';
//       component.replaceQrText();

//       const result = component.generatedQrText!;
//       const payloadWithoutCrc = result.slice(0, -4);
//       const expectedCrc = component.generateChecksum(payloadWithoutCrc + '6304');
//       expect(result.slice(-4)).toBe(expectedCrc);
//     });

//     it('should show an error toast and NOT set generatedQrText when tag 53 is missing', () => {
//       // Payload valid secara panjang tapi sengaja tidak punya tag 53
//       component.originalQrText =
//         '000201' + '010211' + '26020A' + '52045499' + '5802ID' +
//         '5904Test' + '6004City' + '63040000';
//       component.newAmount = '5000';
//       component.generatedQrText = null;

//       component.replaceQrText();

//       expect(component.generatedQrText).toBeNull();
//       expect(component.showCopyToast).toBeTrue();
//       expect(component.toastType).toBe('error');
//       expect(component.toastMessage).toContain('tag mata uang');
//     });

//     it('should show an error toast when amount length exceeds 99 characters', () => {
//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '1'.repeat(100);
//       component.generatedQrText = null;

//       component.replaceQrText();

//       expect(component.generatedQrText).toBeNull();
//       expect(component.toastMessage).toContain('Maksimal 99 karakter');
//     });

//     it('should trigger animation restart via requestAnimationFrame after successful generate', fakeAsync(() => {
//       spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
//         cb(0);
//         return 0;
//       });
//       const restartSpy = spyOn<any>(component, 'restartRevealAnimation');

//       component.originalQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '5000';
//       component.replaceQrText();

//       expect(restartSpy).toHaveBeenCalled();
//     }));
//   });

//   // ================================================================
//   // applyExifOrientationTransform() - private
//   // ================================================================
//   describe('applyExifOrientationTransform', () => {
//     let ctxSpy: jasmine.SpyObj<CanvasRenderingContext2D>;

//     beforeEach(() => {
//       ctxSpy = jasmine.createSpyObj('CanvasRenderingContext2D', ['transform']);
//     });

//     const apply = (orientation: number, w = 100, h = 200) =>
//       (component as any).applyExifOrientationTransform(ctxSpy, orientation, w, h);

//     it('should NOT call transform for orientation 1 (normal)', () => {
//       apply(1);
//       expect(ctxSpy.transform).not.toHaveBeenCalled();
//     });

//     it('should NOT call transform for an unrecognized orientation value', () => {
//       apply(99);
//       expect(ctxSpy.transform).not.toHaveBeenCalled();
//     });

//     it('should apply correct transform for orientation 2 (horizontal flip)', () => {
//       apply(2, 100, 200);
//       expect(ctxSpy.transform).toHaveBeenCalledWith(-1, 0, 0, 1, 100, 0);
//     });

//     it('should apply correct transform for orientation 3 (180 rotate)', () => {
//       apply(3, 100, 200);
//       expect(ctxSpy.transform).toHaveBeenCalledWith(-1, 0, 0, -1, 100, 200);
//     });

//     it('should apply correct transform for orientation 6 (90 CW rotate)', () => {
//       apply(6, 100, 200);
//       expect(ctxSpy.transform).toHaveBeenCalledWith(0, 1, -1, 0, 200, 0);
//     });

//     it('should apply correct transform for orientation 8 (90 CCW rotate)', () => {
//       apply(8, 100, 200);
//       expect(ctxSpy.transform).toHaveBeenCalledWith(0, -1, 1, 0, 0, 100);
//     });
//   });

//   // ================================================================
//   // getExifOrientation() - private, wraps exifr
//   // ================================================================
//   describe('getExifOrientation', () => {
//     it('should return the orientation value when exifr resolves successfully', async () => {
//       // Mock modul exifr yang di-import di component
//       const exifrModule = await import('exifr');
//       spyOn(exifrModule, 'orientation').and.resolveTo(6);

//       const fakeFile = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
//       const result = await (component as any).getExifOrientation(fakeFile);

//       expect(result).toBe(6);
//     });

//     it('should default to 1 when exifr throws (e.g. no EXIF data / screenshot)', async () => {
//       const exifrModule = await import('exifr');
//       spyOn(exifrModule, 'orientation').and.rejectWith(new Error('no exif'));

//       const fakeFile = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const result = await (component as any).getExifOrientation(fakeFile);

//       expect(result).toBe(1);
//     });

//     it('should default to 1 when exifr resolves with a falsy value', async () => {
//       const exifrModule = await import('exifr');
//       spyOn(exifrModule, 'orientation').and.resolveTo(0);

//       const fakeFile = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const result = await (component as any).getExifOrientation(fakeFile);

//       expect(result).toBe(1);
//     });
//   });

//   // ================================================================
//   // generate() - orkestrasi utama (image priority vs raw text fallback)
//   // ================================================================
//   describe('generate', () => {
//     it('should show an error toast when neither file nor raw text is provided', async () => {
//       component.selectedFile = null;
//       component.rawQrText = '';

//       await component.generate();

//       expect(component.showCopyToast).toBeTrue();
//       expect(component.toastType).toBe('error');
//       expect(component.toastMessage).toContain('Upload gambar QR atau paste');
//     });

//     it('should prioritize image over raw text when both are provided', async () => {
//       const decodeSpy = spyOn(component, 'decodeQRCodeImage').and.resolveTo();
//       component.selectedFile = new File(['dummy'], 'test.png', { type: 'image/png' });
//       component.rawQrText = VALID_QRIS_WITHOUT_AMOUNT;

//       await component.generate();

//       expect(decodeSpy).toHaveBeenCalledWith(component.selectedFile);
//     });

//     it('should fall back to raw text when no file is selected', async () => {
//       component.selectedFile = null;
//       component.rawQrText = VALID_QRIS_WITHOUT_AMOUNT;
//       component.newAmount = '5000';

//       await component.generate();

//       expect(component.originalQrText).toBe(VALID_QRIS_WITHOUT_AMOUNT);
//       expect(component.generatedQrText).toContain('540515000');
//     });

//     it('should show an error toast and NOT set originalQrText when raw text fails validation', async () => {
//       component.selectedFile = null;
//       component.rawQrText = 'not a valid qris at all';

//       await component.generate();

//       expect(component.originalQrText).toBeNull();
//       expect(component.toastType).toBe('error');
//     });

//     it('should trim whitespace from raw QR text before processing', async () => {
//       component.selectedFile = null;
//       component.rawQrText = '   ' + VALID_QRIS_WITHOUT_AMOUNT + '   ';

//       await component.generate();

//       expect(component.originalQrText).toBe(VALID_QRIS_WITHOUT_AMOUNT);
//     });

//     it('should prevent concurrent generate() calls while one is already in progress (isGenerating guard)', fakeAsync(() => {
//       let resolveDecode!: () => void;
//       const decodeSpy = spyOn(component, 'decodeQRCodeImage').and.returnValue(
//         new Promise<void>(resolve => (resolveDecode = resolve))
//       );
//       component.selectedFile = new File(['dummy'], 'test.png', { type: 'image/png' });

//       component.generate(); // panggilan pertama, belum selesai (masih pending)
//       component.generate(); // panggilan kedua saat masih pending, harus di-skip

//       expect(decodeSpy).toHaveBeenCalledTimes(1);

//       resolveDecode();
//       flush();
//     }));

//     it('should reset isGenerating to false after completion, allowing subsequent calls', fakeAsync(() => {
//       spyOn(component, 'decodeQRCodeImage').and.resolveTo();
//       component.selectedFile = new File(['dummy'], 'test.png', { type: 'image/png' });

//       component.generate();
//       tick();
//       expect(component.isGenerating).toBeFalse();

//       component.generate();
//       tick();
//       expect((component.decodeQRCodeImage as jasmine.Spy).calls.count()).toBe(2);
//     }));

//     it('should reset isGenerating to false even if decodeQRCodeImage throws', fakeAsync(() => {
//       spyOn(component, 'decodeQRCodeImage').and.rejectWith(new Error('boom'));
//       component.selectedFile = new File(['dummy'], 'test.png', { type: 'image/png' });

//       component.generate().catch(() => {
//         // expected rejection, ignored for this test
//       });
//       tick();

//       expect(component.isGenerating).toBeFalse();
//     }));
//   });

//   // ================================================================
//   // copyToClipboard()
//   // ================================================================
//   describe('copyToClipboard', () => {
//     it('should do nothing if generatedQrText is null', async () => {
//       component.generatedQrText = null;
//       spyOn(navigator.clipboard, 'writeText');

//       await component.copyToClipboard();

//       expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
//     });

//     it('should copy text to clipboard and show success feedback', fakeAsync(() => {
//       component.generatedQrText = 'SOME_QR_TEXT';
//       spyOn(navigator.clipboard, 'writeText').and.resolveTo();

//       component.copyToClipboard();
//       tick();

//       expect(navigator.clipboard.writeText).toHaveBeenCalledWith('SOME_QR_TEXT');
//       expect(component.copiedFeedback).toBeTrue();
//       expect(component.toastType).toBe('success');

//       tick(2000);
//       expect(component.copiedFeedback).toBeFalse();
//     }));

//     it('should show an error toast when clipboard write fails', fakeAsync(() => {
//       component.generatedQrText = 'SOME_QR_TEXT';
//       spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('denied'));

//       component.copyToClipboard();
//       tick();

//       expect(component.toastType).toBe('error');
//       expect(component.toastMessage).toContain('Gagal copy');
//     }));
//   });

//   // ================================================================
//   // removeSelectedFile()
//   // ================================================================
//   describe('removeSelectedFile', () => {
//     it('should reset selectedFile and imageSrc to null', () => {
//       component.selectedFile = new File(['x'], 'a.png');
//       component.imageSrc = 'data:image/png;base64,xxx';

//       component.removeSelectedFile();

//       expect(component.selectedFile).toBeNull();
//       expect(component.imageSrc).toBeNull();
//     });

//     it('should clear the file input value if it exists in the DOM', () => {
//       const input = document.createElement('input');
//       input.type = 'file';
//       input.id = 'fileUpload';
//       document.body.appendChild(input);

//       component.removeSelectedFile();

//       expect(input.value).toBe('');
//       document.body.removeChild(input);
//     });

//     it('should not throw when the file input element does not exist in the DOM', () => {
//       const existing = document.getElementById('fileUpload');
//       if (existing) existing.remove();

//       expect(() => component.removeSelectedFile()).not.toThrow();
//     });
//   });

//   // ================================================================
//   // showToast() - private, diakses lewat (component as any)
//   // ================================================================
//   describe('showToast', () => {
//     const callShowToast = (msg: string, type: 'success' | 'error' = 'success') =>
//       (component as any).showToast(msg, type);

//     it('should set toast message, type, and visibility flag', () => {
//       callShowToast('Test message', 'error');

//       expect(component.toastMessage).toBe('Test message');
//       expect(component.toastType).toBe('error');
//       expect(component.showCopyToast).toBeTrue();
//     });

//     it('should default to type "success" when not specified', () => {
//       callShowToast('Default type test');
//       expect(component.toastType).toBe('success');
//     });

//     it('should auto-hide after 2500ms', fakeAsync(() => {
//       callShowToast('Auto hide test');
//       expect(component.showCopyToast).toBeTrue();

//       tick(2500);
//       expect(component.showCopyToast).toBeFalse();
//     }));

//     it('should reset the hide timer when called again before the previous timeout fires', fakeAsync(() => {
//       callShowToast('First message');
//       tick(2000); // belum 2500ms, belum hilang

//       callShowToast('Second message'); // timer di-reset
//       tick(2000); // total 4000ms dari awal, tapi cuma 2000ms dari toast kedua
//       expect(component.showCopyToast).toBeTrue(); // masih kelihatan karena baru di-reset
//       expect(component.toastMessage).toBe('Second message');

//       tick(500); // genap 2500ms dari toast kedua
//       expect(component.showCopyToast).toBeFalse();
//     }));
//   });

//   // ================================================================
//   // decodeQRCodeImage() - integration-style test dengan Image di-mock
//   // ================================================================
//   describe('decodeQRCodeImage', () => {
//     let fakeImageInstances: any[];

//     beforeEach(() => {
//       fakeImageInstances = [];

//       // Mock global Image constructor supaya onload/onerror bisa dikontrol manual,
//       // tanpa bergantung pada real image decoding di browser test runner.
//       spyOn(window as any, 'Image').and.callFake(function (this: any) {
//         this.width = 300;
//         this.height = 300;
//         this._src = '';
//         Object.defineProperty(this, 'src', {
//           set: (val: string) => {
//             this._src = val;
//             // Trigger onload di microtask berikutnya secara default (bisa dioverride per-test)
//           },
//           get: () => this._src
//         });
//         fakeImageInstances.push(this);
//         return this;
//       });

//       spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-url');
//       spyOn(URL, 'revokeObjectURL');
//       spyOn(component as any, 'getExifOrientation').and.resolveTo(1);

//       // Mock canvas context supaya drawImage tidak benar-benar butuh gambar asli
//       spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue({
//         transform: jasmine.createSpy('transform'),
//         drawImage: jasmine.createSpy('drawImage')
//       } as any);
//     });

//     function triggerImageLoad() {
//       const img = fakeImageInstances[fakeImageInstances.length - 1];
//       if (img?.onload) img.onload();
//     }

//     function triggerImageError() {
//       const img = fakeImageInstances[fakeImageInstances.length - 1];
//       if (img?.onerror) img.onerror();
//     }

//     it('should decode a valid QR image and populate generatedQrText', fakeAsync(() => {
//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.resolveTo({
//         getText: () => VALID_QRIS_WITHOUT_AMOUNT
//       });

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         expect(component.originalQrText).toBe(VALID_QRIS_WITHOUT_AMOUNT);
//         expect(component.generatedQrText).not.toBeNull();
//       });
//       flush();
//     }));

//     it('should show an error toast when the image contains no readable QR code', fakeAsync(() => {
//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.rejectWith(
//         new Error('No QR code found')
//       );

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         expect(component.toastType).toBe('error');
//         expect(component.toastMessage).toContain('tidak mengandung QR code');
//         expect(component.originalQrText).toBeNull();
//       });
//       flush();
//     }));

//     it('should show an error toast when the decoded QR text fails QRIS validation', fakeAsync(() => {
//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.resolveTo({
//         getText: () => 'this is not a valid qris payload'
//       });

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         expect(component.toastType).toBe('error');
//         expect(component.originalQrText).toBeNull();
//         expect(component.generatedQrText).toBeNull();
//       });
//       flush();
//     }));

//     it('should NOT overwrite a previously successful generatedQrText when a subsequent image fails to decode', fakeAsync(() => {
//       component.generatedQrText = 'PREVIOUS_SUCCESSFUL_RESULT';
//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.rejectWith(
//         new Error('No QR code found')
//       );

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         // generatedQrText dari hasil sebelumnya harus tetap utuh, tidak direset
//         expect(component.generatedQrText).toBe('PREVIOUS_SUCCESSFUL_RESULT');
//       });
//       flush();
//     }));

//     it('should show an error toast when the image fails to load entirely (corrupt file)', fakeAsync(() => {
//       const file = new File(['dummy'], 'corrupt.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageError();
//       tick();

//       promise.then(() => {
//         expect(component.toastType).toBe('error');
//         expect(component.toastMessage).toContain('Gagal memuat gambar');
//       });
//       flush();
//     }));

//     it('should always revoke the object URL, even when decoding fails', fakeAsync(() => {
//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.rejectWith(
//         new Error('fail')
//       );

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
//       });
//       flush();
//     }));

//     it('should apply EXIF-based canvas dimension swap for rotated orientations (5-8)', fakeAsync(() => {
//       (component as any).getExifOrientation.and.resolveTo(6); // 90 derajat CW

//       (component.codeReader.decodeFromCanvas as jasmine.Spy).and.resolveTo({
//         getText: () => VALID_QRIS_WITHOUT_AMOUNT
//       });

//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const promise = component.decodeQRCodeImage(file);
//       tick();
//       triggerImageLoad();
//       tick();

//       promise.then(() => {
//         expect(component.originalQrText).toBe(VALID_QRIS_WITHOUT_AMOUNT);
//       });
//       flush();
//     }));
//   });

//   // ================================================================
//   // onFileSelected()
//   // ================================================================
//   describe('onFileSelected', () => {
//     it('should set selectedFile when a file is chosen', () => {
//       const file = new File(['dummy'], 'test.png', { type: 'image/png' });
//       const event = {
//         target: { files: [file] }
//       } as unknown as Event;

//       component.onFileSelected(event);

//       expect(component.selectedFile).toBe(file);
//     });

//     it('should do nothing when no files are provided', () => {
//       const event = {
//         target: { files: [] }
//       } as unknown as Event;

//       component.onFileSelected(event);

//       expect(component.selectedFile).toBeNull();
//     });

//     it('should do nothing when files is null', () => {
//       const event = {
//         target: { files: null }
//       } as unknown as Event;

//       expect(() => component.onFileSelected(event)).not.toThrow();
//       expect(component.selectedFile).toBeNull();
//     });
//   });
// });