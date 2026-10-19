export type CoverField = 'title'|'student'|'university'|'department'|'course'|'professor';
export type FieldResult = {status:'found'|'review'; evidence?:string; reason:string};
export type CoverResult = {fields:Record<CoverField,FieldResult>; notes:string[]};
const labels:Record<CoverField,string[]> = {
 title:['عنوان التقرير','عنوان البحث','موضوع التقرير','موضوع البحث','report title','research title','report on','report about','topic'],
 student:['اسم الطالب','اسم الطالبة','اعداد الطالب','إعداد الطالب','اعداد الطالبة','إعداد الطالبة','اعداد','إعداد','prepared by','submitted by','student name','student'],
 university:['اسم الجامعة','الجامعة','جامعة','university of','university','college of'],
 department:['اسم القسم','القسم','قسم','department of','department','dept.'],
 course:['اسم المادة','المادة الدراسية','المادة','اسم المقرر','course name','course','subject','module'],
 professor:['اسم الدكتور','اسم الدكتورة','بإشراف','باشراف','إشراف','اشراف','تدريسي المادة','مدرس المادة','supervised by','supervisor','instructor','lecturer','professor']
};
const norm=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const acceptable=(v:string)=>v.length>=3 && v.length<=140 && /[\p{L}]/u.test(v) && !/^(?:page|date|الصفحة|التاريخ)\b/i.test(v);
export function checkCover(firstPageText:string):CoverResult {
 const lines=firstPageText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,85);
 const fields={} as Record<CoverField,FieldResult>;
 for(const key of Object.keys(labels) as CoverField[]){
  let result:FieldResult={status:'review',reason:'لم نرصد دليلاً واضحاً؛ راجع الواجهة بصرياً'};
  for(let i=0;i<lines.length;i++){
   const line=lines[i], n=norm(line);
   const label=labels[key].find(l=>n.startsWith(norm(l)) && (n.length===norm(l).length || /[\s:：\-–]/.test(n[norm(l).length]||'')));
   if(!label)continue;
   let candidate=line.slice(label.length).replace(/^[\s:：\-–]+/,'').trim();
   if(!acceptable(candidate) && i+1<lines.length) candidate=lines[i+1];
   if(acceptable(candidate) && !Object.values(labels).flat().some(l=>norm(candidate)===norm(l))){
    result={status:'found',evidence:candidate.slice(0,95),reason:'تم رصد تسمية مع قيمة محتملة'};break;
   }
   result={status:'review',reason:'تم رصد التسمية لكن القيمة غير واضحة'};
  }
  fields[key]=result;
 }
 return {fields,notes:['فحص الواجهة يعتمد على النص المستخرج؛ عدم التعرف لا يعني أن المعلومة غير موجودة.','واجهات PDF المصورة تحتاج OCR أو مراجعة بصرية.','البيانات المكتشفة قرائن محتملة وليست تحققاً من صحة الاسم أو الجامعة.']};
}
