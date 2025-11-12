import 'dotenv/config';
import { getExchangeClient } from '../src/exchanges/index.js';

async function checkPositions() {
  const client = getExchangeClient();
  const positions = await client.getPositions();
  
  console.log('\n📊 交易所持仓:');
  for (const p of positions) {
    const size = parseFloat(p.size);
    if (Math.abs(size) > 0) {
      const symbol = client.extractSymbol(p.contract);
      console.log(`${symbol}: ${size}`);
    }
  }
}

checkPositions();
