type Tide = {at:string;type:'high'|'low'};
export const nextTide = <T extends Tide>(tides: T[], type:Tide['type'], now=Date.now()):T|undefined =>
  tides.filter(item=>item.type===type && Date.parse(item.at)>=now)
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];

export const formatTideTime = (at?:string, now=Date.now()) => {
  if(!at || !Number.isFinite(Date.parse(at))) return '-';
  const time = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
  const day=(value:number)=>Math.floor((value+9*3600000)/86400000);
  const diff=day(Date.parse(at))-day(now);
  if(diff===0) return time;
  if(diff===1) return '내일 '+time;
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(at))+' '+time;
};
