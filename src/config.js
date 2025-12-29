// 환경변수에서 로드
export const config = {
  // Alchemy RPC
  ALCHEMY_RPC: process.env.ALCHEMY_RPC || '',
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '6710244354',
  
  // 컨트랙트 주소
  TAKE_TOKEN: '0xE747E54783Ba3F77a8E5251a3cBA19EBe9C0E197',
  WBNB_TOKEN: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  
  // PancakeSwap V3 Factory (BNB Chain)
  PANCAKE_V3_FACTORY: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  
  // 폴링 간격 (ms)
  POLL_INTERVAL: 15000,  // 15초
  
  // 알람 쿨다운 (같은 알람 반복 방지, ms)
  ALERT_COOLDOWN: 300000,  // 5분
  
  // 텔레그램 명령어 폴링 간격
  COMMAND_POLL_INTERVAL: 2000,  // 2초
};

// 동적으로 변경 가능한 알람 설정
export const alertSettings = {
  // 알람 활성화 여부
  enabled: true,
  
  // DEX 가격 알람 (USDT 기준)
  dexPriceUpper: 0.60,    // 이 가격 이상이면 알람
  dexPriceLower: 0.35,    // 이 가격 이하면 알람
  
  // 괴리율 알람 (%)
  divergenceUpper: 1.5,    // DEX가 Index보다 1.5% 이상 높으면
  divergenceLower: -1.5,   // DEX가 Index보다 1.5% 이상 낮으면
};

// 설정 업데이트 함수
export function updateAlertSettings(key, value) {
  if (key in alertSettings) {
    alertSettings[key] = value;
    return true;
  }
  return false;
}
