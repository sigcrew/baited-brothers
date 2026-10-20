import React from 'react';
import {act,create,ReactTestRenderer} from 'react-test-renderer';
import {useMarineConditions} from '../useMarineConditions';
import {supabase} from '@/src/lib/supabase';
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn().mockResolvedValue(null),setItem:jest.fn().mockResolvedValue(undefined)}));
jest.mock('@/src/lib/supabase',()=>({supabase:{functions:{invoke:jest.fn()},auth:{getSession:jest.fn(async()=>({data:{session:{user:{id:'qa-user'}}}}))}}}));
const invoke=supabase.functions.invoke as jest.Mock;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const response=(code:string)=>({data:{station:{code},tides:[]},error:null});
let latest:ReturnType<typeof useMarineConditions>;
function Probe({lat}:{lat?:number}){latest=useMarineConditions(lat,lat===undefined?undefined:129);return null;}
let view:ReactTestRenderer;
beforeEach(()=>jest.clearAllMocks());
afterEach(async()=>{await act(async()=>view?.unmount());});
test('a slower previous location must not overwrite the currently selected location',async()=>{
 const a=deferred(),b=deferred();invoke.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
 await act(async()=>{view=create(<Probe lat={35}/>);});
 await act(async()=>view.update(<Probe lat={36}/>));
 await act(async()=>b.resolve(response('B')));
 expect(latest.data?.station.code).toBe('B');
 await act(async()=>a.resolve(response('A')));
 expect(latest.data?.station.code).toBe('B');
});
test('changing location clears the previous station while the new one loads',async()=>{
 const b=deferred();invoke.mockResolvedValueOnce(response('A')).mockReturnValueOnce(b.promise);
 await act(async()=>{view=create(<Probe lat={35}/>);});
 expect(latest.data?.station.code).toBe('A');
 await act(async()=>view.update(<Probe lat={36}/>));
 expect(latest.data).toBeNull();
 expect(latest.isLoading).toBe(true);
 await act(async()=>b.resolve(response('B')));
});
test('clearing the selection invalidates its pending response',async()=>{
 const a=deferred();invoke.mockReturnValueOnce(a.promise);
 await act(async()=>{view=create(<Probe lat={35}/>);});
 await act(async()=>view.update(<Probe/>));
 await act(async()=>a.resolve(response('A')));
 expect(latest.data).toBeNull();
 expect(latest.isLoading).toBe(false);
});

test('a stalled marine request stops loading with a retryable error',async()=>{
 jest.useFakeTimers();
 try {
  invoke.mockReturnValueOnce(new Promise(()=>{}));
  await act(async()=>{view=create(<Probe lat={35}/>);});
  await act(async()=>jest.advanceTimersByTime(20001));
  expect(latest.isLoading).toBe(false);
  expect(latest.error?.message).toContain('시간');
 } finally {jest.useRealTimers();}
});
test('an older request failing must not stop the newer request loading',async()=>{
 const a=deferred(),b=deferred();invoke.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
 await act(async()=>{view=create(<Probe lat={35}/>);});
 await act(async()=>view.update(<Probe lat={36}/>));
 await act(async()=>a.resolve({data:null,error:new Error('old failure')}));
 expect(latest.isLoading).toBe(true);
 expect(latest.error).toBeNull();
 await act(async()=>b.resolve(response('B')));
 expect(latest.data?.station.code).toBe('B');
});
test('a failed new location does not show the old location as its fallback',async()=>{
 invoke.mockResolvedValueOnce(response('A')).mockResolvedValueOnce({data:null,error:new Error('offline')});
 await act(async()=>{view=create(<Probe lat={35}/>);});
 await act(async()=>view.update(<Probe lat={36}/>));
 expect(latest.data).toBeNull();
 expect(latest.error?.message).toBe('offline');
 expect(latest.isStale).toBe(false);
});
