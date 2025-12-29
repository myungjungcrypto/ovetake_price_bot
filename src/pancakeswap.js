import { config } from './config.js';

export async function getPancakeswapPrice(provider) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${config.TAKE_TOKEN}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // BNB Chain의 PancakeSwap 풀 찾기 (V2 또는 V3)
    const pool = data.pairs?.find(p => 
      p.chainId === 'bsc' && 
      p.dexId.includes('pancakeswap')
    );
    
    if (!pool) {
      throw new Error('TAKE pool not found on DexScreener');
    }
    
    const priceUsd = parseFloat(pool.priceUsd);
    
    console.log(`[DexScreener] Pool: ${pool.pairAddress}`);
    console.log(`[DexScreener] DEX: ${pool.dexId}`);
    console.log(`[DexScreener] TAKE Price: $${priceUsd}`);
    
    return {
      priceUsd: priceUsd,
      poolAddress: pool.pairAddress,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch DexScreener price:', error.message);
    return null;
  }
}
