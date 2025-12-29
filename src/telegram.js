import { config, alertSettings, updateAlertSettings } from './config.js';

let lastUpdateId = 0;

// HTML 특수문자 이스케이프
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramAlert(message) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return false;
    }
    
    console.log('✅ Telegram alert sent');
    return true;
  } catch (error) {
    console.error('Failed to send Telegram alert:', error.message);
    return false;
  }
}

export async function pollCommands() {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok || !data.result.length) return;
    
    for (const update of data.result) {
      lastUpdateId = update.update_id;
      
      if (update.message?.text && update.message.chat.id.toString() === config.TELEGRAM_CHAT_ID) {
        await handleCommand(update.message.text);
      }
    }
  } catch (error) {
    // Silently ignore polling errors
  }
}

async function handleCommand(text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const value = parts[1];
  
  switch (command) {
    case '/start':
    case '/help':
      await sendHelpMessage();
      break;
      
    case '/status':
      await sendStatusMessage();
      break;
      
    case '/on':
      updateAlertSettings('enabled', true);
      await sendTelegramAlert('✅ 알람이 <b>활성화</b> 되었습니다.');
      break;
      
    case '/off':
      updateAlertSettings('enabled', false);
      await sendTelegramAlert('🔕 알람이 <b>비활성화</b> 되었습니다.');
      break;
      
    case '/price_upper':
      if (value && !isNaN(parseFloat(value))) {
        updateAlertSettings('dexPriceUpper', parseFloat(value));
        await sendTelegramAlert(`✅ DEX 가격 상한이 <b>$${parseFloat(value)}</b>로 설정되었습니다.`);
      } else {
        await sendTelegramAlert('❌ 사용법: /price_upper 0.60');
      }
      break;
      
    case '/price_lower':
      if (value && !isNaN(parseFloat(value))) {
        updateAlertSettings('dexPriceLower', parseFloat(value));
        await sendTelegramAlert(`✅ DEX 가격 하한이 <b>$${parseFloat(value)}</b>로 설정되었습니다.`);
      } else {
        await sendTelegramAlert('❌ 사용법: /price_lower 0.35');
      }
      break;
      
    case '/div_upper':
      if (value && !isNaN(parseFloat(value))) {
        updateAlertSettings('divergenceUpper', parseFloat(value));
        await sendTelegramAlert(`✅ 괴리율 상한이 <b>${parseFloat(value)}%</b>로 설정되었습니다.`);
      } else {
        await sendTelegramAlert('❌ 사용법: /div_upper 1.5');
      }
      break;
      
    case '/div_lower':
      if (value && !isNaN(parseFloat(value))) {
        updateAlertSettings('divergenceLower', parseFloat(value));
        await sendTelegramAlert(`✅ 괴리율 하한이 <b>${parseFloat(value)}%</b>로 설정되었습니다.`);
      } else {
        await sendTelegramAlert('❌ 사용법: /div_lower -1.5');
      }
      break;
      
    case '/price':
      if (global.getCurrentPrices) {
        const prices = await global.getCurrentPrices();
        if (prices) {
          await sendPriceMessage(prices);
        }
      }
      break;
  }
}

async function sendHelpMessage() {
  const msg = `🤖 <b>TAKE Alert Bot 명령어</b>

📊 조회
/status - 현재 설정 확인
/price - 현재 가격 조회

🔔 알람 제어
/on - 알람 켜기
/off - 알람 끄기

💰 가격 알람 설정
/price_upper [값] - DEX 가격 상한
/price_lower [값] - DEX 가격 하한

📐 괴리율 알람 설정
/div_upper [값] - 괴리율 상한
/div_lower [값] - 괴리율 하한

예시:
/price_upper 0.55
/div_lower -2.0`;

  await sendTelegramAlert(msg);
}

async function sendStatusMessage() {
  const status = alertSettings.enabled ? '🟢 활성화' : '🔴 비활성화';
  
  const msg = `📊 <b>현재 설정</b>

알람 상태: ${status}

💰 DEX 가격 알람
- 상한: $${alertSettings.dexPriceUpper}
- 하한: $${alertSettings.dexPriceLower}

📐 괴리율 알람
- 상한: ${alertSettings.divergenceUpper}%
- 하한: ${alertSettings.divergenceLower}%

⏱ 알람 쿨다운: ${config.ALERT_COOLDOWN / 1000}초`;

  await sendTelegramAlert(msg);
}

async function sendPriceMessage(prices) {
  const { dexPrice, indexPrice, divergence } = prices;
  
  const divText = divergence !== null 
    ? (divergence > 0 ? '+' : '') + divergence.toFixed(3) + '%' 
    : 'N/A';
  
  const msg = `💹 <b>현재 TAKE 가격</b>

🥞 PancakeSwap: <b>$${dexPrice?.toFixed(6) || 'N/A'}</b>
📊 Binance Index: <b>$${indexPrice?.toFixed(6) || 'N/A'}</b>
📐 괴리율: <b>${divText}</b>

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

  await sendTelegramAlert(msg);
}

export function formatPriceAlert(type, dexPrice, threshold) {
  const emoji = type === 'upper' ? '🚀' : '📉';
  const direction = type === 'upper' ? '상승' : '하락';
  
  return `${emoji} <b>TAKE DEX 가격 알람</b>

💰 현재 DEX 가격: <b>$${dexPrice.toFixed(6)}</b>
🎯 임계값: $${threshold.toFixed(4)}
📊 상태: 가격 ${direction} 돌파

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
}

export function formatDivergenceAlert(dexPrice, indexPrice, divergence) {
  const emoji = divergence > 0 ? '⬆️' : '⬇️';
  const status = divergence > 0 ? 'DEX가 Index보다 높음' : 'DEX가 Index보다 낮음';
  
  return `${emoji} <b>TAKE 괴리율 알람</b>

🥞 PancakeSwap: <b>$${dexPrice.toFixed(6)}</b>
📊 Binance Index: <b>$${indexPrice.toFixed(6)}</b>
📐 괴리율: <b>${divergence > 0 ? '+' : ''}${divergence.toFixed(3)}%</b>

🔍 ${status}

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
}
