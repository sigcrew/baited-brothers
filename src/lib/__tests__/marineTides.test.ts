import {nextTide} from '../marineTides';
test('next high tide skips past, invalid and low tides and finds the nearest future event',()=>{
 const now=Date.parse('2026-09-10T14:00:00+09:00');
 const tides=[
  {at:'2026-09-10T08:28:00+09:00',type:'high' as const},
  {at:'2026-09-11T08:00:00+09:00',type:'high' as const},
  {at:'invalid',type:'high' as const},
  {at:'2026-09-10T16:00:00+09:00',type:'low' as const},
  {at:'2026-09-10T20:40:00+09:00',type:'high' as const},
 ];
 expect(nextTide(tides,'high',now)?.at).toBe('2026-09-10T20:40:00+09:00');
 expect(nextTide(tides.slice(0,1),'high',now)).toBeUndefined();
});
import {formatTideTime} from '../marineTides';
test('shows tomorrow for the next morning tide rather than an ambiguous past-looking clock',()=>{
 expect(formatTideTime('2026-09-10T23:28:00.000Z',Date.parse('2026-09-10T05:41:00Z'))).toBe('내일 08:28');
 expect(formatTideTime(undefined)).toBe('-');
});
