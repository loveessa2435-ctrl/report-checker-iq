export type ReferenceResult={heading:boolean;entries:number|null;dois:string[];urls:string[];warnings:string[];externalChecked:boolean;sampleEntries:string[];confidence:'medium'|'low'};
const header=/^(?:\d+[.)-]?\s*)?(references|bibliography|works cited|reference list|المصادر(?:\s*والمراجع)?|المراجع|قائمة المصادر|قائمة المراجع)\s*[:：]?(?:\s*)$/i;
const sectionEnd=/^(?:appendix|appendices|ملحق|الملاحق|acknowledg(?:e)?ments|الشكر والتقدير)\s*[:：]?$/i;
const numbered=/^(?:\[\d+\]|\d+[.)])\s+(.+)/;
const authorYear=/^[\p{L}][^\n]{2,100}?[,(]\s*(?:19|20)\d{2}[a-z]?\s*[).,]/u;
export function checkReferences(text:string):ReferenceResult {
 const lines=text.split(/\r?\n/).map(s=>s.trim());
 // Use the LAST independent references heading: table of contents often mentions it earlier.
 const matches=lines.flatMap((line,i)=>header.test(line)?[i]:[]);
 const at=matches.length?matches[matches.length-1]:-1;
 const body=at<0?[]:lines.slice(at+1).filter(Boolean).slice(0,180);
 const stop=body.findIndex(l=>sectionEnd.test(l));
 const candidates=(stop>=0?body.slice(0,stop):body).filter(l=>!/^\d+$/.test(l));
 const numberedLines=candidates.filter(l=>numbered.test(l));
 const authorLines=candidates.filter(l=>authorYear.test(l));
 let samples:string[]=[];let confidence:'medium'|'low'='low';
 if(numberedLines.length){samples=numberedLines;confidence='medium';}
 else if(authorLines.length){samples=authorLines;confidence='medium';}
 // Unstructured references are not confidently countable; never count every prose line.
 const entries=at<0?null:confidence==='medium'?samples.length:null;
 const region=candidates.join('\n');
 const dois=[...new Set([...region.matchAll(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*[:：]?\s*)(10\.\d{4,9}\/[\w.()/:;+-]+)/gi)].map(m=>m[1].replace(/[.,;)]+$/,'')))].slice(0,30);
 const urls=[...new Set([...region.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(m=>m[0].replace(/[.,;)]+$/,'')))].slice(0,30);
 const warnings:string[]=[];
 if(at<0)warnings.push('لم نرصد عنواناً مستقلاً للمراجع؛ لا نستطيع الجزم بعدم وجودها.');
 else if(!candidates.length)warnings.push('عنوان المراجع موجود لكن لا يظهر نص تحته.');
 else if(entries===null)warnings.push('المراجع غير مرقمة أو غير منتظمة؛ تعذر حساب العدد بدقة.');
 if(numberedLines.length && authorLines.length)warnings.push('قد يكون هناك أكثر من نمط لتنسيق المراجع؛ راجع الاتساق.');
 if(dois.length)warnings.push('DOI مستخرج من النص فقط؛ لم يتم التحقق من التسجيل أو تطابق بيانات المرجع.');
 if(urls.length)warnings.push('الروابط لم يتم فتحها أو التحقق من محتواها.');
 return {heading:at>=0,entries,dois,urls,warnings,externalChecked:false,sampleEntries:samples.slice(0,3).map(s=>s.slice(0,160)),confidence};
}
