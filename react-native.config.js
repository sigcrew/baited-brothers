// Android에서만 네이티브 Google 로그인을 쓴다. iOS는 웹 로그인이라 이 모듈을 iOS 빌드에서 뺀다.
// package.json의 expo.autolinking.ios.exclude는 pod 연결만 막고, React Native 코드 생성
// (RCTThirdPartyComponentsProvider)은 이 설정을 따른다. 둘 다 빼야 iOS가 시작 시 죽지 않는다.
module.exports = {
  dependencies: {
    "@react-native-google-signin/google-signin": {
      platforms: { ios: null },
    },
  },
};
