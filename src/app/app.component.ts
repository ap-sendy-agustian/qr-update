import { Component, ElementRef, ViewChild } from '@angular/core';
import { BrowserQRCodeReader } from '@zxing/browser';

interface TlvTag {
  tag: string;
  start: number;
  valueStart: number;
  valueEnd: number;
  value: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  codeReader: BrowserQRCodeReader;

  title = 'qr-update';

  selectedFile: File | null = null;
  imageSrc: string | ArrayBuffer | null = null;

  originalQrText: string | null = null;
  generatedQrText: string | null = null;

  newAmount = '';
  rawQrText = '';

  // NEW - Tip feature (tag 55/56/57)
  // '' = tidak ada tip sama sekali (tag 55/56/57 tidak akan ditambahkan/dihapus)
  // '01' = minta konfirmasi konsumen untuk isi tip sendiri (tanpa tag 56/57)
  // '02' = fixed tip amount (butuh tag 56)
  // '03' = percentage tip (butuh tag 57)
  tipIndicator: '' | '01' | '02' | '03' = '';
  tipValueFixed = '';
  tipValuePercentage = '';

  copiedFeedback = false;

  showCopyToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private toastTimeout?: ReturnType<typeof setTimeout>;

  @ViewChild('qrReveal')
  qrRevealRef?: ElementRef<HTMLDivElement>;

  constructor() {
    this.codeReader = new BrowserQRCodeReader();
  }

