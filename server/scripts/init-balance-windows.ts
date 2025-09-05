#!/usr/bin/env tsx

import { BalanceWindowManager } from '../services/balance-window-manager';

async function initializeBalanceWindows() {
  try {
    console.log('🚀 Initializing balance windows for all hotels...');
    await BalanceWindowManager.initializeAllHotelBalances();
    console.log('✅ Balance window initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Balance initialization failed:', error);
    process.exit(1);
  }
}

initializeBalanceWindows();