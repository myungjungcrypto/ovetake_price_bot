import "dotenv/config";
import { ethers } from 'ethers';
import { config, alertSettings } from './config.js';
import { getPancakeswapPrice } from './pancakeswap.js';
import { getBinanceIndexPrice } from './binance.js';
import { 
  sendTelegramAlert, 
  formatPriceAlert, 
  formatDivergenceAlert,
  pollCommands,
} from './telegram.js';

const alertCooldowns = {
  priceUpper: 0,
  priceLower: 0,
  divergenceUpper: 0,
  divergenceLower: 0,
};

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
  if (!alertSettings.enabled) return;
  
  if (dexPrice >= alertSettings.dexPriceUpper && canSendAlert('priceUpper')) {
    const msg = formatPriceAlert('upper', dexPrice, alertSettings.dexPriceUpper);
    await sendTelegramAlert(msg);
  }
  
  if (dexPrice <= alertSettings.dexPriceLower && canSendAlert('priceLower')) {
    const msg = formatPriceAlert('lower', dexPrice, alertSettings.dexPriceLower);
    await sendTelegramAlert(msg);
  }
  
  if (indexPrice && indexPrice > 0) {
    const divergence = ((dexPrice - indexPrice) / indexPrice) * 100;
    
    if (divergence >= alertSettings.divergenceUpper && canSendAlert('divergenceUpper')) {
      const msg = formatDivergenceAlert(dexPrice, indexPrice, divergence);
      await sendTelegramAlert(msg);
    }
    
    if (divergence <= alertSettings.divergenceLower && canSendAlert('divergenceLower')) {
      const msg = formatDivergenceAlert(dexPrice, indexPrice, divergence);
      await sendTelegramAlert(msg);
    }
  }
}

async function monitorPrices() {
  const provider = new ethers.JsonRpcProvider(config.ALCHEMY_RPC);
  
  console.log('🚀 TAKE Price Alert Bot Started');
  console.log(`📊 Polling interval: ${config.POLL_INTERVAL / 1000}s`);
  console.log(`🎯 DEX Price alerts: $${alertSettings.dexPriceLower} ~ $${alertSettings.dexPriceUpper}`);
  console.log(`📐 Divergence alerts: ${alertSettings.divergenceLower}% ~ ${alertSettings.divergenceUpper}%`);
  console.log('-------------------------------------------');
  
  await sendTelegramAlert(`🤖 <b>TAKE Alert Bot Started</b>

모니터링을 시작합니다.
/help 로 명령어를 확인하세요.`);
  
  global.getCurrentPrices = async () => latestPrices;
  
  async function poll() {
    try {
      const [dexData, binanceData] = await Promise.all([
        getPancakeswapPrice(provider),
        getBinanceIndexPrice(),
      ]);
      
      if (!dexData) {
        console.log('⚠️ Failed to fetch DEX data, skipping this cycle');
        return;
      }
      
      const dexPrice = dexData.priceUsd;
      const indexPrice = binanceData?.indexPrice || null;
      
      let divergence = null;
      if (indexPrice) {
        divergence = ((dexPrice - indexPrice) / indexPrice) * 100;
      }
      
      latestPrices = { dexPrice, indexPrice, divergence };
      
      const timestamp = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
      const alertStatus = alertSettings.enabled ? '🟢' : '🔴';
      console.log(
        `[${timestamp}] ${alertStatus} DEX: $${dexPrice.toFixed(6)} | Index: $${indexPrice?.toFixed(6) || 'N/A'} | 괴리: ${divergence?.toFixed(3) || 'N/A'}%`
      );
      
      await checkAndAlert(dexPrice, indexPrice);
      
    } catch (error) {
      console.error('❌ Error in poll cycle:', error.message);
    }
  }
  
  await poll();
  setInterval(poll, config.POLL_INTERVAL);
  setInterval(pollCommands, config.COMMAND_POLL_INTERVAL);
}

function validateConfig() {
  const required = ['ALCHEMY_RPC', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

validateConfig();
monitorPrices().catch(console.error);
