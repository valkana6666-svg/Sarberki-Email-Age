// Reproducible app-asset color conversion. The approved orange icon's pixel
// coordinates, brightness and alpha are preserved; no shapes are redrawn.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage();
 for(const name of ['apple-touch-icon.png','icon-192.png','icon-512.png']){
  const source=readFileSync('sarberki-chatbot-project/icons/'+name).toString('base64');
  const output=await page.evaluate(async source=>{
   const img=new Image();img.src='data:image/png;base64,'+source;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
   const pixels=ctx.getImageData(0,0,img.width,img.height),before=pixels.data.slice();
   for(let i=0;i<pixels.data.length;i+=4){
    const coverage=Math.max(before[i],before[i+1],before[i+2])/255;
    pixels.data[i]=Math.round(45*coverage);pixels.data[i+1]=Math.round(212*coverage);pixels.data[i+2]=Math.round(191*coverage);
    if((Math.max(before[i],before[i+1],before[i+2])===0)!==(Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2])===0)||before[i+3]!==pixels.data[i+3])throw Error('ICON_SHAPE_CHANGED');
   }
   ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1];
  },source);
  mkdirSync('napi-kezelo/icons',{recursive:true});writeFileSync('napi-kezelo/icons/'+name,Buffer.from(output,'base64'));
 }
}finally{await browser.close();}
