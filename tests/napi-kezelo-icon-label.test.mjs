// #8: daily-operator icon = turquoise approved logo on black, including the ribbon text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

// Minimal decoder for the 8-bit, non-interlaced RGB/RGBA PNGs produced by scripts/build-daily-icons.mjs.
export function decodePng(buffer){
 assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let offset=8,width,height,channels;const data=[];
 while(offset<buffer.length){
  const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),body=buffer.subarray(offset+8,offset+8+length);
  if(type==='IHDR'){width=body.readUInt32BE(0);height=body.readUInt32BE(4);
   assert.equal(body[8],8);assert.equal(body[12],0);channels={2:3,6:4}[body[9]];assert.ok(channels,'colour type');}
  if(type==='IDAT')data.push(body);
  if(type==='IEND')break;
  offset+=12+length;
 }
 const raw=inflateSync(Buffer.concat(data)),stride=width*channels,out=Buffer.alloc(width*height*4);
 let prev=Buffer.alloc(stride);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],line=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
  for(let x=0;x<stride;x++){
   const a=x>=channels?line[x-channels]:0,b=prev[x],c=x>=channels?prev[x-channels]:0;
   const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
   line[x]=(line[x]+[0,a,b,(a+b)>>1,pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter])&255;
  }
  for(let x=0;x<width;x++)for(let c=0;c<4;c++)out[(y*width+x)*4+c]=c<channels?line[x*channels+c]:255;
  prev=line;
 }
 return {width,height,pixel:(x,y)=>[...out.subarray((y*width+x)*4,(y*width+x)*4+4)]};
}
const TURQUOISE=[45,212,191];
const icon=name=>decodePng(readFileSync(new URL('../napi-kezelo/icons/'+name,import.meta.url)));
// Share of dark pixels inside the ribbon band: a plain ribbon is almost solid, lettering is not.
export function ribbonTextShare(img){
 let dark=0,total=0;
 for(let y=Math.round(img.height*0.54);y<Math.round(img.height*0.60);y++)
  for(let x=Math.round(img.width*0.22);x<Math.round(img.width*0.78);x++){total++;if(Math.max(...img.pixel(x,y).slice(0,3))<64)dark++;}
 return dark/total;
}

for(const name of ['icon-512.png','icon-192.png','apple-touch-icon.png']){
 test(`${name}: black background, turquoise-only artwork`,()=>{
  const img=icon(name);
  assert.deepEqual(img.pixel(0,0).slice(0,3),[0,0,0]);
  for(let y=0;y<img.height;y+=3)for(let x=0;x<img.width;x+=3){
   const [r,g,b,alpha]=img.pixel(x,y);assert.equal(alpha,255);
   const k=g/TURQUOISE[1];
   assert.ok(Math.abs(r-TURQUOISE[0]*k)<=2&&Math.abs(b-TURQUOISE[2]*k)<=2,`non-turquoise pixel at ${x},${y}`);
  }
 });
 test(`${name}: ribbon carries the "Sárberki Horgásztó" lettering`,()=>{
  assert.ok(ribbonTextShare(icon(name))>0.2,'ribbon looks plain');
 });
}
