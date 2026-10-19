import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
export type Kind = 'pdf'|'docx';
export type DocumentInfo = {kind:Kind; text:string; firstPageText:string; pages:number|null; formatNotes:string[]; docxFormatting?: {font?:string; sizePt?:number; spacing?:number; paper?:string};};
const arr=(x:any):any[]=>x==null?[]:Array.isArray(x)?x:[x];
const attr=(o:any,k:string)=>o?.[`@_${k}`];
export async function readDocument(bytes:Uint8Array,kind:Kind):Promise<DocumentInfo>{
 if(kind==='pdf'){
  const task=pdfjs.getDocument({data:bytes,useSystemFonts:true,isEvalSupported:false});
  try {const pdf=await task.promise;const pages:string[]=[];
   for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const content=await p.getTextContent();let line='',lines:string[]=[];
    for(const item of content.items){if(!('str' in item))continue;line+=item.str+' ';if(item.hasEOL){lines.push(line.trim());line='';}}
    if(line.trim())lines.push(line.trim());pages.push(lines.join('\n'));p.cleanup();}
   return {kind,text:pages.join('\n\n'),firstPageText:pages[0]||'',pages:pdf.numPages,formatNotes:['PDF: إعدادات الخط والتباعد تحتاج مراجعة بصرية.']};
  }finally{await task.destroy();}
 }
 const buffer=Buffer.from(bytes);const zip=await JSZip.loadAsync(buffer);
 if(!zip.file('word/document.xml'))throw new Error('Invalid DOCX: word/document.xml missing');
 const html=await mammoth.extractRawText({buffer});
 const xml=await zip.file('word/document.xml')!.async('string');
 const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',removeNSPrefix:true});
 const document=parser.parse(xml);const body=document?.document?.body||{};
 const paragraphs=arr(body.p);const firstPageText=paragraphs.slice(0,32).map((p:any)=>{const tokens=arr(p.r).flatMap((r:any)=>arr(r.t).map((t:any)=>typeof t==='string'?t:t?.['#text']||''));return tokens.join('');}).join('\n').trim()||html.value.slice(0,2500);
 const stylesXml=await zip.file('word/styles.xml')?.async('string');const styles=stylesXml?parser.parse(stylesXml):{};
 const defaults=styles?.styles?.docDefaults?.rPrDefault?.rPr||{};
 const paraDefaults=styles?.styles?.docDefaults?.pPrDefault?.pPr||{};
 const normal=arr(styles?.styles?.style).find((s:any)=>attr(s,'styleId')==='Normal')||{};
 const rpr=normal.rPr||defaults;const ppr=normal.pPr||paraDefaults;
 const font=attr(rpr?.rFonts,'ascii')||attr(rpr?.rFonts,'hAnsi')||attr(defaults?.rFonts,'ascii');
 const sz=Number(attr(rpr?.sz,'val')||attr(defaults?.sz,'val'));
 const spacingRaw=ppr?.spacing||paraDefaults?.spacing;
 const line=Number(attr(spacingRaw,'line'));const rule=attr(spacingRaw,'lineRule');
 const section=arr(body.sectPr)[0]||{};const pg=section.pgSz||{};
 const w=Number(attr(pg,'w')),h=Number(attr(pg,'h'));
 const paper=w&&h?(Math.abs(Math.min(w,h)-11906)<130&&Math.abs(Math.max(w,h)-16838)<130?'A4':`${w}×${h} twips`):undefined;
 const formatNotes=['DOCX: القيم تمثل النمط Normal/الإعدادات الافتراضية فقط، وقد تختلف فقرات أو جداول أخرى.','عدد صفحات Word غير محدد دون محرك عرض، لذلك لا يُخمّن.'];
 return {kind,text:html.value,firstPageText,pages:null,formatNotes,docxFormatting:{font,sizePt:sz?sz/2:undefined,spacing:line&&rule!=='exact'&&rule!=='atLeast'?line/240:undefined,paper}};
}
