# X1 Wallet Watcher Bot 🔍

A Telegram bot that monitors X1 blockchain wallet addresses and sends real-time notifications for transactions and balance changes.

**X1 is an SVM-based blockchain** (Solana Virtual Machine), so it uses the same address format and tooling as Solana.

## Features

- 👀 **Watch Multiple Wallets** - Monitor up to 10 wallet addresses per user
- 📥 **Incoming Transaction Alerts** - Get notified when XN is received
- 📤 **Outgoing Transaction Alerts** - Get notified when XN is sent
- 🔷 **Token Tracking** - Track balances of SPL-compatible tokens
- 🆕 **Token-2022 Support** - Full support for Token Extensions program tokens
- 📝 **Metaplex Metadata** - Automatically fetches token names and symbols from on-chain metadata
- 📊 **Wallet Stats** - View total transactions and first activity date
- ⚙️ **Customizable Settings** - Configure which notifications you receive
- 💰 **Minimum Value Filters** - Set thresholds to filter small transactions
- 📊 **Balance Change Alerts** - Get notified of balance changes

## Quick Start

### Prerequisites

- Node.js 18+ 
- A Telegram Bot Token (get from [@BotFather](https://t.me/BotFather))
- X1 RPC endpoint

### Installation

1. **Clone and install dependencies:**
```bash
cd x1-wallet-watcher-bot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
BOT_TOKEN=your_telegram_bot_token_here
X1_RPC_URL=https://x1-mainnet.infrafc.org
POLL_INTERVAL=15000
EXPLORER_URL=https://explorer.x1-mainnet.infrafc.org
```

3. **Run the bot:**
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Docker Deployment

```bash
docker-compose up -d --build
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and show main menu |
| `/watch [address] [label]` | Add a wallet to watch |
| `/unwatch <address>` | Stop watching a wallet |
| `/list` | List all watched wallets |
| `/addtoken` | Add a token to track |
| `/settings` | Configure notification settings |
| `/status` | Check bot and blockchain connection |
| `/stats` | View bot statistics |
| `/help` | Show help message |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram Bot API token (required) | - |
| `X1_RPC_URL` | X1 RPC endpoint | `https://x1-mainnet.infrafc.org` |
| `POLL_INTERVAL` | Polling interval in ms | `15000` (15s) |
| `EXPLORER_URL` | Block explorer URL | `https://explorer.x1-mainnet.infrafc.org` |

### X1 RPC Endpoints

```
# Mainnet
https://x1-mainnet.infrafc.org
https://x1-mainnet.xen.network/rpc

# Testnet
https://x1-testnet.infrafc.org
```

## Usage Examples

### Watch a Wallet
```
/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU My Main Wallet
```

### Track a Token
1. First add a wallet with `/watch`
2. Use `/addtoken` and select the wallet
3. Enter the token mint address

## Architecture

```
src/
├── index.ts        # Bot entry point
├── config.ts       # Configuration management
├── blockchain.ts   # X1/SVM blockchain interactions
├── watcher.ts      # Transaction monitoring service
├── handlers.ts     # Telegram command handlers
├── keyboards.ts    # Inline keyboard layouts
├── storage.ts      # Data persistence
└── types.ts        # TypeScript type definitions
```

### How It Works

1. **Polling**: The bot polls each watched wallet at regular intervals
2. **Signature Tracking**: Uses `getSignaturesForAddress` to detect new transactions
3. **Balance Monitoring**: Compares current vs stored balance for change detection
4. **Token Support**: 
   - 🔷 SPL-compatible tokens via `TOKEN_PROGRAM_ID`
   - 🆕 Token-2022 via `TOKEN_2022_PROGRAM_ID`
5. **Metadata Fetching**: Uses Metaplex to get token names/symbols from on-chain metadata

## Notification Examples

### Incoming Transaction
```
🟢 📥 INCOMING Transaction

📍 Wallet: "My Main Wallet"
💰 Value: 1.5000 XN
📦 Slot: 234567890
⏰ Time: Thu, 01 Jan 2026 12:00:00 GMT

From: 9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde

🔗 View Transaction | View Wallet
```

### Balance Change
```
📈 Balance Change Detected

📍 Wallet: "My Main Wallet"
💰 Balance increased:
   Old: 1.000000 XN
   New: 2.500000 XN
   🟢 +1.500000 XN

🔗 View Wallet
```

## About X1 Blockchain

X1 is an **SVM-based blockchain** (Solana Virtual Machine), which means:
- Uses the same address format as Solana (base58 public keys)
- Compatible with Solana tools and libraries (`@solana/web3.js`)
- Supports SPL tokens and Token-2022
- Native token is **XN**

## License

MIT

## Support

If you find this bot useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 🔧 Contributing improvements
