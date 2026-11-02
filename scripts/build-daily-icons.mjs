// Reproducible daily-operator icon build (#8): the approved Sárberki logo (sarberki-logo-orange.svg, the
// same artwork as the earlier 128 px root icon, including the "SÁRBERKI HORGÁSZTÓ" ribbon text) is drawn
// unchanged on a black square and only recoloured to turquoise. Brightness and transparency of every pixel
// are preserved; no shapes are redrawn. Usage: CHROMIUM_PATH=... node scripts/build-daily-icons.mjs
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const SIZES={'apple-touch-icon.png':180,'icon-192.png':192,'icon-512.png':512};
// Logo box width as a share of the icon edge, matching the earlier root icon layout.
const LOGO_WIDTH=0.88,TURQUOISE=[45,212,191];
const svg=readFileSync('sarberki-logo-orange.svg').toString('base64');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage();
 for(const [name,size] of Object.entries(SIZES)){
  const output=await page.evaluate(async([svg,size,share,color])=>{
   const img=new Image();img.src='data:image/svg+xml;base64,'+svg;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);
   const w=Math.round(size*share),h=Math.round(w*img.naturalHeight/img.naturalWidth);
   ctx.imageSmoothingQuality='high';ctx.drawImage(img,Math.round((size-w)/2),Math.round((size-h)/2),w,h);
   const pixels=ctx.getImageData(0,0,size,size),before=pixels.data.slice();
   for(let i=0;i<pixels.data.length;i+=4){
    const coverage=Math.max(before[i],before[i+1],before[i+2])/255;
    for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(color[c]*coverage);
    if((Math.max(before[i],before[i+1],before[i+2])===0)!==(Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2])===0)||before[i+3]!==pixels.data[i+3])throw Error('ICON_SHAPE_CHANGED');
   }
   ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1];
  },[svg,size,LOGO_WIDTH,TURQUOISE]);
  mkdirSync('napi-kezelo/icons',{recursive:true});writeFileSync('napi-kezelo/icons/'+name,Buffer.from(output,'base64'));
 }
}finally{await browser.close();}
