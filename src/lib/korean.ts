/**
 * 한글 조사 "로/으로". 받침이 없거나 ㄹ 받침이면 "로", 그 외 받침은 "으로".
 * 한글이 아닌 글자로 끝나면(영문 학명 등) "로"를 쓴다.
 */
export const withRoParticle = (word: string) => {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word}로`;
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
};
