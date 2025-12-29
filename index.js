import { ethers } from 'ethers';
import { config, alertSettings } from './config.js';
import { getPancakeswapPrice, calculateTakeUsdPrice } from './pancakeswap.js';
import { getBinanceIndexPrice, getBnbPrice } from './binance.js';
import { 
  sendTelegramAlert, 
  formatPriceAlert, 
  formatDivergenceAlert,
  pollCommands,
} from './telegram.js';

// 알람 쿨다운 상태
const alertCooldowns = {
  priceUpper: 0,
  priceLower: 0,
  divergenceUpper: 0,
  divergenceLower: 0,
};

// 최신 가격 저장 (명령어용)
let latestPrices = {
  dexPrice: null,
  indexPrice: null,
  divergence: null,
};

function canSendAlert(type) {
  const now = Date.now();
  if (now - alertCooldowns[type] > config.ALERT_COOLDOWN) {
    alertCooldowns[type] = now;
    return true;
  }
  return false;
}

async function checkAndAlert(dexPrice, indexPrice) {
  // 알람 비활성화면 스킵
  if (!alertSettings.enabled) return;
  
  // 1. DEX 가격 상한 알람
  if (dexPrice >= alertSettings.dexPriceUpper && canSendAlert('priceUpper')) {
    const msg = formatPriceAlert('upper', dexPrice, alertSettings.dexPriceUpper);
    await sendTelegramAlert(msg);
  }
  
  // 2. DEX 가격 하한 알람
  if (dexPrice <= alertSettings.dexPriceLower && canSendAlert('priceLower')) {
    const msg = formatPriceAlert('lower', dexPrice, alertSettings.dexPriceLower);
    await sendTelegramAlert(msg);
  }
  
  // 3. 괴리율 계산 및 알람
  if (indexPrice && indexPrice > 0) {
    const divergence = ((dexPrice - indexPrice) / indexPrice) * 100;
    
    // 상방 괴리 (DEX > Index)
    if (divergence >= alertSettings.divergenceUpper && canSendAlert('divergenceUpper')) {
      const msg = formatDivergenceAlert(dexPrice, indexPrice, divergence);
      await sendTelegramAlert(msg);
    }
    
    // 하방 괴리 (DEX < Index)
    if (divergence <= alertSettings.divergenceLower && canSendAlert('divergenceLower')) {
      const msg = formatDivergenceAlert(dexPrice, indexPrice, divergence);
      await sendTelegramAlert(msg);
    }
  }
}

async function monitorPrices() {
  // Provider 설정
  const provider = new ethers.JsonRpcProvider(config.ALCHEMY_RPC);
  
  console.log('🚀 TAKE Price Alert Bot Started');
  console.log(`📊 Polling interval: ${config.POLL_INTERVAL / 1000}s`);
  console.log(`🎯 DEX Price alerts: $${alertSettings.dexPriceLower} ~ $${alertSettings.dexPriceUpper}`);
  console.log(`📐 Divergence alerts: ${alertSettings.divergenceLower}% ~ ${alertSettings.divergenceUpper}%`);
  console.log('-------------------------------------------');
  
  // 시작 알람
  await sendTelegramAlert(`🤖 <b>TAKE Alert Bot Started</b>

모니터링을 시작합니다.
/help 로 명령어를 확인하세요.`);
  
  // 현재 가격 조회 함수 (명령어용)
  global.getCurrentPrices = async () => {
    return latestPrices;
  };
  
  async function poll() {
    try {
      // 병렬로 데이터 가져오기
      const [pancakeData, binanceData, bnbPrice] = await Promise.all([
        getPancakeswapPrice(provider),
        getBinanceIndexPrice(),
        getBnbPrice(),
      ]);
      
      if (!pancakeData || !bnbPrice) {
        console.log('⚠️ Failed to fetch some data, skipping this cycle');
        return;
      }
      
      // TAKE USD 가격 계산
      const dexPrice = calculateTakeUsdPrice(pancakeData.takePriceInBnb, bnbPrice);
      const indexPrice = binanceData?.indexPrice || null;
      
      // 괴리율 계산
      let divergence = null;
      if (indexPrice) {
        divergence = ((dexPrice - indexPrice) / indexPrice) * 100;
      }
      
      // 최신 가격 저장
      latestPrices = { dexPrice, indexPrice, divergence };
      
      // 로그 출력
      const timestamp = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
      const alertStatus = alertSettings.enabled ? '🟢' : '🔴';
      console.log(
        `[${timestamp}] ${alertStatus} DEX: $${dexPrice.toFixed(6)} | Index: $${indexPrice?.toFixed(6) || 'N/A'} | 괴리: ${divergence?.toFixed(3) || 'N/A'}%`
      );
      
      // 알람 체크
      await checkAndAlert(dexPrice, indexPrice);
      
    } catch (error) {
      console.error('❌ Error in poll cycle:', error.message);
    }
  }
  
  // 즉시 첫 폴링 실행
  await poll();
  
  // 주기적 폴링
  setInterval(poll, config.POLL_INTERVAL);
  
  // 텔레그램 명령어 폴링
  setInterval(pollCommands, config.COMMAND_POLL_INTERVAL);
}

// 환경변수 체크
function validateConfig() {
  const required = ['ALCHEMY_RPC', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set them in .env file or Railway environment variables');
    process.exit(1);
  }
}

// 시작
validateConfig();
monitorPrices().catch(console.error);
