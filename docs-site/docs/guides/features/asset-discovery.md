# Asset Discovery System

This document outlines the comprehensive asset discovery system implemented in the Stellar Dev Dashboard, featuring popular asset listings, issuer verification, asset metadata, trustline suggestions, and asset performance analytics.

## Overview

The Asset Discovery System provides developers and users with powerful tools to:
- **Discover Assets**: Browse and search through all available Stellar assets
- **Verify Issuers**: Check issuer credentials and domain verification
- **Analyze Performance**: View market data and asset statistics
- **Get Recommendations**: Receive personalized trustline suggestions
- **Make Informed Decisions**: Access comprehensive asset metadata

## Core Features

### 🔍 Asset Search & Discovery
- **Advanced Search**: Search by asset code, issuer address, or domain
- **Smart Filters**: Filter by verification status, account count, domain presence
- **Popular Assets**: Curated list of well-established assets
- **Real-time Data**: Live asset statistics and holder counts

### ✅ Issuer Verification
- **Domain Verification**: Automatic stellar.toml validation
- **Verification Levels**: None, Domain, Manual, Full verification
- **Issuer Profiles**: Organization information, contact details, social links
- **Trust Indicators**: Visual badges for verified vs unverified assets

### 📊 Asset Analytics
- **Market Data**: Price tracking, 24h volume, market cap
- **Network Statistics**: Holder count, total supply, distribution
- **Performance Metrics**: Price changes, trading activity
- **Historical Data**: Asset growth and adoption trends

### 💡 Trustline Recommendations
- **Personalized Suggestions**: Based on account activity and holdings
- **Risk Assessment**: Automated scoring with risk factors
- **Recommendation Reasons**: Clear explanations for suggestions
- **Safety Warnings**: Alerts for high-risk assets

## System Architecture

### Core Components

#### 1. AssetDiscovery.jsx
Main container component managing:
- Tab navigation (Popular, All Assets, Search, Recommendations)
- Search functionality
- Filter management
- Data loading and pagination

#### 2. AssetSearch.jsx
Advanced search component featuring:
- Real-time search with debouncing
- Keyboard shortcuts (Ctrl/Cmd + K)
- Clear and submit actions
- Mobile-optimized input

#### 3. AssetFilters.jsx
Comprehensive filtering system:
- Sort options (accounts, supply, code)
- Quick filters (verified only, has domain)
- Advanced filters (account ranges, asset types)
- Active filter indicators

#### 4. AssetList.jsx
Responsive asset display:
- Grid layout with responsive columns
- Infinite scroll/pagination
- Loading states and empty states
- Performance optimized rendering

#### 5. AssetCard.jsx
Detailed asset information cards:
- Asset metadata and verification status
- Market data and statistics
- Issuer information
- Expandable details
- Risk indicators (authorization flags)

#### 6. PopularAssets.jsx
Curated popular assets showcase:
- Featured asset grid
- Educational information cards
- Quick action buttons
- Community-driven selections

#### 7. TrustlineRecommendations.jsx
Personalized asset suggestions:
- Account analysis
- Recommendation scoring
- Risk factor assessment
- Detailed explanations

### Backend Integration (stellar.ts)

#### Asset Data Types
```typescript
interface AssetInfo {
  code: string
  issuer: string
  domain?: string
  name?: string
  description?: string
  is_verified?: boolean
  num_accounts?: number
  amount?: string
  flags?: AssetFlags
}

interface AssetStats {
  asset: AssetInfo
  num_accounts: number
  amount: string
  accounts: AccountBreakdown
  balances: BalanceBreakdown
}

interface IssuerInfo {
  account_id: string
  domain?: string
  name?: string
  verification_level: VerificationLevel
  toml_url?: string
}
```

#### Key Functions

**fetchAssets(network, filters)**
- Retrieves assets from Horizon API
- Applies client-side filtering
- Supports pagination and sorting
- Returns formatted asset data

**fetchIssuerInfo(issuerAccount, network)**
- Loads issuer account information
- Fetches and parses stellar.toml
- Determines verification level
- Extracts organization metadata

**getTrustlineRecommendations(accountId, network)**
- Analyzes account holdings
- Scores potential assets
- Identifies risk factors
- Returns ranked recommendations

**searchAssets(query, network, filters)**
- Performs fuzzy asset search
- Enhances results with issuer data
- Supports advanced filtering
- Optimized for performance

## Asset Verification System

### Verification Levels

1. **None** (⚠️ Unverified)
   - No domain or manual verification
   - Higher risk profile
   - Limited metadata available

2. **Domain** (✅ Verified)
   - Valid stellar.toml file
   - Domain ownership confirmed
   - Organization information available

3. **Manual** (✅ Verified)
   - Human-reviewed assets
   - Additional due diligence
   - Enhanced trust indicators

4. **Full** (✅ Verified)
   - Complete verification process
   - Regulatory compliance
   - Maximum trust level

### Stellar.toml Integration

The system automatically fetches and parses stellar.toml files to extract:
- Organization information (name, description, logo)
- Contact details (support email, website)
- Social media links (Twitter, GitHub, etc.)
- Asset-specific metadata
- Compliance information

## Recommendation Algorithm

### Scoring Factors

