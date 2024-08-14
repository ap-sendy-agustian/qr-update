import { Component } from '@angular/core';
import { BrowserQRCodeReader } from '@zxing/browser';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent{
  codeReader: BrowserQRCodeReader;


  constructor() {
    this.codeReader = new BrowserQRCodeReader();
  }

  title = 'qr-update';
  selectedFile: File | null = null;
  imageSrc: string | ArrayBuffer | null = null;
  originalQrText: string | null = null;
  generatedQrText: string | null = null;
  newAmount: string = ""

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0]
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
          this.replaceQrText();
          // Handle the QR code text (e.g., display it, store it)
        } catch (error) {
          console.error('Error decoding QR code:', error);
        }
      }
    };
  }

  generateChecksum(payload: string) {
    let checksum = 0xffff;
    const polynomial = 0x1021;
    const data = new TextEncoder().encode(payload)

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

replaceQrText(){
  if(this.originalQrText != null){
    const startAppendIndex = this.originalQrText.indexOf("5303360") + 7;
    console.log("start nya : " + startAppendIndex)
    console.log("nominal : " + this.newAmount)

    const tag = '54';

    const length = this.newAmount.length;
    
    // Convert length to a two-digit string
    const lengthStr = length < 10 ? `0${length}` : length.toString();
    
    // Combine Tag, Length, and Value
    const tlv = tag + lengthStr + this.newAmount;

    const newQrText = this.insertStringAt(this.originalQrText, tlv, startAppendIndex).slice(0, -4);
    console.log("yang baru : " + newQrText)
    const checksum = this.generateChecksum(newQrText)
    this.generatedQrText = newQrText + checksum

    

  }
}

 async duar() {
  console.log("DUAR : " + this.selectedFile);

  if(this.selectedFile){
    await this.decodeQRCodeImage(this.selectedFile);
  }
}

insertStringAt(originalString: string, stringToInsert: string, index:number) {
  if (index > originalString.length) {
    index = originalString.length;
  }
  return originalString.slice(0, index) + stringToInsert + originalString.slice(index);
}



}
