export type Evidence={label:string;status:'pass'|'fail'|'review';weight:number;note:string};
export function scoreSelected(evidence:Evidence[]){
 const verified=evidence.filter(e=>e.status!=='review');
 const total=verified.reduce((a,e)=>a+e.weight,0);
 const earned=verified.filter(e=>e.status==='pass').reduce((a,e)=>a+e.weight,0);
 return {score:total?Math.round(earned/total*100):null,verifiedWeight:total,unverifiedWeight:evidence.reduce((a,e)=>a+e.weight,0)-total,earned,details:evidence};
}
