import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { RecognitionAnalysis } from '@/src/lib/fishRecognition';
import { CONTRIBUTION_CONSENT_TEXT, CONTRIBUTION_CONSENT_VERSION, recognitionContributionRequest } from '@/src/lib/recognitionContributions';
import { FIELD_COLORS, bodyFont, bodySemiBoldFont } from '@/src/theme/fieldJournal';

export function RecognitionContributionCard({analysis,imageBase64,clientRequestId}:{analysis:RecognitionAnalysis;imageBase64:string;clientRequestId:string}) {
  const [consentOpen,setConsentOpen]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [provided,setProvided]=useState(false);
  const provide=async()=>{
    if(busy || provided) return;
    setBusy(true);
    setError(null);
    try {
      await recognitionContributionRequest({action:'submit',consent:true,consentVersion:CONTRIBUTION_CONSENT_VERSION,analysisId:analysis.id,clientRequestId,imageBase64,analysis});
      setProvided(true);
      setConsentOpen(false);
    } catch(error) {
      setError(error instanceof Error?error.message:'사진 제공을 완료하지 못했어요. 다시 시도해 주세요.');
    } finally {setBusy(false);}
  };
  return <View className="mt-5 border p-4" style={{borderColor:FIELD_COLORS.rule}}>
    <Text style={{fontFamily:bodySemiBoldFont,color:FIELD_COLORS.ink}}>판별 개선에 참여하기 · 선택</Text>
    <Text className="mt-2 text-xs leading-5" style={{fontFamily:bodyFont,color:FIELD_COLORS.muted}}>{provided?'이 사진과 판별 결과를 제공했습니다. 선택한 어종은 검수 전 참고 정보로만 사용됩니다. 설정 → 사진 제공 관리에서 삭제할 수 있어요.':'이 사진과 판별 결과를 검토 자료로 제공할 수 있어요. 제공하지 않아도 조과를 기록할 수 있습니다.'}</Text>
    {!provided && !consentOpen && <TouchableOpacity accessibilityRole="button" accessibilityLabel="이 사진과 판별 결과 제공" accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>setConsentOpen(true)} className="mt-3 border px-4 py-3" style={{borderColor:FIELD_COLORS.teal}}>
      <Text style={{fontFamily:bodySemiBoldFont,color:FIELD_COLORS.teal}}>{busy?'처리 중…':'이 사진과 판별 결과 제공'}</Text>
    </TouchableOpacity>}
    {consentOpen && !provided && <View className="mt-3">
      <Text className="text-sm leading-6" style={{fontFamily:bodyFont,color:FIELD_COLORS.ink}}>{CONTRIBUTION_CONSENT_TEXT}</Text>
      {error && <Text accessibilityRole="alert" className="mt-3" style={{color:FIELD_COLORS.red}}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="동의하고 제공" disabled={busy} onPress={()=>void provide()} className="mt-4 p-4" style={{backgroundColor:FIELD_COLORS.teal}}>
        <Text style={{fontFamily:bodySemiBoldFont,color:'white'}}>{busy?'제공 중…':'동의하고 제공'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="제공하지 않기" disabled={busy} onPress={()=>{setConsentOpen(false);setError(null);}} className="p-4">
        <Text style={{fontFamily:bodyFont,color:FIELD_COLORS.ink}}>제공하지 않기</Text>
      </TouchableOpacity>
    </View>}
  </View>;
}
