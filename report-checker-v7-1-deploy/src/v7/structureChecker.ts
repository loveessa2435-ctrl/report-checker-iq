import type {SectionName} from '../pdfChecker';
export type SectionEvidence={found:boolean;line?:string};
const names:Record<SectionName,string[]>={introduction:['introduction','المقدمة','مقدمة'],conclusion:['conclusion','conclusions','الخاتمة','الاستنتاجات'],references:['references','bibliography','المصادر','المراجع','المصادر والمراجع'],contents:['contents','table of contents','الفهرس','المحتويات']};
const normalize=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
export function detectSections(text:string):Record<SectionName,SectionEvidence>{
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const out={} as Record<SectionName,SectionEvidence>;
 const toc=lines.findIndex(l=>names.contents.some(x=>normalize(l)===normalize(x)));
 for(const key of Object.keys(names) as SectionName[]){
  const found=lines.findIndex((l,i)=>{
   if(key!=='contents'&&toc>=0&&i>toc&&i<toc+45 && /\.{2,}|\s\d+$/.test(l))return false;
   const cleaned=normalize(l).replace(/^(?:chapter|section|الفصل|القسم)?\s*\d+(?:\.\d+)*[.)\s-]*/,'').replace(/[.:：\-–]+$/,'').trim();
   return names[key].some(n=>cleaned===normalize(n));
  });
  out[key]={found:found>=0,line:found>=0?lines[found]:undefined};
 }
 return out;
}