**Positive Factors (+points)**
- High holder count (30 points for >1000 holders)
- Domain verification (25 points)
- Asset verification (20 points)
- Active trading pairs (15 points)
- Established issuer (10 points)

**Risk Factors (-points)**
- AUTH_REQUIRED flag (-10 points)
- AUTH_REVOCABLE flag (-15 points)
- AUTH_CLAWBACK_ENABLED flag (-20 points)
- No domain verification (-15 points)
- Low holder count (-10 points)

### Recommendation Categories

1. **Excellent (80-100 points)**
   - Highly recommended
   - Low risk profile
   - Well-established assets

2. **Good (60-79 points)**
   - Recommended with minor considerations
   - Moderate risk factors
   - Growing adoption

3. **Fair (40-59 points)**
   - Consider with caution
   - Notable risk factors
   - Limited track record

4. **Poor (<40 points)**
   - Not recommended
   - High risk profile
   - Insufficient verification

## Popular Assets Curation

### Selection Criteria
- **Adoption**: High number of trustlines and active usage
- **Verification**: Domain-verified issuers with stellar.toml
- **Utility**: Clear use case and value proposition
- **Stability**: Consistent performance and reliability
- **Community**: Strong community support and recognition

### Current Popular Assets
- **USDC**: USD Coin stablecoin by Centre
- **AQUA**: Aqua Network native token
- **yXLM**: Yield-bearing XLM by UltraStellar
- **MOBI**: Mobius Network token

## Mobile Optimization

### Responsive Design
- **Mobile-first approach**: Optimized for touch interfaces
- **Adaptive layouts**: Single column on mobile, grid on desktop
- **Touch targets**: 44px minimum for better usability
- **Optimized typography**: Larger fonts on mobile devices

### Mobile-Specific Features
- **Swipe gestures**: Navigate between tabs
- **Collapsible sections**: Expandable asset details
- **Simplified filters**: Streamlined mobile filter interface
- **Keyboard optimization**: Prevents zoom on iOS inputs

## Performance Optimizations

### Data Loading
- **Lazy loading**: Load asset details on demand
- **Pagination**: Efficient data fetching with cursors
- **Caching**: Client-side caching of asset metadata
- **Debouncing**: Optimized search input handling

### Rendering
- **Virtual scrolling**: Handle large asset lists efficiently
- **Memoization**: Prevent unnecessary re-renders
- **Image optimization**: Lazy load asset logos and images
- **Bundle splitting**: Code splitting for better load times

## Security Considerations

### Data Validation
- **Input sanitization**: Prevent XSS attacks
- **API validation**: Verify Horizon API responses
- **TOML parsing**: Safe parsing of stellar.toml files
- **URL validation**: Validate external links

### Privacy Protection
- **No tracking**: No user data collection
- **Local storage**: Minimal local data storage
- **HTTPS only**: Secure connections for all requests
- **Content Security Policy**: Prevent unauthorized scripts

## Usage Examples

### Basic Asset Search
```jsx
import { AssetDiscovery } from './components/assets';

function MyApp() {
  return (
    <AssetDiscovery />
  );
}
```

### Custom Asset Card
```jsx
import { AssetCard } from './components/assets';

function CustomAssetDisplay({ asset, network }) {
  return (
    <AssetCard 
      asset={asset}
      network={network}
      onClick={() => handleAssetClick(asset)}
    />
  );
}
```

### Trustline Recommendations
```jsx
import { TrustlineRecommendations } from './components/assets';

function RecommendationsPage({ accountId, network }) {
  return (
    <TrustlineRecommendations
      accountId={accountId}
      network={network}
    />
  );
}
```

## API Integration

### Horizon API Endpoints
- `/assets` - Asset listings and statistics
- `/accounts/{account}` - Account information for issuers
- `/paths/strict-send` - Payment path finding
- `/paths/strict-receive` - Reverse payment paths

### External APIs
- **Stellar.toml files** - Issuer verification and metadata
- **Price APIs** - Market data integration (CoinGecko, etc.)
- **Domain validation** - HTTPS certificate verification

## Testing Strategy

### Unit Tests
- Asset data parsing and validation
- Recommendation algorithm accuracy
- Filter and search functionality
- Component rendering and interactions

### Integration Tests
- Horizon API integration
- Stellar.toml fetching and parsing
- End-to-end user workflows
- Cross-browser compatibility

### Performance Tests
- Large dataset handling
- Search performance benchmarks
- Mobile device testing
- Network condition simulation

## Future Enhancements

### Planned Features
- **Asset comparison tool**: Side-by-side asset analysis
- **Portfolio tracking**: Track asset performance over time
- **Price alerts**: Notifications for price changes
- **Advanced analytics**: Technical analysis tools
- **Social features**: Community ratings and reviews

### Integration Opportunities
- **DEX integration**: Direct trading from asset cards
- **Wallet integration**: One-click trustline creation
- **DeFi protocols**: Yield farming opportunities
- **Cross-chain assets**: Bridge asset information
- **Regulatory data**: Compliance and legal information

This comprehensive asset discovery system provides users with all the tools they need to safely and effectively discover, analyze, and interact with Stellar assets while maintaining the highest standards of security and user experience.
