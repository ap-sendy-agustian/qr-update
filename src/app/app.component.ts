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

  title = 'qr-update';

  codeReader: BrowserQRCodeReader;

  selectedFile: File | null = null;
  imageSrc: string | ArrayBuffer | null = null;

  originalQrText: string | null = null;
  generatedQrText: string | null = null;

  newAmount = '';
  rawQrText = '';

  copiedFeedback = false;

  // Toast
  showCopyToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private toastTimeout?: ReturnType<typeof setTimeout>;

  // Prevent multiple generate/decode at the same time
  isGenerating = false;

  @ViewChild('qrReveal')
  qrRevealRef?: ElementRef<HTMLDivElement>;

  constructor() {
    this.codeReader = new BrowserQRCodeReader();
  }

  /**
   * Remove uploaded file.
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
   * Show toast message.
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
   * Copy generated QR text.
   */
  async copyToClipboard(): Promise<void> {
    if (!this.generatedQrText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.generatedQrText);

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
   * File selected.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.selectedFile = file;

    this.readImage(file);
  }

  /**
   * Read uploaded image for preview.
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
   * Main generate method.
   *
   * Image has priority.
   * Raw QR text is used only when no image is selected.
   */
  async generate(): Promise<void> {

    // Prevent multiple generate requests
    // while the image is still being decoded.
    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;

    try {

      /**
       * IMAGE HAS PRIORITY
       */
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

      /**
       * FALLBACK TO RAW TEXT
       */
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

          console.error(
            validationError
          );

          this.showToast(
            validationError,
            'error'
          );

          return;
        }

        // Only update original QR after
        // validation succeeds.
        this.originalQrText = qrText;

        this.replaceQrText();

        return;
      }

      /**
       * NOTHING SELECTED
       */
      this.showToast(
        'Upload gambar QR atau paste QR text terlebih dahulu.',
        'error'
      );

    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Decode QR code from uploaded image.
   */
  async decodeQRCodeImage(
    file: File
  ): Promise<void> {

    const imageUrl =
      URL.createObjectURL(file);

    try {

      /**
       * Load image.
       */
      const img =
        await new Promise<HTMLImageElement>(
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

      /**
       * Create canvas.
       */
      const canvas =
        document.createElement('canvas');

      const context =
        canvas.getContext('2d');

      if (!context) {

        this.showToast(
          'Gagal memproses gambar.',
          'error'
        );

        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      context.drawImage(
        img,
        0,
        0,
        img.width,
        img.height
      );

      try {

        /**
         * Decode QR.
         */
        const result =
          await this.codeReader.decodeFromCanvas(
            canvas
          );

        const qrText =
          result.getText();

        console.log(
          'QR Code Text:',
          qrText
        );

        /**
         * Validate QRIS BEFORE
         * changing application state.
         */
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

          // IMPORTANT:
          // Do not touch generatedQrText.
          // Do not touch originalQrText.
          return;
        }

        /**
         * Only assign originalQrText
         * after validation succeeds.
         */
        this.originalQrText = qrText;

        /**
         * Generate new QR.
         */
        this.replaceQrText();

      } catch (error) {

        console.error(
          'Error decoding QR code:',
          error
        );

        /**
         * This is expected when the image
         * does not contain a readable QR code.
         */
        this.showToast(
          'Gambar tidak mengandung QR code yang bisa dibaca.',
          'error'
        );

        // IMPORTANT:
        // Do not reset generatedQrText.
        return;
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

      return;

    } finally {

      URL.revokeObjectURL(
        imageUrl
      );
    }
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

    /**
     * Basic length check.
     */
    if (trimmed.length < 20) {
      return 'QR text terlalu pendek, kemungkinan bukan QRIS yang valid.';
    }

    /**
     * Payload Format Indicator.
     */
    if (!trimmed.startsWith('000201')) {
      return 'Format QR tidak dikenali - Payload Format Indicator (tag 00) tidak sesuai.';
    }

    /**
     * QRIS should contain CRC at the end.
     */
    if (trimmed.length < 8) {
      return 'QR tidak valid - data QR terlalu pendek.';
    }

    const crc =
      trimmed.slice(-4);

    if (!/^[0-9A-Fa-f]{4}$/.test(crc)) {
      return 'QR tidak valid - CRC checksum (tag 63) tidak sesuai format.';
    }

    /**
     * Remove CRC.
     */
    const withoutCrc =
      trimmed.slice(0, -4);

    const allTags =
      this.parseAllTags(withoutCrc);

    /**
     * Tag 01
     * Point of Initiation Method
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

    /**
     * Merchant Account Information.
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

    /**
     * Tag 52
     * Merchant Category Code.
     */
    if (!allTags.has('52')) {
      return 'QR tidak valid - Merchant Category Code (tag 52) tidak ditemukan.';
    }

    /**
     * Tag 53
     * Transaction Currency.
     */
    const tag53 =
      allTags.get('53');

    if (!tag53) {
      return 'QR tidak valid - tag mata uang (53) tidak ditemukan.';
    }

    if (tag53.value !== '360') {
      return 'QR tidak valid - mata uang bukan Rupiah (kode currency harus 360).';
    }

    /**
     * Tag 58
     * Country Code.
     */
    const tag58 =
      allTags.get('58');

    if (
      !tag58 ||
      tag58.value !== 'ID'
    ) {
      return 'QR tidak valid - Country Code (tag 58) harus "ID".';
    }

    /**
     * Tag 59
     * Merchant Name.
     */
    const tag59 =
      allTags.get('59');

    if (
      !tag59 ||
      tag59.value.trim() === ''
    ) {
      return 'QR tidak valid - Merchant Name (tag 59) tidak ditemukan.';
    }

    /**
     * Tag 60
     * Merchant City.
     */
    const tag60 =
      allTags.get('60');

    if (
      !tag60 ||
      tag60.value.trim() === ''
    ) {
      return 'QR tidak valid - Merchant City (tag 60) tidak ditemukan.';
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

      for (let i = 0; i < 8; i++) {

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
      index + 4 <= qrText.length
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

      /**
       * Length must contain
       * exactly numeric characters.
       */
      if (!/^\d{2}$/.test(lengthStr)) {
        break;
      }

      const length =
        parseInt(
          lengthStr,
          10
        );

      const valueStart =
        index + 4;

      const valueEnd =
        valueStart + length;

      /**
       * Invalid/incomplete TLV.
       */
      if (
        valueEnd > qrText.length
      ) {
        break;
      }

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
   * Replace or insert Tag 54.
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

    /**
     * Remove existing CRC.
     */
    const withoutCrc =
      this.originalQrText.slice(0, -4);

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

    /**
     * Tag 54 = Transaction Amount.
     */
    const tag = '54';

    const length =
      amount.length;

    if (length > 99) {

      this.showToast(
        'Nominal terlalu panjang. Maksimal 99 karakter.',
        'error'
      );

      return;
    }

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

    /**
     * Update existing Tag 54.
     */
    if (existingTag54) {

      console.log(
        'Tag 54 sudah ada, melakukan update.'
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

      /**
       * Insert Tag 54 after Tag 53.
       */
      console.log(
        'Tag 54 belum ada, insert setelah tag 53.'
      );

      newQrText =
        this.insertStringAt(
          withoutCrc,
          tlv,
          tag53.valueEnd
        );
    }

    /**
     * Generate new CRC.
     */
    const checksum =
      this.generateChecksum(
        newQrText + '6304'
      );

    /**
     * Important:
     * CRC is calculated over
     * payload + "6304".
     */
    const finalQrText =
      newQrText +
      '6304' +
      checksum;

    console.log(
      'Generated QR:',
      finalQrText
    );

    /**
     * ONLY HERE do we update
     * the generated QR.
     *
     * Therefore errors before this
     * point cannot make the result
     * disappear.
     */
    this.generatedQrText =
      finalQrText;

    /**
     * Restart reveal animation.
     */
    requestAnimationFrame(() => {
      this.restartRevealAnimation();
    });
  }

  /**
   * Restart QR reveal animation
   * without destroying DOM.
   */
  private restartRevealAnimation(): void {

    const el =
      this.qrRevealRef?.nativeElement;

    if (!el) {
      return;
    }

    el.style.animation = 'none';

    /**
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
      index > originalString.length
    ) {
      index = originalString.length;
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