  /**
   * Remove uploaded file
   */
  removeSelectedFile(): void {
    this.selectedFile = null;
    this.imageSrc = null;

    const fileInput = document.getElementById(
      'fileUpload'
    ) as HTMLInputElement;

    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Show toast
   */
  private showToast(
    message: string,
    type: 'success' | 'error' = 'success'
  ): void {

    this.toastMessage = message;
    this.toastType = type;
    this.showCopyToast = true;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.showCopyToast = false;
    }, 2500);
  }

  /**
   * NEW - Handle perubahan pilihan Tip Indicator dari UI.
   * Reset value fixed/percentage yang tidak relevan lagi ketika
   * user ganti pilihan, supaya tidak ada state basi tertinggal.
   */
  onTipIndicatorChange(value: '' | '01' | '02' | '03'): void {
    this.tipIndicator = value;

    if (value !== '02') {
      this.tipValueFixed = '';
    }
    if (value !== '03') {
      this.tipValuePercentage = '';
    }
  }

  /**
   * Copy generated QR text
   */
  async copyToClipboard(): Promise<void> {

    if (!this.generatedQrText) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        this.generatedQrText
      );

      this.copiedFeedback = true;

      this.showToast(
        'QR text berhasil di-copy!',
        'success'
      );

      setTimeout(() => {
        this.copiedFeedback = false;
      }, 2000);

    } catch (error) {

      console.error(
        'Failed to copy QR text:',
        error
      );

      this.showToast(
        'Gagal copy QR text.',
        'error'
      );
    }
  }

  /**
   * File selected
   */
  onFileSelected(event: Event): void {

    const input =
      event.target as HTMLInputElement;

    if (
      !input.files ||
      input.files.length === 0
    ) {
      return;
    }

    const file = input.files[0];

    this.selectedFile = file;

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    this.readImage(file);
  }

  /**
   * Read uploaded image for preview
   */
  private readImage(file: File): void {

    const reader = new FileReader();

    reader.onload = () => {
      this.imageSrc = reader.result;
    };

    reader.onerror = () => {

      this.showToast(
        'Gagal membaca gambar.',
        'error'
      );

    };

    reader.readAsDataURL(file);
  }

  /**
   * Main generate method
   *
   * Image has priority.
   * Raw QR text is used only when no image is selected.
   */
  async generate(): Promise<void> {

    if (this.selectedFile) {

      console.log(
        'Sumber input: gambar (' +
        this.selectedFile.name +
        ')'
      );

      await this.decodeQRCodeImage(
        this.selectedFile
      );

      return;
    }

    if (
      this.rawQrText &&
      this.rawQrText.trim() !== ''
    ) {

      console.log(
        'Sumber input: raw QR text'
      );

      const qrText =
        this.rawQrText.trim();

      const validationError =
        this.validateQrisFormat(qrText);

      if (validationError) {

        console.error(validationError);

        this.showToast(
          validationError,
          'error'
        );

        return;
      }

      this.originalQrText = qrText;

      this.replaceQrText();

      return;
    }

    this.showToast(
      'Upload gambar QR atau paste QR text terlebih dahulu.',
      'error'
    );
  }

  /**
   * Detect HEIC / HEIF
   */
  private isHeicFile(file: File): boolean {

    return (
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name)
    );
  }

  /**
   * Decode QR code from uploaded image
   *
   * Supports:
   * - PNG
   * - JPG
   * - JPEG
   * - WEBP
   * - HEIC
   * - HEIF
   */
  async decodeQRCodeImage(
    file: File
  ): Promise<void> {

    let imageUrl: string | null = null;

    try {

      const isHeic =
        this.isHeicFile(file);

      console.log('File:', file.name);
      console.log('Type:', file.type);
      console.log('Size:', file.size);
      console.log('Is HEIC:', isHeic);

      if (isHeic) {

        console.log(
          'HEIC/HEIF detected.'
        );

        console.log(
          'Converting HEIC/HEIF to JPEG...'
        );

        const jpegBlob =
          await this.convertHeicToJpeg(file);

        console.log(
          'HEIC conversion result:',
          jpegBlob.type,
          jpegBlob.size
        );

        imageUrl =
          URL.createObjectURL(jpegBlob);

        const img =
          await this.loadImage(imageUrl);

        console.log(
          'HEIC converted to:',
          jpegBlob.type,
          jpegBlob.size
        );

        console.log(
          'Image loaded:',
          img.naturalWidth,
          'x',
          img.naturalHeight
        );

        const canvas =
          this.imageToCanvas(img);

        await this.decodeQrWithMultipleAttempts(
          canvas
        );

        return;
      }

      imageUrl =
        URL.createObjectURL(file);

      const img =
        await this.loadImage(imageUrl);

      console.log(
        'Image loaded:',
        img.naturalWidth,
        'x',
        img.naturalHeight
      );

      const canvas =
        this.imageToCanvas(img);

      await this.decodeQrWithMultipleAttempts(
        canvas
      );

    } catch (error) {

      console.error(
        'Error loading image:',
        error
      );

      this.showToast(
        'Gagal membaca gambar. Pastikan gambar tidak rusak dan merupakan foto QR yang valid.',
        'error'
      );

    } finally {

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    }
  }

  /**
   * Convert HEIC/HEIF to JPEG.
   */
  private async convertHeicToJpeg(
    file: File
  ): Promise<Blob> {

    const ImageDecoderConstructor =
      (window as any).ImageDecoder;

    if (ImageDecoderConstructor) {

      try {

        console.log(
          'Trying browser ImageDecoder...'
        );

        const buffer =
          await file.arrayBuffer();

        const decoder =
          new ImageDecoderConstructor({
            data: buffer,
            type: file.type || 'image/heic'
          });

        const result =
          await decoder.decode();

        const frame =
          result.image;

        const canvas =
          document.createElement('canvas');

        canvas.width =
          frame.displayWidth;

        canvas.height =
          frame.displayHeight;

        const context =
          canvas.getContext('2d');

        if (!context) {
          throw new Error(
            'CANVAS_CONTEXT_ERROR'
          );
        }

        context.drawImage(
          frame,
          0,
          0
        );

        return await this.canvasToJpeg(
          canvas
        );

      } catch (error) {

        console.warn(
          'ImageDecoder failed:',
          error
        );
      }
    }

    throw new Error(
      'HEIC_CONVERSION_NOT_SUPPORTED'
    );
  }

  /**
   * Load image from object URL
   */
  private loadImage(
    imageUrl: string
  ): Promise<HTMLImageElement> {

    return new Promise(
      (resolve, reject) => {

        const image =
          new Image();

        image.onload = () => {
          resolve(image);
        };

        image.onerror = () => {
          reject(
            new Error(
              'IMAGE_LOAD_ERROR'
            )
          );
        };

        image.src = imageUrl;
      }
    );
  }

  /**
   * Convert HTMLImageElement to canvas
   */
  private imageToCanvas(
    img: HTMLImageElement
  ): HTMLCanvasElement {

    const canvas =
      document.createElement('canvas');

    canvas.width =
      img.naturalWidth || img.width;

    canvas.height =
      img.naturalHeight || img.height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'CANVAS_CONTEXT_ERROR'
      );
    }

    context.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas;
  }

  /**
   * Convert canvas to JPEG
   */
  private canvasToJpeg(
    canvas: HTMLCanvasElement
  ): Promise<Blob> {

    return new Promise(
      (resolve, reject) => {

        canvas.toBlob(
          blob => {

            if (!blob) {

              reject(
                new Error(
                  'JPEG_CONVERSION_FAILED'
                )
              );

              return;
            }

            resolve(blob);
          },
          'image/jpeg',
          0.95
        );
      }
    );
  }

  /**
   * MULTI QR DECODE
   */
  private async decodeQrWithMultipleAttempts(
    originalCanvas: HTMLCanvasElement
  ): Promise<void> {

    console.log(
      'Starting multi-attempt QR detection...'
    );

    const attempts: HTMLCanvasElement[] = [];

    attempts.push(
      originalCanvas
    );

    attempts.push(
      this.resizeCanvas(
        originalCanvas,
        1600
      )
    );

    attempts.push(
      this.resizeCanvas(
        originalCanvas,
        1000
      )
    );

    attempts.push(
      this.createGrayscaleCanvas(
        originalCanvas
      )
    );

    attempts.push(
      this.createContrastCanvas(
        originalCanvas,
        1.5
      )
    );

    attempts.push(
      this.createCenterCropCanvas(
        originalCanvas,
        0.75
      )
    );

    const centerCrop =
      this.createCenterCropCanvas(
        originalCanvas,
        0.60
      );

    attempts.push(
      this.resizeCanvas(
        centerCrop,
        1600
      )
    );

    for (
      let i = 0;
      i < attempts.length;
      i++
    ) {

      console.log(
        `Attempting QR decode #${i + 1}...`
      );

      try {

        const result =
          await this.codeReader.decodeFromCanvas(
            attempts[i]
          );

        const qrText =
          result.getText();

        console.log(
          `QR detected on attempt #${i + 1}:`,
          qrText
        );

        const validationError =
          this.validateQrisFormat(
            qrText
          );

        if (validationError) {

          console.warn(
            `Attempt #${i + 1} detected a QR, but it is not valid QRIS:`,
            validationError
          );

          continue;
        }

        this.originalQrText =
          qrText;

        this.replaceQrText();

        return;

      } catch (error) {

        console.log(
          `QR decode failed on attempt #${i + 1}`,
          error
        );
      }
    }

    console.error(
      'All QR detection attempts failed.'
    );

    this.showToast(
      'QR tidak berhasil dibaca. Pastikan QR terlihat jelas, tidak terlalu miring, dan seluruh QR masuk ke dalam foto.',
      'error'
    );
  }

  /**
   * Resize canvas while keeping aspect ratio.
   */
  private resizeCanvas(
    source: HTMLCanvasElement,
    maxSize: number
  ): HTMLCanvasElement {

    const sourceWidth =
      source.width;

    const sourceHeight =
      source.height;

    const scale =
      Math.min(
        1,
        maxSize /
          Math.max(
            sourceWidth,
            sourceHeight
          )
      );

    const width =
      Math.max(
        1,
        Math.round(
          sourceWidth * scale
        )
      );

    const height =
      Math.max(
        1,
        Math.round(
          sourceHeight * scale
        )
      );

    const canvas =
      document.createElement('canvas');

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      return source;
    }

    context.imageSmoothingEnabled =
      true;

    context.imageSmoothingQuality =
      'high';

    context.drawImage(
      source,
      0,
      0,
      width,
      height
    );

    return canvas;
  }

  /**
   * Create grayscale version.
   */
  private createGrayscaleCanvas(
    source: HTMLCanvasElement
  ): HTMLCanvasElement {

    const canvas =
      document.createElement('canvas');

    canvas.width =
      source.width;

    canvas.height =
      source.height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      return source;
    }

    context.drawImage(
      source,
      0,
      0
    );

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const data =
      imageData.data;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {

      const gray =
        (
          data[i] * 0.299 +
          data[i + 1] * 0.587 +
          data[i + 2] * 0.114
        );

      data[i] =
        gray;

      data[i + 1] =
        gray;

      data[i + 2] =
        gray;
    }

    context.putImageData(
      imageData,
      0,
      0
    );

    return canvas;
  }

  /**
   * Create contrast-enhanced canvas.
   */
  private createContrastCanvas(
    source: HTMLCanvasElement,
    contrast: number
  ): HTMLCanvasElement {

    const canvas =
      document.createElement('canvas');

    canvas.width =
      source.width;

    canvas.height =
      source.height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      return source;
    }

    context.drawImage(
      source,
      0,
      0
    );

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const data =
      imageData.data;

    const factor =
      (259 * (contrast + 255)) /
      (255 * (259 - contrast));

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {

      data[i] =
        this.clamp(
          factor * (data[i] - 128) + 128
        );

      data[i + 1] =
        this.clamp(
          factor * (data[i + 1] - 128) + 128
        );

      data[i + 2] =
        this.clamp(
          factor * (data[i + 2] - 128) + 128
        );
    }

    context.putImageData(
      imageData,
      0,
      0
    );

    return canvas;
  }

  /**
   * Center crop.
   */
  private createCenterCropCanvas(
    source: HTMLCanvasElement,
    ratio: number
  ): HTMLCanvasElement {

    const cropWidth =
      Math.floor(
        source.width * ratio
      );

    const cropHeight =
      Math.floor(
        source.height * ratio
      );

    const startX =
      Math.floor(
        (source.width - cropWidth) / 2
      );

    const startY =
      Math.floor(
        (source.height - cropHeight) / 2
      );

    const canvas =
      document.createElement('canvas');

    canvas.width =
      cropWidth;

    canvas.height =
      cropHeight;

    const context =
      canvas.getContext('2d');

    if (!context) {
      return source;
    }

    context.drawImage(
      source,
      startX,
      startY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return canvas;
  }

  /**
   * Clamp RGB value.
   */
  private clamp(value: number): number {

    return Math.max(
      0,
      Math.min(
        255,
        value
      )
    );
  }

  /**
   * Validate QRIS MPM structure
   */
  private validateQrisFormat(
    qrText: string
  ): string | null {

    if (
      !qrText ||
      qrText.trim() === ''
    ) {

      return 'QR text kosong.';
    }

    const trimmed =
      qrText.trim();

    if (trimmed.length < 20) {

      return 'QR text terlalu pendek, kemungkinan bukan QRIS yang valid.';
    }

    if (
      !trimmed.startsWith('000201')
    ) {

      return 'Format QR tidak dikenali - Payload Format Indicator (tag 00) tidak sesuai.';
    }

    if (trimmed.length < 4) {
      return 'QR text tidak memiliki CRC.';
    }

    const withoutCrc =
      trimmed.slice(0, -4);

    const allTags =
      this.parseAllTags(
        withoutCrc
      );

    const tag01 =
      allTags.get('01');

    if (!tag01) {

      return 'QR tidak valid - Point of Initiation Method (tag 01) tidak ditemukan.';
    }

    if (
      tag01.value !== '11' &&
      tag01.value !== '12'
    ) {

      return 'QR ini bukan format QRIS MPM (Point of Initiation Method tidak sesuai).';
    }

    const merchantAccountTags = [
      '02',
      '04',
      '26',
      '27',
      '28',
      '29',
      '30',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
      '37',
      '38',
      '39',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
      '48',
      '49',
      '50',
      '51'
    ];

    const hasMerchantAccount =
      merchantAccountTags.some(
        tag => allTags.has(tag)
      );

    if (!hasMerchantAccount) {

      return 'QR tidak valid - Merchant Account Information tidak ditemukan.';
    }

    if (!allTags.has('52')) {

      return 'QR tidak valid - Merchant Category Code (tag 52) tidak ditemukan.';
    }

    const tag53 =
      allTags.get('53');

    if (!tag53) {

      return 'QR tidak valid - tag mata uang (53) tidak ditemukan.';
    }

    if (
      tag53.value !== '360'
    ) {

      return 'QR tidak valid - mata uang bukan Rupiah (kode currency harus 360).';
    }

    const tag58 =
      allTags.get('58');

    if (
      !tag58 ||
      tag58.value !== 'ID'
    ) {

      return 'QR tidak valid - Country Code (tag 58) harus "ID".';
    }

    const tag59 =
      allTags.get('59');

    if (
      !tag59 ||
      tag59.value.trim() === ''
    ) {

      return 'QR tidak valid - Merchant Name (tag 59) tidak ditemukan.';
    }

    const tag60 =
      allTags.get('60');

    if (
      !tag60 ||
      tag60.value.trim() === ''
    ) {

      return 'QR tidak valid - Merchant City (tag 60) tidak ditemukan.';
    }

    const crc =
      trimmed.slice(-4);

    if (
      !/^[0-9A-Fa-f]{4}$/.test(crc)
    ) {

      return 'QR tidak valid - CRC checksum (tag 63) tidak sesuai format.';
    }

    return null;
  }

  /**
   * NEW - Validasi input Tip (tag 55/56/57) sesuai spesifikasi ASPI.
   * Return null kalau valid / tidak ada tip yang dipilih (tipIndicator kosong).
   */
  private validateTipInputs(): string | null {

    if (!this.tipIndicator) {
      return null;
    }

    if (!['01', '02', '03'].includes(this.tipIndicator)) {
      return 'Tip Indicator tidak valid.';
    }

    if (this.tipIndicator === '02') {

      const val = this.tipValueFixed?.trim();

      if (!val) {
        return 'Nominal tip (Fixed) wajib diisi.';
      }

      // 4.7.10.2 - hanya digit 0-9 dan boleh satu titik desimal, tidak negatif
      if (!/^\d+(\.\d+)?$/.test(val)) {
        return 'Nominal tip (Fixed) hanya boleh berisi angka dan titik desimal.';
      }

      // 4.7.10.1 - value tidak boleh "0"
      if (parseFloat(val) === 0) {
        return 'Nominal tip (Fixed) tidak boleh 0.';
      }
    }

    if (this.tipIndicator === '03') {

      const val = this.tipValuePercentage?.trim();

      if (!val) {
        return 'Persentase tip wajib diisi.';
      }

      // 4.7.11.2 - hanya digit 0-9 dan boleh satu titik desimal
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(val)) {
        return 'Format persentase tip tidak valid (hanya angka dan titik, contoh: 5.5 atau 10).';
      }

      // 4.7.11.1 - range 00.01 s.d 99.99
      const num = parseFloat(val);
      if (num < 0.01 || num > 99.99) {
        return 'Persentase tip harus di antara 0.01 dan 99.99.';
      }
    }

    return null;
  }

  /**
   * Generate CRC16 checksum
   */
  generateChecksum(
    payload: string
  ): string {

    let checksum =
      0xffff;

    const polynomial =
      0x1021;

    const data =
      new TextEncoder()
        .encode(payload);

    for (const b of data) {

      for (
        let i = 0;
        i < 8;
        i++
      ) {

        const bit =
          (b >> (7 - i)) & 1;

        const c15 =
          (checksum >> 15) & 1;

        checksum <<= 1;

        if (c15 ^ bit) {
          checksum ^= polynomial;
        }
      }
    }

    checksum &= 0xffff;

    return checksum
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
  }

  /**
   * Parse QRIS TLV
   */
  private parseAllTags(
    qrText: string
  ): Map<string, TlvTag> {

    const tags =
      new Map<string, TlvTag>();

    let index = 0;

    while (
      index < qrText.length - 4
    ) {

      const currentTag =
        qrText.substring(
          index,
          index + 2
        );

      const lengthStr =
        qrText.substring(
          index + 2,
          index + 4
        );

      const length =
        parseInt(
          lengthStr,
          10
        );

      if (isNaN(length)) {
        break;
      }

      const valueStart =
        index + 4;

      const valueEnd =
        valueStart + length;

      const value =
        qrText.substring(
          valueStart,
          valueEnd
        );

      tags.set(
        currentTag,
        {
          tag: currentTag,
          start: index,
          valueStart,
          valueEnd,
          value
        }
      );

      index =
        valueEnd;
    }

    return tags;
  }

  /**
   * NEW - Upsert (insert/update) atau remove sebuah tag di dalam string QRIS.
   *
   * - Kalau value === null -> tag akan DIHAPUS kalau ada (dan dibiarkan
   *   kalau memang belum ada).
   * - Kalau value diisi -> tag akan di-UPDATE kalau sudah ada di posisi yang
   *   sama, atau di-INSERT setelah anchorTag berakhir kalau belum ada.
   *
   * Dipakai bareng-bareng untuk tag 54 (amount, selalu ada) maupun tag
   * 55/56/57 (tip, optional - bisa insert/update/remove tergantung pilihan
   * user di UI).
   */
  /**
   * FIXED - Upsert (insert/update) atau remove sebuah tag di dalam string QRIS.
   *
   * - Kalau value === null -> tag akan DIHAPUS kalau ada (dan dibiarkan
   *   kalau memang belum ada).
   * - Kalau value diisi -> tag akan di-UPDATE kalau sudah ada di posisi yang
   *   sama, atau di-INSERT setelah anchor pertama yang DITEMUKAN dari daftar
   *   anchorTags (dicoba berurutan dari yang paling spesifik/dekat).
   *
   * PENTING (bug fix): sebelumnya kalau anchor tunggal tidak ditemukan,
   * fallback-nya adalah qrText.length (ujung string) - ini SALAH karena
   * qrText di titik ini masih menyisakan header tag 63 ("6304") yang belum
   * di-strip, jadi insert di posisi itu bikin tag baru nyempil SETELAH
   * header tag 63, merusak struktur QR (contoh kasus: insert tag 57 saat
   * tag 56 tidak ada, karena mode Percentage memang tidak pernah membuat
   * tag 56 sama sekali).
   *
   * Sekarang anchorTags berupa array prioritas - dicoba satu-satu dari
   * yang paling dekat, dan HARUS selalu berakhir di tag yang dijamin ada
   * (tag 53), bukan pernah jatuh ke ujung string mentah.
   */
  private upsertOrRemoveTag(
    qrText: string,
    tag: string,
    value: string | null,
    anchorTags: string[]
  ): string {

    const allTags =
      this.parseAllTags(qrText);

    const existing =
      allTags.get(tag);

    if (value === null) {

      if (!existing) {
        return qrText;
      }

      return (
        qrText.slice(0, existing.start) +
        qrText.slice(existing.valueEnd)
      );
    }

    const length =
      value.length;

    const lengthStr =
      length < 10
        ? `0${length}`
        : length.toString();

    const tlv =
      tag + lengthStr + value;

    if (existing) {

      return (
        qrText.slice(0, existing.start) +
        tlv +
        qrText.slice(existing.valueEnd)
      );
    }

    // Cari anchor pertama yang benar-benar ada, berurutan sesuai prioritas.
    // anchorTags WAJIB diakhiri dengan '53' oleh pemanggil, supaya selalu
    // ada fallback yang valid dan tidak pernah jatuh ke qrText.length.
    let insertPos: number | null = null;

    for (const candidateTag of anchorTags) {
      const anchor = allTags.get(candidateTag);
      if (anchor) {
        insertPos = anchor.valueEnd;
        break;
      }
    }

    if (insertPos === null) {
      // Ini seharusnya tidak pernah terjadi selama '53' selalu ada di
      // anchorTags dan tag 53 sendiri sudah divalidasi ada sebelumnya
      // di replaceQrText(). Sebagai safety net terakhir saja.
      console.error(
        `Tidak ada anchor valid ditemukan untuk tag ${tag}, kemungkinan bug struktur QR.`
      );
      insertPos = qrText.length;
    }

    return this.insertStringAt(
      qrText,
      tlv,
      insertPos
    );
  }

  /**
   * Replace / insert tag 54, plus tag 55/56/57 (tip) kalau dipilih.
   */
  replaceQrText(): void {

    if (
      this.originalQrText == null
    ) {
      return;
    }

    const amount =
      this.newAmount &&
      this.newAmount.trim() !== ''
        ? this.newAmount.trim()
        : '0';

    let workingText =
      this.originalQrText.slice(0, -4);

    const allTags =
      this.parseAllTags(
        workingText
      );

    const tag53 =
      allTags.get('53');

    if (!tag53) {

      this.showToast(
        'QR tidak valid - tag mata uang (53) tidak ditemukan.',
        'error'
      );

      return;
    }

    // NEW - Validasi input tip SEBELUM ada perubahan apa pun ke QR
    const tipValidationError =
      this.validateTipInputs();

    if (tipValidationError) {

      this.showToast(
        tipValidationError,
        'error'
      );

      return;
    }

    // --- Tag 54 (Transaction Amount) ---
    workingText = this.upsertOrRemoveTag(
      workingText,
      '54',
      amount,
      ['53']
    );

    // NEW --- Tag 55 (Tip Indicator) ---
    // null kalau tipIndicator kosong -> tag 55 (dan 56/57) otomatis
    // dihapus dari QR kalau sebelumnya sempat ada.
    workingText = this.upsertOrRemoveTag(
      workingText,
      '55',
      this.tipIndicator || null,
      ['54', '53']
    );

    // NEW --- Tag 56 (Tip Value Fixed) ---
    // hanya diisi kalau tipIndicator === '02', selain itu dihapus.
    const fixedValue =
      this.tipIndicator === '02'
        ? this.tipValueFixed.trim()
        : null;

    workingText = this.upsertOrRemoveTag(
      workingText,
      '56',
      fixedValue,
      ['55', '54', '53']
    );

    // NEW --- Tag 57 (Tip Value Percentage) ---
    // hanya diisi kalau tipIndicator === '03', selain itu dihapus.
    // FIX: anchor sekarang berjenjang ['56','55','54','53'] - karena mode
    // Percentage TIDAK PERNAH membuat tag 56, jadi kalau cuma mengandalkan
    // anchor tunggal '56', dia akan gagal ditemukan dan (sebelum fix ini)
    // jatuh ke ujung string yang salah. Sekarang otomatis fallback ke '55'
    // (yang pasti ada di mode ini), tanpa pernah menyentuh qrText.length.
    const percentageValue =
      this.tipIndicator === '03'
        ? this.tipValuePercentage.trim()
        : null;

    workingText = this.upsertOrRemoveTag(
      workingText,
      '57',
      percentageValue,
      ['56', '55', '54', '53']
    );

    console.log(
      'yang baru : ' +
      workingText
    );

    const checksum =
      this.generateChecksum(
        workingText
      );

    console.log(
      'checksum nya: ' +
      checksum
    );

    const finalQrText =
      workingText +
      checksum;

    console.log(
      'new nya: ' +
      finalQrText
    );

    /**
     * Only update result after
     * everything succeeds.
     */
    this.generatedQrText =
      finalQrText;

    requestAnimationFrame(() => {
      this.restartRevealAnimation();
    });
  }

  /**
   * Restart reveal animation
   */
  private restartRevealAnimation(): void {

    const el =
      this.qrRevealRef?.nativeElement;

    if (!el) {
      return;
    }

    el.style.animation =
      'none';

    void el.offsetWidth;

    el.style.animation =
      '';
  }

  /**
   * Insert string
   */
  insertStringAt(
    originalString: string,
    stringToInsert: string,
    index: number
  ): string {

    if (
      index > originalString.length
    ) {

      index =
        originalString.length;
    }

    return (
      originalString.slice(
        0,
        index
      ) +
      stringToInsert +
      originalString.slice(
        index
      )
    );
  }
}