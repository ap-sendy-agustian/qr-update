import { Component } from '@angular/core';
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

  constructor() {
    this.codeReader = new BrowserQRCodeReader();
  }

  title = 'qr-update';
  selectedFile: File | null = null;
  imageSrc: string | ArrayBuffer | null = null;
  originalQrText: string | null = null;
  generatedQrText: string | null = null;
  newAmount: string = '';
  rawQrText: string = '';
  errorMessage: string = ''; // NEW - nampilin pesan error validasi di UI

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      const file = input.files[0];
      this.readImage(file);
    }
  }

  private readImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.imageSrc = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * NEW - Method generate terpadu, gantiin 2 tombol lama (duar() & useRawQrText()).
   * Otomatis deteksi sumber input: file diprioritaskan, fallback ke raw text.
   */
  async generate(): Promise<void> {
    this.errorMessage = '';
    this.generatedQrText = null;

    if (this.selectedFile) {
      console.log('Sumber input: gambar (' + this.selectedFile.name + ')');
      await this.decodeQRCodeImage(this.selectedFile);
    } else if (this.rawQrText && this.rawQrText.trim() !== '') {
      console.log('Sumber input: raw QR text');
      this.originalQrText = this.rawQrText.trim();
      this.runValidationAndReplace(); // NEW
    } else {
      this.errorMessage = 'Upload gambar QR atau paste QR text dulu sebelum generate.';
    }
  }

  async decodeQRCodeImage(file: File): Promise<void> {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = imageUrl;

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);

        try {
          const result = await this.codeReader.decodeFromCanvas(canvas);
          console.log('QR Code Text:', result.getText());
          this.originalQrText = result.getText();
          this.runValidationAndReplace(); // CHANGED - sebelumnya langsung this.replaceQrText()
        } catch (error) {
          // NEW - sebelumnya cuma console.error, sekarang tampil di UI juga
          this.errorMessage = 'Gambar tidak mengandung QR code yang bisa dibaca. Pastikan gambar jelas dan tidak terpotong.';
          console.error('Error decoding QR code:', error);
        }
      }
    };

    img.onerror = () => {
      // NEW
      this.errorMessage = 'Gagal memuat gambar. Pastikan file yang diupload adalah gambar yang valid.';
    };
  }

  /**
   * NEW - jalanin validasi dulu sebelum replaceQrText().
   * Kalau validasi gagal, generatedQrText tidak diisi & error ditampilkan.
   */
  private runValidationAndReplace(): void {
    if (!this.originalQrText) return;

    const validationError = this.validateQrisFormat(this.originalQrText);
    if (validationError) {
      this.errorMessage = validationError;
      console.error(validationError);
      return;
    }

    this.replaceQrText();
  }

  /**
   * NEW - Validasi struktur QRIS khusus format MPM (Merchant Presented Mode).
   * Return null kalau valid, atau pesan error kalau tidak valid.
   */
  private validateQrisFormat(qrText: string): string | null {
    if (!qrText || qrText.trim() === '') {
      return 'QR text kosong.';
    }

    const trimmed = qrText.trim();

    if (trimmed.length < 20) {
      return 'QR text terlalu pendek, kemungkinan bukan QRIS yang valid.';
    }

    if (!trimmed.startsWith('000201')) {
      return 'Format QR tidak dikenali - Payload Format Indicator (tag 00) tidak sesuai.';
    }

    const withoutCrc = trimmed.slice(0, -4);
    const allTags = this.parseAllTags(withoutCrc);

    // let reconstructedLength = 0;
    // for (const t of allTags.values()) {
    //   reconstructedLength += (t.valueEnd - t.start);
    // }
    // if (reconstructedLength !== withoutCrc.length || allTags.size === 0) {
    //   return 'Struktur QR tidak valid - format TLV rusak atau tidak lengkap.';
    // }

    const tag01 = allTags.get('01');
    if (!tag01) {
      return 'QR tidak valid - Point of Initiation Method (tag 01) tidak ditemukan.';
    }
    if (tag01.value !== '11' && tag01.value !== '12') {
      return 'QR ini bukan format QRIS MPM (Point of Initiation Method tidak sesuai).';
    }

    const merchantAccountTags = [
      '02', '04', '26', '27', '28', '29', '30', '31', '32', '33', '34',
      '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
      '46', '47', '48', '49', '50', '51'
    ];
    const hasMerchantAccount = merchantAccountTags.some(t => allTags.has(t));
    if (!hasMerchantAccount) {
      return 'QR tidak valid - Merchant Account Information tidak ditemukan.';
    }

    if (!allTags.has('52')) {
      return 'QR tidak valid - Merchant Category Code (tag 52) tidak ditemukan.';
    }

    const tag53 = allTags.get('53');
    if (!tag53) {
      return 'QR tidak valid - tag mata uang (53) tidak ditemukan.';
    }
    if (tag53.value !== '360') {
      return 'QR tidak valid - mata uang bukan Rupiah (kode currency harus 360).';
    }

    const tag58 = allTags.get('58');
    if (!tag58 || tag58.value !== 'ID') {
      return 'QR tidak valid - Country Code (tag 58) harus "ID".';
    }

    const tag59 = allTags.get('59');
    if (!tag59 || tag59.value.trim() === '') {
      return 'QR tidak valid - Merchant Name (tag 59) tidak ditemukan.';
    }

    const tag60 = allTags.get('60');
    if (!tag60 || tag60.value.trim() === '') {
      return 'QR tidak valid - Merchant City (tag 60) tidak ditemukan.';
    }

    const crc = trimmed.slice(-4);
    if (!/^[0-9A-Fa-f]{4}$/.test(crc)) {
      return 'QR tidak valid - CRC checksum (tag 63) tidak sesuai format.';
    }

    return null;
  }

  generateChecksum(payload: string) {
    let checksum = 0xffff;
    const polynomial = 0x1021;
    const data = new TextEncoder().encode(payload);

    for (const b of data) {
      for (let i = 0; i < 8; i++) {
        const bit = (b >> (7 - i)) & 1;
        const c15 = (checksum >> 15) & 1;
        checksum <<= 1;
        if (c15 ^ bit) {
          checksum ^= polynomial;
        }
      }
    }

    checksum &= 0xffff;
    return checksum.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Parse seluruh QRIS jadi map of tag -> posisi & value-nya.
   */
  private parseAllTags(qrText: string): Map<string, TlvTag> {
    const tags = new Map<string, TlvTag>();
    let index = 0;

    while (index < qrText.length - 4) {
      const currentTag = qrText.substring(index, index + 2);
      const lengthStr = qrText.substring(index + 2, index + 4);
      const length = parseInt(lengthStr, 10);

      if (isNaN(length)) {
        break;
      }

      const valueStart = index + 4;
      const valueEnd = valueStart + length;
      const value = qrText.substring(valueStart, valueEnd);

      tags.set(currentTag, {
        tag: currentTag,
        start: index,
        valueStart,
        valueEnd,
        value,
      });

      index = valueEnd;
    }

    return tags;
  }

  replaceQrText() {
    if (this.originalQrText != null) {
      const amount = this.newAmount && this.newAmount.trim() !== '' ? this.newAmount.trim() : '0';

      const withoutCrc = this.originalQrText.slice(0, -4);
      const allTags = this.parseAllTags(withoutCrc);

      const tag53 = allTags.get('53');
      if (!tag53) {
        // Safety net - seharusnya sudah kefilter di validateQrisFormat
        this.errorMessage = 'QR tidak valid - tag mata uang (53) tidak ditemukan.';
        return;
      }

      const tag = '54';
      const length = amount.length;
      const lengthStr = length < 10 ? `0${length}` : length.toString();
      const tlv = tag + lengthStr + amount;

      const existingTag54 = allTags.get('54');
      let newQrText: string;

      if (existingTag54) {
        console.log('Tag 54 sudah ada, melakukan update di posisi: ' + existingTag54.start);
        newQrText =
          withoutCrc.slice(0, existingTag54.start) +
          tlv +
          withoutCrc.slice(existingTag54.valueEnd);
      } else {
        console.log('Tag 54 belum ada, insert baru setelah tag 53 berakhir di: ' + tag53.valueEnd);
        newQrText = this.insertStringAt(withoutCrc, tlv, tag53.valueEnd);
      }

      console.log('yang baru : ' + newQrText);
      const checksum = this.generateChecksum(newQrText);
      console.log('checksum nya :' + checksum);
      this.generatedQrText = newQrText + checksum;
      console.log('new nya :' + this.generatedQrText);
    }
  }

  insertStringAt(originalString: string, stringToInsert: string, index: number) {
    if (index > originalString.length) {
      index = originalString.length;
    }
    return originalString.slice(0, index) + stringToInsert + originalString.slice(index);
  }
}