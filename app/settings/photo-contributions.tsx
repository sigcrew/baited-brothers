import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SettingsScaffold } from '@/components/settings/SettingsScaffold';
import { useAuth } from '@/src/contexts/AuthContext';
import { useFieldNotice } from '@/src/contexts/FieldNoticeContext';
import { recognitionContributionRequest } from '@/src/lib/recognitionContributions';
import { FIELD_COLORS, bodyFont, bodySemiBoldFont } from '@/src/theme/fieldJournal';
type Item={id:string;consented_at:string;expires_at:string;analysis:{status?:string}};
export default function PhotoContributions() {
  const {session}=useAuth();const {confirm,alert}=useFieldNotice();
  const [items,setItems]=useState<Item[]>([]),[count,setCount]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{
    if(!session?.user.id) return;
    setError(null);
    try {const data=await recognitionContributionRequest<{items:Item[];count:number}>({action:'list'});setItems(data.items);setCount(data.count);}catch{setError('제공 내역을 불러오지 못했습니다. 다시 확인해 주세요.');}
  },[session?.user.id]);
  useEffect(()=>{setItems([]);setCount(0);void load();},[load]);
  const remove=async(id?:string)=>{
    if(busy) return;
    if(!await confirm({title:id?'이 사진 제공을 철회할까요?':'제공한 사진을 모두 삭제할까요?',message:'개선용 사진과 판별 내역을 삭제합니다. 원래 조과와 사진은 그대로 유지됩니다.',confirmLabel:'철회하고 삭제',cancelLabel:'취소',destructive:true})) return;
    setBusy(true);
    try{await recognitionContributionRequest({action:'delete',...(id?{id}:{})});await load();}
    catch{await alert({title:'삭제를 완료하지 못했어요',message:'연결을 확인한 뒤 다시 시도해 주세요.'});}
    finally{setBusy(false);}
  };
  return <SettingsScaffold eyebrow="선택 · 자료 제공" title="사진 제공 관리" description="직접 동의해 제공한 사진만 관리합니다. 제공 여부는 조과 기록 기능에 영향을 주지 않습니다.">
    <Text className="mt-5 leading-6" style={{fontFamily:bodyFont,color:FIELD_COLORS.muted}}>사진과 판별 결과는 어종 판별 품질 검토에 최대 90일 사용합니다. 공개·자동 학습에 사용하지 않으며, 선택한 어종은 미검수 참고 정보입니다. 연결된 조과를 삭제하면 제공 자료도 검토 대상에서 제외하고 순차 삭제합니다.</Text>
    {!session?<Text className="mt-5">로그인이 필요합니다.</Text>:<>
      <Text className="mt-5 text-lg" style={{fontFamily:bodySemiBoldFont}}>제공 중인 사진 {count}장</Text>
      {error && <Text accessibilityRole="alert" className="mt-3" style={{color:FIELD_COLORS.red}}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" onPress={()=>void load()} className="py-4"><Text style={{color:FIELD_COLORS.teal}}>내역 새로고침</Text></TouchableOpacity>
      {count>0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="제공 자료 전체 철회 및 삭제" disabled={busy} onPress={()=>void remove()} className="border p-4" style={{borderColor:FIELD_COLORS.red}}><Text style={{color:FIELD_COLORS.red}}>{busy?'삭제 중…':'제공 자료 전체 철회 및 삭제'}</Text></TouchableOpacity>}
      {items.map(item=><View key={item.id} className="border-b py-4" style={{borderColor:FIELD_COLORS.rule}}>
        <Text style={{fontFamily:bodySemiBoldFont}}>{new Date(item.consented_at).toLocaleDateString('ko-KR')} 제공 · 미검수</Text>
        <Text className="mt-1" style={{color:FIELD_COLORS.muted}}>{item.analysis.status==='failed'?'처리 실패':item.analysis.status==='rejected'?'재촬영 안내':'후보 추천'} · {new Date(item.expires_at).toLocaleDateString('ko-KR')} 검토 종료</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="이 제공 사진 삭제" disabled={busy} onPress={()=>void remove(item.id)} className="py-3"><Text style={{color:FIELD_COLORS.red}}>제공 철회·삭제</Text></TouchableOpacity>
      </View>)}
      {count>50 && <Text className="mt-3">최근 50장을 표시합니다. 전체 삭제는 모든 제공 자료에 적용됩니다.</Text>}
    </>}
  </SettingsScaffold>;
}
