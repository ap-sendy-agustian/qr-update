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
   * Show toast message
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
      input.files &&
      input.files.length > 0
    ) {

      const file = input.files[0];

      this.selectedFile = file;

      console.log('Selected file:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      this.readImage(file);
    }
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

      this.originalQrText =
        this.rawQrText.trim();

      this.runValidationAndReplace();

      return;
    }

    this.showToast(
      'Upload gambar QR atau paste QR text terlebih dahulu.',
      'error'
    );
  }

  /**
   * Decode QR code from uploaded image.
   *
   * Strategy:
   *
   * 1. Load image properly using Promise.
   * 2. Try direct ZXing image decoding.
   * 3. If that fails, fallback to canvas.
   * 4. Resize huge iPhone photos before canvas decoding.
   */
  async decodeQRCodeImage(
    file: File
  ): Promise<void> {

    const imageUrl =
      URL.createObjectURL(file);

    try {

      /*
       * ==================================================
       * LOAD IMAGE
       * ==================================================
       */
      const img =
        await this.loadImage(imageUrl);

      console.log(
        'Image loaded:',
        {
          width: img.width,
          height: img.height,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          fileType: file.type,
          fileSize: file.size
        }
      );

      /*
       * ==================================================
       * 1. DIRECT IMAGE DECODING
       * ==================================================
       *
       * Try decoding directly from HTMLImageElement.
       *
       * This avoids forcing every image through canvas
       * first and is useful for Safari/iOS.
       */
      try {

        console.log(
          'Trying direct image decoding...'
        );

        const result =
          await this.codeReader
            .decodeFromImageElement(img);

        const qrText =
          result.getText();

        console.log(
          'QR decoded directly:',
          qrText
        );

        const validationError =
          this.validateQrisFormat(qrText);

        if (validationError) {

          console.error(
            validationError
          );

          this.showToast(
            validationError,
            'error'
          );

          return;
        }

        /*
         * Only update state after QR
         * successfully passes validation.
         */
        this.originalQrText =
          qrText;

        this.replaceQrText();

        return;

      } catch (directError) {

        console.warn(
          'Direct image decoding failed. Trying canvas fallback...',
          directError
        );
      }

      /*
       * ==================================================
       * 2. CANVAS FALLBACK
       * ==================================================
       */

      console.log(
        'Trying canvas decoding...'
      );

      const canvas =
        document.createElement('canvas');

      const context =
        canvas.getContext(
          '2d',
          {
            willReadFrequently: true
          }
        );

      if (!context) {

        this.showToast(
          'Gagal memproses gambar.',
          'error'
        );

        return;
      }

      /*
       * iPhone photos can be very large.
       *
       * Example:
       * 4032 x 3024
       *
       * We don't need that much resolution
       * for QR detection.
       */
      const MAX_SIZE = 2000;

      let width =
        img.naturalWidth ||
        img.width;

      let height =
        img.naturalHeight ||
        img.height;

      const largestDimension =
        Math.max(
          width,
          height
        );

      const scale =
        Math.min(
          1,
          MAX_SIZE / largestDimension
        );

      width =
        Math.round(
          width * scale
        );

      height =
        Math.round(
          height * scale
        );

      console.log(
        'Canvas size:',
        {
          width,
          height,
          scale
        }
      );

      canvas.width = width;
      canvas.height = height;

      context.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      /*
       * ==================================================
       * CANVAS QR DECODING
       * ==================================================
       */
      try {

        const result =
          await this.codeReader
            .decodeFromCanvas(canvas);

        const qrText =
          result.getText();

        console.log(
          'QR decoded from canvas:',
          qrText
        );

        const validationError =
          this.validateQrisFormat(qrText);

        if (validationError) {

          console.error(
            validationError
          );

          this.showToast(
            validationError,
            'error'
          );

          return;
        }

        /*
         * Only update state after validation.
         */
        this.originalQrText =
          qrText;

        this.replaceQrText();

      } catch (canvasError) {

        console.error(
          'Canvas QR decoding failed:',
          canvasError
        );

        this.showToast(
          'Gambar tidak mengandung QR code yang bisa dibaca. Pastikan seluruh QR terlihat jelas dan tidak blur.',
          'error'
        );
      }

    } catch (error) {

      console.error(
        'Error loading image:',
        error
      );

      this.showToast(
        'Gagal memuat gambar. Pastikan file yang diupload adalah gambar yang valid.',
        'error'
      );

    } finally {

      /*
       * Release object URL.
       */
      URL.revokeObjectURL(imageUrl);
    }
  }

  /**
   * Load image and wait until it is completely loaded.
   *
   * Important:
   *
   * This fixes the old async onload flow where
   * decodeQRCodeImage() could finish before img.onload.
   */
  private loadImage(
    imageUrl: string
  ): Promise<HTMLImageElement> {

    return new Promise(
      (resolve, reject) => {

        const img =
          new Image();

        img.onload = () => {
          resolve(img);
        };

        img.onerror = () => {
          reject(
            new Error(
              'IMAGE_LOAD_ERROR'
            )
          );
        };

        img.src = imageUrl;
      }
    );
  }

  /**
   * Validate raw QR text before replacing amount.
   */
  private runValidationAndReplace(): void {

    if (!this.originalQrText) {
      return;
    }

    const validationError =
      this.validateQrisFormat(
        this.originalQrText
      );

    if (validationError) {

      console.error(
        validationError
      );

      this.showToast(
        validationError,
        'error'
      );

      return;
    }

    this.replaceQrText();
  }

  /**
   * Validate QRIS MPM structure.
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
      !trimmed.startsWith(
        '000201'
      )
    ) {

      return 'Format QR tidak dikenali - Payload Format Indicator (tag 00) tidak sesuai.';
    }

    /*
     * Remove CRC.
     */
    const withoutCrc =
      trimmed.slice(0, -4);

    const allTags =
      this.parseAllTags(
        withoutCrc
      );

    /*
     * Tag 01
     */
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

    /*
     * Merchant Account Information
     */
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

    /*
     * Tag 52
     */
    if (!allTags.has('52')) {

      return 'QR tidak valid - Merchant Category Code (tag 52) tidak ditemukan.';
    }

    /*
     * Tag 53 - Currency
     */
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

    /*
     * Tag 58 - Country
     */
    const tag58 =
      allTags.get('58');

    if (
      !tag58 ||
      tag58.value !== 'ID'
    ) {

      return 'QR tidak valid - Country Code (tag 58) harus "ID".';
    }

    /*
     * Tag 59 - Merchant Name
     */
    const tag59 =
      allTags.get('59');

    if (
      !tag59 ||
      tag59.value.trim() === ''
    ) {

      return 'QR tidak valid - Merchant Name (tag 59) tidak ditemukan.';
    }

    /*
     * Tag 60 - Merchant City
     */
    const tag60 =
      allTags.get('60');

    if (
      !tag60 ||
      tag60.value.trim() === ''
    ) {

      return 'QR tidak valid - Merchant City (tag 60) tidak ditemukan.';
    }

    /*
     * CRC format
     */
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
   * Generate CRC16 checksum.
   */
  generateChecksum(
    payload: string
  ): string {

    let checksum = 0xffff;

    const polynomial = 0x1021;

    const data =
      new TextEncoder().encode(
        payload
      );

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
   * Parse QRIS TLV structure.
   */
  private parseAllTags(
    qrText: string
  ): Map<string, TlvTag> {

    const tags =
      new Map<string, TlvTag>();

    let index = 0;

    while (
      index <
      qrText.length - 4
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

      index = valueEnd;
    }

    return tags;
  }

  /**
   * Replace or insert tag 54.
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

    const withoutCrc =
      this.originalQrText.slice(
        0,
        -4
      );

    const allTags =
      this.parseAllTags(
        withoutCrc
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

    const tag = '54';

    const length =
      amount.length;

    const lengthStr =
      length < 10
        ? `0${length}`
        : length.toString();

    const tlv =
      tag +
      lengthStr +
      amount;

    const existingTag54 =
      allTags.get('54');

    let newQrText: string;

    /*
     * Update existing tag 54.
     */
    if (existingTag54) {

      console.log(
        'Tag 54 sudah ada, melakukan update di posisi: ' +
        existingTag54.start
      );

      newQrText =
        withoutCrc.slice(
          0,
          existingTag54.start
        ) +
        tlv +
        withoutCrc.slice(
          existingTag54.valueEnd
        );

    } else {

      /*
       * Insert new tag 54 after tag 53.
       */
      console.log(
        'Tag 54 belum ada, insert baru setelah tag 53 berakhir di: ' +
        tag53.valueEnd
      );

      newQrText =
        this.insertStringAt(
          withoutCrc,
          tlv,
          tag53.valueEnd
        );
    }

    console.log(
      'QR tanpa CRC:',
      newQrText
    );

    /*
     * Generate new CRC.
     */
    const checksum =
      this.generateChecksum(
        newQrText
      );

    console.log(
      'Checksum:',
      checksum
    );

    const finalQrText =
      newQrText +
      checksum;

    console.log(
      'Final QR:',
      finalQrText
    );

    /*
     * Only update generatedQrText
     * after everything succeeds.
     *
     * This prevents the result card
     * from disappearing on errors.
     */
    this.generatedQrText =
      finalQrText;

    /*
     * Restart reveal animation.
     */
    requestAnimationFrame(
      () => {
        this.restartRevealAnimation();
      }
    );
  }

  /**
   * Restart QR reveal animation
   * without destroying/recreating DOM.
   */
  private restartRevealAnimation(): void {

    const el =
      this.qrRevealRef?.nativeElement;

    if (!el) {
      return;
    }

    el.style.animation = 'none';

    /*
     * Force browser reflow.
     */
    void el.offsetWidth;

    el.style.animation = '';
  }

  /**
   * Insert string at specific position.
   */
  insertStringAt(
    originalString: string,
    stringToInsert: string,
    index: number
  ): string {

    if (
      index >
      originalString.length
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
      originalString.slice(index)
    );
  }
}